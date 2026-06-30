// PO webCall verification server (zero-dependency, Node builtin only)
// Usage:  node board/verify-server.js
// Listens on 127.0.0.1:8080, logs every GET/POST from PO so you can tell
// at a glance whether sys.webCall is reachable from battle callbacks.

var http = require('http');
var qs = require('querystring');

var PORT = 8080;
var HOST = '127.0.0.1';

var server = http.createServer(function (req, res) {
    var body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
        var ts = new Date().toISOString();
        console.log('--------------------------------------------------');
        console.log('[' + ts + '] ' + req.method + ' ' + req.url);
        if (req.headers['content-type']) {
            console.log('  content-type: ' + req.headers['content-type']);
        }
        if (body) {
            console.log('  raw body: ' + body);
            var parsed = null;
            try {
                parsed = JSON.parse(body);
                console.log('  parsed (json): ' + JSON.stringify(parsed));
            } catch (e1) {
                try {
                    parsed = qs.parse(body);
                    console.log('  parsed (form): ' + JSON.stringify(parsed));
                } catch (e2) {
                    console.log('  parsed: (unparseable)');
                }
            }
        } else {
            console.log('  raw body: (empty)');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
    });
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' is in use. Close the other process or edit PORT.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('PO webCall verify server');
    console.log('Listening on http://' + HOST + ':' + PORT);
    console.log('Waiting for requests from PO...');
    console.log('(GET /health from /wctest, POST /ping from battle callbacks)');
    console.log('');
});
