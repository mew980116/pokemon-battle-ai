'use strict';

var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var readline = require('readline');
var clientModule = require('./client.js');
var bridgeModule = require('./decision-bridge.js');

function parseArgs(argv) {
    var result = {
        referenceUrl: 'http://127.0.0.1:8093/reference',
        logFile: '',
        quiet: false
    };
    for (var i = 0; i < argv.length; i++) {
        if (argv[i] === '--reference-url') result.referenceUrl = argv[++i];
        else if (argv[i] === '--log-file') result.logFile = argv[++i];
        else if (argv[i] === '--quiet') result.quiet = true;
        else throw new Error('Unknown argument: ' + argv[i]);
    }
    return result;
}

function nowIso() {
    return new Date().toISOString();
}

function toId(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeEffectId(value) {
    var normalized = String(value || '')
        .toLowerCase()
        .replace(/^move:\s*/, '')
        .replace(/[^a-z0-9]+/g, '');
    return normalized === 'none' ? '' : normalized;
}

function actionKeyFromState(state, action) {
    if (!action) return null;
    if (action.type === 'move') {
        return toId(action.id || action.name) + (action.tera ? '-tera' : '');
    }
    if (action.type === 'switch') {
        var slot = Number(action.slot || 0);
        var team = Array.isArray(state.myTeam) ? state.myTeam : [];
        for (var i = 0; i < team.length; i++) {
            if (Number(team[i].slot || 0) === slot) {
                return 'switch ' + toId(team[i].name);
            }
        }
        return 'switch ' + slot;
    }
    if (action.type === 'team') return 'team ' + Number(action.lead || 0);
    return null;
}

function actionKeyFromCommand(state, command) {
    var text = String(command || '').trim();
    if (text.indexOf('/switch ') === 0) {
        var switchSlot = Number(text.slice('/switch '.length).split('|')[0]);
        return actionKeyFromState(state, { type: 'switch', slot: switchSlot });
    }
    if (text.indexOf('/choose move ') === 0) {
        var moveText = text.slice('/choose move '.length).split('|')[0].trim();
        var tera = /\bterastallize\b/i.test(moveText);
        moveText = moveText.replace(/\s+(terastallize|dynamax|mega|zmove)\b/ig, '').trim();
        return toId(moveText) + (tera ? '-tera' : '');
    }
    if (text.indexOf('/team ') === 0) {
        var order = text.slice('/team '.length).split('|')[0].trim();
        return order ? 'team ' + Number(order.charAt(0)) : null;
    }
    return null;
}

function requestKey(room, rqid) {
    return String(room || '') + ':' + String(rqid === undefined || rqid === null ? '' : rqid);
}

function canonicalStat(value) {
    var id = toId(value);
    var aliases = {
        atk: 'atk',
        attack: 'atk',
        def: 'def',
        defense: 'def',
        spa: 'spa',
        specialattack: 'spa',
        spd: 'spd',
        specialdefense: 'spd',
        spe: 'spe',
        speed: 'spe',
        accuracy: 'accuracy',
        evasion: 'evasion'
    };
    return aliases[id] || id;
}

function normalizeBoosts(value) {
    var result = {};
    if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
            var text = String(value[i] || '').toLowerCase().replace(/\s+/g, '');
            var match = text.match(/^(special-attack|special-?defense|attack|defense|speed|accuracy|evasion|atk|def|spa|spd|spe)([+-]\d+)$/);
            if (match) result[canonicalStat(match[1])] = Number(match[2]);
        }
        return result;
    }
    var source = value || {};
    Object.keys(source).forEach(function (key) {
        var canonical = canonicalStat(key);
        var amount = Number(source[key] || 0);
        if (amount) result[canonical] = amount;
    });
    return result;
}

function normalizedMoves(value) {
    var result = [];
    var source = Array.isArray(value) ? value : [];
    for (var i = 0; i < source.length; i++) {
        var item = source[i];
        var name = item && typeof item === 'object' ? (item.id || item.name) : item;
        if (name) result.push(toId(name));
    }
    return result.sort();
}

function sameArray(left, right) {
    if (left.length !== right.length) return false;
    for (var i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) return false;
    }
    return true;
}

function samePokemonName(left, right) {
    var leftId = toId(left);
    var rightId = toId(right);
    if (leftId === rightId) return true;
    var suffixes = [
        'gulping', 'gorging', 'fullbelly', 'dawnwings', 'duskmane', 'galar',
        'hangry', 'ultra', 'primal', 'therian', 'incarnate', 'origin',
        'ash', 'school', '10', '10percent', 'complete'
    ];
    for (var i = 0; i < suffixes.length; i++) {
        if (leftId === rightId + suffixes[i] ||
            rightId === leftId + suffixes[i]) {
            return true;
        }
    }
    return false;
}

function normalizedConditionCounts(value) {
    var result = {};
    var durationEffects = {
        reflect: true,
        lightscreen: true,
        auroraveil: true,
        safeguard: true,
        mist: true,
        tailwind: true,
        luckychant: true
    };
    var source = value || {};
    Object.keys(source).forEach(function (key) {
        var normalized = normalizeEffectId(key);
        var raw = source[key];
        var count;
        if (raw && typeof raw === 'object') {
            // 屏障类状态的整数表示剩余回合，adapter detail 同时保存 count 和 turnsRemaining。
            if (durationEffects[normalized] &&
                raw.turnsRemaining !== undefined &&
                raw.turnsRemaining !== null) {
                count = raw.turnsRemaining;
            } else {
                count = raw.count;
            }
        } else {
            count = raw;
        }
        count = Number(count || 0);
        if (normalized && count) result[normalized] = count;
    });
    return result;
}

function normalizedPokemonMoves(pokemon) {
    if (!pokemon) return [];
    if (pokemon.moveDetails && typeof pokemon.moveDetails === 'object') {
        var details = Object.keys(pokemon.moveDetails);
        if (details.length) return details.map(toId).sort();
    }
    return normalizedMoves(pokemon.moves || pokemon.moveIds);
}

function normalizedStatus(pokemon) {
    var status = String(pokemon && pokemon.status || '').toLowerCase();
    return status === 'fnt' ? '' : status;
}

function normalizedFainted(pokemon) {
    if (!pokemon) return false;
    return !!pokemon.fainted ||
        String(pokemon.status || '').toLowerCase() === 'fnt' ||
        Number(pokemon.hp) <= 0;
}

function comparablePokemonDiff(label, baselinePokemon, translatedPokemon, options) {
    var differences = [];
    if (!baselinePokemon || !translatedPokemon) {
        differences.push(label + '-missing');
        return differences;
    }
    if (!samePokemonName(baselinePokemon.name, translatedPokemon.name)) {
        differences.push(label + '-name');
    }
    if (options.hp) {
        var baselineMax = Number(baselinePokemon.maxHp || 0);
        var baselineHp = Number(baselinePokemon.hp);
        var translatedPct = translatedPokemon.hpPct;
        var baselinePct = baselineMax > 0 ? baselineHp / baselineMax * 100 : null;
        var expectedPct = options.expectedHpPct;
        if (translatedPct !== undefined && translatedPct !== null &&
            expectedPct !== undefined && expectedPct !== null) {
            if (Math.abs(Number(translatedPct) - Number(expectedPct)) > 0.51) {
                differences.push(label + '-hp');
            }
        } else if (translatedPct !== undefined && translatedPct !== null && baselinePct !== null) {
            if (Math.abs(Number(translatedPct) - baselinePct) > 0.51) {
                differences.push(label + '-hp');
            }
        } else if (Number(baselinePokemon.hp) !== Number(translatedPokemon.hp)) {
            differences.push(label + '-hp');
        }
    }
    if (options.status &&
        normalizedStatus(baselinePokemon) !== normalizedStatus(translatedPokemon)) {
        differences.push(label + '-status');
    }
    if (options.fainted &&
        normalizedFainted(baselinePokemon) !== normalizedFainted(translatedPokemon)) {
        differences.push(label + '-fainted');
    }
    if (options.boosts &&
        !normalizedFainted(baselinePokemon) &&
        !normalizedFainted(translatedPokemon) &&
        JSON.stringify(normalizeBoosts(baselinePokemon.boosts)) !==
        JSON.stringify(normalizeBoosts(translatedPokemon.boosts))) {
        differences.push(label + '-boosts');
    }
    if (options.moves &&
        !sameArray(normalizedMoves(baselinePokemon.moves), normalizedPokemonMoves(translatedPokemon))) {
        var baselineMoves = normalizedMoves(baselinePokemon.moves);
        var translatedMoves = normalizedPokemonMoves(translatedPokemon);
        var translatedSet = {};
        translatedMoves.forEach(function (move) { translatedSet[move] = true; });
        var baselineSubset = baselineMoves.every(function (move) {
            return !!translatedSet[move];
        });
        if (!baselineSubset) differences.push(label + '-moves');
    }
    return differences;
}

function baselineTeam(baseline) {
    var user = baseline && baseline.user || {};
    return [user.active].concat(user.reserve || []).filter(function (item) { return !!item; });
}

function translatedTeam(state, sideName) {
    var rows = sideName === 'self' ? (state.myTeam || []) : (state.oppTeam || []);
    return rows.filter(function (item) { return !!item && item.name; });
}

function findPokemon(team, name) {
    var wanted = toId(name);
    for (var i = 0; i < team.length; i++) {
        if (toId(team[i].name) === wanted) return team[i];
    }
    // upstream Foul Play 有时使用基础种名，PS protocol 在形态公开后使用
    // 带形态后缀的名称，例如 Cramorant-Gulping 或 Necrozma-Dawn-Wings。
    // 这类名称仍然是同一个已公开队伍槽位，不能误报为缺失。
    var formSuffixes = [
        'gulping', 'gorging', 'fullbelly', 'dawnwings', 'duskmane', 'galar',
        'hangry',
        'ultra', 'primal', 'therian', 'incarnate', 'origin',
        'ash', 'school', '10', '10percent', 'complete'
    ];
    for (var j = 0; j < team.length; j++) {
        var candidate = toId(team[j].name);
        for (var k = 0; k < formSuffixes.length; k++) {
            var suffix = formSuffixes[k];
            if (candidate === wanted + suffix || wanted === candidate + suffix) {
                return team[j];
            }
        }
    }
    return null;
}

function latestPublicHpPercent(state, name) {
    var history = Array.isArray(state && state.history) ? state.history : [];
    var wanted = toId(name);
    var latest = null;
    for (var i = 0; i < history.length; i++) {
        var line = String(history[i] || '');
        var parts = line.split('|');
        var type = parts[1] || '';
        if (type !== 'switch' && type !== 'drag' && type !== 'replace' &&
            type !== '-damage' && type !== '-heal' &&
            type !== 'sethp' && type !== '-sethp' && type !== 'faint') {
            continue;
        }
        var ident = parts[2] || '';
        if (ident.indexOf('p2') !== 0) continue;
        var actorName = ident.split(':').slice(1).join(':').trim();
        var actorId = toId(actorName);
        var sameName = actorId === wanted;
        if (!sameName) {
            var actorBase = actorId;
            var wantedBase = wanted;
            var suffixes = [
                'gulping', 'gorging', 'fullbelly', 'dawnwings', 'duskmane', 'galar',
                'hangry',
                'ultra', 'primal', 'therian', 'incarnate', 'origin',
                'ash', 'school', '10', '10percent', 'complete'
            ];
            for (var j = 0; j < suffixes.length; j++) {
                if (actorBase === wanted + suffixes[j] ||
                    wantedBase === actorBase + suffixes[j]) {
                    sameName = true;
                    break;
                }
            }
        }
        if (!sameName) continue;
        var hpIndex = type === 'switch' || type === 'drag' || type === 'replace' ? 4 : 3;
        var hpText = type === 'faint' ? '0 fnt' : (parts[hpIndex] || '');
        var match = hpText.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        if (match) {
            latest = Number(match[1]) / Number(match[2]) * 100;
        } else if (hpText.indexOf('fnt') !== -1 || hpText === '0') {
            latest = 0;
        } else {
            var percent = hpText.match(/^(\d+(?:\.\d+)?)\s*%/);
            if (percent) latest = Number(percent[1]);
        }
    }
    return latest;
}

function postJson(url, value, timeoutMs) {
    return new Promise(function (resolve, reject) {
        var parsed = new URL(url);
        var body = Buffer.from(JSON.stringify(value), 'utf8');
        var transport = parsed.protocol === 'https:' ? https : http;
        var request = transport.request({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + (parsed.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length
            }
        }, function (response) {
            var chunks = [];
            response.on('data', function (chunk) { chunks.push(chunk); });
            response.on('end', function () {
                var text = Buffer.concat(chunks).toString('utf8');
                var result;
                try {
                    result = JSON.parse(text);
                } catch (error) {
                    reject(new Error('reference response was not JSON: ' + text.slice(0, 200)));
                    return;
                }
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error('reference HTTP ' + response.statusCode + ': ' + JSON.stringify(result)));
                    return;
                }
                resolve(result);
            });
        });
        request.setTimeout(timeoutMs, function () {
            request.destroy(new Error('reference request timeout'));
        });
        request.on('error', reject);
        request.end(body);
    });
}

function Mirror(options) {
    this.options = options;
    this.client = null;
    this.bridge = null;
    this.pending = {};
    this.logStream = null;
}

Mirror.prototype.start = function (username) {
    var self = this;
    this.client = new clientModule.PSClient({
        username: username,
        shadowMode: true,
        skipLogin: false
    });
    this.bridge = new bridgeModule.DecisionBridge({
        account: username,
        providerHint: 'upstream-foul-play'
    });
    this.client.onRequest = function (request, actions, session, room) {
        var state = self.bridge.buildState(session, request, actions);
        var key = requestKey(room || (session && session.roomId), request && request.rqid);
        var entry = self.pending[key] || { key: key, state: state, actual: null };
        entry.state = state;
        self.pending[key] = entry;
        self.fetchReference(entry);
    };
    if (this.options.logFile) {
        var parent = path.dirname(this.options.logFile);
        fs.mkdirSync(parent, { recursive: true });
        this.logStream = fs.createWriteStream(this.options.logFile, { flags: 'a', encoding: 'utf8' });
    }
};

Mirror.prototype.fetchReference = function (entry) {
    var self = this;
    postJson(this.options.referenceUrl, entry.state, 30000).then(function (reference) {
        entry.reference = reference;
        self.finalize(entry);
    }).catch(function (error) {
        entry.referenceError = error.message;
        self.finalize(entry);
    });
};

Mirror.prototype.acceptProtocol = function (raw) {
    var text = String(raw || '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    if (firstLine.indexOf('>battle-') !== 0) return;
    try {
        this.client.handleMessage(text);
    } catch (error) {
        this.emit({
            schemaVersion: 'upstream-mirror/v1',
            type: 'mirror-error',
            timestamp: nowIso(),
            error: error.message
        });
    }
};

Mirror.prototype.acceptActual = function (room, rqid, command) {
    var key = requestKey(room, rqid);
    var entry = this.pending[key];
    if (!entry) {
        entry = { key: key, state: null, actual: null };
        this.pending[key] = entry;
    }
    entry.actual = {
        command: command,
        action: actionKeyFromCommand(entry.state || {}, command)
    };
    this.finalize(entry);
};

Mirror.prototype.acceptBaseline = function (room, rqid, baseline) {
    var key = requestKey(room, rqid);
    var entry = this.pending[key];
    if (!entry) {
        entry = { key: key, state: null, actual: null };
        this.pending[key] = entry;
    }
    entry.baseline = baseline;
    this.finalize(entry);
};

function compareBaselineState(baseline, state) {
    if (!baseline || !state) return { comparable: false, differences: ['missing-state'] };
    var differences = [];
    var baselineSummaryDifferences = [];
    var me = state.me || {};
    var opp = state.opp || {};
    var baselineMe = baseline.user && baseline.user.active || {};
    var baselineOpp = baseline.opponent && baseline.opponent.active || {};
    differences = differences.concat(
        comparablePokemonDiff('active-me', baselineMe, me, {
            hp: true,
            status: true,
            boosts: true,
            moves: true
        })
    );
    differences = differences.concat(
        comparablePokemonDiff('active-opp', baselineOpp, opp, {
            hp: true,
            status: true,
            fainted: true,
            boosts: true,
            moves: false
        })
    );
    if (normalizeEffectId(baseline.weather) !== normalizeEffectId(state.weather)) {
        differences.push('weather');
    }
    if (normalizeEffectId(baseline.field) !== normalizeEffectId(state.terrain)) {
        differences.push('terrain');
    }
    var baselineOwnTeam = baselineTeam(baseline);
    var translatedOwnTeam = translatedTeam(state, 'self');
    for (var i = 0; i < baselineOwnTeam.length; i++) {
        var own = baselineOwnTeam[i];
        var translatedOwn = findPokemon(translatedOwnTeam, own.name);
        differences = differences.concat(
            comparablePokemonDiff('team-' + toId(own.name), own, translatedOwn, {
                hp: true,
                status: true,
                fainted: true,
                boosts: true,
                moves: true
            })
        );
    }
    var baselinePublicOpponent = [baselineOpp].concat(
        (baseline.opponent && baseline.opponent.reserve) || []
    ).filter(function (item) { return !!item; });
    var translatedPublicOpponent = translatedTeam(state, 'opponent');
    for (var j = 0; j < baselinePublicOpponent.length; j++) {
        var publicOpponent = baselinePublicOpponent[j];
        var translatedOpponent = findPokemon(translatedPublicOpponent, publicOpponent.name);
        var latestPublicHp = latestPublicHpPercent(state, publicOpponent.name);
        var baselineMaxHp = Number(publicOpponent.maxHp || 0);
        var baselineHp = Number(publicOpponent.hp);
        var baselineHpPct = baselineMaxHp > 0 ? baselineHp / baselineMaxHp * 100 : null;
        if (translatedOpponent && latestPublicHp !== null &&
            baselineHpPct !== null &&
            Math.abs(latestPublicHp - baselineHpPct) > 0.51 &&
            Math.abs(Number(translatedOpponent.hpPct) - latestPublicHp) <= 0.51) {
            baselineSummaryDifferences.push(
                'baseline-public-' + toId(publicOpponent.name) + '-hp'
            );
        }
        differences = differences.concat(
            comparablePokemonDiff('public-' + toId(publicOpponent.name), publicOpponent, translatedOpponent, {
                hp: true,
                expectedHpPct: latestPublicHp,
                status: true,
                fainted: true,
                boosts: true,
                moves: false
            })
        );
    }
    var baselineConditions = normalizedConditionCounts(
        baseline.user && baseline.user.sideConditions || {}
    );
    var translatedConditions = normalizedConditionCounts(
        state.sideConditionDetails && state.sideConditionDetails.me || {}
    );
    var conditionKeys = {};
    Object.keys(baselineConditions).forEach(function (key) { conditionKeys[key] = true; });
    Object.keys(translatedConditions).forEach(function (key) { conditionKeys[key] = true; });
    Object.keys(conditionKeys).forEach(function (key) {
        var baselineCount = Number(baselineConditions[key] || 0);
        var translatedCount = Number(translatedConditions[key] || 0);
        // Foul Play 的 side_conditions 对多数屏障只保存存在性 1，PS adapter
        // detail 同时保存真实剩余回合。若 baseline 只有存在性信息，不能把
        // “1”与“当前剩余 2 回合”误判成转译错误。
        var samePresence = (baselineCount > 0) === (translatedCount > 0);
        var durationTimingDelta = samePresence &&
            baselineCount > 0 && translatedCount > 0 &&
            Math.abs(baselineCount - translatedCount) <= 1;
        var comparableDuration = baselineCount > 1;
        if (!samePresence || (comparableDuration && baselineCount !== translatedCount &&
            !durationTimingDelta)) {
            differences.push('side-condition-' + key);
        } else if (durationTimingDelta && baselineCount !== translatedCount) {
            baselineSummaryDifferences.push('baseline-side-condition-' + key + '-timing');
        }
    });
    return {
        comparable: true,
        differences: differences,
        translationDifferences: differences,
        baselineSummaryDifferences: baselineSummaryDifferences,
        selfDifferences: differences.filter(function (item) {
            return item.indexOf('active-me') === 0 ||
                item.indexOf('team-') === 0 ||
                item.indexOf('side-condition-') === 0;
        }),
        opponentPublicDifferences: differences.filter(function (item) {
            return item.indexOf('active-opp') === 0 ||
                item.indexOf('public-') === 0 ||
                item === 'weather' ||
                item === 'terrain';
        })
    };
}

Mirror.prototype.finalize = function (entry) {
    if (!entry.reference && !entry.referenceError) return;
    if (!entry.actual || !entry.baseline || entry.logged) return;
    entry.logged = true;
    var referenceAction = entry.reference && (
        entry.reference.selectedAction || entry.reference.bestAction || null
    );
    var actualAction = entry.actual.action;
    this.emit({
        schemaVersion: 'upstream-mirror/v1',
        type: 'comparison',
        timestamp: nowIso(),
        key: entry.key,
        referenceAction: referenceAction,
        actualAction: actualAction,
        same: !!referenceAction && !!actualAction &&
            String(referenceAction).toLowerCase() === String(actualAction).toLowerCase(),
        referenceError: entry.referenceError || null,
        reference: entry.reference || null,
        actual: entry.actual,
        baseline: entry.baseline,
        stateParity: compareBaselineState(entry.baseline, entry.state),
        state: entry.state
    });
    delete this.pending[entry.key];
};

Mirror.prototype.emit = function (record) {
    var line = JSON.stringify(record);
    if (this.logStream) this.logStream.write(line + '\n');
    if (!this.options.quiet) process.stdout.write(line + '\n');
};

function main() {
    var options = parseArgs(process.argv.slice(2));
    var username = process.env.PS_USERNAME || '';
    if (!username) throw new Error('PS_USERNAME is required');
    var mirror = new Mirror(options);
    mirror.start(username);
    var input = readline.createInterface({
        input: process.stdin,
        crlfDelay: Infinity
    });
    input.on('line', function (line) {
        if (!line) return;
        var message;
        try {
            message = JSON.parse(line);
        } catch (error) {
            mirror.emit({
                schemaVersion: 'upstream-mirror/v1',
                type: 'mirror-error',
                timestamp: nowIso(),
                error: 'invalid input JSON'
            });
            return;
        }
        if (message.kind === 'protocol') mirror.acceptProtocol(message.raw);
        else if (message.kind === 'actual') {
            mirror.acceptActual(message.room, message.rqid, message.command);
        } else if (message.kind === 'baseline') {
            mirror.acceptBaseline(message.room, message.rqid, message.baseline);
        }
    });
}

if (require.main === module) {
    main();
}

module.exports = {
    compareBaselineState: compareBaselineState,
    normalizedConditionCounts: normalizedConditionCounts,
    normalizedPokemonMoves: normalizedPokemonMoves
};
