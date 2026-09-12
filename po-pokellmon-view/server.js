// po-pokellmon-view/server.js — LLM 对战可视化服务（读日志，零依赖）
//
// 读取 po-pokellmon/logs/ 与 po-pokellmon-tool/logs/ 的 JSONL 决策日志，
// 提供给前端浏览器做「对战界面 + 历史战报 + LLM 交互」可视化。
//
// 运行：node po-pokellmon-view/server.js  （默认 8093）
// Routes:
//   GET /api/battles         -> 列出可用的日志文件
//   GET /api/battle?file=..  -> 读取并解析某日志（返回决策数组）
//   GET /                    -> 前端 index.html

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var PORT = Number(process.env.POKELLMON_VIEW_PORT) || 8093;
var HOST = '127.0.0.1';
var VIEW_DIR = __dirname;
var LOG_DIRS = [
    path.join(__dirname, '..', 'po-pokellmon', 'logs'),
    path.join(__dirname, '..', 'po-pokellmon-tool', 'logs')
];

// 实时推送：po-pokellmon server 写日志时 POST /push，这里 SSE 广播给浏览器
var latestEntry = null;
var clients = [];

function broadcast(obj) {
    var payload = 'data: ' + JSON.stringify(obj) + '\n\n';
    var dead = [];
    clients.forEach(function (res) {
        try { res.write(payload); } catch (e) { dead.push(res); }
    });
    dead.forEach(function (res) {
        var i = clients.indexOf(res);
        if (i !== -1) clients.splice(i, 1);
    });
}

setInterval(function () {
    clients.forEach(function (res) {
        try { res.write(': ping\n\n'); } catch (e) {}
    });
}, 15000);

function listLogFiles() {
    var out = [];
    LOG_DIRS.forEach(function (dir) {
        var files = [];
        try { files = fs.readdirSync(dir); } catch (e) { return; }
        files.forEach(function (f) {
            if (f.indexOf('.log') === -1) return;
            var full = path.join(dir, f);
            var rel = 'logs/' + f;
            try {
                var st = fs.statSync(full);
                out.push({ file: rel, name: f, bytes: st.size, mtime: st.mtimeMs, source: (dir.indexOf('tool') !== -1 ? 'tool' : 'no-think') });
            } catch (e) {}
        });
    });
    out.sort(function (a, b) { return b.mtime - a.mtime; });
    return out;
}

// 相对路径安全解析：只允许访问 LOG_DIRS 下的文件
function resolveLogFile(file) {
    if (!file || file.indexOf('..') !== -1 || file.indexOf('\\') !== -1) return null;
    for (var i = 0; i < LOG_DIRS.length; i++) {
        var p = path.join(LOG_DIRS[i], path.basename(file));
        if (fs.existsSync(p)) return p;
    }
    // 兼容传入完整相对路径 logs/xxx.log
    if (file.indexOf('logs/') === 0) {
        for (var j = 0; j < LOG_DIRS.length; j++) {
            var p2 = path.join(LOG_DIRS[j], path.basename(file));
            if (fs.existsSync(p2)) return p2;
        }
    }
    return null;
}

function readBattle(file) {
    var p = resolveLogFile(file);
    if (!p) return null;
    var txt = fs.readFileSync(p, 'utf8');
    var lines = txt.split(/\r?\n/);
    var out = [];
    lines.forEach(function (l) {
        if (!l.trim()) return;
        try { out.push(JSON.parse(l)); } catch (e) {}
    });
    return out;
}

var server = http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // POST /push  (po-pokellmon server 写日志时推送一条决策)
    if (req.method === 'POST' && req.url.indexOf('/push') === 0) {
        var body = '';
        req.on('data', function (c) {
            body += c;
            if (body.length > 2e6) req.destroy();
        });
        req.on('end', function () {
            try {
                var entry = JSON.parse(body);
                latestEntry = entry;
                broadcast(entry);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('ok');
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('parse error: ' + e.message);
            }
        });
        return;
    }

    // GET /events  (SSE，新连接补发最新一条)
    if (req.method === 'GET' && req.url.indexOf('/events') === 0) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('retry: 3000\n\n');
        if (latestEntry) {
            res.write('data: ' + JSON.stringify(latestEntry) + '\n\n');
        }
        clients.push(res);
        req.on('close', function () {
            var i = clients.indexOf(res);
            if (i !== -1) clients.splice(i, 1);
        });
        return;
    }

    if (req.method === 'GET' && req.url.indexOf('/api/battles') === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(listLogFiles()));
        return;
    }

    if (req.method === 'GET' && req.url.indexOf('/api/battle') === 0) {
        var q = url.parse(req.url, true).query;
        var battle = readBattle(q.file);
        if (battle === null) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('not found: ' + q.file);
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(battle));
        return;
    }

    if (req.method === 'GET') {
        var rel = (req.url === '/' || req.url === '/index.html') ? 'index.html' : path.normalize(req.url).replace(/^[\/\\]+/, '').replace(/^(\.\.[\/\\])+/, '');
        var fp = path.join(VIEW_DIR, rel);
        fs.readFile(fp, function (err, data) {
            if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + req.url); return; }
            var ext = path.extname(fp).toLowerCase();
            var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(data);
        });
        return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('method not allowed');
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' in use. Set POKELLMON_VIEW_PORT or stop the other process.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('po-pokellmon-view server (LLM battle viewer)');
    console.log('  view : http://' + HOST + ':' + PORT + '/');
    console.log('  logs : ' + LOG_DIRS.join(', '));
    console.log('  files: ' + listLogFiles().length + ' battle logs found');
});
