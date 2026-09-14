// po-pokellmon-tool/test-5-scenes.js — 从最近 5 场 log 各取 1 个场面，重放给 LLM，看它怎么应对（输出 choice + 理由）
//
// 场面覆盖：序盘 / 优势中盘 / 劣势中盘 / 尾盘优势 / 尾盘劣势。
// 每个场面用「当时的 state + 当时的 Available actions」，但使用当前 server 的 system prompt（含 13 个 tool + battle_tips），
// 并把结尾指令改成「先给理由，再输出 {"choice":N,"reason":"..."}」。
//
// 运行：node po-pokellmon-tool/test-5-scenes.js
// 注意：只做测试，不写日志、不推 view。apikey 复用 po-pokellmon-tool/apikey.txt 或 po-pokellmon/apikey.txt。

const https = require('https');
const fs = require('fs');
const path = require('path');
const tools = require('./tools.js');

const MODEL = 'deepseek-v4-flash';
const THINKING_ENABLED = true;
const REASONING_EFFORT = 'low';
const MAX_ROUNDS = 15;
const TIMEOUT_MS = 240000;

// 当前 server 的 system prompt（与 server.js 0.3.14 一致）
const SYSTEM_PROMPT = require('../po-pokellmon/prompts.js').BATTLE_TIPS +
    ' You may call tools to compute type matchups, apply stat boosts, read the battle history, or record/read your notes before deciding. ' +
    'IMPORTANT: use save_observation to record what you learn about each opposing pokemon (revealed moves, likely item/ability, damage estimate), and save_strategy to record your current plan each turn, so you can recall them in later turns. ' +
    'Before committing to a move, use calc_damage to check whether your moves can KO or how much damage they deal (it returns the 0.85x and 1.0x random rolls and the % of the defender max HP). ' +
    'For speed comparison, use get_my_stats to read your own pokemon actual stats, and calc_stats to compute any pokemon stats under a given EV/IV/nature/boost (e.g. estimate whether you outspeed the opponent). ' +
    'Record the speed matchup via save_observation using this consistent format so you can recall it later without recomputing: "Speed:<current>(<spread>)|<boostMove>+<stage>:<boosted>|<reference>:<speed>", e.g. "Speed:259(252Spe Adamant)|DragonDance+1:388|Garchomp:303". ' +
    'Each turn, before deciding, review the previous turn(s) battle log and infer any speed observation from it (who moved first, any speed boost like Dragon Dance/Agility, speed drop, paralysis, Tailwind, or Choice Scarf clues), then record it via save_observation so your speed-line notes stay up to date. ' +
    'For strategic guidance (how to play in a given situation), call battle_tips with the relevant tip names, e.g. ["优势局"] when you are ahead, ["劣势局"] when behind, ["残局"] in the endgame, ["太晶"] before terastallizing, ["牺牲"] when deciding a sacrifice, ["预知未来"]/["撒钉"]/["强化手"] etc. You may pass up to 10 tip names at once. ' +
    'After using calc_damage, compare its result with the actual damage shown in the battle log (via get_battle_history). If the calculated damage differs from the observed damage by a large factor (roughly 2x or more) and no obvious modifier explains it, call submit_feedback to report the discrepancy (state which attacker/move/defender and the expected vs actual damage). ' +
    'If no built-in tool covers a computation you need (e.g. speed comparison, batch damage, custom scoring), you may write a small synchronous JS snippet and run it via run_js; it exposes data/typeMul/effStat/resolvePokemon/resolveMove/calcDamage and print/console.log. Prefer the built-in tools first and use run_js only as a fallback. ' +
    'If you need battle information or computation that no available tool provides, call submit_feedback to tell us what tool you wish you had.';

const SCENES = [
    { label: '序盘', file: 'deepseek_tool_20260913_battle32.log', turn: 0, pick: 0 },
    { label: '优势·中盘', file: 'deepseek_tool_20260913_battle30.log', turn: 2, pick: 0 },
    { label: '劣势·中盘', file: 'deepseek_tool_20260914_battle34.log', turn: 9, pick: 0 },
    { label: '尾盘·优势', file: 'deepseek_tool_20260913_battle31.log', turn: 25, pick: 0 },
    { label: '尾盘·劣势', file: 'deepseek_tool_20260914_battle33.log', turn: 24, pick: 1 }
];

function getApiKey() {
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
    const candidates = [path.join(__dirname, 'apikey.txt'), path.join(__dirname, '..', 'po-pokellmon', 'apikey.txt')];
    for (const c of candidates) {
        try { const k = fs.readFileSync(c, 'utf8').trim(); if (k) return k; } catch (e) {}
    }
    return null;
}

function findScene(scene) {
    const p = path.join(__dirname, 'logs', scene.file);
    const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
    let seen = 0;
    for (const line of lines) {
        let o;
        try { o = JSON.parse(line); } catch (e) { continue; }
        if (!o.state || !o.state.me || !o.state.opp) continue;
        if (o.state.turn !== scene.turn) continue;
        if (seen === scene.pick) return { state: o.state, prompt: o.prompt || '', reply: o.reply || '', action: o.action || null };
        seen++;
    }
    return null;
}

function buildUserPrompt(originalPrompt) {
    // 去掉原结尾「Choose the best action. Output ONLY...」指令，换成要求输出理由的版本
    const cut = originalPrompt.indexOf('Choose the best action.');
    const body = (cut >= 0 ? originalPrompt.slice(0, cut) : originalPrompt).trim();
    return body +
        '\n\nChoose the best action. Think step by step: consider the type matchup, speed order, likely damage (call calc_damage if helpful), and your win condition.' +
        ' Then output a JSON object: {"choice": <number>, "reason": "<one or two sentences explaining why>"}.\n';
}

function describeState(state) {
    const me = state.me, opp = state.opp;
    const myRem = (state.myTeam || []).filter(t => !t.ko).length;
    const oppRem = state.oppRemaining;
    const myBoosts = (me.boosts && me.boosts.length) ? ' [' + me.boosts.join(',') + ']' : '';
    return '我 ' + me.name + ' ' + me.types.join('/') + ' ' + me.hpPct + '%' + myBoosts +
        ' (剩' + myRem + '只)  vs  敌 ' + opp.name + ' ' + opp.types.join('/') + ' ' + opp.hpPct + '%' +
        ' (剩' + oppRem + '只)  天气:' + (state.weather || '无') + ' 场地:' + (state.terrain || '无');
}

function callDeepSeek(messages) {
    return new Promise((resolve, reject) => {
        const apiKey = getApiKey();
        if (!apiKey) { reject(new Error('missing apikey')); return; }
        const payloadObj = { model: MODEL, messages: messages, stream: false, tools: tools.TOOL_DEFS };
        if (THINKING_ENABLED) {
            payloadObj.thinking = { type: 'enabled' };
            if (REASONING_EFFORT) payloadObj.reasoning_effort = REASONING_EFFORT;
        }
        const payload = JSON.stringify(payloadObj);
        const req = https.request({
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let d = '';
            res.on('data', (c) => { d += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('deepseek timeout')));
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function extractMessage(data) {
    try {
        const o = JSON.parse(data);
        if (o.choices && o.choices[0] && o.choices[0].message) return o.choices[0].message;
        return { content: data };
    } catch (e) { return { content: data }; }
}

function extractUsage(data) {
    try { return JSON.parse(data).usage || null; } catch (e) { return null; }
}

async function runScene(scene, index, total) {
    console.log('\n' + '='.repeat(90));
    console.log('【' + (index + 1) + '/' + total + '】' + scene.label + '  (' + scene.file + ' T' + scene.turn + ')');
    const found = findScene(scene);
    if (!found) { console.log('  !! 未找到场面'); return; }
    const state = found.state;
    console.log('场景：' + describeState(state));
    console.log('历史（近几回合）：');
    (state.fullHistory || state.history || []).slice(-4).forEach(h => console.log('   ' + h.trim()));
    console.log('原 LLM 当时选择：' + (found.reply || '(无)') + (found.action ? '  action=' + JSON.stringify(found.action) : ''));

    const userPrompt = buildUserPrompt(found.prompt);
    const notes = { pokemon: {}, turns: {} };   // 本轮持久笔记，供 save/get observation/strategy 复用
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
    ];

    let finalText = null;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
        const t0 = Date.now();
        let res;
        try { res = await callDeepSeek(messages); }
        catch (e) { console.log('  round ' + round + ' ERROR ' + (Date.now() - t0) + 'ms: ' + e.message); break; }
        const ms = Date.now() - t0;
        if (res.status !== 200) {
            console.log('  round ' + round + ' HTTP ' + res.status + ' ' + ms + 'ms: ' + res.body.slice(0, 300));
            break;
        }
        const usage = extractUsage(res.body);
        const msg = extractMessage(res.body);
        const toolCalls = msg.tool_calls;
        const tok = usage ? ('tok ' + usage.prompt_tokens + '/' + usage.completion_tokens) : '';

        if (toolCalls && toolCalls.length) {
            console.log('  [round ' + round + ' ' + ms + 'ms ' + tok + '] 调用 ' + toolCalls.length + ' 个 tool:');
            messages.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls });
            for (const tc of toolCalls) {
                let args = {};
                try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
                let result;
                try { result = tools.runTool(tc.function.name, args, { state: state, notes: notes, turn: state.turn }); }
                catch (e) { result = { error: String(e.message || e) }; }
                console.log('     - ' + tc.function.name + ' ' + JSON.stringify(args).slice(0, 220));
                console.log('       => ' + JSON.stringify(result).slice(0, 300));
                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
            }
            continue;
        }

        finalText = msg.content || '';
        console.log('  [round ' + round + ' ' + ms + 'ms ' + tok + '] 最终答复：');
        console.log('  ' + finalText.split('\n').map(l => '  ' + l).join('\n'));
        break;
    }
    if (finalText === null) console.log('  !! 未得到最终答复');
}

async function main() {
    console.log('=== test-5-scenes: 5 场 log 各取 1 场面重放 LLM ===');
    console.log('model=' + MODEL + ' thinking=' + (THINKING_ENABLED ? REASONING_EFFORT : 'off') +
        ' max_rounds=' + MAX_ROUNDS + ' tools=' + tools.TOOL_DEFS.length);
    for (let i = 0; i < SCENES.length; i++) {
        await runScene(SCENES[i], i, SCENES.length);
    }
    console.log('\n=== 完成 ===');
}

main().catch((e) => { console.error(e); process.exit(1); });
