'use strict';

var assert = require('assert');
var adapter = require('./adapter.js');

var protocol = [
    '|player|p1|Alice|1|',
    '|player|p2|Bob|1|',
    '|teamsize|p1|3',
    '|turn|1',
    '|switch|p1a: Pikachu|Pikachu, L50|100/100',
    '|switch|p2a: Garchomp|Garchomp, L50|100/100',
    '|move|p1a: Pikachu|Thunderbolt|p2a: Garchomp',
    '|damage|p2a: Garchomp|50/100',
    '|status|p2a: Garchomp|par',
    '|weather|RainDance',
    '|fieldstart|Electric Terrain',
    '|sidestart|p2: Bob|Stealth Rock',
    '|faint|p2a: Garchomp',
    '|win|Alice'
].join('\n');

var events = adapter.parseProtocol(protocol);
assert.strictEqual(events.length, 14);
assert.strictEqual(events[4].actor.side, 'p1');
assert.strictEqual(events[4].hp.percent, 100);
assert.strictEqual(events[6].move, 'Thunderbolt');
assert.strictEqual(events[7].hp.percent, 50);
assert.strictEqual(events[11].effect, 'Stealth Rock');

var session = new adapter.BattleSession('battle-test');
session.apply(protocol);
assert.strictEqual(session.roomId, 'battle-test');
assert.strictEqual(session.turn, 1);
assert.strictEqual(session.weather, 'RainDance');
assert.strictEqual(session.field['Electric Terrain'], true);
assert.strictEqual(session.sides.p1.active.name, 'Pikachu');
assert.strictEqual(session.sides.p1.active.moves[0], 'Thunderbolt');
assert.strictEqual(session.sides.p2.active.hp.percent, 0);
assert.strictEqual(session.sides.p2.active.fainted, true);
assert.strictEqual(session.sides.p2.sideConditions['Stealth Rock'], true);

var request = {
    rqid: 7,
    side: { id: 'p1', pokemon: [
        { ident: 'p1: Pikachu', details: 'Pikachu, L50', condition: '100/100', active: true },
        { ident: 'p1: Charizard', details: 'Charizard, L50', condition: '100/100', active: false },
        { ident: 'p1: Snorlax', details: 'Snorlax, L50', condition: '0 fnt', active: false }
    ] },
    active: [{ moves: [
        { move: 'Thunderbolt', id: 'thunderbolt', disabled: false },
        { move: 'Protect', id: 'protect', disabled: true }
    ] }]
};
var actions = adapter.requestActions(request);
assert.deepStrictEqual(actions, [
    { type: 'move', slot: 1, id: 'thunderbolt', name: 'Thunderbolt' },
    { type: 'switch', slot: 2 }
]);
assert.strictEqual(adapter.actionToCommand(actions[0]), '/choose move 1');
assert.strictEqual(adapter.actionToCommand(actions[1]), '/choose switch 2');
assert.strictEqual(adapter.actionToCommand({ type: 'team', order: '321' }), '/choose team 321');

var force = { side: { id: 'p1', pokemon: [] }, forceSwitch: [true] };
session.apply(force);
assert.strictEqual(session.pending.type, 'forceSwitch');
assert.deepStrictEqual(adapter.requestActions(force), [{ type: 'switch', slot: 1, forced: true }]);

console.log('PS adapter tests passed');
