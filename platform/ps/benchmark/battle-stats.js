'use strict';

var fs = require('fs');
var path = require('path');

var MOVE_DATA = [];
try {
    var moveDataText = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'movedata.json'), 'utf8');
    MOVE_DATA = JSON.parse(moveDataText.replace(/^\uFEFF/, ''));
} catch (error) {
    MOVE_DATA = [];
}

var MOVE_BY_ID = {};
for (var moveIndex = 0; moveIndex < MOVE_DATA.length; moveIndex++) {
    var move = MOVE_DATA[moveIndex];
    if (!move || !move.name) continue;
    MOVE_BY_ID[toId(move.name)] = move;
}

function toId(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseIdent(value) {
    var text = String(value || '');
    var match = text.match(/^(p[12])([a-z])?:\s*(.*)$/i);
    return {
        ident: text,
        side: match ? match[1].toLowerCase() : null,
        name: match ? match[3] : text
    };
}

function sideOf(value) {
    if (value && value.side) return String(value.side).toLowerCase();
    return parseIdent(value).side;
}

function identOf(value) {
    if (value && value.ident) return String(value.ident);
    return String(value || '');
}

function sameIdent(left, right) {
    var a = identOf(left).replace(/^(p[12])[a-z]:/i, '$1:').toLowerCase();
    var b = identOf(right).replace(/^(p[12])[a-z]:/i, '$1:').toLowerCase();
    return !!a && !!b && a === b;
}

function emptySide() {
    return {
        teamSize: null,
        observedTeamSize: null,
        finalAlive: null,
        switches: 0,
        allSwitches: 0,
        nonInitialSwitches: 0,
        boostEvents: 0,
        boostAmount: 0,
        unboostEvents: 0,
        moveCount: 0,
        attackMoveCount: 0,
        teraUses: 0,
        firstTeraTurn: null,
        teraTurns: [],
        faints: 0,
        residualFaints: 0,
        firstStrikeKOs: 0,
        switchInKOs: 0
    };
}

function isAttackMove(name) {
    var data = MOVE_BY_ID[toId(name)];
    if (!data) return false;
    // movedata.json uses 1=Physical, 2=Special, 3=Status.
    return Number(data.category) === 1 || Number(data.category) === 2;
}

function isPositiveBoost(event) {
    var args = eventArgs(event);
    var amount = event.amount !== undefined ? event.amount : args[2];
    if (event.type === 'boost') return Number(amount) > 0;
    if (event.type === 'setboost') return Number(amount) > 0;
    return false;
}

function eventArgs(event) {
    return Array.isArray(event.args) ? event.args : [];
}

function eventActor(event) {
    var args = eventArgs(event);
    return parseIdent(args[0] || '');
}

function eventTarget(event) {
    var args = eventArgs(event);
    return parseIdent(args[0] || '');
}

function moveTarget(event) {
    var args = eventArgs(event);
    return parseIdent(args[2] || '');
}

function numericTurn(event, currentTurn) {
    if (event && event.turn !== null && event.turn !== undefined &&
        Number.isFinite(Number(event.turn))) return Number(event.turn);
    return currentTurn;
}

function playerMapping(row, players) {
    var selfId = toId(row && row.account);
    var opponentId = toId(row && row.opponent);
    var selfSide = null;
    var opponentSide = null;
    for (var i = 0; i < players.length; i++) {
        var playerId = toId(players[i].name);
        if (selfId && playerId === selfId) selfSide = players[i].side;
        if (opponentId && playerId === opponentId) opponentSide = players[i].side;
    }
    if (!selfSide && selfId && players.length === 1) selfSide = players[0].side;
    if (!opponentSide && selfSide) opponentSide = selfSide === 'p1' ? 'p2' : 'p1';
    if (!selfSide && opponentSide) selfSide = opponentSide === 'p1' ? 'p2' : 'p1';
    return { self: selfSide || 'p1', opponent: opponentSide || (selfSide === 'p1' ? 'p2' : 'p1') };
}

function normalizeStats(stats, turns) {
    stats.p1.finalAlive = stats.p1.teamSize === null ?
        (stats.p1.observedTeamSize === null ? null : Math.max(0, stats.p1.observedTeamSize - stats.p1.faints)) :
        Math.max(0, stats.p1.teamSize - stats.p1.faints);
    stats.p2.finalAlive = stats.p2.teamSize === null ?
        (stats.p2.observedTeamSize === null ? null : Math.max(0, stats.p2.observedTeamSize - stats.p2.faints)) :
        Math.max(0, stats.p2.teamSize - stats.p2.faints);
    return {
        turns: turns,
        sides: {
            p1: stats.p1,
            p2: stats.p2
        }
    };
}

function availableTeamSize(side) {
    return side.teamSize === null ? side.observedTeamSize : side.teamSize;
}

function normalizedPerTurn(side, turns) {
    var result = {};
    var divisor = Number(turns) > 0 ? Number(turns) : null;
    var names = [
        'switches', 'allSwitches', 'nonInitialSwitches', 'boostEvents',
        'boostAmount', 'unboostEvents', 'moveCount', 'attackMoveCount',
        'teraUses',
        'faints', 'residualFaints', 'firstStrikeKOs', 'switchInKOs'
    ];
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        result[name + 'PerTurn'] = divisor === null ? null : side[name] / divisor;
    }
    return result;
}

function survivalTimeline(stats, turns, faintTurns) {
    var p1Size = availableTeamSize(stats.p1);
    var p2Size = availableTeamSize(stats.p2);
    if (p1Size === null || p2Size === null || !Number.isFinite(Number(turns)) || turns < 1) {
        return { byTurn: [], checkpoints: [] };
    }
    var p1Faints = 0;
    var p2Faints = 0;
    var byTurn = [];
    for (var turn = 1; turn <= turns; turn++) {
        p1Faints += faintTurns.p1[turn] || 0;
        p2Faints += faintTurns.p2[turn] || 0;
        var p1Alive = Math.max(0, p1Size - p1Faints);
        var p2Alive = Math.max(0, p2Size - p2Faints);
        byTurn.push({
            turn: turn,
            progress: turn / turns,
            p1Alive: p1Alive,
            p2Alive: p2Alive,
            p1MinusP2: p1Alive - p2Alive
        });
    }
    var progressPoints = [0, 0.25, 0.5, 0.75, 1];
    var checkpoints = [];
    for (var pointIndex = 0; pointIndex < progressPoints.length; pointIndex++) {
        var progress = progressPoints[pointIndex];
        var checkpointTurn = progress === 0 ? 0 : Math.min(turns, Math.ceil(progress * turns));
        var p1CheckpointAlive = checkpointTurn === 0 ? p1Size : byTurn[checkpointTurn - 1].p1Alive;
        var p2CheckpointAlive = checkpointTurn === 0 ? p2Size : byTurn[checkpointTurn - 1].p2Alive;
        checkpoints.push({
            progress: progress,
            turn: checkpointTurn,
            p1Alive: p1CheckpointAlive,
            p2Alive: p2CheckpointAlive,
            p1MinusP2: p1CheckpointAlive - p2CheckpointAlive
        });
    }
    return { byTurn: byTurn, checkpoints: checkpoints };
}

function analyzeBattle(rowOrProtocol, options) {
    var row = Array.isArray(rowOrProtocol) ? {} : (rowOrProtocol || {});
    var protocol = Array.isArray(rowOrProtocol) ? rowOrProtocol : row.protocol;
    protocol = Array.isArray(protocol) ? protocol : [];
    options = options || {};

    var stats = { p1: emptySide(), p2: emptySide() };
    var currentTurn = 0;
    var maxTurn = 0;
    var seenPokemon = { p1: {}, p2: {} };
    var switchRecords = {};
    var lastMove = { p1: null, p2: null };
    var actionsThisTurn = { p1: false, p2: false };
    var firstDeployment = { p1: true, p2: true };
    var faintTurns = { p1: {}, p2: {} };
    var sequence = 0;
    var players = [];

    for (var i = 0; i < protocol.length; i++) {
        var event = protocol[i] || {};
        var type = String(event.type || event.rawType || '').replace(/^-/, '');
        currentTurn = numericTurn(event, currentTurn);
        if (type === 'turn') {
            currentTurn = Number(event.args && event.args[0] || event.turn || currentTurn);
            if (Number.isFinite(currentTurn)) maxTurn = Math.max(maxTurn, currentTurn);
            actionsThisTurn = { p1: false, p2: false };
        }
        if (currentTurn > maxTurn) maxTurn = currentTurn;
        sequence++;

        if (type === 'player') {
            var playerArgs = eventArgs(event);
            if (playerArgs[0] === 'p1' || playerArgs[0] === 'p2') {
                players.push({ side: playerArgs[0], name: playerArgs[1] || '' });
            }
            continue;
        }
        if (type === 'teamsize') {
            var teamArgs = eventArgs(event);
            if (teamArgs[0] === 'p1' || teamArgs[0] === 'p2') {
                stats[teamArgs[0]].teamSize = Number(teamArgs[1]);
            }
            continue;
        }
        if (type === 'poke') {
            var pokeArgs = eventArgs(event);
            if (pokeArgs[0] === 'p1' || pokeArgs[0] === 'p2') {
                seenPokemon[pokeArgs[0]][toId(pokeArgs[1])] = true;
                stats[pokeArgs[0]].observedTeamSize = Object.keys(seenPokemon[pokeArgs[0]]).length;
            }
            continue;
        }
        if (type === 'switch' || type === 'replace' || type === 'drag') {
            var switchActor = eventActor(event);
            var switchSide = switchActor.side;
            if (!switchSide || !stats[switchSide]) continue;
            var initial = firstDeployment[switchSide];
            firstDeployment[switchSide] = false;
            stats[switchSide].allSwitches++;
            if (!initial) {
                stats[switchSide].nonInitialSwitches++;
                stats[switchSide].switches++;
            }
            switchRecords[switchActor.ident.toLowerCase()] = {
                side: switchSide,
                turn: currentTurn,
                sequence: sequence,
                initial: initial
            };
            continue;
        }
        if (type === 'move') {
            var moveActor = eventActor(event);
            var moveSide = moveActor.side;
            if (!moveSide || !stats[moveSide]) continue;
            stats[moveSide].moveCount++;
            if (isAttackMove(eventArgs(event)[1])) stats[moveSide].attackMoveCount++;
            actionsThisTurn[moveSide] = true;
            lastMove[moveSide] = {
                side: moveSide,
                actor: moveActor,
                target: moveTarget(event),
                turn: currentTurn,
                sequence: sequence,
                attack: isAttackMove(eventArgs(event)[1]),
                damaged: false
            };
            continue;
        }
        if (type === 'terastallize') {
            var teraActor = eventActor(event);
            var teraSide = teraActor.side;
            if (teraSide && stats[teraSide]) {
                stats[teraSide].teraUses++;
                if (Number.isFinite(Number(currentTurn))) {
                    stats[teraSide].teraTurns.push(Number(currentTurn));
                    if (stats[teraSide].firstTeraTurn === null) {
                        stats[teraSide].firstTeraTurn = Number(currentTurn);
                    }
                }
            }
            continue;
        }
        if (type === 'damage' || type === 'sethp') {
            var damageTarget = eventTarget(event);
            var damageSide = damageTarget.side;
            var damageArgs = eventArgs(event);
            var residual = damageArgs.slice(2).some(function (arg) {
                return /^\s*\[(from|of)\]/i.test(String(arg || ''));
            });
            if (!residual && damageSide && lastMove[damageSide === 'p1' ? 'p2' : 'p1'] &&
                lastMove[damageSide === 'p1' ? 'p2' : 'p1'].turn === currentTurn) {
                var possibleMove = lastMove[damageSide === 'p1' ? 'p2' : 'p1'];
                if (possibleMove.attack &&
                    (!possibleMove.target.ident || sameIdent(possibleMove.target, damageTarget))) {
                    possibleMove.damaged = true;
                }
            }
            continue;
        }
        if (type === 'boost' || type === 'setboost') {
            var boostSide = sideOf(eventTarget(event));
            if (boostSide && stats[boostSide] && isPositiveBoost(event)) {
                stats[boostSide].boostEvents++;
                var boostArgs = eventArgs(event);
                var boostAmount = event.amount !== undefined ? event.amount : boostArgs[2];
                stats[boostSide].boostAmount += Math.max(0, Number(boostAmount) || 0);
            }
            continue;
        }
        if (type === 'unboost') {
            var unboostSide = sideOf(eventTarget(event));
            if (unboostSide && stats[unboostSide]) stats[unboostSide].unboostEvents++;
            continue;
        }
        if (type === 'faint') {
            var faintTarget = eventTarget(event);
            var faintSide = faintTarget.side;
            if (!faintSide || !stats[faintSide]) continue;
            stats[faintSide].faints++;
            if (!faintTurns[faintSide][currentTurn]) faintTurns[faintSide][currentTurn] = 0;
            faintTurns[faintSide][currentTurn]++;
            var killerSide = faintSide === 'p1' ? 'p2' : 'p1';
            var killingMove = lastMove[killerSide];
            var directKill = killingMove && killingMove.turn === currentTurn &&
                killingMove.damaged && killingMove.actor.side === killerSide &&
                (!killingMove.target.ident || sameIdent(killingMove.target, faintTarget));
            if (directKill) {
                if (!actionsThisTurn[faintSide]) stats[killerSide].firstStrikeKOs++;
                var record = switchRecords[faintTarget.ident.toLowerCase()];
                if (record && record.side === faintSide && !record.initial && record.turn === currentTurn &&
                    record.sequence < sequence) {
                    stats[killerSide].switchInKOs++;
                }
            } else {
                stats[faintSide].residualFaints++;
            }
            continue;
        }
    }

    var mapping = playerMapping(row, players);
    var result = normalizeStats(stats, maxTurn || Number(row.turns) || 0);
    var turns = result.turns;
    var timeline = survivalTimeline(stats, turns, faintTurns);
    result.mapping = mapping;
    result.sides.self = result.sides[mapping.self];
    result.sides.opponent = result.sides[mapping.opponent];
    result.normalized = {
        p1: normalizedPerTurn(result.sides.p1, turns),
        p2: normalizedPerTurn(result.sides.p2, turns)
    };
    result.normalized.self = result.normalized[mapping.self];
    result.normalized.opponent = result.normalized[mapping.opponent];
    result.survivalLeadByTurn = timeline.byTurn.map(function (entry) {
        var selfAlive = mapping.self === 'p1' ? entry.p1Alive : entry.p2Alive;
        var opponentAlive = mapping.opponent === 'p1' ? entry.p1Alive : entry.p2Alive;
        return {
            turn: entry.turn,
            progress: entry.progress,
            selfAlive: selfAlive,
            opponentAlive: opponentAlive,
            selfMinusOpponent: selfAlive - opponentAlive
        };
    });
    result.survivalLeadTimeline = timeline.checkpoints.map(function (entry) {
        var selfAlive = mapping.self === 'p1' ? entry.p1Alive : entry.p2Alive;
        var opponentAlive = mapping.opponent === 'p1' ? entry.p1Alive : entry.p2Alive;
        return {
            progress: entry.progress,
            turn: entry.turn,
            selfAlive: selfAlive,
            opponentAlive: opponentAlive,
            selfMinusOpponent: selfAlive - opponentAlive
        };
    });
    result.comparison = {};
    var metricNames = [
        'finalAlive', 'switches', 'allSwitches', 'nonInitialSwitches',
        'boostEvents', 'boostAmount', 'unboostEvents', 'moveCount',
        'attackMoveCount', 'teraUses', 'faints', 'residualFaints', 'firstStrikeKOs',
        'switchInKOs'
    ];
    for (var metricIndex = 0; metricIndex < metricNames.length; metricIndex++) {
        var metric = metricNames[metricIndex];
        result.comparison[metric] = result.sides.p1[metric] - result.sides.p2[metric];
    }
    return result;
}

module.exports = {
    analyzeBattle: analyzeBattle,
    isAttackMove: isAttackMove
};
