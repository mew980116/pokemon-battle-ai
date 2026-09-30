'use strict';

var assert = require('assert');
var contract = require('./decision-contract.js');
var router = require('./decision-router.js');

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

process.env.POKELLMON_DECISION_ROUTING_JSON = JSON.stringify({
    default: 'llm',
    accounts: { 'mapped-bot': 'random' },
    allowClientHint: true
});
assert.strictEqual(router.resolveProvider({ account: 'mapped-bot', providerHint: 'llm' }), 'random');
assert.strictEqual(router.resolveProvider({ account: 'other-bot', providerHint: 'random' }), 'random');

console.log('decision router tests passed');
