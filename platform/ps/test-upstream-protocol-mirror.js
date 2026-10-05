'use strict';

var assert = require('assert');
var mirror = require('./upstream-protocol-mirror.js');

function testScreenDurationParity() {
    var baseline = {
        weather: null,
        field: null,
        user: {
            active: { name: 'Baxcalibur', hp: 100, maxHp: 100, status: null, boosts: {}, moves: [] },
            reserve: [],
            sideConditions: { auroraveil: 7 }
        },
        opponent: {
            active: { name: 'Gholdengo', hp: 100, maxHp: 100, status: null, boosts: {}, moves: [] },
            reserve: []
        }
    };
    var state = {
        me: {
            name: 'Baxcalibur',
            hp: 100,
            hpPct: 100,
            status: null,
            boosts: [],
            moves: [],
            moveDetails: {}
        },
        opp: {
            name: 'Gholdengo',
            hp: 100,
            hpPct: 100,
            status: null,
            boosts: [],
            moves: [],
            moveDetails: {}
        },
        myTeam: [],
        oppTeam: [],
        weather: null,
        terrain: null,
        sideConditionDetails: {
            me: {
                'move: Aurora Veil': {
                    id: 'auroraveil',
                    count: 1,
                    turnsRemaining: 7
                }
            }
        }
    };
    var result = mirror.compareBaselineState(baseline, state);
    assert.ok(!result.differences.includes('side-condition-auroraveil'));
}

function testPublicFormAliasAndBaselineHpClassification() {
    var baseline = {
        weather: null,
        field: null,
        user: {
            active: { name: 'Pikachu', hp: 100, maxHp: 100, status: null, boosts: {}, moves: [] },
            reserve: []
        },
        opponent: {
            active: { name: 'Necrozma', hp: 100, maxHp: 100, status: null, boosts: {}, moves: [] },
            reserve: [
                { name: 'Cramorant', hp: 261, maxHp: 261, status: null, boosts: {}, moves: [] },
                { name: 'Slowbro', hp: 300, maxHp: 300, status: null, boosts: {}, moves: [] }
            ]
        }
    };
    var state = {
        history: [
            '|switch|p2a: Cramorant|Cramorant-Gulping, L80|52/100',
            '|switch|p2a: Slowbro|Slowbro, L85|100/100',
            '|-damage|p2a: Slowbro|78/100'
        ],
        me: {
            name: 'Pikachu', hp: 100, hpPct: 100, status: null, boosts: [],
            moves: [], moveDetails: {}
        },
        opp: {
            name: 'Necrozma', hp: 100, hpPct: 100, status: null, boosts: [],
            moves: [], moveDetails: {}
        },
        myTeam: [],
        oppTeam: [
            { name: 'Cramorant-Gulping', hpPct: 52, hp: 52, maxHp: 100, status: null, boosts: [], moves: [] },
            { name: 'Slowbro', hpPct: 78, hp: 78, maxHp: 100, status: null, boosts: [], moves: [] },
            { name: 'Necrozma', hpPct: 100, hp: 100, maxHp: 100, status: null, boosts: [], moves: [] }
        ],
        weather: null,
        terrain: null,
        sideConditionDetails: {}
    };
    var result = mirror.compareBaselineState(baseline, state);
    assert.ok(!result.differences.includes('public-cramorant-missing'));
    assert.ok(!result.differences.includes('public-slowbro-hp'));
    assert.ok(result.baselineSummaryDifferences.includes('baseline-public-slowbro-hp'));
}

testScreenDurationParity();
testPublicFormAliasAndBaselineHpClassification();
console.log('upstream protocol mirror tests passed');
