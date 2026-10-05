'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var observerModule = require('./live-observer.js');

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
    callback(fakeResponse({
        bestAction: 'thunderbolt',
        actions: { thunderbolt: 0.75, protect: 0.25 },
        searchTimeMs: 5,
        selfSearchTimeMs: 5,
        opponentSearchTimeMs: 7,
        opponentExploration: 0.1,
        particleCount: 1,
        opponentModelPrediction: { protect: 1 },
        opponentExploration: 0.1,
        particleDiagnostics: [{
            opponentParticleId: 'particle-a',
            opponentBestAction: 'protect',
            opponentTotalVisits: 12,
            opponentSearchTimeMs: 7
        }],
        selfPolicy: { thunderbolt: 0.75, protect: 0.25 },
        opponentPrediction: { protect: 0.6, thunderbolt: 0.25, 'switch charizard': 0.15 },
        rootActionScores: { thunderbolt: { expectedValue: 0.1 } },
        referenceMode: 'sampled-opponent-root-oracle'
    }));
    return {
        on: function () {},
        end: function (body) { fakeRequest.body = body; }
    };
}

var logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'live-observer-')), 'decisions.jsonl');
var messages = [];
var results = [];
var observer = new observerModule.LiveObserver({
    url: 'http://127.0.0.1:8093/reference',
    announce: 'diff-only',
    logFile: logFile,
    timeoutMs: 100,
    request: fakeRequest,
    onResult: function (result) { results.push(result); }
});
var state = {
    battleId: 'battle-observer-test',
    turn: 3,
    rqid: 17,
    format: 'gen9randombattle',
    request: {
        side: { id: 'p1' },
        secret: 'must-not-be-written',
        active: [{ moves: [{ id: 'thunderbolt', move: 'Thunderbolt', disabled: false }] }]
    },
    me: { name: 'Pikachu', hp: 100, maxHp: 100 },
    opp: { name: 'Carbink', hp: 100, maxHp: 100 },
    myTeam: [{ name: 'Pikachu', item: 'lightball' }],
    bench: [{ slot: 2, name: 'Charizard' }],
    oppTeam: [{ name: 'Carbink', moves: [{ id: 'moonblast' }] }],
    actions: [{ type: 'move', slot: 1, id: 'thunderbolt' }]
};
var record = {
    battleId: state.battleId,
    turn: state.turn,
    action: { type: 'move', slot: 1 },
    suggestion: {
        type: 'move',
        slot: 1,
        id: 'thunderbolt',
        decisionProvider: 'dual-view',
        selfSearchTimeMs: 5,
        opponentSearchTimeMs: 7,
        opponentExploration: 0.1,
        particleCount: 1,
        particleDiagnostics: [{ opponentBestAction: 'protect' }],
        selfPolicy: { thunderbolt: 0.75 },
        opponentPrediction: { protect: 0.6, thunderbolt: 0.25, 'switch charizard': 0.15 },
        rootActionScores: { thunderbolt: { expectedValue: 0.1 } }
    },
    state: state
};

observer.observe(record, {
    sendChat: function (room, message) { messages.push({ room: room, message: message }); }
}).then(function (result) {
    assert.strictEqual(result.sameDecision, true);
    assert.strictEqual(result.decisionService.selfSearchTimeMs, 5);
    assert.strictEqual(result.decisionService.opponentSearchTimeMs, 7);
    assert.strictEqual(result.decisionService.opponentExploration, 0.1);
    assert.strictEqual(result.decisionService.particleDiagnostics.length, 1);
    assert.deepStrictEqual(
        result.decisionService.opponentPredictionTop3.map(function (item) { return item.action; }),
        ['protect', 'thunderbolt', 'switch charizard']
    );
    assert.strictEqual(result.opponentPrediction.top3[0].action, 'protect');
    assert.strictEqual(messages.length, 0);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(JSON.parse(fakeRequest.body).request.secret, 'must-not-be-written');
    var logged = fs.readFileSync(logFile, 'utf8');
    assert.ok(logged.indexOf('[redacted]') !== -1);
    assert.ok(logged.indexOf('must-not-be-written') === -1);
    assert.ok(logged.indexOf('"thunderbolt"') !== -1);

    var nextState = Object.assign({}, state, {
        turn: 4,
        rqid: 18,
        fullHistory: [
            '|turn|3',
            '|move|p2a: Carbink|Protect|p1a: Pikachu',
            '|turn|4'
        ],
        actions: [{ type: 'move', slot: 1, id: 'thunderbolt' }]
    });
    var nextRecord = {
        battleId: nextState.battleId,
        turn: nextState.turn,
        action: { type: 'move', slot: 1 },
        suggestion: { type: 'move', slot: 1, id: 'thunderbolt' },
        state: nextState
    };
    return observer.observe(nextRecord, {
        sendChat: function () {}
    }).then(function () {
        var outcomeLines = fs.readFileSync(logFile, 'utf8').trim().split('\n')
            .map(function (line) { return JSON.parse(line); })
            .filter(function (line) {
                return line.schemaVersion === 'live-observer/opponent-prediction/v1';
            });
        assert.strictEqual(outcomeLines.length, 1);
        assert.strictEqual(outcomeLines[0].actualOpponentAction, 'protect');
        assert.strictEqual(outcomeLines[0].actualActionProbability, 0.6);
        assert.strictEqual(outcomeLines[0].top1Correct, true);
        assert.strictEqual(outcomeLines[0].top3Correct, true);
        assert.strictEqual(outcomeLines[0].cumulativeStats.evaluated, 1);
    });
}).then(function () {
    var diffObserver = new observerModule.LiveObserver({
        url: 'http://127.0.0.1:8093/reference',
        announce: 'diff-only',
        request: function (options, callback) {
            callback(fakeResponse({ bestAction: 'protect', actions: { protect: 1 } }));
            return { on: function () {}, end: function () {} };
        }
    });
    return diffObserver.observe(record, {
        sendChat: function (room, message) { messages.push({ room: room, message: message }); }
    });
}).then(function (result) {
    assert.strictEqual(result.sameDecision, false);
    assert.strictEqual(messages.length, 1);
    assert.ok(messages[0].message.indexOf('[OBS T3] NM=thunderbolt FP=protect DIFF') === 0);

    var switchState = Object.assign({}, state, {
        turn: 4,
        rqid: 18,
        actions: [{ type: 'switch', slot: 2 }]
    });
    var switchRecord = {
        battleId: switchState.battleId,
        turn: switchState.turn,
        action: { type: 'switch', slot: 2 },
        suggestion: { type: 'switch', slot: 2, name: 'Charizard' },
        state: switchState
    };
    assert.strictEqual(observerModule.actionKey(switchRecord.action, switchRecord.suggestion, switchState), 'switch charizard');
    var forcedObserver = new observerModule.LiveObserver({
        url: 'http://127.0.0.1:8093/reference',
        announce: 'diff-only',
        request: function (options, callback) {
            callback(fakeResponse({
                bestAction: 'dracometeor',
                rawBestAction: 'dracometeor',
                selectedAction: 'switch charizard',
                selectionFallback: true,
                selectionFallbackReason: 'raw-best-action-not-legal',
                actions: { dracometeor: 1 }
            }));
            return { on: function () {}, end: function () {} };
        }
    });
    return forcedObserver.observe({
        battleId: switchState.battleId,
        turn: switchState.turn,
        action: { type: 'switch', slot: 2 },
        suggestion: { type: 'switch', slot: 2, name: 'Charizard' },
        state: switchState
    }, {
        sendChat: function () {
            throw new Error('forced switch must not be announced as a normal diff');
        }
    }).then(function (forcedResult) {
        assert.strictEqual(forcedResult.comparisonKind, 'forced-switch');
        assert.strictEqual(forcedResult.sameDecision, null);
        assert.strictEqual(forcedResult.foulPlayReference.rawBestAction, 'dracometeor');
        assert.strictEqual(forcedResult.foulPlayReference.selectedAction, 'switch charizard');
    });
}).then(function () {
    console.log('live observer tests passed');
}).catch(function (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
