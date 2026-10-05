'use strict';

var assert = require('assert');
var rules = require('./rules-provider.js');

function move(name, slot) {
    return { name: name, id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, ''), slot: slot };
}

function lowHpSwitchState() {
    return {
        gen: 8,
        me: {
            name: 'Dragapult',
            hpPct: 23.3,
            hp: 74,
            maxHp: 318,
            level: 100,
            item: 'lifeorb',
            ability: 'clearbody',
            types: ['Dragon', 'Ghost'],
            moves: [
                move('Dragon Darts', 1),
                move('Dragon Dance', 2),
                move('Phantom Force', 3),
                move('Substitute', 4)
            ]
        },
        opp: {
            name: 'Buzzwole',
            hpPct: 100,
            hp: 100,
            maxHp: 100,
            level: 100,
            types: ['Bug', 'Fighting'],
            moves: []
        },
        bench: [{
            name: 'Corviknight',
            slot: 3,
            hpPct: 100,
            hp: 281,
            maxHp: 281,
            level: 100,
            item: 'lifeorb',
            ability: 'pressure',
            types: ['Flying', 'Steel'],
            moves: [
                move('Brave Bird', 1),
                move('U-turn', 2),
                move('Roost', 3),
                move('Iron Head', 4)
            ]
        }]
    };
}

var state = lowHpSwitchState();
var selected = rules.rulesAction(state);
assert.strictEqual(selected.type, 'switch');
assert.strictEqual(selected.slot, 3);

var unsafeState = lowHpSwitchState();
unsafeState.me.hpPct = 15;
unsafeState.me.hp = 48;
unsafeState.opp.moves = [move('Close Combat', 1)];
unsafeState.opp.types = ['Fighting'];
unsafeState.bench[0].hpPct = 25;
unsafeState.bench[0].hp = 70;
assert.notStrictEqual(rules.rulesAction(unsafeState).type, 'switch');

var weatherState = lowHpSwitchState();
weatherState.weather = 'Sandstorm';
weatherState.me.name = 'Slowking';
weatherState.me.hpPct = 30.3;
weatherState.me.hp = 119;
weatherState.me.maxHp = 393;
weatherState.me.types = ['Water', 'Psychic'];
weatherState.me.moves = [move('Slack Off', 1), move('Scald', 2)];
weatherState.opp.name = 'Melmetal';
weatherState.opp.types = ['Steel'];
weatherState.opp.moves = [move('Double Iron Bash', 1)];
assert.notStrictEqual(rules.rulesAction(weatherState).slot, 1);

var contactState = lowHpSwitchState();
contactState.me.name = 'Toxapex';
contactState.me.hpPct = 5;
contactState.me.hp = 20;
contactState.me.maxHp = 400;
contactState.me.types = ['Water', 'Poison'];
contactState.me.moves = [move('Knock Off', 1), move('Recover', 2)];
contactState.opp.name = 'Ferrothorn';
contactState.opp.types = ['Grass', 'Steel'];
contactState.opp.ability = 'ironbarbs';
contactState.opp.item = 'rockyhelmet';
contactState.opp.moves = [move('Power Whip', 1)];
assert.ok(rules.scoreMove({ type: 'move', slot: 1, name: 'Knock Off' },
    contactState, 8) < 0);

var delayedScore = rules.scoreMove({
    type: 'move',
    slot: 3,
    id: 'phantomforce',
    name: 'Phantom Force'
}, state, 8);
var directScore = rules.scoreMove({
    type: 'move',
    slot: 1,
    id: 'dragondarts',
    name: 'Dragon Darts'
}, state, 8);
assert.ok(delayedScore < directScore);

console.log('rules provider tests passed');
