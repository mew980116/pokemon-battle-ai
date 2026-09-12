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
var SERVER_VERSION = '0.1.3';   // tool 分支版本（改动时 bump，随日志记录）

// ==== DeepSeek 模型参数（tool 分支：思考 high，超时/maxtoken 放宽）====
var MODEL = 'deepseek-v4-flash';
var THINKING_ENABLED = true;            // 思考模式开
var REASONING_EFFORT = 'high';          // 思考强度 high
var MAX_TOKENS = null;                  // 不限制输出 token（思考链 + 最终答案）
var TIMEOUT_MS = 180000;                // 放宽：180s（tool 多轮往返慢）
var MAX_TOOL_ROUNDS = 5;                // 最多 function calling 轮数，超过则 fallback

var SYSTEM_PROMPT = require('../po-pokellmon/prompts.js').BATTLE_TIPS + ' You may call tools to compute type matchups, apply stat boosts, or read the battle history before deciding.';

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

function callDeepSeek(messages, cb) {
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
    if (THINKING_ENABLED) {
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

function buildPrompt(state) {
    var p = '';
    var opp = state.opp || {};
    var me = state.me || {};
    var bench = state.bench || [];
    var oppTypes = opp.types || [];

    // 战报不塞进 prompt，改由 get_battle_history tool 按需读取（省初始 token）
    var histN = (state.fullHistory && state.fullHistory.length) ? state.fullHistory.length : 0;
    if (histN > 0) {
        p += 'Battle history (' + histN + ' turns) is available via the get_battle_history tool.\n';
    }

    var oppRemaining = state.oppRemaining !== undefined ? state.oppRemaining : 6;
    p += 'Opponent has ' + oppRemaining + ' pokemons left.\n';
    if (opp.name) {
        var oppStatus = opp.status ? 'Status:' + opp.status + ',' : '';
        var oppBoosts = (opp.boosts && opp.boosts.length) ? 'Boosts:[' + opp.boosts.join(',') + '],' : '';
        p += 'Opponent current pokemon:' + opp.name + ':Type:' + oppTypes.join('&') + ',HP:' + (opp.hpPct || 0) + '%,' + oppStatus + oppBoosts + '\n';
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
        p += 'Your current pokemon:' + me.name + ',Type:' + (me.types || []).join('&') + ',HP:' + (me.hpPct || 0) + '%,' + meStatus + meBoosts + '\n';
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
            p += idx + '. switch to ' + bk.name + ':Type:' + (bk.types || []).join('&') + ',HP:' + (bk.hpPct || 0) + '%' + (bk.status ? ',Status:' + bk.status : '') + '\n';
        }
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

function handleChoice(res, state) {
    var prompt = buildPrompt(state);
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
        var t0 = Date.now();
        callDeepSeek(messages, function (err, statusCode, data) {
            var ms = Date.now() - t0;

            if (err || statusCode !== 200) {
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
                    var result = tools.runTool(tc.function.name, args, { state: state });
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
