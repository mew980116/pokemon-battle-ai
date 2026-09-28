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
session.apply('|player|p1|Alice|1|\n|player|p2|Bob|2|\n|teamsize|p1|3\n|teamsize|p2|6\n|turn|3\n|switch|p1a: Pikachu|Pikachu, L50|80/100\n|switch|p2a: Garchomp|Garchomp, L50|100/100\n|weather|RainDance');
var request = { rqid: 17, formatid: 'gen8randombattle', side: { id: 'p1', pokemon: [
    { ident: 'p1: Pikachu', details: 'Pikachu, L50', condition: '80/100', active: true, item: 'Light Ball', ability: 'Static', stats: { atk: 55, def: 40, spa: 50, spd: 50, spe: 90 } },
    { ident: 'p1: Charizard', details: 'Charizard, L50', condition: '100/100', active: false, stats: { atk: 84, def: 78, spa: 109, spd: 85, spe: 100 } }
] }, active: [{ moves: [{ id: 'tackle', move: 'Tackle', disabled: false }, { id: 'protect', move: 'Protect', disabled: false }] }] };
session.applyRequest(request);
var actions = adapter.requestActions(request);

var sent = [];
var client = { onRequest: function () {}, chooseAction: function (action, room) { sent.push({ action: action, room: room }); return { sent: true }; } };
var bridge = new bridgeModule.DecisionBridge({ url: 'http://127.0.0.1:8092/choice', request: fakeRequest, shadow: true });
bridge.attachClient(client);
return bridge.handleRequest(request, actions, session).then(function (record) {
    assert.strictEqual(fakeRequest.options.path.indexOf('/choice?state='), 0);
    var state = record.state;
    assert.strictEqual(state.turn, 3);
    assert.strictEqual(state.battleId, 'battle-bridge');
    assert.strictEqual(state.platform, 'ps');
    assert.strictEqual(state.rqid, 17);
    assert.strictEqual(state.gen, 8);
    assert.strictEqual(state.format, 'gen8randombattle');
    assert.strictEqual(state.weather, 'RainDance');
    assert.strictEqual(state.me.moves[1].name, 'Protect');
    assert.strictEqual(state.me.moves.length, 2);   // 招式以 request 为准，不是「用过的」
    assert.strictEqual(state.bench.length, 1);      // 出战中的那只不能出现在替补席（替补只剩 Charizard）
    assert.strictEqual(state.bench[0].name, 'Charizard');
    // 补充字段：等级/属性/道具 + 我方六维(myStats) + 对手剩余只数
    assert.strictEqual(state.me.level, 50);
    assert.deepStrictEqual(state.me.types, ['Electric']);
    assert.strictEqual(state.me.item, 'Light Ball');
    assert.strictEqual(state.me.hpPct, 80);
    assert.strictEqual(state.myStats[0].stats.spe, 90);
    assert.strictEqual(state.myStats[1].name, 'Charizard');
    assert.strictEqual(state.oppRemaining, 6);      // |teamsize|p2|6，一只都没倒
    assert.strictEqual(record.action.type, 'move');
    assert.strictEqual(record.action.slot, 2);
    assert.strictEqual(sent.length, 0);

    bridge.shadow = false;
    var nextRequest = Object.assign({}, request, { rqid: 18 });
    return bridge.handleRequest(nextRequest, actions, session);
}).then(function (record) {
    assert.strictEqual(record.shadow, false);
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual(sent[0].action, { type: 'move', slot: 2 });
    assert.strictEqual(sent[0].room, 'battle-bridge');
    assert.deepStrictEqual(bridge.toPSAction({ type: 'switch', pokeSlot: 4 }), { type: 'switch', slot: 4 });

    // 没有可选项的请求（PS 的 wait:true）：不调决策服务，否则白烧一整轮 LLM
    var skipCalls = 0;
    var skipBridge = new bridgeModule.DecisionBridge({
        agent: 'llm',
        shadow: false,
        request: function () { skipCalls++; throw new Error('没有可选项时不该调决策服务'); }
    });
    skipBridge.attachClient({ onRequest: function () {}, chooseAction: function () { return { sent: true }; } });
    return skipBridge.handleRequest({ wait: true }, [], session).then(function (skipRecord) {
        assert.strictEqual(skipRecord, null);
        assert.strictEqual(skipCalls, 0);
    });

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
    });
}).then(function () {
    // 服务给了不在本次可选项里的动作（例如 team preview 却回了招式）：同样退回本地，否则会被服务器拒掉卡住
    var offListSent = [];
    var offListBridge = new bridgeModule.DecisionBridge({
        agent: 'llm',
        shadow: false,
        request: function (options, callback) {
            callback(fakeResponse({ type: 'attack', attackSlot: 9 }));
            return { on: function () {}, end: function () {} };
        }
    });
    offListBridge.attachClient({ onRequest: function () {}, chooseAction: function (action, room) { offListSent.push(action); return { sent: true }; } });
    return offListBridge.handleRequest(request, actions, session).then(function (offListRecord) {
        assert.strictEqual(offListRecord.fallback, true);
        assert.ok(offListSent[0].slot === 1 || offListSent[0].slot === 2, '兜底动作必须落在可选项里');
    });
}).then(function () {
    // 开局选人：服务给 lead → 用本地候选（带整队顺序）发 /choose team
    var previewRequest = {
        teamPreview: true,
        side: { id: 'p1', pokemon: [
            { ident: 'p1: A', details: 'A, L50, F', condition: '100/100', active: true, moves: ['tackle', 'protect'] },
            { ident: 'p1: B', details: 'B, L50, M', condition: '100/100', active: true, moves: ['ember'] },
            { ident: 'p1: C', details: 'C, L50', condition: '100/100', active: true, moves: [] }
        ] }
    };
    var pvSession = new adapter.BattleSession('battle-preview');
    pvSession.apply('|player|p1|Alice|1|');
    pvSession.applyRequest(previewRequest);
    var pvActions = adapter.requestActions(previewRequest);
    var pvSent = [];
    var pvBridge = new bridgeModule.DecisionBridge({
        agent: 'llm',
        shadow: false,
        request: function (options, callback) {
            callback(fakeResponse({ type: 'team', lead: 3 }));
            return { on: function () {}, end: function () {} };
        }
    });
    pvBridge.attachClient({ onRequest: function () {}, chooseAction: function (action, room) { pvSent.push(action); return { sent: true }; } });
    return pvBridge.handleRequest(previewRequest, pvActions, pvSession).then(function (pvRecord) {
        assert.strictEqual(pvRecord.state.teamPreview, true);
        assert.strictEqual(pvRecord.state.myTeam.length, 3);
        assert.strictEqual(pvRecord.state.bench.length, 0, 'team preview 全员都是 active，替补应为空');
        assert.strictEqual(pvRecord.state.myTeam[0].details, 'A, L50, F', '候选要带 details（服务据此取等级）');
        assert.deepStrictEqual(pvRecord.state.myTeam[0].moveIds, ['tackle', 'protect'], '候选要带招式 id');
        assert.strictEqual(pvRecord.fallback, undefined, '服务给的是合法首发，不该走兜底');
        assert.deepStrictEqual(pvSent[0], { type: 'team', lead: 3, order: '312' });
        console.log('PS decision bridge tests passed');
    });
});
