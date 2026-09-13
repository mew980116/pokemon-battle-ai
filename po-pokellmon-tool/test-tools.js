// po-pokellmon-tool/test-tools.js — 测试 LLM 是否主动调用各类 tool（calc_stats / get_my_stats / calc_damage / run_js）
//
// 构造一个明确引导的场景，跑完整 function-calling loop，打印每轮 tool 调用 + 结果 + 最终决策。
// 运行：node po-pokellmon-tool/test-tools.js
//
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

// mock state：带 myStats（我方实际 ev/iv/nature/level），供 get_my_stats 读取
const MOCK_STATE = {
    turn: 1,
    myStats: [
        { slot: 0, name: 'Garchomp', numRef: 445, level: 100, ev: [0, 252, 0, 0, 0, 252], iv: [31, 31, 31, 31, 31, 31], nature: 3 },
        { slot: 1, name: 'Blissey', numRef: 242, level: 100, ev: [252, 0, 252, 0, 0, 0], iv: [31, 31, 31, 31, 31, 31], nature: 5 }
    ]
};

function getApiKey() {
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
    const candidates = [path.join(__dirname, 'apikey.txt'), path.join(__dirname, '..', 'po-pokellmon', 'apikey.txt')];
    for (const c of candidates) {
        try {
            const k = fs.readFileSync(c, 'utf8').trim();
            if (k) return k;
        } catch (e) {}
    }
    return null;
}

const SYSTEM_PROMPT = require('../po-pokellmon/prompts.js').BATTLE_TIPS +
    ' You have tools available. Use them to compute type matchups, damage ranges, stats, or run small JS snippets before deciding.';

const USER_PROMPT =
    'Your current pokemon: Garchomp (Ground/Dragon), HP 100%. ' +
    'Opponent current pokemon: Dragonite (Dragon/Flying), HP 100%.\n\n' +
    'The opponent Dragonite is known to run Dragon Dance (boosts Attack and Speed by +1 each). ' +
    'Its typical spread is 252 Attack / 252 Speed with an Adamant nature.\n\n' +
    'Before deciding, analyze the speed relationship carefully:\n' +
    '1. Call get_my_stats with poke "Garchomp" to read your actual Garchomp stats.\n' +
    '2. Call calc_stats to compute Dragonite current Speed (level 100, 252 Spe EVs, 31 IV, Adamant nature, no boosts, return only "spe").\n' +
    '3. Call calc_stats to compute Dragonite Speed AFTER one Dragon Dance (same spread but boosts {"spe":1}, return only "spe").\n\n' +
    'Then determine: do you outspeed it NOW? Will it outspeed you after one Dragon Dance? ' +
    'Output your final decision as a JSON object: {"choice": 1} (1=Earthquake).';

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

async function main() {
    console.log('=== test-tools: 验证 LLM 是否调用 calc_stats / get_my_stats ===\n');
    console.log('model=' + MODEL + ' thinking=' + (THINKING_ENABLED ? REASONING_EFFORT : 'off'));
    console.log('system_prompt_len=' + SYSTEM_PROMPT.length + ' user_prompt_len=' + USER_PROMPT.length + '\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT }
    ];

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        const t0 = Date.now();
        let res;
        try {
            res = await callDeepSeek(messages);
        } catch (e) {
            console.log('round ' + round + ' ERROR ' + (Date.now() - t0) + 'ms: ' + e.message);
            break;
        }
        const ms = Date.now() - t0;
        if (res.status !== 200) {
            console.log('round ' + round + ' HTTP ' + res.status + ' ' + ms + 'ms: ' + res.body.slice(0, 200));
            break;
        }

        const usage = extractUsage(res.body);
        const msg = extractMessage(res.body);
        const toolCalls = msg.tool_calls;
        const tok = usage ? ('prompt=' + usage.prompt_tokens + ' comp=' + usage.completion_tokens) : '';

        if (toolCalls && toolCalls.length) {
            console.log('round ' + round + ' ' + ms + 'ms | ' + tok + ' | LLM 调用 ' + toolCalls.length + ' 个 tool:');
            messages.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls });
            for (const tc of toolCalls) {
                let args = {};
                try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
                const result = tools.runTool(tc.function.name, args, { state: MOCK_STATE, notes: { pokemon: {}, turns: {} }, turn: 1 });
                console.log('    - ' + tc.function.name + ' ' + JSON.stringify(args));
                console.log('      => ' + JSON.stringify(result).slice(0, 400));
                messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
            }
            console.log('');
            continue;
        }

        // 最终答案
        console.log('round ' + round + ' ' + ms + 'ms | ' + tok + ' | FINAL reply:');
        console.log(msg.content || '(empty)');
        console.log('\n=== done (round ' + round + ') ===');
        break;
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
