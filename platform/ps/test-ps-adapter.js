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

// 强制换人：只能选替补席的队伍槽位（不是出战位 i+1）
var force = {
    side: { id: 'p1', pokemon: [
        { ident: 'p1: Pikachu', condition: '0 fnt', active: true },
        { ident: 'p1: Charizard', condition: '100/100', active: false },
        { ident: 'p1: Snorlax', condition: '0 fnt', active: false },
        { ident: 'p1: Lapras', condition: '80/100', active: false }
    ] },
    forceSwitch: [true]
};
session.apply(force);
assert.strictEqual(session.pending.type, 'forceSwitch');
assert.deepStrictEqual(adapter.requestActions(force), [{ type: 'switch', slot: 2 }, { type: 'switch', slot: 4 }]);

// wait:true（等对手出招）没有可选项
assert.deepStrictEqual(adapter.requestActions({
    wait: true,
    side: { id: 'p1', pokemon: [{ ident: 'p1: Pikachu', condition: '100/100', active: true }] }
}), []);

// forceSwitch:[false] 是正常回合：招式 + 替补换人
assert.deepStrictEqual(adapter.requestActions({
    side: { id: 'p1', pokemon: [
        { ident: 'p1: Pikachu', condition: '100/100', active: true },
        { ident: 'p1: Charizard', condition: '100/100', active: false }
    ] },
    forceSwitch: [false],
    active: [{ moves: [{ move: 'Tackle', id: 'tackle', disabled: false }] }]
}), [
    { type: 'move', slot: 1, id: 'tackle', name: 'Tackle' },
    { type: 'switch', slot: 2 }
]);

// 被困住时不能把替补席加入候选，否则发出非法 switch 后对局会卡在同一个 rqid
assert.deepStrictEqual(adapter.requestActions({
    side: { id: 'p1', pokemon: [
        { ident: 'p1: Pikachu', condition: '100/100', active: true },
        { ident: 'p1: Charizard', condition: '100/100', active: false }
    ] },
    active: [{
        trapped: true,
        moves: [{ move: 'Tackle', id: 'tackle', disabled: false }]
    }]
}), [
    { type: 'move', slot: 1, id: 'tackle', name: 'Tackle' }
]);

// 极巨化 / 钛晶化：作为独立选项出现，命令是 /choose move N dynamax | terastallize
var gen8 = {
    side: { id: 'p1', pokemon: [{ ident: 'p1: Cresselia', condition: '100/100', active: true }] },
    active: [{ canDynamax: true, moves: [
        { move: 'Psychic', id: 'psychic', disabled: false },
        { move: 'Moonblast', id: 'moonblast', disabled: true }
    ] }]
};
assert.deepStrictEqual(adapter.requestActions(gen8), [
    { type: 'move', slot: 1, id: 'psychic', name: 'Psychic' },
    { type: 'move', slot: 1, id: 'psychic', name: 'Psychic', dynamax: true }
]);
assert.strictEqual(adapter.actionToCommand({ type: 'move', slot: 1, dynamax: true }), '/choose move 1 dynamax');

var gen9 = {
    side: { id: 'p1', pokemon: [{ ident: 'p1: Meowscarada', condition: '100/100', active: true }] },
    active: [{ canTerastallize: 'Grass', moves: [{ move: 'Flower Trick', id: 'flowertrick', disabled: false }] }]
};
assert.deepStrictEqual(adapter.requestActions(gen9), [
    { type: 'move', slot: 1, id: 'flowertrick', name: 'Flower Trick' },
    { type: 'move', slot: 1, id: 'flowertrick', name: 'Flower Trick', tera: true, teraType: 'Grass' }
]);
assert.strictEqual(adapter.actionToCommand({ type: 'move', slot: 1, tera: true }), '/choose move 1 terastallize');

// 开局选人：每个候选 = 谁首发 + 对应的整队顺序
var preview = {
    teamPreview: true,
    side: { id: 'p1', pokemon: [
        { ident: 'p1: A', details: 'A', condition: '100/100', active: true },
        { ident: 'p1: B', details: 'B', condition: '100/100', active: true },
        { ident: 'p1: C', details: 'C', condition: '100/100', active: true }
    ] }
};
assert.deepStrictEqual(adapter.requestActions(preview), [
    { type: 'team', lead: 1, order: '123' },
    { type: 'team', lead: 2, order: '213' },
    { type: 'team', lead: 3, order: '312' }
]);
assert.strictEqual(adapter.actionToCommand({ type: 'team', lead: 2, order: '213' }), '/choose team 213');

// |poke| 事件：开局亮出的对手成员要记进队伍（工厂/team preview 才发）
var pokeSession = new adapter.BattleSession('battle-poke');
pokeSession.apply('|player|p2|Bob|\n|poke|p2|Gourgeist-*, M|\n|poke|p2|Jolteon, F|');
assert.strictEqual(pokeSession.sides.p2.team.length, 2);
assert.strictEqual(pokeSession.sides.p2.team[0].name, 'Gourgeist-*');

// 同一次 team preview：先 |poke| 亮出自己队伍，再来 request —— 不能重复记账
var pvSession = new adapter.BattleSession('battle-pv');
pvSession.apply('|player|p1|Alice|\n|poke|p1|Wishiwashi|\n|poke|p1|Shiftry|');
pvSession.applyRequest({ teamPreview: true, side: { id: 'p1', pokemon: [
    { ident: 'p1: Wishiwashi', details: 'Wishiwashi', condition: '241/241', active: true },
    { ident: 'p1: Shiftry', details: 'Shiftry', condition: '100/100', active: true }
] } });
assert.strictEqual(pvSession.sides.p1.team.length, 2);

// 等级/道具/特性：等级从 details 取，道具/特性从 |item| / |ability| / |-enditem| 事件记
var infoSession = new adapter.BattleSession('battle-info');
infoSession.apply('|player|p2|Bob|\n|switch|p2a: Gyarados|Gyarados, L80, M|100/100\n|ability|p2a: Gyarados|Intimidate|\n|item|p2a: Gyarados|Leftovers');
assert.strictEqual(infoSession.sides.p2.team[0].level, 80);
assert.strictEqual(infoSession.sides.p2.team[0].ability, 'Intimidate');
assert.strictEqual(infoSession.sides.p2.team[0].item, 'Leftovers');
infoSession.apply('|-enditem|p2a: Gyarados|Leftovers|[from] move: Knock Off');
assert.strictEqual(infoSession.sides.p2.team[0].item, null);

console.log('PS adapter tests passed');
