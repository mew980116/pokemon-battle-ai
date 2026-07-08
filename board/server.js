// PO Battle Board server (zero-dependency, Node builtin only)
// Usage:  node board/server.js
// Routes:
//   POST /state   - PO webCall pushes state (form-urlencoded: state=<json>)
//   GET  /events  - SSE stream (text/event-stream), replays latest on connect
//   GET  /        - serves board/index.html
//   GET  /<file>  - static files from board/

var http = require('http');
var qs = require('querystring');
var fs = require('fs');
var path = require('path');

var PORT = 8080;
var HOST = '127.0.0.1';
var BOARD_DIR = __dirname;

var latestState = null;
var clients = [];

function broadcast(obj){
    var payload = 'data: ' + JSON.stringify(obj) + '\n\n';
    var dead = [];
    clients.forEach(function(res){
        try { res.write(payload); }
        catch(e){ dead.push(res); }
    });
    dead.forEach(function(res){
        var i = clients.indexOf(res);
        if (i !== -1) clients.splice(i, 1);
    });
}

// SSE heartbeat every 15s to keep proxies from closing idle conns
setInterval(function(){
    clients.forEach(function(res){
        try { res.write(': ping\n\n'); } catch(e){}
    });
}, 15000);

var MIME = {
    '.html':'text/html; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.png':'image/png',
    '.gif':'image/gif',
    '.jpg':'image/jpeg',
    '.svg':'image/svg+xml'
};

var server = http.createServer(function(req, res){
    res.setHeader('Access-Control-Allow-Origin', '*');

    // POST /state  (PO pushes state here)
    if (req.method === 'POST' && req.url.indexOf('/state') === 0){
        var body = '';
        req.on('data', function(c){
            body += c;
            if (body.length > 2e6) { req.destroy(); }  // guard: >2MB
        });
        req.on('end', function(){
            try {
                var form = qs.parse(body);
                if (!form.state) throw new Error('no state field');
                var state = JSON.parse(form.state);
                latestState = state;
                broadcast(state);
                res.writeHead(200, {'Content-Type':'text/plain'});
                res.end('ok');
                console.log('[state] turn=' + state.turn + '  clients=' + clients.length);
            } catch(e){
                res.writeHead(400, {'Content-Type':'text/plain'});
                res.end('parse error: ' + e.message);
                console.log('[state] parse error: ' + e.message);
            }
        });
        return;
    }

    // GET /events  (SSE)
    if (req.method === 'GET' && req.url.indexOf('/events') === 0){
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('retry: 3000\n\n');
        if (latestState){
            res.write('data: ' + JSON.stringify(latestState) + '\n\n');
        }
        clients.push(res);
        req.on('close', function(){
            var i = clients.indexOf(res);
            if (i !== -1) clients.splice(i, 1);
        });
        return;
    }

    // GET static
    if (req.method === 'GET'){
        var rel;
        if (req.url === '/' || req.url === '/index.html'){
            rel = 'index.html';
        } else {
            rel = path.normalize(req.url).replace(/^[\/\\]+/, '').replace(/^(\.\.[\/\\])+/, '');
        }
        var filePath = path.join(BOARD_DIR, rel);
        fs.readFile(filePath, function(err, data){
            if (err){
                res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
                res.end('not found: ' + req.url);
                return;
            }
            var ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
            res.end(data);
        });
        return;
    }

    res.writeHead(405, {'Content-Type':'text/plain'});
    res.end('method not allowed');
});

server.on('error', function(err){
    if (err.code === 'EADDRINUSE'){
        console.error('Port ' + PORT + ' is in use. Stop the other process or change PORT.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function(){
    console.log('PO Battle Board server');
    console.log('  board : http://' + HOST + ':' + PORT + '/');
    console.log('  SSE   : http://' + HOST + ':' + PORT + '/events');
    console.log('  POST  : http://' + HOST + ':' + PORT + '/state');
    console.log('Waiting for PO state pushes...');
});
