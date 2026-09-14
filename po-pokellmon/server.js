// po-pokellmon/server.js — PO LLM 对战机器人决策服务器（移植 PokeLLMon 方案）
// 接收 PO 采集的战场状态 → 拼 PokeLLMon 风格 prompt（历史回合 ICRL + 克制 KAG[Type] + 招式 Effect）→ DeepSeek → 解析动作
//
// 运行：
//   $env:DEEPSEEK_API_KEY = "sk-..."   # 或在本目录建 apikey.txt
//   node po-pokellmon/server.js
//
// Endpoints:
//   GET /health              -> "ok"
//   GET /choice?state=JSON   -> 返回 {"type":"move","name":"招式名"} 或 {"type":"switch","name":"宝可梦名"}
//   GET /decide?msg=ping     -> 连通性测试

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var path = require('path');

var PORT = Number(process.env.POKELLMON_PORT) || 8091;
var HOST = '127.0.0.1';
var SERVER_VERSION = '0.4.19';  // 服务版本（改动时 bump，随日志记录）

// ==== DeepSeek 模型参数（可配置，改动后重启生效）====
var MODEL = 'deepseek-v4-flash';        // 模型名：deepseek-v4-flash / deepseek-v4-pro
var THINKING_ENABLED = false;           // 思考模式开关（实测：非思考快且稳，0.78s/次；思考 30s/次且 token 爆）
var REASONING_EFFORT = 'high';          // 思考强度：high / max（仅思考模式生效，非思考忽略）
var TEMPERATURE = 0.3;                  // 采样温度（低温度=决策稳定；仅非思考模式生效）
var MAX_TOKENS = null;                  // 最大输出 token（null = 不限制，用模型默认最大输出）

var SYSTEM_PROMPT = require('./prompts.js').BATTLE_TIPS + ' Choose the best action.';

// 加载知识库
var KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
var MOVES = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, 'moves.json'), 'utf8'));
var TYPECHART = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, 'typechart.json'), 'utf8'));
var TYPE_NAMES = TYPECHART.types;
var CHART = TYPECHART.chart;

var LOG_DIR = path.join(__dirname, 'logs');

function getApiKey() {
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
    try {
        var k = fs.readFileSync(path.join(__dirname, 'apikey.txt'), 'utf8').trim();
        if (k) return k;
    } catch (e) {}
    return null;
}

function callDeepSeek(messages, cb, maxTokens, jsonFormat) {
    var apiKey = getApiKey();
    if (!apiKey) {
        cb(new Error('missing DEEPSEEK_API_KEY (set env var or create apikey.txt)'));
        return;
    }
    var payloadObj = {
        model: MODEL,
        messages: messages,
        stream: false
    };
    var mt = maxTokens || MAX_TOKENS;
    if (mt) payloadObj.max_tokens = mt;
    if (THINKING_ENABLED) {
        payloadObj.thinking = { type: 'enabled' };
        if (REASONING_EFFORT) payloadObj.reasoning_effort = REASONING_EFFORT;
    } else {
        // 非思考：显式 disabled，且不带 reasoning_effort（否则 reasoning_effort 会重新开启思考）
        payloadObj.thinking = { type: 'disabled' };
    }
    if (TEMPERATURE !== null && TEMPERATURE !== undefined) payloadObj.temperature = TEMPERATURE;
    if (jsonFormat) payloadObj.response_format = { type: 'json_object' };
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
    req.setTimeout(20000, function () {
        req.destroy(new Error('deepseek timeout'));
    });
    req.on('error', function (e) { cb(e); });
    req.write(payload);
    req.end();
}

function extractReply(data) {
    try {
        var obj = JSON.parse(data);
        if (obj.choices && obj.choices[0] && obj.choices[0].message) {
            return obj.choices[0].message.content || '';
        }
        return data;
    } catch (e) {
        return data;
    }
}

// 从 DeepSeek 响应提取 token 用量（prompt_tokens / completion_tokens / total_tokens）
function extractUsage(data) {
    try {
        var obj = JSON.parse(data);
        if (obj.usage) return obj.usage;
        return null;
    } catch (e) {
        return null;
    }
}

// 类型名称 -> 编号索引
function typeIndex(name) {
    return TYPE_NAMES.indexOf(name);
}

// 单个攻击属性对防御属性组合的克制倍率
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

// KAG[Type]：对手作为 defender 的克制描述（我方招式类型对对手的克制倍率）
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

// 招式信息：num 查 knowledge/moves.json，type 用 state 传入（PO 运行时 sys.moveType 最准）
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

// 拼 prompt：数字选项方案（4 招式 + N 换人，DS 只需返回数字）
function buildPrompt(state) {
    var p = '';
    var opp = state.opp || {};
    var me = state.me || {};
    var bench = state.bench || [];
    var oppTypes = opp.types || [];

    // 历史回合（ICRL）
    if (state.history && state.history.length) {
        p += 'Historical turns:\n' + state.history.join('\n') + '\n';
    }

    // 天气/场地/入场陷阱（天气特性触发消息与陷阱都不走回调，改用 battle.data.field 直读）
    var env = [];
    if (state.weather) env.push('Weather:' + state.weather);
    if (state.terrain) env.push('Terrain:' + state.terrain);
    var mh = state.myHazards || [];
    var oh = state.oppHazards || [];
    if (mh.length) env.push('My hazards:[' + mh.join(',') + ']');
    if (oh.length) env.push('Opp hazards:[' + oh.join(',') + ']');
    if (env.length) p += env.join(' | ') + '\n';

    // 对手
    if (opp.name) {
        var oppStatus = opp.status ? 'Status:' + opp.status + ',' : '';
        var oppBoosts = (opp.boosts && opp.boosts.length) ? 'Boosts:[' + opp.boosts.join(',') + '],' : '';
        p += 'Opponent current pokemon:' + opp.name + ':Type:' + oppTypes.join('&') + ',HP:' + (opp.hpPct || 0) + '%,' + oppStatus + oppBoosts + '\n';
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

    // 我方当前宝可梦
    if (me.name) {
        var meStatus = me.status ? 'Status:' + me.status + ',' : '';
        var meBoosts = (me.boosts && me.boosts.length) ? 'Boosts:[' + me.boosts.join(',') + '],' : '';
        var meAbi = me.ability ? 'Ability:' + me.ability + ',' : '';
        var meItem = me.item ? 'Item:' + me.item + ',' : '';
        p += 'Your current pokemon:' + me.name + ',Type:' + (me.types || []).join('&') + ',HP:' + (me.hpPct || 0) + '%,' + meAbi + meItem + meStatus + meBoosts + '\n';
    }

    // 数字选项列表（招式 + 换人）
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
            p += sw + '\n';
        }
    }

    return p;
}

// 从 DeepSeek 输出提取数字（支持 {"choice":N} 或纯数字）
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

// 数字 -> slot：1~M 是招式（me.moves 顺序），M+1~N 是换人（bench 顺序）
function parseAction(content, state) {
    var num = extractNumber(content);
    if (num === null) return null;
    var me = state.me || {};
    var moves = me.moves || [];
    var bench = state.bench || [];
    if (num >= 1 && num <= moves.length) {
        var mv = moves[num - 1];
        return { type: 'attack', attackSlot: mv.slot };
    }
    var switchIdx = num - moves.length - 1;
    if (switchIdx >= 0 && switchIdx < bench.length) {
        return { type: 'switch', pokeSlot: bench[switchIdx].slot };
    }
    return null;
}

// 兜底：优先用第一个可用招式；招式全不可用（锁招/ban/强制换人）时转换人
function fallbackMove(state) {
    var me = state.me || {};
    var moves = me.moves || [];
    if (moves.length) return { type: 'attack', attackSlot: moves[0].slot };
    var bench = state.bench || [];
    if (bench.length) return { type: 'switch', pokeSlot: bench[0].slot };
    return { type: 'attack', attackSlot: 0 };
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

// 写日志（JSONL：每行一次决策的完整记录，含队伍/战报 state + prompt + reply + action）
// 按 battleId 分文件：deepseek_YYYYMMDD_battle{id}.log，一天多场互不干扰
function writeLog(entry) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        var d = new Date();
        var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
        var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
        var battleId = (entry.state && entry.state.battleId !== undefined && entry.state.battleId !== null) ? entry.state.battleId : 'unknown';
        var file = path.join(LOG_DIR, 'deepseek_' + d.getFullYear() + mm + dd + '_battle' + battleId + '.log');
        fs.appendFileSync(file, JSON.stringify(entry) + '\n');
        pushToView(entry);
    } catch (e) {
        console.log('[log] write error: ' + e.message);
    }
}

// parse 失败（DS 返回空/无法解析/请求错误）时最多重试次数（共 1 初始 + 1 retry）
var FALLBACK_RETRY = 1;

// 兜底动作（带 fallback 标记和原因）
function fallbackAction(state, reason) {
    var a = fallbackMove(state) || { type: 'attack', attackSlot: 0 };
    a.fallback = true;
    a.reason = reason || '';
    return a;
}

// dummy 探测请求（简单英文 prompt，用于区分「服务端整体挂」vs「特定请求挂」）
// 已暂时关闭（请求稳定后不再需要）；需要诊断时改回 true
var DUMMY_PING_ENABLED = false;
var DUMMY_PROMPT = 'Choose the best action. Output ONLY a JSON object: {"choice": <number>}. No other text.\n1. Flamethrower\n2. Thunderbolt';

function pingDeepSeek(cb) {
    var apiKey = getApiKey();
    if (!apiKey) { cb(new Error('no key')); return; }
    var payload = JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: DUMMY_PROMPT }],
        max_tokens: 64,
        stream: false,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: 0.3
    });
    var t0 = Date.now();
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
        var d = '';
        res.on('data', function (c) { d += c; });
        res.on('end', function () { cb(null, { status: res.statusCode, ms: Date.now() - t0 }); });
    });
    req.setTimeout(8000, function () { req.destroy(new Error('dummy timeout')); });
    req.on('error', function (e) { cb(e); });
    req.write(payload);
    req.end();
}

function handleChoice(res, state) {
    var prompt = buildPrompt(state);
    var constraint = 'Choose the best action. Output ONLY a JSON object: {"choice": <number>} where <number> is the number of the action you choose. No other text.\n';
    var userPrompt = prompt + '\n' + constraint;

    console.log('[choice] turn=' + (state.turn || '?') + ' prompt_len=' + userPrompt.length);

    var attempt = 0;
    var lastReply = '';
    var lastPing = '';
    var attemptLog = [];   // 每次尝试的详细记录
    var lastUsage = null;  // 最后一次响应的 token 用量（含重试）
    var startTime = Date.now();   // 本次决策总耗时起点（含重试）

    // 写日志（含 error/非200 fallback 的情况 + 每次 attempt 详情）
    function logEntry(reply, action) {
        if (!state.log) return;
        writeLog({
            ts: new Date().toISOString(),
            serverVersion: SERVER_VERSION,
            scriptVersion: state.scriptVersion || '',
            account: state.account || '',
            turn: state.turn,
            attempts: attempt,
            totalMs: Date.now() - startTime,
            usage: lastUsage,
            attemptLog: attemptLog,
            fallback: !!action.fallback,
            lastReply: lastReply,
            dummyPing: lastPing,
            state: state,
            systemPrompt: SYSTEM_PROMPT,
            prompt: userPrompt,
            reply: reply,
            action: action
        });
    }

    function tryDecide() {
        attempt++;
        var t0 = Date.now();
        callDeepSeek([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ], function (err, statusCode, data) {
            var ms = Date.now() - t0;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');

            if (err) {
                var rec = { attempt: attempt, result: 'error', ms: ms, error: err.message };
                attemptLog.push(rec);
                console.log('[choice] error (attempt ' + attempt + '/' + (FALLBACK_RETRY + 1) + ') ' + ms + 'ms: ' + err.message);
                // 发 dummy 探测，区分「服务端整体挂」vs「特定请求挂」（已暂时关闭）
                if (DUMMY_PING_ENABLED) {
                    pingDeepSeek(function (perr, pres) {
                        var pingResult = perr ? ('FAILED: ' + perr.message) : ('OK ' + pres.ms + 'ms');
                        rec.ping = pingResult;
                        lastPing = pingResult;
                        console.log('[ping] dummy ' + pingResult);
                    });
                }
                if (attempt <= FALLBACK_RETRY) { tryDecide(); return; }
                var fa = fallbackAction(state, 'error');
                logEntry('ERROR: ' + (err.message || ''), fa);
                res.writeHead(500);
                res.end(JSON.stringify(fa));
                return;
            }
            if (statusCode !== 200) {
                attemptLog.push({ attempt: attempt, result: 'http' + statusCode, ms: ms });
                console.log('[choice] http ' + statusCode + ' (attempt ' + attempt + '/' + (FALLBACK_RETRY + 1) + ') ' + ms + 'ms');
                if (attempt <= FALLBACK_RETRY) { tryDecide(); return; }
                var fa2 = fallbackAction(state, 'http' + statusCode);
                logEntry('HTTP ' + statusCode + ': ' + (data || ''), fa2);
                res.writeHead(200);
                res.end(JSON.stringify(fa2));
                return;
            }

            var reply = extractReply(data);
            var usage = extractUsage(data);
            lastUsage = usage;
            var action = parseAction(reply, state);
            if (!action) {
                lastReply = reply;
                attemptLog.push({ attempt: attempt, result: 'parse_failed', ms: ms, usage: usage, reply: reply.slice(0, 100) });
                console.log('[choice] parse failed (attempt ' + attempt + '/' + (FALLBACK_RETRY + 1) + ') ' + ms + 'ms, reply=' + reply.slice(0, 200));
                if (attempt <= FALLBACK_RETRY) {
                    tryDecide();   // fallback retry：DS 返回无法解析，重试
                    return;
                }
                action = fallbackAction(state, 'parse_failed');
            } else {
                attemptLog.push({ attempt: attempt, result: 'success', ms: ms, usage: usage });
            }

            var tokStr = (usage && usage.total_tokens !== undefined) ? (' ' + usage.total_tokens + 'tok') : '';
            console.log('[choice] => ' + JSON.stringify(action) + (action.fallback ? ' (FALLBACK)' : '') + ' ' + ms + 'ms' + tokStr);
            logEntry(reply, action);
            res.writeHead(200);
            res.end(JSON.stringify(action));
        }, MAX_TOKENS, true);
    }

    tryDecide();
}

function handleDecide(msg, res) {
    callDeepSeek([{ role: 'user', content: msg || 'ping' }], function (err, statusCode, data) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (err) { res.writeHead(500); res.end('ERROR: ' + err.message); return; }
        res.writeHead(statusCode === 200 ? 200 : 502);
        res.end(statusCode === 200 ? extractReply(data) : 'ERROR: http ' + statusCode);
    });
}

var server = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);

    if (req.method === 'GET' && u.pathname === '/health') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end('ok');
        return;
    }

    if (req.method === 'GET' && u.pathname === '/decide') {
        handleDecide(u.query.msg, res);
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
    res.end('po-pokellmon server. use GET /health or GET /choice?state=...');
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' in use. Set POKELLMON_PORT or stop the other process.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('po-pokellmon server (PokeLLMon-style LLM decision)');
    console.log('  health : http://' + HOST + ':' + PORT + '/health');
    console.log('  choice : http://' + HOST + ':' + PORT + '/choice?state=...');
    console.log('  model  : ' + MODEL);
    console.log('  apiKey : ' + (getApiKey() ? 'present' : 'MISSING (set DEEPSEEK_API_KEY or create apikey.txt)'));
    console.log('  moves  : ' + Object.keys(MOVES).length + ' loaded, typechart ' + TYPE_NAMES.length + ' types');
});
