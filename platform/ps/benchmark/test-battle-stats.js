'use strict';

var assert = require('assert');
var stats = require('./battle-stats.js');

function event(type, args, turn) {
    return { type: type, args: args || [], turn: turn };
}

function baseProtocol() {
    return [
        event('player', ['p1', 'Bot']),
        event('player', ['p2', 'foulplaybot']),
        event('teamsize', ['p1', '2']),
        event('teamsize', ['p2', '2']),
        event('poke', ['p1', 'Alpha']),
        event('poke', ['p1', 'Beta']),
        event('poke', ['p2', 'Gamma']),
        event('poke', ['p2', 'Delta']),
        event('switch', ['p1a: Alpha', 'Alpha', '100/100'], 0),
        event('switch', ['p2a: Gamma', 'Gamma', '100/100'], 0),
        event('turn', ['1'], 1)
    ];
}

var protocol = baseProtocol();
protocol.push(event('move', ['p1a: Alpha', 'Tackle', 'p2a: Gamma'], 1));
protocol.push(event('terastallize', ['p1a: Alpha', 'Fire'], 1));
protocol.push(event('damage', ['p2a: Gamma', '0 fnt'], 1));
protocol.push(event('faint', ['p2a: Gamma'], 1));
protocol.push(event('switch', ['p2a: Delta', 'Delta', '100/100'], 1));
protocol.push(event('move', ['p1a: Alpha', 'Tackle', 'p2a: Delta'], 1));
protocol.push(event('damage', ['p2a: Delta', '0 fnt'], 1));
protocol.push(event('faint', ['p2a: Delta'], 1));
var result = stats.analyzeBattle({
    account: 'Bot',
    opponent: 'foulplaybot',
    turns: 1,
    protocol: protocol
});
assert.strictEqual(result.turns, 1);
assert.strictEqual(result.sides.p1.attackMoveCount, 2);
assert.strictEqual(result.sides.p1.teraUses, 1);
assert.strictEqual(result.sides.p1.firstTeraTurn, 1);
assert.deepStrictEqual(result.sides.p1.teraTurns, [1]);
assert.strictEqual(result.sides.p2.teraUses, 0);
assert.strictEqual(result.sides.p2.firstTeraTurn, null);
assert.strictEqual(result.sides.self.teraUses, 1);
assert.strictEqual(result.sides.p1.firstStrikeKOs, 2);
assert.strictEqual(result.sides.p1.switchInKOs, 1);
assert.strictEqual(result.sides.p2.faints, 2);
assert.strictEqual(result.sides.p2.finalAlive, 0);
assert.strictEqual(result.sides.p1.finalAlive, 2);
assert.strictEqual(result.sides.self, result.sides.p1);
assert.strictEqual(result.sides.opponent, result.sides.p2);
assert.strictEqual(result.normalized.self.switchesPerTurn, 0);
assert.strictEqual(result.survivalLeadByTurn.length, 1);
assert.strictEqual(result.survivalLeadTimeline[2].selfMinusOpponent, 2);

var mixed = baseProtocol();
mixed.push(event('move', ['p2a: Gamma', 'Swords Dance', 'p1a: Alpha'], 1));
mixed.push(event('boost', ['p2a: Gamma', 'atk', '2'], 1));
mixed.push(event('move', ['p1a: Alpha', 'Protect', 'p2a: Gamma'], 1));
mixed.push(event('move', ['p2a: Gamma', 'Tackle', 'p1a: Alpha'], 1));
mixed.push(event('damage', ['p1a: Alpha', '0 fnt'], 1));
mixed.push(event('faint', ['p1a: Alpha'], 1));
var mixedResult = stats.analyzeBattle({
    account: 'Bot',
    opponent: 'foulplaybot',
    protocol: mixed
});
assert.strictEqual(mixedResult.sides.p2.boostEvents, 1);
assert.strictEqual(mixedResult.sides.p2.attackMoveCount, 1);
assert.strictEqual(mixedResult.sides.p2.firstStrikeKOs, 0);
assert.strictEqual(mixedResult.sides.p1.residualFaints, 0);

var noTeamSize = [
    event('player', ['p1', 'Bot']),
    event('player', ['p2', 'foulplaybot']),
    event('poke', ['p1', 'Alpha']),
    event('poke', ['p1', 'Beta']),
    event('poke', ['p2', 'Gamma']),
    event('switch', ['p1a: Alpha', 'Alpha', '100/100'], 0),
    event('switch', ['p2a: Gamma', 'Gamma', '100/100'], 0),
    event('faint', ['p2a: Gamma'], 1)
];
var noTeamSizeResult = stats.analyzeBattle({
    account: 'Bot',
    opponent: 'foulplaybot',
    protocol: noTeamSize
});
assert.strictEqual(noTeamSizeResult.sides.p2.finalAlive, 0);

var residual = baseProtocol();
residual.push(event('status', ['p2a: Gamma', 'brn'], 1));
residual.push(event('damage', ['p2a: Gamma', '0 fnt', '[from] brn'], 1));
residual.push(event('faint', ['p2a: Gamma'], 1));
var residualResult = stats.analyzeBattle({
    account: 'Bot',
    opponent: 'foulplaybot',
    protocol: residual
});
assert.strictEqual(residualResult.sides.p1.firstStrikeKOs, 0);
assert.strictEqual(residualResult.sides.p2.residualFaints, 1);

console.log('battle stats tests passed');
