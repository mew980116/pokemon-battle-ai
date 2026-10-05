'use strict';

var assert = require('assert');
var contract = require('./decision-contract.js');
var router = require('./decision-router.js');
var rulesProvider = require('./rules-provider.js');

var poState = {
    platform: 'po',
    account: 'random-bot',
    me: { moves: [{ slot: 0, name: 'Tackle' }] },
    bench: [{ slot: 2, name: 'Pikachu' }]
};

var poActions = contract.getActionCandidates(poState);
assert.strictEqual(poActions.length, 2);
assert.strictEqual(poActions[0].id, 'move:0');
assert.strictEqual(poActions[1].id, 'switch:2');
assert.strictEqual(contract.validateResponseAction({ type: 'attack', attackSlot: 0 }, poState), true);
assert.strictEqual(contract.validateResponseAction({ type: 'switch', pokeSlot: 2 }, poState), true);
assert.strictEqual(contract.validateResponseAction({ type: 'attack', attackSlot: 3 }, poState), false);

var psState = {
    platform: 'ps',
    actions: [
        { type: 'move', slot: 1 },
        { type: 'switch', slot: 2 }
    ]
};
var random = router.randomAction(psState);
assert.ok(random.type === 'move' || random.type === 'switch');
assert.ok(random.slot === 1 || random.slot === 2);

var rulesState = {
    platform: 'ps',
    gen: 9,
    me: { types: ['Electric'], hpPct: 100, moves: [
        { slot: 1, id: 'tackle', name: 'Tackle' },
        { slot: 2, id: 'thunderbolt', name: 'Thunderbolt' }
    ] },
    opp: { types: ['Water', 'Flying'], hpPct: 100, moves: [] },
    actions: [
        { type: 'move', slot: 1, id: 'tackle', name: 'Tackle' },
        { type: 'move', slot: 2, id: 'thunderbolt', name: 'Thunderbolt' }
    ]
};
var rulesAction = router.rulesAction(rulesState);
assert.strictEqual(rulesAction.type, 'move');
assert.strictEqual(rulesAction.slot, 2);

// HP Percentage Mod uses 100 as the protocol denominator. The rules provider
// must convert it back to the calculator's real HP before testing KO lines.
var hpPercentState = {
    platform: 'ps',
    gen: 9,
    me: {
        name: 'Garchomp',
        level: 100,
        hpPct: 100,
        hp: 357,
        maxHp: 357,
        types: ['Dragon', 'Ground'],
        moves: [{ slot: 1, name: 'Tackle' }]
    },
    opp: {
        name: 'Blissey',
        level: 100,
        hpPct: 50,
        hp: 50,
        maxHp: 100,
        types: ['Normal'],
        moves: []
    },
    myStats: [{
        slot: 1,
        name: 'Garchomp',
        hp: 357,
        stats: { hp: 357, atk: 359, def: 226, spa: 176, spd: 206, spe: 333 }
    }]
};
assert.ok(rulesProvider.currentHp(hpPercentState.opp, hpPercentState, 'opp', 9) > 100);
var tackleDamage = rulesProvider.damageRange(
    { type: 'move', slot: 1, name: 'Tackle' },
    hpPercentState.me,
    hpPercentState.opp,
    hpPercentState,
    9,
    'me'
);
assert.ok(tackleDamage && tackleDamage.percentMax < 100);

process.env.POKELLMON_DECISION_ROUTING_JSON = JSON.stringify({
    default: 'llm',
    accounts: { 'mapped-bot': 'random' },
    allowClientHint: true
});
assert.strictEqual(router.resolveProvider({ account: 'mapped-bot', providerHint: 'llm' }), 'random');
assert.strictEqual(router.resolveProvider({ account: 'other-bot', providerHint: 'random' }), 'random');

console.log('decision router tests passed');
