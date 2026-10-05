'use strict';

var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var url = require('url');

function nowIso() {
    return new Date().toISOString();
}

function normalizeId(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/-tera$/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeAction(value) {
    var text = String(value || '').trim().toLowerCase();
    text = text.replace(/-tera\b/g, '');
    text = text.replace(/\s+/g, ' ');
    return text || null;
}

function actionType(action) {
    return String(action && action.type || '').toLowerCase();
}

function actionSlot(action) {
    if (!action) return null;
    if (action.slot !== undefined) return Number(action.slot);
    if (action.attackSlot !== undefined) return Number(action.attackSlot);
    if (action.pokeSlot !== undefined) return Number(action.pokeSlot);
    return null;
}

function stateActionForSlot(state, action) {
    var slot = actionSlot(action);
    var actions = state && Array.isArray(state.actions) ? state.actions : [];
    if (slot === null || !isFinite(slot)) return null;
    for (var i = 0; i < actions.length; i++) {
        if (actionType(actions[i]) !== actionType(action)) continue;
        if (actionSlot(actions[i]) === slot) return actions[i];
    }
    return null;
}

function requestMoveForSlot(state, slot) {
    var request = state && state.request;
    var active = request && Array.isArray(request.active) ? request.active[0] : null;
    var moves = active && Array.isArray(active.moves) ? active.moves : [];
    if (!slot || !moves[slot - 1]) return null;
    return moves[slot - 1];
}

function actionKey(action, suggestion, state) {
    var type = actionType(action || suggestion);
    var source = action || suggestion || {};
    var candidate = stateActionForSlot(state, action || suggestion);
    if (type === 'move' || type === 'attack' || type === 'attackslot') {
        var move = source.id || source.move || source.name;
        if (!move && candidate) move = candidate.id || candidate.move || candidate.name;
        if (!move) {
            var requested = requestMoveForSlot(state, actionSlot(action || suggestion));
            if (requested) move = requested.id || requested.move || requested.name;
        }
        // 只有无法从实际已提交动作的 slot 还原时，才使用服务原始建议。
        if (!move && (!action || actionSlot(action) === null) && suggestion && suggestion !== source) {
            move = suggestion.id || suggestion.move || suggestion.name;
        }
        return normalizeId(move);
    }
    if (type === 'switch' || type === 'switchslot') {
        var target = source.name || source.pokemon || source.species;
        if (!target && candidate) target = candidate.name || candidate.pokemon || candidate.species;
        if (!target && state && Array.isArray(state.bench)) {
            for (var i = 0; i < state.bench.length; i++) {
                if (Number(state.bench[i].slot) === actionSlot(action || suggestion)) {
                    target = state.bench[i].name;
                    break;
                }
            }
        }
        return target ? 'switch ' + normalizeId(target) : null;
    }
    if (type === 'team') {
        var lead = source.lead !== undefined ? source.lead : candidate && candidate.lead;
        return lead !== undefined && lead !== null ? 'team ' + String(lead) : null;
    }
    return normalizeAction(source.action || source.id || source.name);
}

function displayAction(value) {
    var action = normalizeAction(value);
    if (!action) return 'unknown';
    return action.replace(/[^a-z0-9 -]/g, '').slice(0, 40) || 'unknown';
}

function historyLines(state) {
    state = state || {};
    var history = Array.isArray(state.fullHistory) ? state.fullHistory :
        (Array.isArray(state.history) ? state.history : []);
    return history.map(function (line) { return String(line || ''); });
}

function opponentSide(state) {
    var side = state && state.request && state.request.side && state.request.side.id;
    return side === 'p1' ? 'p2' : 'p1';
}

function protocolSide(ident) {
    var match = String(ident || '').match(/^(p[12])[a-z]?:/i);
    return match ? match[1].toLowerCase() : null;
}

function historyAction(line, side, forced) {
    var parts = String(line || '').split('|');
    var type = parts[1] || '';
    if (type !== 'move' && type !== 'switch' && type !== 'drag' && type !== 'replace') return null;
    if (protocolSide(parts[2]) !== side) return null;
    if (type === 'move') {
        var move = normalizeId(parts[3]);
        return move ? { action: move, raw: line, forced: false, type: 'move' } : null;
    }
    var details = String(parts[3] || parts[2] || '').split(',')[0].trim();
    var species = normalizeId(details);
    return species ? {
        action: 'switch ' + species,
        raw: line,
        forced: forced || type === 'drag' || type === 'replace',
        type: 'switch'
    } : null;
}

function findOpponentAction(state, pending) {
    var lines = historyLines(state);
    var start = Number(pending.historyLength || 0);
    var side = pending.opponentSide || opponentSide(state);
    var currentTurn = null;
    var previousType = null;
    for (var i = 0; i < lines.length; i++) {
        var parts = lines[i].split('|');
        var type = parts[1] || '';
        if (type === 'turn') {
            var parsedTurn = Number(parts[2]);
            currentTurn = isFinite(parsedTurn) ? parsedTurn : currentTurn;
        }
        if (i < start) {
            previousType = type;
            continue;
        }
        if (currentTurn !== Number(pending.turn)) {
            previousType = type;
            continue;
        }
        var action = historyAction(lines[i], side, previousType === 'faint');
        if (action) return action;
        previousType = type;
    }
    return null;
}

function topActions(distribution, limit) {
    var aggregate = {};
    Object.keys(distribution || {}).forEach(function (rawAction) {
        var action = normalizeAction(rawAction);
        var probability = Number(distribution[rawAction]);
        if (!action || !isFinite(probability) || probability < 0) return;
        if (!aggregate[action]) aggregate[action] = 0;
        aggregate[action] += probability;
    });
    return Object.keys(aggregate).sort(function (left, right) {
        return aggregate[right] - aggregate[left] || left.localeCompare(right);
    }).slice(0, limit || 3).map(function (action, index) {
        return {
            action: action,
            probability: aggregate[action],
            rank: index + 1
        };
    });
}

function probabilityForAction(distribution, actualAction) {
    var target = normalizeAction(actualAction);
    var probability = 0;
    Object.keys(distribution || {}).forEach(function (rawAction) {
        if (normalizeAction(rawAction) !== target) return;
        var value = Number(distribution[rawAction]);
        if (isFinite(value) && value >= 0) probability += value;
    });
    return probability;
}

function rankForAction(top3, actualAction) {
    var target = normalizeAction(actualAction);
    for (var i = 0; i < (top3 || []).length; i++) {
        if (normalizeAction(top3[i].action) === target) return top3[i].rank;
    }
    return null;
}

function publicPokemon(value) {
    value = value || {};
    return {
        name: value.name || null,
        hp: value.hp === undefined ? null : value.hp,
        maxHp: value.maxHp === undefined ? null : value.maxHp,
        hpPct: value.hpPct === undefined ? null : value.hpPct,
        status: value.status || null,
        types: Array.isArray(value.types) ? value.types : [],
        moves: Array.isArray(value.moves) ? value.moves.map(function (move) {
            return typeof move === 'string' ? normalizeId(move) : normalizeId(move && (move.id || move.name));
        }).filter(Boolean) : [],
        fainted: !!value.fainted
    };
}

function publicState(state) {
    state = state || {};
    var legalActions = [];
    var seenActions = {};
    var rawActions = Array.isArray(state.actions) ? state.actions : [];
    for (var i = 0; i < rawActions.length; i++) {
        var key = actionKey(rawActions[i], rawActions[i], state);
        if (!key || seenActions[key]) continue;
        seenActions[key] = true;
        legalActions.push(key);
    }
    return {
        battleId: state.battleId || null,
        turn: state.turn === undefined ? null : state.turn,
        rqid: state.rqid === undefined ? null : state.rqid,
        format: state.format || null,
        gen: state.gen === undefined ? null : state.gen,
        me: publicPokemon(state.me),
        opp: publicPokemon(state.opp),
        oppTeam: Array.isArray(state.oppTeam) ? state.oppTeam.map(publicPokemon) : [],
        weather: state.weather || null,
        terrain: state.terrain || null,
        legalActions: legalActions
    };
}

function comparisonKind(state) {
    var actions = state && Array.isArray(state.actions) ? state.actions : [];
    if (!actions.length) return 'transition-or-stale-request';
    if (actions.every(function (action) { return actionType(action) === 'switch'; })) {
        return 'forced-switch';
    }
    if (actions.every(function (action) { return actionType(action) === 'team'; })) {
        return 'team-preview';
    }
    return 'normal-choice';
}

function writeJsonl(file, value) {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(value) + '\n');
}

function sanitizeForLog(value, key) {
    if (value === null || value === undefined) return value;
    if (key && /password|token|secret|api[_-]?key|credential/i.test(String(key))) {
        return '[redacted]';
    }
    if (Array.isArray(value)) {
        return value.map(function (item) { return sanitizeForLog(item, ''); });
    }
    if (typeof value !== 'object') return value;
    var result = {};
    Object.keys(value).forEach(function (childKey) {
        result[childKey] = sanitizeForLog(value[childKey], childKey);
    });
    return result;
}

function summarizeDecisionService(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        decisionProvider: value.decisionProvider || null,
        bestAction: normalizeAction(value.bestAction),
        rawBestAction: value.rawBestAction || value.bestAction || null,
        selectedAction: normalizeAction(value.selectedAction),
        selectionFallback: value.selectionFallback === undefined ? null : !!value.selectionFallback,
        selectionFallbackReason: value.selectionFallbackReason || null,
        selfSearchTimeMs: value.selfSearchTimeMs === undefined ? null : value.selfSearchTimeMs,
        opponentSearchTimeMs: value.opponentSearchTimeMs === undefined ? null : value.opponentSearchTimeMs,
        particleCount: value.particleCount === undefined ? null : value.particleCount,
        opponentModelPrediction: value.opponentModelPrediction || {},
        opponentExploration: value.opponentExploration === undefined ? null : value.opponentExploration,
        opponentPredictionTop3: topActions(value.opponentPrediction || {}, 3),
        particleDiagnostics: Array.isArray(value.particleDiagnostics) ? value.particleDiagnostics : [],
        selfPolicy: value.selfPolicy || {},
        opponentPrediction: value.opponentPrediction || {},
        rootActionScores: value.rootActionScores || {},
        actionPairValues: value.actionPairValues || {},
        referenceMode: value.referenceMode || null
    };
}

function requestJson(targetUrl, body, timeoutMs, requester) {
    var target = url.parse(targetUrl);
    var transport = target.protocol === 'https:' ? https : http;
    var payload = JSON.stringify(body);
    var options = {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + (target.search || ''),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        },
        agent: false
    };
    var requestFactory = requester || transport.request;
    return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('reference request timeout'));
        }, timeoutMs);
        var req;
        try {
            req = requestFactory.call(transport, options, function (res) {
                var responseBody = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) { responseBody += chunk; });
                res.on('end', function () {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        reject(new Error('reference service HTTP ' + res.statusCode));
                        return;
                    }
                    try {
                        resolve(JSON.parse(responseBody));
                    } catch (error) {
                        reject(new Error('reference service returned invalid JSON'));
                    }
                });
            });
        } catch (error) {
            clearTimeout(timer);
            reject(error);
            return;
        }
        req.on('error', function (error) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        });
        req.end(payload);
    });
}

function LiveObserver(options) {
    options = options || {};
    this.url = options.url || '';
    this.announce = options.announce || 'none';
    this.logFile = options.logFile || '';
    this.timeoutMs = Number(options.timeoutMs || 1500);
    this.request = options.request || null;
    this.onResult = options.onResult || function () {};
    this.seen = {};
    this.pendingOpponentPredictions = {};
    this.latestStates = {};
    this.opponentPredictionStats = {
        evaluated: 0,
        top1Correct: 0,
        top3Correct: 0,
        probabilitySum: 0,
        forcedOrUnscorable: 0
    };
}

LiveObserver.prototype.requestKey = function (record) {
    var state = record && record.state || {};
    var battleId = record && (record.battleId || state.battleId) || '';
    var rqid = record && record.rqid !== undefined ? record.rqid : state.rqid;
    return String(battleId) + ':' + String(rqid === undefined ? '' : rqid);
};

LiveObserver.prototype.shouldAnnounce = function (comparison) {
    if (this.announce === 'none') return false;
    if (this.announce === 'all') return true;
    return this.announce === 'diff-only' &&
        comparison.comparisonKind === 'normal-choice' &&
        comparison.sameDecision === false;
};

LiveObserver.prototype.makeAnnouncement = function (comparison) {
    var turn = comparison.turn === null ? '?' : comparison.turn;
    if (comparison.comparisonKind === 'forced-switch') {
        return '[OBS T' + turn + '] FORCED_SWITCH NM=' +
            displayAction(comparison.newModelAction) + ' FP=' +
            displayAction(comparison.foulPlayReference.selectedAction);
    }
    if (comparison.comparisonKind === 'team-preview') {
        return '[OBS T' + turn + '] TEAM_PREVIEW NM=' +
            displayAction(comparison.newModelAction) + ' FP=' +
            displayAction(comparison.foulPlayReference.selectedAction);
    }
    var status = comparison.sameDecision ? 'SAME' : 'DIFF';
    return '[OBS T' + turn + '] NM=' + displayAction(comparison.newModelAction) +
        ' FP=' + displayAction(comparison.foulPlayReference.selectedAction) + ' ' + status;
};

LiveObserver.prototype.statsSnapshot = function () {
    var stats = this.opponentPredictionStats;
    return {
        evaluated: stats.evaluated,
        top1Correct: stats.top1Correct,
        top3Correct: stats.top3Correct,
        probabilitySum: stats.probabilitySum,
        forcedOrUnscorable: stats.forcedOrUnscorable,
        top1Accuracy: stats.evaluated ? stats.top1Correct / stats.evaluated : null,
        top3Accuracy: stats.evaluated ? stats.top3Correct / stats.evaluated : null,
        meanActualProbability: stats.evaluated ? stats.probabilitySum / stats.evaluated : null
    };
};

LiveObserver.prototype.resolveOpponentPrediction = function (state) {
    var self = this;
    var battleId = state && state.battleId;
    if (!battleId) return;
    var latest = this.latestStates[battleId] = state;
    Object.keys(this.pendingOpponentPredictions).forEach(function (key) {
        var pending = self.pendingOpponentPredictions[key];
        if (pending.battleId !== battleId) return;
        var actual = findOpponentAction(latest, pending);
        if (!actual) return;
        delete self.pendingOpponentPredictions[key];
        var rank = rankForAction(pending.top3, actual.action);
        var scorable = !actual.forced;
        if (scorable) {
            self.opponentPredictionStats.evaluated += 1;
            if (rank === 1) self.opponentPredictionStats.top1Correct += 1;
            if (rank !== null) self.opponentPredictionStats.top3Correct += 1;
            self.opponentPredictionStats.probabilitySum += probabilityForAction(
                pending.distribution,
                actual.action
            );
        } else {
            self.opponentPredictionStats.forcedOrUnscorable += 1;
        }
        var outcome = {
            schemaVersion: 'live-observer/opponent-prediction/v1',
            battleId: pending.battleId,
            room: pending.room,
            predictedTurn: pending.turn,
            predictedRqid: pending.rqid,
            opponentSide: pending.opponentSide,
            predictedTop3: pending.top3,
            actualOpponentAction: actual.action,
            actualOpponentActionRaw: actual.raw,
            actualActionProbability: probabilityForAction(
                pending.distribution,
                actual.action
            ),
            actualActionRank: rank,
            top1Correct: scorable && rank === 1,
            top3Correct: scorable && rank !== null,
            scorable: scorable,
            unscorableReason: scorable ? null : 'forced-switch',
            cumulativeStats: self.statsSnapshot(),
            timestamp: nowIso()
        };
        writeJsonl(self.logFile, outcome);
        self.onResult(outcome);
    });
};

LiveObserver.prototype.observe = function (record, client) {
    var self = this;
    if (!this.url) return Promise.resolve(null);
    if (!record || !record.state || record.skipped) return Promise.resolve(null);
    var key = this.requestKey(record);
    if (this.seen[key]) return Promise.resolve(null);
    this.seen[key] = true;
    var state = record.state;
    this.resolveOpponentPrediction(state);
    var startedAt = Date.now();
    var newModelAction = actionKey(record.action, record.suggestion, state);
    var kind = comparisonKind(state);
    var base = {
        schemaVersion: 'live-observer/v1',
        battleId: record.battleId || state.battleId || null,
        room: record.battleId || state.battleId || null,
        turn: record.turn === undefined ? (state.turn === undefined ? null : state.turn) : record.turn,
        rqid: state.rqid === undefined ? null : state.rqid,
        newModelAction: newModelAction,
        newModelActionRaw: record.action || null,
        state: publicState(state),
        timestamp: nowIso()
    };
    return requestJson(this.url, state, this.timeoutMs, this.request).then(function (reference) {
        var comparison = {
            schemaVersion: 'live-observer/v1',
            battleId: base.battleId,
            room: base.room,
            turn: base.turn,
            rqid: base.rqid,
            newModelAction: newModelAction,
            foulPlayReference: {
                bestAction: normalizeAction(reference.bestAction),
                rawBestAction: normalizeAction(
                    reference.rawBestAction === undefined ?
                        reference.bestAction : reference.rawBestAction
                ),
                selectedAction: normalizeAction(
                    reference.selectedAction === undefined ?
                        reference.bestAction : reference.selectedAction
                ),
                selectionFallback: reference.selectionFallback === undefined ?
                    null : !!reference.selectionFallback,
                selectionFallbackReason: reference.selectionFallbackReason || null,
                actions: reference.actions || {},
                searchTimeMs: reference.searchTimeMs === undefined ? null : reference.searchTimeMs,
                particleCount: reference.particleCount === undefined ? null : reference.particleCount,
                referenceMode: reference.referenceMode || null
            },
            comparisonKind: kind,
            decisionService: summarizeDecisionService(record.suggestion),
            opponentPrediction: {
                distribution: record.suggestion && record.suggestion.opponentPrediction || {},
                top3: topActions(
                    record.suggestion && record.suggestion.opponentPrediction || {},
                    3
                ),
                outcomePending: true
            },
            sameDecision: kind === 'normal-choice' ? (
                !!newModelAction &&
                normalizeAction(
                    reference.selectedAction === undefined ?
                        reference.bestAction : reference.selectedAction
                ) === normalizeAction(newModelAction)
            ) : null,
            referenceLatencyMs: Date.now() - startedAt,
            referenceError: null,
            state: sanitizeForLog(state),
            publicState: base.state,
            timestamp: nowIso()
        };
        comparison.announcement = self.makeAnnouncement(comparison);
        if (self.shouldAnnounce(comparison) && client && typeof client.sendChat === 'function' && comparison.room) {
            client.sendChat(comparison.room, comparison.announcement);
        }
        writeJsonl(self.logFile, comparison);
        self.onResult(comparison);
        var decisionService = comparison.decisionService || {};
        if (decisionService.opponentPredictionTop3.length) {
            self.pendingOpponentPredictions[key] = {
                battleId: base.battleId,
                room: base.room,
                turn: base.turn,
                rqid: base.rqid,
                opponentSide: opponentSide(state),
                historyLength: historyLines(state).length,
                distribution: decisionService.opponentPrediction,
                top3: decisionService.opponentPredictionTop3
            };
            self.resolveOpponentPrediction(self.latestStates[base.battleId] || state);
        }
        return comparison;
    }).catch(function (error) {
        var failed = {
            schemaVersion: 'live-observer/v1',
            battleId: base.battleId,
            room: base.room,
            turn: base.turn,
            rqid: base.rqid,
            newModelAction: newModelAction,
            foulPlayReference: null,
            sameDecision: null,
            referenceLatencyMs: Date.now() - startedAt,
            referenceError: error.message,
            state: sanitizeForLog(state),
            publicState: base.state,
            timestamp: nowIso()
        };
        writeJsonl(self.logFile, failed);
        self.onResult(failed);
        return failed;
    });
};

module.exports = {
    LiveObserver: LiveObserver,
    actionKey: actionKey,
    publicState: publicState
};
