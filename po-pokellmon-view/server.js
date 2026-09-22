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

// ⚠ 日志目录在**网络盘**（\\smartstorage）：实测单次文件操作 ~170ms。所以这条路径上：
//   ① 一律不用 *Sync API —— 同步 stat 243 个文件会把事件循环占住 30-60s，连 index.html 都发不出去（实测 `/` 被拖到 77s）；
//   ② 目录列表缓存 15s（前端每 15s 轮询一次），解析结果按 (file+mtime+size) 缓存 —— 避免反复重读网络盘。
var LIST_TTL_MS = 15000;
var listCache = { at: 0, data: null };
var listWaiters = null;        // 同时到达的请求合并成一次扫描
var STAT_LIMIT = 24;           // 并发池：串行 220 个 stat ≈ 37s，24 并发 ≈ 1.7s

// 异步列目录 + 并发 stat（不阻塞事件循环）
function scanDir(dir, cb) {
    fs.readdir(dir, function (err, names) {
        if (err) return cb([]);
        var files = names.filter(function (n) { return n.indexOf('.log') !== -1; });
        if (!files.length) return cb([]);
        var out = [], started = 0, done = 0;
        function launch(name) {
            started++;
            fs.stat(path.join(dir, name), function (e, st) {
                if (!e && st.isFile()) {
                    out.push({
                        file: 'logs/' + name, name: name, bytes: st.size, mtime: st.mtimeMs,
                        source: (dir.indexOf('tool') !== -1 ? 'tool' : 'no-think')
                    });
                }
                done++;
                if (done === files.length) return cb(out);
                pump();
            });
        }
        function pump() {
            while (started < files.length && (started - done) < STAT_LIMIT) launch(files[started]);
        }
        pump();
    });
}

function listLogFiles(cb) {
    if (listCache.data && (Date.now() - listCache.at) < LIST_TTL_MS) return cb(null, listCache.data);
    if (listWaiters) { listWaiters.push(cb); return; }
    listWaiters = [cb];
    var acc = [], i = 0;
    (function nextDir() {
        if (i >= LOG_DIRS.length) {
            acc.sort(function (a, b) { return b.mtime - a.mtime; });
            listCache = { at: Date.now(), data: acc };
            var q = listWaiters; listWaiters = null;
            q.forEach(function (fn) { fn(null, acc); });
            return;
        }
        scanDir(LOG_DIRS[i++], function (files) { acc = acc.concat(files || []); nextDir(); });
    })();
}

// 相对路径安全解析：只允许访问 LOG_DIRS 下的文件（异步，别用 existsSync 打网络盘）
function resolveLogFile(file, cb) {
    if (!file || file.indexOf('..') !== -1 || file.indexOf('\\') !== -1) return cb(null, null);
    var base = path.basename(file), i = 0;
    (function next() {
        if (i >= LOG_DIRS.length) return cb(null, null);
        var p = path.join(LOG_DIRS[i++], base);
        fs.stat(p, function (e, st) {
            if (!e && st.isFile()) return cb(p, st);
            next();
        });
    })();
}

// 解析结果缓存：key = 文件名 + mtime + size（日志每次追加都会换 key，天然失效）
var battleCache = {}, battleCacheKeys = [];
var BATTLE_CACHE_MAX = 3;

function readBattle(file, cb) {
    resolveLogFile(file, function (p, st) {
        if (!p) return cb(null, null);
        var key = path.basename(p) + '|' + st.mtimeMs + '|' + st.size;
        if (battleCache[key]) return cb(null, battleCache[key]);
        fs.readFile(p, 'utf8', function (e, txt) {
            if (e) return cb(null, null);
            var out = [];
            txt.split(/\r?\n/).forEach(function (l) {
                if (!l.trim()) return;
                try { out.push(JSON.parse(l)); } catch (x) {}
            });
            battleCache[key] = out;
            battleCacheKeys.push(key);
            while (battleCacheKeys.length > BATTLE_CACHE_MAX) delete battleCache[battleCacheKeys.shift()];
            cb(null, out);
        });
    });
}

// ?light=1：只回前端真正渲染的字段 —— 丢掉 `ledger`（占 ~20%，前端从不读），
// 且 `systemPrompt` 每条都完全相同（实测 25 条一模一样），只留第一条（前端用第一条兜底）。
var LIGHT_DROP = ['ledger'];
function lighten(arr) {
    return arr.map(function (o, i) {
        var c = {};
        Object.keys(o).forEach(function (k) { c[k] = o[k]; });
        for (var j = 0; j < LIGHT_DROP.length; j++) delete c[LIGHT_DROP[j]];
        if (i > 0) delete c.systemPrompt;
        return c;
    });
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
        listLogFiles(function (err, list) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(list || []));
        });
        return;
    }

    if (req.method === 'GET' && req.url.indexOf('/api/battle') === 0) {
        var q = url.parse(req.url, true).query;
        readBattle(q.file, function (err, battle) {
            if (!battle) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('not found: ' + q.file);
                return;
            }
            if (q.light === '1' || q.light === 'true') battle = lighten(battle);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(battle));
        });
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
    listLogFiles(function (err, list) {
        console.log('  files: ' + ((list || []).length) + ' battle logs found');
    });
});
