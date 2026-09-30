'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var clientModule = require('./client.js');
var bridgeModule = require('./decision-bridge.js');

var logFile = path.join(__dirname, '..', 'logs', 'ps-sandrone-' + new Date().toISOString().slice(0, 10) + '.jsonl');
function writeLog(type, data) {
    try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFileSync(logFile, JSON.stringify({ time: new Date().toISOString(), type: type, data: data }) + '\n');
    } catch (error) {
        console.error('[ps log error] ' + error.message);
    }
}

// #region debug-point A:report
function reportDebug(hypothesisId, message, data) {
    var body = JSON.stringify({ sessionId: 'ps-sandrone-chat', runId: 'post-fix', hypothesisId: hypothesisId, location: 'platform/ps/run-shadow.js', msg: '[DEBUG] ' + message, data: data || {}, ts: Date.now() });
    var request = http.request({ hostname: '127.0.0.1', port: 7777, path: '/event', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
    request.on('error', function () {});
    request.write(body);
    request.end();
}
// #endregion

var shadowMode = ['1', 'true', 'yes', 'on'].indexOf(String(process.env.PS_SHADOW || '').trim().toLowerCase()) !== -1;
var skipLogin = ['1', 'true', 'yes', 'on'].indexOf(String(process.env.PS_SKIP_LOGIN || '').trim().toLowerCase()) !== -1;
var autoAccept = ['1', 'true', 'yes', 'on'].indexOf(String(process.env.PS_AUTO_ACCEPT || '').trim().toLowerCase()) !== -1;
var decisionMode = String(process.env.PS_DECISION || 'llm').trim().toLowerCase();
var searchFormat = process.env.PS_SEARCH_FORMAT || '';
var rival = process.env.PS_RIVAL || 'III.Columbina';
if (rival === 'none' || rival === 'off') rival = '';   // 显式关闭自动挑战：只等别人来挑战（配合 PS_AUTO_ACCEPT 用）
var challengeFormat = process.env.PS_CHALLENGE_FORMAT || 'gen8randombattle';
var exitAfterBattle = ['1', 'true', 'yes', 'on'].indexOf(String(process.env.PS_EXIT_AFTER_BATTLE || '').trim().toLowerCase()) !== -1;
var client = new clientModule.PSClient({
    server: process.env.PS_SERVER,
    wsUrl: process.env.PS_WS_URL,
    rival: rival,
    challengeFormat: challengeFormat,
    searchFormat: searchFormat,
    shadowMode: shadowMode,
    onConnection: function (type, data) {
        console.log('[ps connection] ' + type + (data ? ' ' + JSON.stringify(data) : ''));
        writeLog('connection', { event: type, data: data || null });
        reportDebug(type === 'error' ? 'A' : (type === 'challstr' ? 'C' : 'B'), 'PS connection event: ' + type, data || {});
    },
    onBattleStart: function (session, room) { writeLog('battle_start', { room: room }); },
    onBattleEnd: function (session, event, room) {
        writeLog('battle_end', { room: room, event: event });
        if (exitAfterBattle) {
            setTimeout(function () { client.leaveRoom(room); client.close(); }, 250);
        }
    },
    onChallenge: function (from) {
        console.log('[ps challenge] from ' + from + (autoAccept ? ' -> accept' : ' (ignored)'));
        writeLog('challenge', { from: from, autoAccept: autoAccept });
        if (autoAccept) client.acceptChallenge(from);
    },
    onProtocol: function (event, room) {
        writeLog('protocol', { room: room, event: event });
        if (room || !event || !event.raw) return;
        var raw = String(event.raw).replace(/[\r\n]+/g, ' ');
        if (raw.indexOf('updatesearch') !== -1) console.log('[ps search] ' + raw.slice(0, 300));
        if (raw.indexOf('/error') !== -1) console.log('[ps error] ' + raw.slice(0, 300));
    }
});
console.log('[ps mode] ' + (searchFormat ? 'ladder search: ' + searchFormat : 'challenge: ' + rival + ' (' + challengeFormat + ')')
    + ' | decision: ' + (decisionMode === 'random' ? 'random (server provider hint)' : 'llm ' + (process.env.POKELLMON_TOOL_URL || 'http://127.0.0.1:8092/choice'))
    + ' | login: ' + (skipLogin ? 'skip (local server)' : 'official ' + (process.env.PS_WS_URL || 'wss://sim3.psim.us/showdown/websocket'))
    + (autoAccept ? ' | auto-accept' : '')
    + (shadowMode ? ' | shadow' : ''));
var chatTarget = process.env.PS_CHAT_TARGET || 'III.Columbina';
var chatMessage = process.env.PS_CHAT_MESSAGE || '';
var bridge = new bridgeModule.DecisionBridge({
    url: process.env.POKELLMON_TOOL_URL,
    shadow: client.shadowMode,
    // random now runs in the decision service. Keep agent for old tests;
    // production requests always go through /choice.
    agent: 'llm',
    account: process.env.PS_ACCOUNT || client.username,
    providerHint: decisionMode,
    onSuggestion: function (entry) {
        if (entry.error) {
            console.log('[ps decision error] ' + entry.error + (entry.room ? ' (' + entry.room + ')' : ''));
            writeLog('decision_error', { room: entry.room || null, error: entry.error });
            return;
        }
        console.log('[ps decision' + (entry.shadow ? ' shadow' : '') + (entry.fallback ? ' fallback' : '') + '] ' + JSON.stringify(entry.suggestion));
        writeLog('decision', {
            battleId: entry.battleId,
            turn: entry.turn,
            suggestion: entry.suggestion,
            action: entry.action,
            fallback: !!entry.fallback,
            sent: entry.sent || { sent: false, shadow: entry.shadow }
        });
    },
    onRequest: function (entry) {
        // skip = 没有可选项（等对手出招），没有决策可记
        if (entry.skipped) { writeLog('decision_skip', { battleId: entry.battleId, turn: entry.turn }); return; }
        writeLog('decision_request', { battleId: entry.battleId, turn: entry.turn, actions: entry.state.actions });
    }
});
bridge.attachClient(client);

try {
    client.connect();
    if (chatMessage) {
        var chatTimer = setInterval(function () {
            if (!client.loggedIn) return;
            try {
                client.sendPrivateMessage(chatTarget, chatMessage);
                console.log('[ps chat] sent private message to ' + chatTarget);
                clearInterval(chatTimer);
                writeLog('private_message', { target: chatTarget, message: chatMessage });
            } catch (error) {
                console.error('[ps chat error] ' + error.message);
            }
        }, 1000);
    }
} catch (error) {
    console.error('Unable to start PS client: ' + error.message);
    console.error('Inject a WebSocket implementation with PSClient({ WebSocket }) or call connect(socket); no ws dependency is installed.');
    process.exitCode = 1;
}
