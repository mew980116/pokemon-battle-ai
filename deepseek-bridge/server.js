// DeepSeek bridge server (zero-dependency, Node builtin only)
// Purpose: relay PO battle AI <-> DeepSeek API. Dummy connectivity test.
//
// Run (PowerShell):
//   $env:DEEPSEEK_API_KEY = "sk-..."     # or create apikey.txt in this dir
//   node deepseek-bridge/server.js
//
// Endpoints:
//   GET  /health            -> "ok"
//   GET  /decide?msg=ping   -> call DeepSeek, return reply text
//   POST /decide            -> same, form body: msg=... (& model=...)
//   GET  /choice            -> call DeepSeek, return a JSON battle command
//
// Default model: deepseek-v4-flash (override via ?model= or form model=)

var http = require('http');
var https = require('https');
var url = require('url');
var qs = require('querystring');
var fs = require('fs');
var path = require('path');

var PORT = Number(process.env.DEEPSEEK_BRIDGE_PORT) || 8090;
var HOST = '127.0.0.1';
var DEFAULT_MODEL = 'deepseek-v4-flash';

function getApiKey() {
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
    try {
        var k = fs.readFileSync(path.join(__dirname, 'apikey.txt'), 'utf8').trim();
        if (k) return k;
    } catch (e) {}
    return null;
}

function callDeepSeek(msg, model, cb, maxTokens) {
    var apiKey = getApiKey();
    if (!apiKey) {
        cb(new Error('missing DEEPSEEK_API_KEY (set env var or create apikey.txt)'));
        return;
    }
    var payload = JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [{ role: 'user', content: msg || 'ping' }],
        max_tokens: maxTokens || 512,
        stream: false
    });
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
        res.on('end', function () {
            cb(null, res.statusCode, data);
        });
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
            var c = obj.choices[0].message.content;
            if (!c && obj.choices[0].message.reasoning_content) {
                c = '(reasoning) ' + obj.choices[0].message.reasoning_content;
            }
            return c || '';
        }
        return data;
    } catch (e) {
        return data;
    }
}

// 从 DeepSeek 自由文本里尽量提取一个合法 attack 指令；解析失败则兜底 attackSlot 0。
function parseChoice(content) {
    var s = String(content || '').trim();
    s = s.replace(/```json/gi, '').replace(/```/g, '').trim();
    var a = s.indexOf('{');
    var b = s.lastIndexOf('}');
    if (a === -1 || b === -1 || b <= a) return { type: 'attack', attackSlot: 0 };
    try {
        var o = JSON.parse(s.substring(a, b + 1));
        if (o && o.type === 'attack') {
            var n = parseInt(o.attackSlot, 10);
            if (n >= 0 && n <= 3) return { type: 'attack', attackSlot: n };
        }
        if (o && o.type === 'switch') {
            var p = parseInt(o.pokeSlot, 10);
            if (p >= 1 && p <= 5) return { type: 'switch', pokeSlot: p };
        }
        return { type: 'attack', attackSlot: 0 };
    } catch (e) {
        return { type: 'attack', attackSlot: 0 };
    }
}

var CHOICE_PROMPT = '你是宝可梦对战AI。请随机选择一个出招指令。只输出一个JSON对象，不要输出任何解释或其他文字，格式：{"type":"attack","attackSlot":0}，其中attackSlot是0到3之间的整数。';

function handleChoice(res, switches, state) {
    var prompt;
    if (state && switches && switches.length) {
        prompt = '你是宝可梦对战AI，正在参与一场宝可梦对战。请根据当前战场状态选择最优指令。只输出一个JSON对象，不要输出任何解释或其他文字。\n' +
            '当前战场状态（JSON）：\n' + state + '\n\n' +
            '字段说明：me=我方场上宝可梦（me.moves 是4个招式，attackSlot 对应其数组索引 0~3）；opp=对手场上宝可梦（hpPct 为血量百分比，moves 为已暴露招式）；bench=我方后备宝可梦（slot 对应 pokeSlot）。\n' +
            '可选动作：出招 {"type":"attack","attackSlot":N}；或换人 {"type":"switch","pokeSlot":M}（M 只能是 bench 中未 KO 的 slot，即 [' + switches.join(',') + ']）。';
    } else if (switches && switches.length) {
        prompt = '你是宝可梦对战AI。请随机选择一个战斗指令，出招和换人的概率各占一半。只输出一个JSON对象，不要输出任何解释或其他文字。' +
            '可选动作：出招 {"type":"attack","attackSlot":0}（attackSlot是0到3的整数）；' +
            '或换人 {"type":"switch","pokeSlot":1}（pokeSlot只能是以下槽位之一：[' + switches.join(',') + ']）。';
    } else {
        prompt = CHOICE_PROMPT;
    }
    console.log('[choice] requesting command, switches=[' + (switches ? switches.join(',') : '') + '] state=' + (state ? 'yes' : 'no'));
    callDeepSeek(prompt, null, function (err, statusCode, data) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (err) {
            console.log('[choice] error: ' + err.message);
            res.writeHead(500);
            res.end('{"type":"attack","attackSlot":0}');
            return;
        }
        console.log('[choice] status=' + statusCode + ' body=' + data.slice(0, 300));
        if (statusCode !== 200) {
            res.writeHead(200);
            res.end('{"type":"attack","attackSlot":0}');
            return;
        }
        var cmd = parseChoice(extractReply(data));
        console.log('[choice] => ' + JSON.stringify(cmd));
        res.writeHead(200);
        res.end(JSON.stringify(cmd));
    }, 2048);
}

function handleDecide(msg, model, res) {
    console.log('[decide] msg="' + (msg || 'ping') + '" model=' + (model || DEFAULT_MODEL));
    callDeepSeek(msg, model, function (err, statusCode, data) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (err) {
            console.log('[decide] error: ' + err.message);
            res.writeHead(500);
            res.end('ERROR: ' + err.message);
            return;
        }
        console.log('[decide] status=' + statusCode + ' body=' + data.slice(0, 300));
        if (statusCode !== 200) {
            res.writeHead(502);
            res.end('ERROR: deepseek http ' + statusCode + ' -> ' + data);
            return;
        }
        res.writeHead(200);
        res.end(extractReply(data));
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
        handleDecide(u.query.msg, u.query.model, res);
        return;
    }

    if (req.method === 'GET' && u.pathname === '/choice') {
        var switches = [];
        if (u.query.switches) {
            var parts = String(u.query.switches).split(',');
            for (var i = 0; i < parts.length; i++) {
                var n = parseInt(parts[i], 10);
                if (n >= 1 && n <= 5) switches.push(n);
            }
        }
        handleChoice(res, switches, u.query.state);
        return;
    }

    if (req.method === 'POST' && u.pathname === '/decide') {
        var body = '';
        req.on('data', function (c) {
            body += c;
            if (body.length > 2e6) req.destroy();
        });
        req.on('end', function () {
            var form = {};
            try { form = qs.parse(body); } catch (e) {}
            handleDecide(form.msg, form.model, res);
        });
        return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.writeHead(200);
    res.end('deepseek bridge. use GET /health or GET /decide?msg=ping');
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' in use. Set DEEPSEEK_BRIDGE_PORT or stop the other process.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('DeepSeek bridge server');
    console.log('  health : http://' + HOST + ':' + PORT + '/health');
    console.log('  decide : http://' + HOST + ':' + PORT + '/decide?msg=ping');
    console.log('  model  : ' + DEFAULT_MODEL);
    console.log('  apiKey : ' + (getApiKey() ? 'present' : 'MISSING (set DEEPSEEK_API_KEY or create apikey.txt)'));
});
