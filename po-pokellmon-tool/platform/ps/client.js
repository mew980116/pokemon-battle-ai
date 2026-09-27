'use strict';

var fs = require('fs');
var path = require('path');
var https = require('https');
var adapter = require('./adapter.js');

function readCredentialsFile() {
    try {
        var file = path.join(__dirname, 'ps-credentials.json');
        var data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return data && typeof data === 'object' ? data : {};
    } catch (error) {
        return {};
    }
}

function defaultLoginRequest(options) {
    return new Promise(function (resolve, reject) {
        var body = 'name=' + encodeURIComponent(options.username) + '&pass=' + encodeURIComponent(options.password) + '&challstr=' + encodeURIComponent(options.challstr);
        var request = https.request({
            hostname: 'play.pokemonshowdown.com',
            path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
        }, function (response) {
            var text = '';
            response.setEncoding('utf8');
            response.on('data', function (chunk) { text += chunk; });
            response.on('end', function () {
                var result;
                try {
                    var jsonStart = text.indexOf('{');
                    if (jsonStart === -1) throw new Error('missing JSON object');
                    result = JSON.parse(text.slice(jsonStart));
                } catch (error) {
                    reject(new Error('PS login response was not valid JSON'));
                    return;
                }
                if (!result.actionsuccess || !result.assertion || !result.curuser || !result.curuser.userid) {
                    reject(new Error('PS login failed: ' + JSON.stringify({ status: result.status, error: result.error, actionsuccess: result.actionsuccess })));
                    return;
                }
                resolve({ assertion: result.assertion, userid: result.curuser.userid });
            });
        });
        request.on('error', reject);
        request.write(body);
        request.end();
    });
}

function addSocketListener(socket, name, handler) {
    if (socket.on) socket.on(name, handler);
    else if (socket.addEventListener) socket.addEventListener(name, handler);
}

function unwrapMessage(event) {
    if (event && typeof event.data !== 'undefined') return String(event.data);
    return String(event || '');
}

function PSClient(options) {
    options = options || {};
    var credentials = readCredentialsFile();
    this.username = options.username || process.env.PS_USERNAME || credentials.username || '';
    this.password = options.password || process.env.PS_PASSWORD || credentials.password || '';
    this.rival = options.rival || process.env.PS_RIVAL || '';
    this.challengeFormat = options.challengeFormat || process.env.PS_CHALLENGE_FORMAT || 'gen8randombattle';
    this.server = options.server || process.env.PS_SERVER || 'play.pokemonshowdown.com';
    this.wsUrl = options.wsUrl || process.env.PS_WS_URL || 'wss://sim3.psim.us/showdown/websocket';
    this.WebSocket = options.WebSocket || null;
    this.loginRequest = options.loginRequest || defaultLoginRequest;
    this.socket = null;
    this.connected = false;
    this.loggedIn = false;
    this.challstr = null;
    this.shadowMode = options.shadowMode !== false;
    this.sessions = {};
    this.currentRoom = null;
    this.lastActions = {};
    this.callbacks = options.callbacks || {};
    this.onRequest = options.onRequest || function () {};
    this.onBattleStart = options.onBattleStart || function () {};
    this.onBattleEnd = options.onBattleEnd || function () {};
    this.onProtocol = options.onProtocol || function () {};
    this.onConnection = options.onConnection || function () {};
}

PSClient.prototype.connect = function (socket) {
    var self = this;
    this.socket = socket || (this.WebSocket ? new this.WebSocket(this.wsUrl) : this.createDefaultSocket());
    addSocketListener(this.socket, 'open', function () {
        self.connected = true;
        if (self.onConnection) self.onConnection('open');
    });
    addSocketListener(this.socket, 'message', function (event) { self.handleMessage(unwrapMessage(event)); });
    addSocketListener(this.socket, 'error', function (error) {
        if (self.onConnection) self.onConnection('error', error);
    });
    addSocketListener(this.socket, 'close', function (code, reason) {
        self.connected = false;
        self.loggedIn = false;
        if (self.onConnection) self.onConnection('close', { code: code, reason: String(reason || '') });
    });
    return this.socket;
};

PSClient.prototype.createDefaultSocket = function () {
    var WebSocket;
    try { WebSocket = require('ws'); } catch (error) { throw new Error('No WebSocket implementation supplied; inject options.WebSocket or a socket into connect()'); }
    return new WebSocket(this.wsUrl);
};

PSClient.prototype.send = function (message) {
    if (!this.socket || typeof this.socket.send !== 'function') throw new Error('PS WebSocket is not connected');
    this.socket.send(message);
};

PSClient.prototype.sendGlobal = function (command) { this.send('|/' + command); };
PSClient.prototype.sendRoom = function (room, command) { this.send(room + '|/' + command); };
PSClient.prototype.sendChat = function (room, message) {
    if (!room || !message) throw new Error('room and message are required');
    this.send(room + '|' + String(message).replace(/[\r\n]+/g, ' '));
};
PSClient.prototype.sendPrivateMessage = function (username, message) {
    if (!username || !message) throw new Error('username and message are required');
    this.sendGlobal('pm ' + username + ', ' + String(message).replace(/[\r\n]+/g, ' '));
};
PSClient.prototype.joinRoom = function (room) { this.sendGlobal('join ' + room); this.currentRoom = room; };
PSClient.prototype.challenge = function (username) { this.sendGlobal('challenge ' + username); };
PSClient.prototype.acceptChallenge = function (username) { this.sendGlobal('accept ' + username); };
PSClient.prototype.setShadowMode = function (enabled) { this.shadowMode = !!enabled; };

PSClient.prototype.handleMessage = function (raw) {
    var lines = String(raw || '').split(/\r?\n/);
    var room = '';
    if (lines.length && lines[0].charAt(0) !== '|') room = lines.shift();
    var payload = lines.join('\n');
    if (!payload) return;
    if (room) this.currentRoom = room;
    if (this.onProtocol && !room) this.onProtocol({ type: 'global', raw: payload });
    var updateUser = payload.match(/\|updateuser\|([^|\n]+)\|([^|\n]*)/);
    if (updateUser && updateUser[2] === '1') {
        this.loggedIn = true;
        this.userId = updateUser[1];
        if (this.onConnection) this.onConnection('loggedIn', { username: updateUser[1] });
        if (this.rival) {
            this.sendGlobal('challenge ' + this.rival + ', ' + this.challengeFormat);
        }
    }
    var challenge = payload.match(/\|challstr\|([^\n]*)\|([^\n]*)/);
    // #region debug-point A:challstr
    if (challenge) {
        this.challstr = challenge[1] + '|' + challenge[2];
        if (this.onConnection) this.onConnection('challstr', { hasChallstr: true });
        this.login();
    }
    // #endregion
    if (room && room.indexOf('battle-') === 0) this.handleBattlePayload(room, payload);
};

PSClient.prototype.login = function () {
    var self = this;
    if (!this.username || !this.password) throw new Error('PS_USERNAME and PS_PASSWORD are required for login');
    return Promise.resolve(this.loginRequest({ username: this.username, password: this.password, challstr: this.challstr, server: this.server })).then(function (loginResult) {
        var assertion = typeof loginResult === 'string' ? loginResult : loginResult.assertion;
        var userid = typeof loginResult === 'string' ? self.username : loginResult.userid;
        self.send('|/trn ' + self.username + ',0,' + assertion);
        self.loggedIn = false;
        self.userId = userid;
        if (self.onConnection) self.onConnection('loginAccepted', { username: userid });
        return assertion;
    });
};

PSClient.prototype.handleBattlePayload = function (room, payload) {
    var session = this.sessions[room];
    if (!session) {
        session = this.sessions[room] = new adapter.BattleSession(room);
        this.onBattleStart(session, room);
    }
    var events = adapter.parseProtocol(payload);
    for (var i = 0; i < events.length; i++) {
        var event = events[i];
        this.onProtocol(event, room, session);
        if (event.type === 'request') {
            session.applyRequest(event.request);
            var actions = adapter.requestActions(event.request);
            this.lastActions[room] = actions;
            this.onRequest(event.request, actions, session);
        } else session.applyEvent(event);
        if (event.type === 'win' || event.type === 'tie' || event.type === 'deinit') this.endBattle(room, session, event);
    }
};

PSClient.prototype.chooseAction = function (action, room) {
    room = room || this.currentRoom;
    var session = room ? this.sessions[room] : null;
    var command = typeof action === 'string' ? action : adapter.actionToCommand(action);
    if (!command) throw new Error('Unsupported PS action');
    if (this.shadowMode) {
        if (session) session.lastChosenAction = action;
        return { sent: false, command: command, action: action, room: room };
    }
    this.sendRoom(room, command.slice(1));
    if (session) session.lastChosenAction = action;
    return { sent: true, command: command, action: action, room: room };
};

PSClient.prototype.endBattle = function (room, session, event) {
    delete this.sessions[room];
    delete this.lastActions[room];
    this.onBattleEnd(session, event, room);
};

module.exports = { PSClient: PSClient, defaultLoginRequest: defaultLoginRequest };
