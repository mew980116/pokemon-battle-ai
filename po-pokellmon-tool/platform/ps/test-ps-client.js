'use strict';

var assert = require('assert');
var clientModule = require('./client.js');

function FakeSocket() {
    this.sent = [];
    this.handlers = {};
}
FakeSocket.prototype.on = function (name, handler) { this.handlers[name] = handler; };
FakeSocket.prototype.send = function (message) { this.sent.push(message); };
FakeSocket.prototype.emit = function (name, value) { if (this.handlers[name]) this.handlers[name](value); };

var requests = [];
var starts = [];
var ends = [];
var protocols = [];
var client = new clientModule.PSClient({
    username: 'TestUser',
    password: 'not-stored',
    server: 'play.pokemonshowdown.com',
    shadowMode: true,
    loginRequest: function (options) {
        requests.push(options);
        return Promise.resolve('assertion-token');
    },
    onRequest: function (request, actions) { starts.push({ request: request, actions: actions }); },
    onBattleStart: function (session) { starts.push(session.roomId); },
    onBattleEnd: function (session) { ends.push(session.roomId); },
    onProtocol: function (event) { protocols.push(event.type); }
});
var socket = new FakeSocket();
client.connect(socket);
socket.emit('open');
assert.strictEqual(client.connected, true);
socket.emit('message', '|challstr|abc|123');
return Promise.resolve().then(function () {
    assert.deepStrictEqual(requests[0], { username: 'TestUser', password: 'not-stored', challstr: 'abc|123', server: 'play.pokemonshowdown.com' });
    assert.deepStrictEqual(socket.sent, ['|/trn TestUser,0,assertion-token']);
    assert.strictEqual(client.loggedIn, false);
    socket.emit('message', '|updateuser|TestUser|1');
    assert.strictEqual(client.loggedIn, true);

    client.challenge('Rival');
    client.acceptChallenge('Rival');
    client.sendPrivateMessage('Rival', 'hello');
    client.sendChat('battle-test', 'public hello');
    client.joinRoom('battle-test');
    client.search('gen8randombattle');
    client.cancelSearch();
    assert.deepStrictEqual(socket.sent.slice(1), ['|/challenge Rival', '|/accept Rival', '|/pm Rival, hello', 'battle-test|public hello', '|/join battle-test', '|/search gen8randombattle', '|/cancelsearch']);

    socket.emit('message', 'battle-test\n|player|p1|TestUser|1|\n|request|{"rqid":1,"side":{"id":"p1","pokemon":[{"ident":"p1: Pikachu","details":"Pikachu, L50","condition":"100/100","active":true}]},"active":[{"moves":[{"id":"thunderbolt","move":"Thunderbolt","disabled":false}]}]}');
    assert.ok(client.sessions['battle-test']);
    assert.strictEqual(starts[0], 'battle-test');
    assert.strictEqual(starts[1].actions[0].type, 'move');
    assert.deepStrictEqual(client.chooseAction(starts[1].actions[0], 'battle-test'), { sent: false, command: '/choose move 1', action: starts[1].actions[0], room: 'battle-test' });
    assert.strictEqual(socket.sent.indexOf('battle-test|choose move 1'), -1);

    client.setShadowMode(false);
    client.chooseAction({ type: 'move', slot: 1 }, 'battle-test');
    assert.strictEqual(socket.sent[socket.sent.length - 1], 'battle-test|/choose move 1');
    socket.emit('message', 'battle-test\n|win|TestUser');
    assert.strictEqual(client.sessions['battle-test'], undefined);
    assert.deepStrictEqual(ends, ['battle-test']);
    assert.ok(protocols.indexOf('request') !== -1);

    // searchFormat 优先于 rival：登录后应走 /search，而不是 /challenge
    var searchSocket = new FakeSocket();
    var searchClient = new clientModule.PSClient({
        username: 'SearchUser',
        password: 'not-stored',
        rival: 'Rival',
        searchFormat: 'gen8randombattle',
        shadowMode: true,
        loginRequest: function () { return Promise.resolve('assertion-search'); }
    });
    searchClient.connect(searchSocket);
    searchSocket.emit('open');
    searchSocket.emit('message', '|challstr|abc|123');
    return Promise.resolve().then(function () {
        searchSocket.emit('message', '|updateuser|SearchUser|1');
        assert.deepStrictEqual(searchSocket.sent, ['|/trn SearchUser,0,assertion-search', '|/search gen8randombattle']);
        console.log('PS client tests passed');
    });
});
