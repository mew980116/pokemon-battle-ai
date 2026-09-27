'use strict';

var assert = require('assert');
var adapter = require('./adapter.js');
var bridgeModule = require('./decision-bridge.js');

function fakeResponse(body) {
    return {
        statusCode: 200,
        setEncoding: function () {},
        on: function (name, handler) {
            if (name === 'data') handler(JSON.stringify(body));
            if (name === 'end') handler();
        }
    };
}
function fakeRequest(options, callback) {
    fakeRequest.options = options;
    callback(fakeResponse({ type: 'attack', attackSlot: 2 }));
    return { on: function () {}, end: function () {} };
}

var session = new adapter.BattleSession('battle-bridge');
session.apply('|player|p1|Alice|1|\n|turn|3\n|switch|p1a: Pikachu|Pikachu, L50|80/100\n|switch|p2a: Garchomp|Garchomp, L50|100/100\n|weather|RainDance');
var request = { side: { id: 'p1', pokemon: [{ ident: 'p1: Pikachu', details: 'Pikachu, L50', condition: '80/100', active: true }] }, active: [{ moves: [{ id: 'tackle', move: 'Tackle', disabled: false }, { id: 'protect', move: 'Protect', disabled: false }] }] };
session.applyRequest(request);
var actions = adapter.requestActions(request);

var sent = [];
var client = { onRequest: function () {}, chooseAction: function (action, room) { sent.push({ action: action, room: room }); return { sent: true }; } };
var bridge = new bridgeModule.DecisionBridge({ url: 'http://127.0.0.1:8092/choice', request: fakeRequest, shadow: true });
bridge.attachClient(client);
return bridge.handleRequest(request, [{ type: 'move', slot: 1 }], session).then(function (record) {
    assert.strictEqual(fakeRequest.options.path.indexOf('/choice?state='), 0);
    var state = record.state;
    assert.strictEqual(state.turn, 3);
    assert.strictEqual(state.battleId, 'battle-bridge');
    assert.strictEqual(state.weather, 'RainDance');
    assert.strictEqual(state.me.moves[1].name, 'Protect');
    assert.strictEqual(record.action.type, 'move');
    assert.strictEqual(record.action.slot, 2);
    assert.strictEqual(sent.length, 0);

    bridge.shadow = false;
    return bridge.handleRequest(request, [], session);
}).then(function (record) {
    assert.strictEqual(record.shadow, false);
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual(sent[0].action, { type: 'move', slot: 2 });
    assert.strictEqual(sent[0].room, 'battle-bridge');
    assert.deepStrictEqual(bridge.toPSAction({ type: 'switch', pokeSlot: 4 }), { type: 'switch', slot: 4 });

    // agent='random'：不请求决策服务，直接发本地随机合法动作
    var localSent = [];
    var localBridge = new bridgeModule.DecisionBridge({
        agent: 'random',
        shadow: false,
        request: function () { throw new Error('decision service must not be called in random mode'); }
    });
    localBridge.attachClient({ onRequest: function () {}, chooseAction: function (action, room) { localSent.push({ action: action, room: room }); return { sent: true }; } });
    return localBridge.handleRequest(request, actions, session).then(function (localRecord) {
        assert.strictEqual(localRecord.fallback, true);
        assert.strictEqual(localSent.length, 1);
        assert.strictEqual(localSent[0].room, 'battle-bridge');
        assert.ok(['move', 'switch', 'team'].indexOf(localSent[0].action.type) !== -1);
    });
}).then(function () {
    // llm 模式但决策服务报错：退回本地随机动作（不发动作会让对战卡住）
    var errorSent = [];
    var errorBridge = new bridgeModule.DecisionBridge({
        agent: 'llm',
        shadow: false,
        request: function () {
            return { on: function (name, handler) { if (name === 'error') handler(new Error('service down')); }, end: function () {} };
        }
    });
    errorBridge.attachClient({ onRequest: function () {}, chooseAction: function (action, room) { errorSent.push(action); return { sent: true }; } });
    return errorBridge.handleRequest(request, actions, session).then(function (fallbackRecord) {
        assert.strictEqual(fallbackRecord.fallback, true);
        assert.strictEqual(errorSent.length, 1);
        console.log('PS decision bridge tests passed');
    });
});
