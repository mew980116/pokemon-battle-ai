// po-pokellmon-tool/server.js — 路线 3：思考 + tool（function calling）
//
// 接收 PO 采集的战场状态 → 拼 prompt + tools → DeepSeek（思考 high）多轮 function calling
// → DS 决策前动态调用 tool（类型克制 / 能力等级等确定性计算）→ 最终返回动作。
//
// 运行：
//   $env:DEEPSEEK_API_KEY = "sk-..."   # 或复用 po-pokellmon/apikey.txt
//   node po-pokellmon-tool/server.js
//
// Endpoints:
//   GET /health              -> "ok"
//   GET /choice?state=JSON   -> 返回 {"type":"move"/"switch", ...}

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var path = require('path');
var tools = require('./tools.js');

var PORT = Number(process.env.POKELLMON_TOOL_PORT) || 8092;
var HOST = '127.0.0.1';
var SERVER_VERSION = '0.3.13';   // tool 分支版本（改动时 bump，随日志记录）

// ==== DeepSeek 模型参数（tool 分支：思考 + tool，强度 low）====
var MODEL = 'deepseek-v4-flash';
var THINKING_ENABLED = true;            // 思考模式（非思考拉垮且不调 tool）
var REASONING_EFFORT = 'low';           // 思考强度 low（high 太慢，先试 low）
var MAX_TOKENS = null;                  // 不限制输出 token（思考链 + 最终答案）
var TIMEOUT_MS = 240000;                // 放宽：240s（tool 多轮往返慢）
var MAX_TOOL_ROUNDS = 15;               // 最多 function calling 轮数，超过则 fallback
var RETRY_DELAYS = [2000, 5000, 10000]; // 单次请求失败后的重试延迟：第1次2s、第2次5s、第3次10s（第3次降级 no think），再失败 fallback

var SYSTEM_PROMPT = require('../po-pokellmon/prompts.js').BATTLE_TIPS +
    ' You may call tools to compute type matchups, apply stat boosts, read the battle history, or record/read your notes before deciding. ' +
    'IMPORTANT: use save_observation to record what you learn about each opposing pokemon (revealed moves, likely item/ability, damage estimate), and save_strategy to record your current plan each turn, so you can recall them in later turns. ' +
    'Before committing to a move, use calc_damage to check whether your moves can KO or how much damage they deal (it returns the 0.85x and 1.0x random rolls and the % of the defender max HP). ' +
    'For speed comparison, use get_my_stats to read your own pokemon actual stats, and calc_stats to compute any pokemon stats under a given EV/IV/nature/boost (e.g. estimate whether you outspeed the opponent). ' +
    'Record the speed matchup via save_observation using this consistent format so you can recall it later without recomputing: "Speed:<current>(<spread>)|<boostMove>+<stage>:<boosted>|<reference>:<speed>", e.g. "Speed:259(252Spe Adamant)|DragonDance+1:388|Garchomp:303". ' +
    'Each turn, before deciding, review the previous turn(s) battle log and infer any speed observation from it (who moved first, any speed boost like Dragon Dance/Agility, speed drop, paralysis, Tailwind, or Choice Scarf clues), then record it via save_observation so your speed-line notes stay up to date. ' +
    'After using calc_damage, compare its result with the actual damage shown in the battle log (via get_battle_history). If the calculated damage differs from the observed damage by a large factor (roughly 2x or more) and no obvious modifier explains it, call submit_feedback to report the discrepancy (state which attacker/move/defender and the expected vs actual damage). ' +
    'If no built-in tool covers a computation you need (e.g. speed comparison, batch damage, custom scoring), you may write a small synchronous JS snippet and run it via run_js; it exposes data/typeMul/effStat/resolvePokemon/resolveMove/calcDamage and print/console.log. Prefer the built-in tools first and use run_js only as a fallback. ' +
    'If you need battle information or computation that no available tool provides, call submit_feedback to tell us what tool you wish you had.';

// 复用 po-pokellmon 知识库
var KNOWLEDGE_DIR = path.join(__dirname, '..', 'po-pokellmon', 'knowledge');
var MOVES = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, 'moves.json'), 'utf8'));
var TYPECHART = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, 'typechart.json'), 'utf8'));
var TYPE_NAMES = TYPECHART.types;
var CHART = TYPECHART.chart;

var LOG_DIR = path.join(__dirname, 'logs');

function getApiKey() {
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
    // 优先本目录 apikey.txt，其次复用 po-pokellmon/apikey.txt
    var candidates = [path.join(__dirname, 'apikey.txt'), path.join(__dirname, '..', 'po-pokellmon', 'apikey.txt')];
    for (var i = 0; i < candidates.length; i++) {
        try {
            var k = fs.readFileSync(candidates[i], 'utf8').trim();
            if (k) return k;
        } catch (e) {}
    }
    return null;
}

function callDeepSeek(messages, noThink, cb) {
    var apiKey = getApiKey();
    if (!apiKey) {
        cb(new Error('missing DEEPSEEK_API_KEY (set env var or create apikey.txt)'));
        return;
    }
    var payloadObj = {
        model: MODEL,
        messages: messages,
        stream: false,
        tools: tools.TOOL_DEFS
    };
    var mt = MAX_TOKENS;
    if (mt) payloadObj.max_tokens = mt;
    if (THINKING_ENABLED && !noThink) {
        payloadObj.thinking = { type: 'enabled' };
        if (REASONING_EFFORT) payloadObj.reasoning_effort = REASONING_EFFORT;
    } else {
        payloadObj.thinking = { type: 'disabled' };
    }
    var payload = JSON.stringify(payloadObj);
    var req = https.request({
        hostname: 'api.deepseek.com',
        path: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
            'Content-Length': Buffer.byteLength(payload)
        }
    }, function (res) {
        var data = '';
        res.on('data', function (c) { data += c; });
        res.on('end', function () { cb(null, res.statusCode, data); });
    });
    req.setTimeout(TIMEOUT_MS, function () {
        req.destroy(new Error('deepseek timeout'));
    });
    req.on('error', function (e) { cb(e); });
    req.write(payload);
    req.end();
}

// 提取完整 message（含 tool_calls）
function extractMessage(data) {
    try {
        var obj = JSON.parse(data);
        if (obj.choices && obj.choices[0] && obj.choices[0].message) {
            return obj.choices[0].message;
        }
        return { content: data };
    } catch (e) {
        return { content: data };
    }
}

function extractUsage(data) {
    try {
        var obj = JSON.parse(data);
        if (obj.usage) return obj.usage;
        return null;
    } catch (e) {
        return null;
    }
}

function typeIndex(name) {
    return TYPE_NAMES.indexOf(name);
}

function damageMultiplier(attackType, defendTypes) {
    var ai = typeIndex(attackType);
    if (ai < 0) return 1;
    if (!defendTypes || !defendTypes.length) return 1;
    var m = CHART[ai][typeIndex(defendTypes[0])];
    if (defendTypes[1] && typeIndex(defendTypes[1]) >= 0) {
        m *= CHART[ai][typeIndex(defendTypes[1])];
    }
    return m;
}

function buildDefenderAdvantage(oppName, oppTypes, myMoveTypes) {
    var buckets = { 4: [], 2: [], 0.5: [], 0.25: [], 0: [] };
    var seen = {};
    for (var i = 0; i < myMoveTypes.length; i++) {
        var at = myMoveTypes[i];
        if (!at || seen[at]) continue;
        seen[at] = true;
        var m = damageMultiplier(at, oppTypes);
        if (buckets[m] !== undefined) buckets[m].push(at);
    }
    var descs = [];
    if (buckets[4].length) descs.push(buckets[4].join(',') + ' deal 4x damage');
    if (buckets[2].length) descs.push(buckets[2].join(',') + ' deal 2x damage');
    if (buckets[0.5].length) descs.push(buckets[0.5].join(',') + ' only deal 0.5x damage');
    if (buckets[0.25].length) descs.push(buckets[0.25].join(',') + ' only deal 0.25x damage');
    if (buckets[0].length) descs.push(buckets[0].join(',') + ' have no effect');
    if (descs.length) return oppName + ' as defender, ' + descs.join('; ') + ' to ' + oppName + '\n';
    return '';
}

function moveInfo(m) {
    var num = m.num;
    var base = (MOVES[String(num)] || MOVES[num]) || {};
    var power = (m.power !== undefined && m.power !== null) ? m.power : (base.power || 0);
    var acc = base.accuracy || 0;
    var effect = base.effect || '';
    return { name: m.name || base.name || '?', type: m.type || '?', power: power, pp: m.pp, acc: acc, effect: effect };
}

// 对手 bench 槽位详情（[Name,HP%,status] / [Name,fainted] / [???]）
function buildOppBench(state) {
    var team = state.oppTeam || [];
    var parts = [];
    for (var i = 1; i < team.length; i++) {
        var t = team[i];
        if (t.ko) {
            parts.push('[' + (t.name || '???') + ',fainted]');
        } else if (t.revealed) {
            var s = '[' + t.name;
            if (t.hpPct !== null && t.hpPct !== undefined) s += ',' + t.hpPct + '%';
            if (t.status) s += ',' + t.status;
            s += ']';
            parts.push(s);
        } else {
            parts.push('[???]');
        }
    }
    return parts.join('');
}

// 跨回合笔记存储（按 battleId 隔离）：{ battleId: { pokemon:{name:text}, turns:{turn:text} } }
var notesStore = {};
function getNotes(battleId) {
    var id = (battleId !== undefined && battleId !== null) ? String(battleId) : 'unknown';
    if (!notesStore[id]) notesStore[id] = { pokemon: {}, turns: {} };
    return notesStore[id];
}

function buildPrompt(state, notes) {
    var p = '';
    var opp = state.opp || {};
    var me = state.me || {};
    var bench = state.bench || [];
    var oppTypes = opp.types || [];

    // 最后 2 回合战报显式贴进 prompt；更早的走 get_battle_history tool 按需读
    var srcHist = (state.fullHistory && state.fullHistory.length) ? state.fullHistory : (state.history || []);
    var histN = srcHist.length;
    var recent = [];
    for (var i = Math.max(0, histN - 2); i < histN; i++) {
        recent.push(srcHist[i]);
    }
    if (recent.length) {
        p += 'Recent turns:\n' + recent.join('\n') + '\n';
    }
    if (histN > 0) {
        p += 'Earlier battle history (' + histN + ' turns) is available via the get_battle_history tool.\n';
    }

    // 天气/场地/入场陷阱：固定加载，无则写 None（避免 LLM 误以为信息缺失）
    var mh = state.myHazards || [];
    var oh = state.oppHazards || [];
    p += 'Weather:' + (state.weather || 'None') +
        ' | Terrain:' + (state.terrain || 'None') +
        ' | My hazards:' + (mh.length ? '[' + mh.join(',') + ']' : 'None') +
        ' | Opp hazards:' + (oh.length ? '[' + oh.join(',') + ']' : 'None') + '\n';

    // 默认注入笔记：对手场上这只的观察 + 最近 2 回合思路
    if (notes) {
        var noteLines = [];
        var pn = notes.pokemon || {};
        if (opp.name && pn[opp.name]) {
            noteLines.push('Observation on ' + opp.name + ': ' + pn[opp.name]);
        }
        var tn = notes.turns || {};
        var tkeys = Object.keys(tn).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        var recentT = tkeys.slice(-2);
        for (var ti = 0; ti < recentT.length; ti++) {
            noteLines.push('Strategy note (turn ' + recentT[ti] + '): ' + tn[recentT[ti]]);
        }
        if (noteLines.length) {
            p += 'Your notes:\n' + noteLines.join('\n') + '\n';
        }
    }

    if (opp.name) {
        var oppStatus = opp.status ? 'Status:' + opp.status + ',' : '';
        var oppBoosts = (opp.boosts && opp.boosts.length) ? 'Boosts:[' + opp.boosts.join(',') + '],' : '';
        p += 'Opponent current pokemon:' + opp.name + ':Type:' + oppTypes.join('&') + ',HP:' + (opp.hpPct || 0) + '%,' + oppStatus + oppBoosts + '\n';
        if (opp.fainted) {
            p += 'NOTE: The opponent current pokemon has fainted and will send out a replacement this turn.\n';
        }
        // 对手后备（bench）槽位详情
        var ob = buildOppBench(state);
        if (ob) p += 'Opponent bench: ' + ob + '\n';
        // 对手已暴露招式（未露的写「未知」，始终补满 4 个槽位）
        var om = '';
        var oppMoves = opp.moves || [];
        for (var i = 0; i < 4; i++) {
            if (i < oppMoves.length) {
                om += '[' + oppMoves[i].name + ',' + oppMoves[i].type + '],';
            } else {
                om += '[未知,?],';
            }
        }
        p += 'Opponent revealed moves: ' + om + '\n';
    }

    if (me.name) {
        var meStatus = me.status ? 'Status:' + me.status + ',' : '';
        var meBoosts = (me.boosts && me.boosts.length) ? 'Boosts:[' + me.boosts.join(',') + '],' : '';
        var meAbi = me.ability ? 'Ability:' + me.ability + ',' : '';
        var meItem = me.item ? 'Item:' + me.item + ',' : '';
        p += 'Your current pokemon:' + me.name + ',Type:' + (me.types || []).join('&') + ',HP:' + (me.hpPct || 0) + '%,' + meAbi + meItem + meStatus + meBoosts + '\n';
    }

    p += '\nAvailable actions (choose one number):\n';
    var idx = 0;
    if (me.moves && me.moves.length) {
        for (var m = 0; m < me.moves.length; m++) {
            var mi = moveInfo(me.moves[m]);
            idx++;
            p += idx + '. ' + mi.name + ':Type:' + mi.type + ',Power:' + mi.power + ',Acc:' + mi.acc + '%';
            if (mi.power > 0) {   // 变化招式（Power:0）不写克制关系
                var mult = damageMultiplier(mi.type, oppTypes);
                var multStr = (mult === 0) ? 'no effect' : (mult + 'x');
                p += ',vs opponent ' + multStr;
            }
            if (mi.effect) p += ',Effect:' + mi.effect;
            p += '\n';
        }
    }
    if (bench.length) {
        for (var s = 0; s < bench.length; s++) {
            idx++;
            var bk = bench[s];
            var sw = idx + '. switch to ' + bk.name + ':Type:' + (bk.types || []).join('&') + ',HP:' + (bk.hpPct || 0) + '%' + (bk.status ? ',Status:' + bk.status : '') + (bk.ability ? ',Ability:' + bk.ability : '') + (bk.item ? ',Item:' + bk.item : '');
            if (bk.moves && bk.moves.length) {
                var ms = '';
                for (var mi = 0; mi < bk.moves.length; mi++) {
                    if (mi > 0) ms += '|';
                    ms += bk.moves[mi].name + ',' + bk.moves[mi].type;
                }
                sw += ',Moves:[' + ms + ']';
            }
            if (state.teamPreview === false && bk.unrevealed) {
                sw += ' [opponent has not seen this pokemon]';
            }
            p += sw + '\n';
        }
    }

    // 已尝试但被 PO 拒绝的项（锁招/禁换人），提示 LLM 换别的
    var bm = state.bannedMoves || [];
    var bs = state.bannedSwitches || [];
    if (bm.length || bs.length) {
        var rej = [];
        for (var r1 = 0; r1 < bm.length; r1++) rej.push('move:' + bm[r1]);
        for (var r2 = 0; r2 < bs.length; r2++) rej.push('switch:' + bs[r2]);
        p += 'CAUTION: you already tried these actions but the game (PO) rejected them, likely due to move-locking (Choice item / Taunt / Disable) or switch-blocking (Shadow Tag etc.). Do not choose them again: ' + rej.join(', ') + '. The system cannot judge whether the other listed choices are actually available; if one of them is also rejected, it will be added to this list next turn.\n';
    }

    return p;
}

function extractNumber(content) {
    var s = String(content || '').trim();
    s = s.replace(/```json/gi, '').replace(/```/g, '').trim();
    var a = s.indexOf('{');
    var b = s.lastIndexOf('}');
    if (a !== -1 && b > a) {
        try {
            var o = JSON.parse(s.substring(a, b + 1));
            if (o && o.choice !== undefined && o.choice !== null) {
                var n = parseInt(o.choice, 10);
                if (!isNaN(n)) return n;
            }
        } catch (e) {}
    }
    var m = s.match(/\d+/);
    if (m) return parseInt(m[0], 10);
    return null;
}

function parseAction(content, state) {
    var num = extractNumber(content);
    if (num === null) return null;
    var me = state.me || {};
    var moves = me.moves || [];
    var bench = state.bench || [];
    if (num >= 1 && num <= moves.length) {
        return { type: 'attack', attackSlot: moves[num - 1].slot };
    }
    var switchIdx = num - moves.length - 1;
    if (switchIdx >= 0 && switchIdx < bench.length) {
        return { type: 'switch', pokeSlot: bench[switchIdx].slot };
    }
    return null;
}

function fallbackMove(state) {
    var me = state.me || {};
    var moves = me.moves || [];
    if (moves.length) return { type: 'attack', attackSlot: moves[0].slot };
    var bench = state.bench || [];
    if (bench.length) return { type: 'switch', pokeSlot: bench[0].slot };
    return { type: 'attack', attackSlot: 0 };
}

function fallbackAction(state, reason) {
    var a = fallbackMove(state) || { type: 'attack', attackSlot: 0 };
    a.fallback = true;
    a.reason = reason || '';
    return a;
}

// 推送决策到可视化 view server（fire-and-forget，失败不影响主流程）
var VIEW_PUSH_PORT = 8093;
function pushToView(entry) {
    try {
        var payload = JSON.stringify(entry);
        var r = http.request({
            hostname: '127.0.0.1',
            port: VIEW_PUSH_PORT,
            path: '/push',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, function (res) { res.resume(); });
        r.on('error', function () {});
        r.setTimeout(2000, function () { r.destroy(); });
        r.write(payload);
        r.end();
    } catch (e) {}
}

function writeLog(entry) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        var d = new Date();
        var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
        var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
        var battleId = (entry.state && entry.state.battleId !== undefined && entry.state.battleId !== null) ? entry.state.battleId : 'unknown';
        var file = path.join(LOG_DIR, 'deepseek_tool_' + d.getFullYear() + mm + dd + '_battle' + battleId + '.log');
        fs.appendFileSync(file, JSON.stringify(entry) + '\n');
        pushToView(entry);
    } catch (e) {
        console.log('[log] write error: ' + e.message);
    }
}

// 对战结束时汇总 LLM 笔记，追加到 log 末尾（供事后复盘）
function appendSummary(battleId, result, winner) {
    var id = (battleId !== undefined && battleId !== null) ? String(battleId) : 'unknown';
    try {
        var notes = getNotes(id);
        var d = new Date();
        var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
        var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
        var file = path.join(LOG_DIR, 'deepseek_tool_' + d.getFullYear() + mm + dd + '_battle' + id + '.log');
        var summary = {
            type: 'summary',
            ts: new Date().toISOString(),
            battleId: id,
            result: result || null,
            winner: (winner !== undefined && winner !== null) ? winner : null,
            notes: notes
        };
        fs.appendFileSync(file, JSON.stringify(summary) + '\n');
        console.log('[summary] battle ' + id + ' notes: ' + Object.keys(notes.pokemon || {}).length + ' pokemon, ' + Object.keys(notes.turns || {}).length + ' turns');
    } catch (e) {
        console.log('[summary] write error: ' + e.message);
    }
    // 对战结束即释放该场笔记，防止长期运行（服务型 BOT 数百上千场）notesStore 内存膨胀
    delete notesStore[id];
}

function handleChoice(res, state) {
    var notes = getNotes(state.battleId);
    var prompt = buildPrompt(state, notes);
    var constraint = 'Choose the best action. Output ONLY a JSON object: {"choice": <number>} where <number> is the number of the action you choose. No other text.\n';
    var userPrompt = prompt + '\n' + constraint;

    console.log('[choice] turn=' + (state.turn || '?') + ' prompt_len=' + userPrompt.length);

    var messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
    ];
    var rounds = 0;
    var startTime = Date.now();
    var toolLog = [];        // 记录每轮 tool 调用
    var lastUsage = null;
    var lastReply = '';

    function logEntry(reply, action) {
        if (!state.log) return;
        writeLog({
            ts: new Date().toISOString(),
            serverVersion: SERVER_VERSION,
            scriptVersion: state.scriptVersion || '',
            account: state.account || '',
            turn: state.turn,
            totalMs: Date.now() - startTime,
            rounds: rounds,
            toolLog: toolLog,
            usage: lastUsage,
            fallback: !!action.fallback,
            state: state,
            systemPrompt: SYSTEM_PROMPT,
            prompt: userPrompt,
            reply: reply,
            action: action
        });
    }

    function respond(action, reply) {
        console.log('[choice] => ' + JSON.stringify(action) + (action.fallback ? ' (FALLBACK)' : '') + ' rounds=' + rounds);
        logEntry(reply, action);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end(JSON.stringify(action));
    }

    function loop() {
        rounds++;
        attempt(0);
    }

    // 单次 DeepSeek 请求 + 重试阶梯：第1次失败等2s、第2次失败等5s、第3次失败等10s且降级 no think，再失败才 fallback。
    // 重试不消耗 rounds（tool 轮数预算只统计成功拿到回复并处理 tool 的轮数）。
    function attempt(retryIdx) {
        var noThink = retryIdx >= RETRY_DELAYS.length;   // 最后一次重试用 no think
        var t0 = Date.now();
        callDeepSeek(messages, noThink, function (err, statusCode, data) {
            var ms = Date.now() - t0;

            if (err || statusCode !== 200) {
                if (retryIdx < RETRY_DELAYS.length) {
                    var delay = RETRY_DELAYS[retryIdx];
                    console.log('[choice] fail ' + ms + 'ms (' + (err ? err.message : ('http ' + statusCode)) + '), retry ' + (retryIdx + 1) + '/' + RETRY_DELAYS.length + ' in ' + delay + 'ms' + (retryIdx + 1 >= RETRY_DELAYS.length ? ' [no think]' : ''));
                    setTimeout(function () { attempt(retryIdx + 1); }, delay);
                    return;
                }
                console.log('[choice] error ' + ms + 'ms: ' + (err ? err.message : ('http ' + statusCode)));
                var fa = fallbackAction(state, err ? 'error' : ('http' + statusCode));
                respond(fa, 'ERROR: ' + (err ? err.message : ('http ' + statusCode)));
                return;
            }

            var usage = extractUsage(data);
            lastUsage = usage;
            var msg = extractMessage(data);
            var reply = msg.content || '';
            lastReply = reply;
            var toolCalls = msg.tool_calls;

            if (toolCalls && toolCalls.length) {
                // DS 想调 tool：记录并执行，把结果追加进 messages，继续下一轮
                var called = [];
                messages.push({ role: 'assistant', content: reply || null, tool_calls: toolCalls });
                for (var i = 0; i < toolCalls.length; i++) {
                    var tc = toolCalls[i];
                    var args = {};
                    try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
                    var result = tools.runTool(tc.function.name, args, { state: state, notes: notes, turn: state.turn });
                    called.push({ name: tc.function.name, args: args, result: result });
                    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
                }
                toolLog.push({ round: rounds, ms: ms, usage: usage, calls: called });
                console.log('[tool] round ' + rounds + ' ' + ms + 'ms: ' + JSON.stringify(called));

                if (rounds >= MAX_TOOL_ROUNDS) {
                    var fa2 = fallbackAction(state, 'tool_rounds_exceeded');
                    respond(fa2, reply);
                    return;
                }
                loop();
                return;
            }

            // 最终答案
            var action = parseAction(reply, state);
            if (!action) {
                action = fallbackAction(state, 'parse_failed');
            }
            respond(action, reply);
        });
    }

    loop();
}

var server = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);

    if (req.method === 'GET' && u.pathname === '/health') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end('ok');
        return;
    }

    if (req.method === 'GET' && u.pathname === '/choice') {
        var state = {};
        if (u.query.state) {
            try { state = JSON.parse(u.query.state); } catch (e) {
                res.writeHead(400);
                res.end('invalid state JSON');
                return;
            }
        }
        handleChoice(res, state);
        return;
    }

    if (req.method === 'GET' && u.pathname === '/summary') {
        appendSummary(u.query.battleId, u.query.result, u.query.winner);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end('ok');
        return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.writeHead(200);
    res.end('po-pokellmon-tool server. use GET /health or GET /choice?state=...');
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' in use. Set POKELLMON_TOOL_PORT or stop the other process.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('po-pokellmon-tool server (route 3: thinking + tool)');
    console.log('  health : http://' + HOST + ':' + PORT + '/health');
    console.log('  choice : http://' + HOST + ':' + PORT + '/choice?state=...');
    console.log('  model  : ' + MODEL);
    console.log('  thinking: ' + (THINKING_ENABLED ? 'enabled / ' + REASONING_EFFORT : 'disabled'));
    console.log('  timeout: ' + TIMEOUT_MS + 'ms, max_tool_rounds: ' + MAX_TOOL_ROUNDS);
    console.log('  apiKey : ' + (getApiKey() ? 'present' : 'MISSING'));
    console.log('  tools  : ' + tools.TOOL_DEFS.map(function (t) { return t.function.name; }).join(', '));
});
