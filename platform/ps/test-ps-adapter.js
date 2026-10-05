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
assert.strictEqual(session.weather, 'raindance');
assert.strictEqual(session.field['Electric Terrain'], true);
assert.strictEqual(session.sides.p1.active.name, 'Pikachu');
assert.strictEqual(session.sides.p1.active.moves[0], 'Thunderbolt');
assert.strictEqual(session.sides.p2.active.hp.percent, 0);
assert.strictEqual(session.sides.p2.active.fainted, true);
assert.strictEqual(session.sides.p2.sideConditions['Stealth Rock'], true);

// 形态变化必须更新当前公开名称，不能继续使用 ident 中的基础形态名。
var formeSession = new adapter.BattleSession('battle-forme');
formeSession.apply([
    '|switch|p2a: Terapagos|Terapagos, L77, F|100/100',
    '|detailschange|p2a: Terapagos|Terapagos-Terastal, L77, F'
].join('\n'));
assert.strictEqual(formeSession.sides.p2.active.name, 'Terapagos-Terastal');

// 倒下后不能把上一条战报中的 boost 带到后续状态。
var faintBoostSession = new adapter.BattleSession('battle-faint-boost');
faintBoostSession.apply([
    '|switch|p1a: Armarouge|Armarouge, L80, F|100/100',
    '|-boost|p1a: Armarouge|spa|1',
    '|-damage|p1a: Armarouge|0 fnt',
    '|faint|p1a: Armarouge'
].join('\n'));
assert.deepStrictEqual(faintBoostSession.sides.p1.active.boosts, {});

// 状态字段统一保存为 Foul Play 可识别的内部 id。
var fieldSession = new adapter.BattleSession('battle-field');
fieldSession.apply([
    '|-weather|RainDance',
    '|-fieldstart|move: Electric Terrain'
].join('\n'));
assert.strictEqual(fieldSession.weather, 'raindance');
assert.strictEqual(fieldSession.fieldState.terrain, 'electricterrain');

// 屏障持续时间必须在设置时记录，不能因为持有 Light Clay 的宝可梦随后换下而缩短。
var screenSession = new adapter.BattleSession('battle-screen-duration');
screenSession.applyRequest({
    rqid: 1,
    side: {
        id: 'p1',
        pokemon: [{
            ident: 'p1: Abomasnow',
            details: 'Abomasnow, L84, F',
            condition: '287/287',
            active: true,
            item: 'lightclay'
        }]
    },
    active: [{ moves: [{ move: 'Aurora Veil', id: 'auroraveil' }] }]
});
screenSession.apply([
    '|turn|9',
    '|-sidestart|p1: Alice|move: Aurora Veil',
    '|switch|p1a: Pikachu|Pikachu, L50|100/100'
].join('\n'));
assert.strictEqual(
    screenSession.sides.p1.sideConditionDetails['move: Aurora Veil'].duration,
    8
);

// 高风险战斗状态：Substitute 命中、Wish/Future Sight 计时以及 Baton Pass 保留 boosts。
var volatileSession = new adapter.BattleSession('battle-volatile-state');
volatileSession.apply([
    '|turn|1',
    '|switch|p1a: Ninjask|Ninjask, L80|100/100',
    '|switch|p2a: Garchomp|Garchomp, L80|100/100',
    '|move|p1a: Ninjask|Substitute|p1a: Ninjask',
    '|-start|p1a: Ninjask|Substitute',
    '|-activate|p1a: Ninjask|Substitute|[damage]',
    '|move|p1a: Ninjask|Baton Pass|p1a: Ninjask',
    '|switch|p1a: Scizor|Scizor, L80|100/100|[from] Baton Pass',
    '|move|p1a: Scizor|Wish|p1a: Scizor',
    '|move|p1a: Scizor|Future Sight|p2a: Garchomp',
    '|-start|p2a: Garchomp|Future Sight',
    '|move|p1a: Scizor|Healing Wish|p1a: Scizor'
].join('\n'));
assert.strictEqual(volatileSession.sides.p1.active.name, 'Scizor');
assert.strictEqual(volatileSession.sides.p1.active.volatile.substitute, true);
// 与 Foul Play battle_modifier 对齐：Baton Pass 传递 Substitute，
// 但新宝可梦的 substitute_hit 标记从 false 开始。
assert.strictEqual(volatileSession.sides.p1.active.substituteHit, false);
volatileSession.sides.p1.active.boosts.spe = 2;
// 用真实的 pending 状态重新触发一次 Baton Pass，验证新对象能继承旧对象的 boosts。
volatileSession.sides.p1.active.boosts.spa = 1;
volatileSession.apply([
    '|move|p1a: Scizor|Baton Pass|p1a: Scizor',
    '|switch|p1a: Rotom|Rotom, L80|100/100|[from] Baton Pass'
].join('\n'));
assert.strictEqual(volatileSession.sides.p1.active.name, 'Rotom');
assert.strictEqual(volatileSession.sides.p1.active.boosts.spa, 1);
assert.strictEqual(volatileSession.sides.p1.active.substituteHit, false);
assert.strictEqual(volatileSession.sides.p1.effects.batonPassing, false);

// Shed Tail 只传递 Substitute，不传递 boosts。
var shedTailSession = new adapter.BattleSession('battle-shed-tail');
shedTailSession.apply([
    '|switch|p1a: Cyclizar|Cyclizar, L80|100/100',
    '|-boost|p1a: Cyclizar|spe|2',
    '|move|p1a: Cyclizar|Substitute|p1a: Cyclizar',
    '|-start|p1a: Cyclizar|Substitute',
    '|-activate|p1a: Cyclizar|Substitute|[damage]',
    '|move|p1a: Cyclizar|Shed Tail|p1a: Cyclizar',
    '|switch|p1a: Baxcalibur|Baxcalibur, L80|100/100|[from] Shed Tail'
].join('\n'));
assert.strictEqual(shedTailSession.sides.p1.active.name, 'Baxcalibur');
assert.deepStrictEqual(shedTailSession.sides.p1.active.boosts, {});
assert.strictEqual(shedTailSession.sides.p1.active.volatile.substitute, true);
assert.strictEqual(shedTailSession.sides.p1.active.substituteHit, false);
assert.strictEqual(shedTailSession.sides.p1.effects.shedTailing, false);

// 普通换人不能继承上一只宝可梦的 boosts 或 volatile。
var ordinarySwitchSession = new adapter.BattleSession('battle-ordinary-switch');
ordinarySwitchSession.apply([
    '|switch|p1a: Ninjask|Ninjask, L80|100/100',
    '|-boost|p1a: Ninjask|spe|2',
    '|-start|p1a: Ninjask|Substitute',
    '|switch|p1a: Scizor|Scizor, L80|100/100'
].join('\n'));
assert.deepStrictEqual(ordinarySwitchSession.sides.p1.team[0].boosts, {});
assert.deepStrictEqual(ordinarySwitchSession.sides.p1.team[0].volatile, {});
assert.deepStrictEqual(ordinarySwitchSession.sides.p1.active.boosts, {});
assert.deepStrictEqual(ordinarySwitchSession.sides.p1.active.volatile, {});
assert.strictEqual(ordinarySwitchSession.sides.p1.active.substituteHit, false);

// Transform/Imposter 在变身时复制目标已有的能力等级。
var transformSession = new adapter.BattleSession('battle-transform-boosts');
transformSession.apply([
    '|switch|p1a: Crawdaunt|Crawdaunt, L84|100/100',
    '|-unboost|p1a: Crawdaunt|def|1',
    '|-unboost|p1a: Crawdaunt|spd|1',
    '|switch|p2a: Ditto|Ditto, L87|100/100',
    '|-transform|p2a: Ditto|p1a: Crawdaunt|[from] ability: Imposter'
].join('\n'));
assert.strictEqual(transformSession.sides.p1.active.boosts.def, -1);
assert.strictEqual(transformSession.sides.p1.active.boosts.spd, -1);
assert.strictEqual(transformSession.sides.p2.active.boosts.def, -1);
assert.strictEqual(transformSession.sides.p2.active.boosts.spd, -1);

var effectSession = new adapter.BattleSession('battle-side-effects');
effectSession.apply([
    '|switch|p1a: Jirachi|Jirachi, L80|100/100',
    '|move|p1a: Jirachi|Wish|p1a: Jirachi',
    '|move|p1a: Jirachi|Future Sight|p2a: Garchomp',
    '|move|p1a: Jirachi|Healing Wish|p1a: Jirachi'
].join('\n'));
assert.strictEqual(effectSession.sides.p1.effects.wish.turnsRemaining, 2);
assert.strictEqual(effectSession.sides.p1.effects.wish.source, 'Jirachi');
assert.strictEqual(effectSession.sides.p1.effects.futureSight.turnsRemaining, 3);
assert.strictEqual(effectSession.sides.p1.effects.healingWish, 1);

var volatileDurationSession = new adapter.BattleSession('battle-volatile-duration');
volatileDurationSession.apply([
    '|switch|p1a: Gengar|Gengar, L80|100/100',
    '|-start|p1a: Gengar|Encore',
    '|move|p1a: Gengar|Shadow Ball|p2a: Garchomp',
    '|-start|p1a: Gengar|Taunt',
    '|move|p1a: Gengar|Shadow Ball|p2a: Garchomp',
    '|upkeep'
].join('\n'));
assert.strictEqual(volatileDurationSession.sides.p1.active.volatileDurations.Encore, 2);
assert.strictEqual(volatileDurationSession.sides.p1.active.volatileDurations.Taunt, 1);

var volatileAliasEndSession = new adapter.BattleSession('battle-volatile-alias-end');
volatileAliasEndSession.apply([
    '|switch|p1a: Gengar|Gengar, L80|100/100',
    '|-start|p1a: Gengar|move: Substitute',
    '|-activate|p1a: Gengar|Substitute|[damage]',
    '|-end|p1a: Gengar|Substitute'
].join('\n'));
assert.deepStrictEqual(volatileAliasEndSession.sides.p1.active.volatile, {});
assert.strictEqual(volatileAliasEndSession.sides.p1.active.substituteHit, false);

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

// 更完整的 PS battle protocol：效果事件保留 rawType，并更新状态、形态和结果。
var extended = adapter.parseProtocol([
    '|gen|8',
    '|tier|[Gen 8] Random Battle',
    '|switch|p1a: Pikachu|Pikachu, L50|100/100',
    '|-start|p1a: Pikachu|Substitute',
    '|-boost|p1a: Pikachu|spe|2',
    '|-damage|p1a: Pikachu|75/100|[from] ps',
    '|-sethp|p1a: Pikachu|50/100',
    '|-formechange|p1a: Pikachu|Pikachu-Gmax, L50',
    '|-terastallize|p1a: Pikachu|Electric',
    '|-end|p1a: Pikachu|Substitute',
    '|win|Alice'
].join('\n'));
assert.strictEqual(extended[2].rawType, 'switch');
assert.strictEqual(extended[3].type, 'start');
assert.strictEqual(extended[6].type, 'sethp');
assert.strictEqual(extended[8].form, 'Electric');
assert.strictEqual(extended[7].details, 'Pikachu-Gmax, L50');
assert.strictEqual(extended[10].subject, 'Alice');

var extendedSession = new adapter.BattleSession('battle-extended');
extendedSession.apply(extended.reduce(function (text, event) {
    return text + '|' + event.rawType + (event.args.length ? '|' + event.args.join('|') : '') + '\n';
}, ''));
assert.strictEqual(extendedSession.gen, 8);
assert.strictEqual(extendedSession.format, '[Gen 8] Random Battle');
assert.strictEqual(extendedSession.sides.p1.active.name, 'Pikachu-Gmax');
assert.strictEqual(extendedSession.sides.p1.active.hp.percent, 50);
assert.strictEqual(extendedSession.sides.p1.active.boosts.spe, 2);
assert.strictEqual(extendedSession.sides.p1.active.teraType, 'Electric');
assert.strictEqual(extendedSession.sides.p1.active.volatile.Substitute, undefined);
assert.strictEqual(extendedSession.ended, true);
assert.deepStrictEqual(extendedSession.result, { type: 'win', winner: 'Alice' });

// team preview 的 active:true 只是预览标记，不应伪造当前出战宝可梦。
var previewSession = new adapter.BattleSession('battle-preview-active');
previewSession.applyRequest({
    teamPreview: true,
    side: { id: 'p1', pokemon: [
        { ident: 'p1: A', details: 'A', condition: '100/100', active: true },
        { ident: 'p1: B', details: 'B', condition: '100/100', active: true }
    ] }
});
assert.strictEqual(previewSession.sides.p1.active, null);

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

// PS 的 stat stage 不能超过 [-6, 6]，重复降速事件也不能生成非法值。
var boostClampSession = new adapter.BattleSession('battle-boost-clamp');
boostClampSession.apply('|switch|p1a: Pikachu|Pikachu, L50|100/100');
boostClampSession.apply(
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1\n' +
    '|-unboost|p1a: Pikachu|spe|1'
);
assert.strictEqual(boostClampSession.sides.p1.active.boosts.spe, -6);

console.log('PS adapter tests passed');
