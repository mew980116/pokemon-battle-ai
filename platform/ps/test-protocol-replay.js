'use strict';

var assert = require('assert');
var replay = require('./protocol-replay.js');

var request = {
    rqid: 1,
    formatid: 'gen9randombattle',
    side: {
        id: 'p1',
        name: 'Alice',
        pokemon: [
            { ident: 'p1: Pikachu', details: 'Pikachu, L50', condition: '100/100', active: true },
            { ident: 'p1: Charizard', details: 'Charizard, L50', condition: '100/100', active: false }
        ]
    },
    active: [{
        moves: [{ id: 'thunderbolt', move: 'Thunderbolt', disabled: false }]
    }]
};

var raw = [
    '>battle-gen9randombattle-replay',
    '|gen|9',
    '|tier|[Gen 9] Random Battle',
    '|player|p1|Alice|1|',
    '|player|p2|Bob|1|',
    '|teamsize|p1|2',
    '|teamsize|p2|2',
    '|request|' + JSON.stringify(request),
    '|turn|1',
    '|switch|p1a: Pikachu|Pikachu, L50|100/100',
    '|switch|p2a: Garchomp|Garchomp, L50|100/100',
    '|move|p1a: Pikachu|Thunderbolt|p2a: Garchomp',
    '|-damage|p2a: Garchomp|0 fnt',
    '|faint|p2a: Garchomp',
    '|-terastallize|p1a: Pikachu|Electric',
    '|win|Alice',
    '|deinit|battle-gen9randombattle-replay'
].join('\n');

var result = replay.replayText(raw, { snapshots: true });
assert.strictEqual(result.sourceType, 'protocol');
assert.strictEqual(result.roomId, 'battle-gen9randombattle-replay');
assert.strictEqual(result.summary.gen, 9);
assert.strictEqual(result.summary.format, '[Gen 9] Random Battle');
assert.strictEqual(result.summary.turn, 1);
assert.strictEqual(result.summary.ended, true);
assert.deepStrictEqual(result.summary.result, { type: 'win', winner: 'Alice' });
assert.strictEqual(result.summary.sides.p1.active.name, 'Pikachu');
assert.strictEqual(result.summary.sides.p1.active.teraType, 'Electric');
assert.strictEqual(result.summary.sides.p1.active.moves[0], 'Thunderbolt');
assert.strictEqual(result.summary.sides.p2.active.fainted, true);
assert.strictEqual(result.snapshots.length, 4);

var benchmarkRow = {
    room: 'battle-jsonl-replay',
    protocol: [
        { type: 'gen', rawType: 'gen', args: ['9'] },
        { type: 'tier', rawType: 'tier', args: ['[Gen 9] Random Battle'] },
        { type: 'switch', rawType: 'switch', args: ['p1a: Eevee', 'Eevee, L50', '100/100'] },
        { type: 'turn', rawType: 'turn', args: ['2'], turn: 2 },
        { type: 'win', rawType: 'win', args: ['Bob'] }
    ]
};
var jsonResult = replay.replayText(JSON.stringify(benchmarkRow), { snapshots: true });
assert.strictEqual(jsonResult.sourceType, 'json');
assert.strictEqual(jsonResult.roomId, 'battle-jsonl-replay');
assert.strictEqual(jsonResult.summary.gen, 9);
assert.strictEqual(jsonResult.summary.turn, 2);
assert.deepStrictEqual(jsonResult.summary.result, { type: 'win', winner: 'Bob' });

var jsonlResult = replay.replayText([
    JSON.stringify({ type: 'protocol', data: { room: 'battle-log-replay', event: { type: 'player', rawType: 'player', args: ['p1', 'Alice', '1', ''] } } }),
    JSON.stringify({ type: 'protocol', data: { room: 'battle-log-replay', event: { type: 'win', rawType: 'win', args: ['Alice'] } } })
].join('\n'));
assert.strictEqual(jsonlResult.roomId, 'battle-log-replay');
assert.strictEqual(jsonlResult.summary.ended, true);
assert.deepStrictEqual(jsonlResult.summary.result, { type: 'win', winner: 'Alice' });

console.log('PS protocol replay tests passed');
