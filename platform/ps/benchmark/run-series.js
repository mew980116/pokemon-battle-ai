'use strict';

var fs = require('fs');
var path = require('path');
var clientModule = require('../client.js');
var bridgeModule = require('../decision-bridge.js');
var observerModule = require('../live-observer.js');
var battleStats = require('./battle-stats.js');

var DEFAULTS = {
    host: '218.244.153.64',
    port: 8000,
    wsPath: '/showdown/websocket',
    provider: 'random',
    games: 1,
    completedGames: 0,
    maxAttempts: 0,
    format: 'gen9randombattle',
    opponent: '',
    output: path.join(__dirname, 'results'),
    decisionUrl: process.env.POKELLMON_TOOL_URL || 'http://127.0.0.1:8092/choice',
    noTimer: true,
    battleTimeoutMs: 180000,
    setupTimeoutMs: 45000,
    setupRetries: 1,
    setupRetryDelayMs: 2000,
    settleMs: 10000,
    observerUrl: '',
    announce: 'none',
    observerLog: '',
    observerTimeoutMs: 1500
};

function parseArgs(argv) {
    var options = {};
    for (var i = 0; i < argv.length; i++) {
        var arg = argv[i];
        if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--provider') options.provider = argv[++i];
        else if (arg === '--games') options.games = Number(argv[++i]);
        else if (arg === '--completed-games') options.completedGames = Number(argv[++i]);
        else if (arg === '--max-attempts') options.maxAttempts = Number(argv[++i]);
        else if (arg === '--format') options.format = argv[++i];
        else if (arg === '--opponent') options.opponent = argv[++i];
        else if (arg === '--host') options.host = argv[++i];
        else if (arg === '--port') options.port = Number(argv[++i]);
        else if (arg === '--ws-url') options.wsUrl = argv[++i];
        else if (arg === '--output') options.output = argv[++i];
        else if (arg === '--decision-url') options.decisionUrl = argv[++i];
        else if (arg === '--battle-timeout-ms') options.battleTimeoutMs = Number(argv[++i]);
        else if (arg === '--setup-timeout-ms') options.setupTimeoutMs = Number(argv[++i]);
        else if (arg === '--setup-retries') options.setupRetries = Number(argv[++i]);
        else if (arg === '--setup-retry-delay-ms') options.setupRetryDelayMs = Number(argv[++i]);
        else if (arg === '--settle-ms') options.settleMs = Number(argv[++i]);
        else if (arg === '--observer-url') options.observerUrl = argv[++i];
        else if (arg === '--announce') options.announce = argv[++i];
        else if (arg === '--observer-log') options.observerLog = argv[++i];
        else if (arg === '--observer-timeout-ms') options.observerTimeoutMs = Number(argv[++i]);
        else if (arg === '--keep-timer') options.noTimer = false;
        else throw new Error('Unknown argument: ' + arg);
    }
    return options;
}

function printHelp() {
    console.log('Usage: node platform/ps/benchmark/run-series.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --provider random|rules|llm|foul-play|dual-view Decision provider (default: random)');
    console.log('  --games N                   Number of battles (default: 1)');
    console.log('  --completed-games N         Stop after N completed wins/losses/ties');
    console.log('  --max-attempts N            Safety cap when using --completed-games');
    console.log('  --format FORMAT             PS format');
    console.log('  --opponent USER             Opponent user id');
    console.log('  --host IP                   PS server host');
    console.log('  --port N                   PS server port (default: 8000)');
    console.log('  --ws-url URL                Full websocket URL');
    console.log('  --output DIR                Result directory');
    console.log('  --decision-url URL          Decision service URL for llm, foul-play, or dual-view');
    console.log('  --battle-timeout-ms N       Battle timeout (default: 180000)');
    console.log('  --setup-timeout-ms N        Login/challenge timeout (default: 45000)');
    console.log('  --setup-retries N           Retry only when no challenge response is observed (default: 1)');
    console.log('  --setup-retry-delay-ms N    Delay before a setup retry (default: 2000)');
    console.log('  --settle-ms N               Wait after a battle before the next one');
    console.log('  --observer-url URL          Foul Play live reference sidecar URL');
    console.log('  --announce none|all|diff-only  Room announcement mode (default: none)');
    console.log('  --observer-log FILE         JSONL path for live decision comparisons');
    console.log('  --observer-timeout-ms N     Reference timeout (default: 1500)');
    console.log('  --keep-timer                Do not send /timer off');
}

function safePart(value) {
    return String(value || '').replace(/[^A-Za-z0-9._-]+/g, '-');
}

function toId(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function nowIso() {
    return new Date().toISOString();
}

function redactProtocolLine(value) {
    return String(value || '').replace(/\|challstr\|[^\r\n]*/, '|challstr|[redacted]');
}

function percentile(values, fraction) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
    return sorted[index];
}

function summarizeLatencies(entries) {
    var values = [];
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].latencyMs !== null && entries[i].latencyMs !== undefined) values.push(entries[i].latencyMs);
    }
    return {
        count: values.length,
        p50: percentile(values, 0.50),
        p95: percentile(values, 0.95),
        max: values.length ? Math.max.apply(Math, values) : null
    };
}

function formatDefaults(options) {
    var format = String(options.format || DEFAULTS.format);
    var opponent = options.opponent;
    if (!opponent) opponent = format.indexOf('gen8') === 0 ? 'foulplaybot-g8' : 'foulplaybot';
    return {
        host: options.host || DEFAULTS.host,
        port: Number(options.port || DEFAULTS.port),
        wsUrl: options.wsUrl || 'ws://' + (options.host || DEFAULTS.host) + ':' +
            Number(options.port || DEFAULTS.port) + DEFAULTS.wsPath,
        provider: options.provider || DEFAULTS.provider,
        games: Number(options.games || DEFAULTS.games),
        completedGames: Math.max(0, Number(options.completedGames || DEFAULTS.completedGames)),
        maxAttempts: Math.max(0, Number(options.maxAttempts || DEFAULTS.maxAttempts)),
        format: format,
        opponent: opponent,
        output: options.output || DEFAULTS.output,
        decisionUrl: options.decisionUrl || DEFAULTS.decisionUrl,
        noTimer: options.noTimer !== undefined ? !!options.noTimer : DEFAULTS.noTimer,
        battleTimeoutMs: Number(options.battleTimeoutMs || DEFAULTS.battleTimeoutMs),
        setupTimeoutMs: Number(options.setupTimeoutMs || DEFAULTS.setupTimeoutMs),
        setupRetries: Math.max(0, Number(options.setupRetries !== undefined ? options.setupRetries : DEFAULTS.setupRetries)),
        setupRetryDelayMs: Math.max(0, Number(options.setupRetryDelayMs !== undefined ? options.setupRetryDelayMs : DEFAULTS.setupRetryDelayMs)),
        settleMs: Number(options.settleMs || DEFAULTS.settleMs),
        observerUrl: options.observerUrl || DEFAULTS.observerUrl,
        announce: options.announce || DEFAULTS.announce,
        observerLog: options.observerLog || DEFAULTS.observerLog,
        observerTimeoutMs: Number(options.observerTimeoutMs || DEFAULTS.observerTimeoutMs)
    };
}

function makeUsername(config, index) {
    var providerCode = config.provider === 'llm' ? 'L' :
        (config.provider === 'foul-play' ? 'F' :
            (config.provider === 'dual-view' ? 'D' : 'R'));
    var generationCode = config.format.indexOf('gen8') === 0 ? '8' : '9';
    var stamp = Date.now().toString(36).slice(-7);
    // PS 用户名长度有限；必须把 index 和时间戳放在前面，避免多场复用同一账号。
    return safePart('B' + providerCode + generationCode + index + stamp).slice(0, 18);
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeJsonl(file, row) {
    fs.appendFileSync(file, JSON.stringify(row) + '\n');
}

function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function runOne(config, index) {
    return new Promise(function (resolve) {
        var startedAt = Date.now();
        var username = makeUsername(config, index);
        var room = null;
        var ended = false;
        var timedOut = false;
        var protocol = [];
        var decisions = [];
        var invalidActions = 0;
        var fallbackCount = 0;
        var client;
        var bridge;
        var liveObserver;
        var setupTimeoutHandle;
        var setupRetryHandle;
        var battleTimeoutHandle;
        var setupTimedOut = false;
        var setupRetriesUsed = 0;
        var challengeCancelRequested = false;
        var connectionEvents = [];
        var setupSignals = [];
        var setupState = {
            challstr: false,
            loggedIn: false,
            challengeSent: false,
            challengeResponse: false,
            battleRoom: false,
            rejection: null,
            attempts: 1
        };
        var resultFile = path.join(config.output, 'matches.jsonl');
        var sessionRef = null;
        var requestStartedAt = {};

        function finish(result) {
            if (ended) return;
            ended = true;
            clearTimeout(setupTimeoutHandle);
            clearTimeout(setupRetryHandle);
            clearTimeout(battleTimeoutHandle);
            if (client) client.close();
            var latencies = summarizeLatencies(decisions);
            var row = {
                schemaVersion: 'ps-benchmark/v1',
                matchId: safePart(config.format + '-' + config.provider + '-' + index + '-' + startedAt),
                index: index,
                startedAt: new Date(startedAt).toISOString(),
                endedAt: nowIso(),
                durationMs: Date.now() - startedAt,
                provider: config.provider,
                decisionUrl: ['llm', 'foul-play', 'dual-view'].indexOf(config.provider) !== -1 ?
                    config.decisionUrl : null,
                format: config.format,
                opponent: config.opponent,
                account: username,
                room: room,
                result: result && result.result ? result.result : 'error',
                winner: result && result.winner ? result.winner : null,
                reason: result && result.reason ? result.reason : null,
                timedOut: timedOut,
                setupTimedOut: setupTimedOut,
                connectionEvents: connectionEvents,
                setupSignals: setupSignals,
                setupState: setupState,
                setupRetriesUsed: setupRetriesUsed,
                turns: sessionRef ? sessionRef.turn : null,
                decisionCount: decisions.length,
                fallbackCount: fallbackCount,
                invalidActionCount: invalidActions,
                latencyMs: latencies,
                protocolEventCount: protocol.length,
                decisions: decisions,
                protocol: protocol
            };
            if (row.result === 'win' || row.result === 'loss' || row.result === 'tie') {
                row.technicalStats = battleStats.analyzeBattle(row);
            } else {
                row.technicalStats = null;
            }
            writeJsonl(resultFile, row);
            console.log(JSON.stringify({
                match: index,
                room: room,
                result: row.result,
                winner: row.winner,
                turns: row.turns,
                technicalStats: row.technicalStats ? {
                    turns: row.technicalStats.turns,
                    p1: {
                        finalAlive: row.technicalStats.sides.p1.finalAlive,
                        switches: row.technicalStats.sides.p1.switches,
                        boostEvents: row.technicalStats.sides.p1.boostEvents,
                        attackMoveCount: row.technicalStats.sides.p1.attackMoveCount,
                        teraUses: row.technicalStats.sides.p1.teraUses,
                        firstTeraTurn: row.technicalStats.sides.p1.firstTeraTurn,
                        firstStrikeKOs: row.technicalStats.sides.p1.firstStrikeKOs,
                        switchInKOs: row.technicalStats.sides.p1.switchInKOs
                    },
                    p2: {
                        finalAlive: row.technicalStats.sides.p2.finalAlive,
                        switches: row.technicalStats.sides.p2.switches,
                        boostEvents: row.technicalStats.sides.p2.boostEvents,
                        attackMoveCount: row.technicalStats.sides.p2.attackMoveCount,
                        teraUses: row.technicalStats.sides.p2.teraUses,
                        firstTeraTurn: row.technicalStats.sides.p2.firstTeraTurn,
                        firstStrikeKOs: row.technicalStats.sides.p2.firstStrikeKOs,
                        switchInKOs: row.technicalStats.sides.p2.switchInKOs
                    }
                } : null,
                decisions: row.decisionCount,
                fallback: row.fallbackCount,
                p50: row.latencyMs.p50,
                p95: row.latencyMs.p95
            }));
            resolve(row);
        }

        function setupTimeoutReason() {
            return !setupState.challstr ? 'no_challstr' :
                !setupState.loggedIn ? 'login_not_confirmed' :
                !setupState.challengeSent ? 'challenge_not_sent' :
                setupState.rejection ? 'challenge_rejected' :
                !setupState.challengeResponse ? 'opponent_no_response' : 'no_battle_room';
        }

        function armSetupTimeout() {
            clearTimeout(setupTimeoutHandle);
            setupTimeoutHandle = setTimeout(function () {
                var reason = setupTimeoutReason();
                if (!ended && !room && reason === 'opponent_no_response' &&
                    setupRetriesUsed < config.setupRetries) {
                    setupRetriesUsed++;
                    setupState.attempts = setupRetriesUsed + 1;
                    setupSignals.push({
                        type: 'setupRetryScheduled',
                        attempt: setupRetriesUsed + 1,
                        reason: reason,
                        time: nowIso()
                    });
                    setupRetryHandle = setTimeout(function () {
                        if (ended || room) return;
                        try {
                            // 先取消上一轮未响应的挑战，避免服务器把重试判定为重复挑战。
                            challengeCancelRequested = true;
                            if (typeof client.cancelChallenge === 'function') client.cancelChallenge(config.opponent);
                            return sleep(config.setupRetryDelayMs).then(function () {
                                if (ended || room) return;
                                challengeCancelRequested = false;
                                client.challenge(config.opponent, config.format);
                                armSetupTimeout();
                            }).catch(function (error) {
                                finish({ result: 'error', reason: 'setup_retry_failed: ' + error.message });
                            });
                        } catch (error) {
                            finish({ result: 'error', reason: 'setup_retry_failed: ' + error.message });
                        }
                    }, 0);
                    return;
                }
                setupTimedOut = true;
                finish({ result: 'setup_timeout', reason: reason });
            }, config.setupTimeoutMs);
        }

        function onRequest(entry) {
            if (entry && entry.skipped) return;
            if (!entry) return;
            var copy = {
                battleId: entry.battleId || null,
                turn: entry.turn === undefined ? null : entry.turn,
                action: entry.action || null,
                suggestion: entry.suggestion || null,
                fallback: !!entry.fallback,
                shadow: !!entry.shadow,
                sent: entry.sent || null,
                receivedAt: nowIso()
            };
            if (copy.sent && copy.sent.error) invalidActions++;
            if (copy.fallback) fallbackCount++;
            if (config.provider === 'rules' && entry.state) copy.state = entry.state;
            if (entry.startedAt) copy.startedAt = entry.startedAt;
            if (entry.totalMs !== undefined) copy.latencyMs = entry.totalMs;
            else if (entry.latencyMs !== undefined) copy.latencyMs = entry.latencyMs;
            else {
                var state = entry.state || {};
                var requestKey = String(entry.battleId || room) + ':' +
                    String(entry.rqid !== undefined ? entry.rqid : state.rqid !== undefined ? state.rqid : '');
                copy.latencyMs = requestStartedAt[requestKey] ? Date.now() - requestStartedAt[requestKey] : null;
            }
            decisions.push(copy);
        }

        client = new clientModule.PSClient({
            username: username,
            skipLogin: true,
            wsUrl: config.wsUrl,
            rival: config.opponent,
            challengeFormat: config.format,
            shadowMode: false,
            onRequest: function (request, actions, session, battleRoom) {
                var requestKey = String(battleRoom || session.roomId) + ':' +
                    String(request && request.rqid !== undefined ? request.rqid : '');
                requestStartedAt[requestKey] = Date.now();
            },
            onConnection: function (type, data) {
                console.log('[match ' + index + '] ' + type + (data ? ' ' + JSON.stringify(data) : ''));
                connectionEvents.push({ type: type, data: data || null, time: nowIso() });
                if (type === 'challstr') setupState.challstr = true;
                if (type === 'loggedIn') setupState.loggedIn = true;
                if (type === 'challengeSent') setupState.challengeSent = true;
                if (type === 'challengeCancelled') challengeCancelRequested = true;
                if (type === 'challstr' || type === 'trnSent' || type === 'loggedIn' ||
                    type === 'challengeSent' || type === 'challengeCancelled' ||
                    type === 'challengeAccepted' || type === 'close' ||
                    type === 'error') {
                    setupSignals.push({ type: type, data: data || null, time: nowIso() });
                }
                if (type === 'error' && !room) finish({ result: 'error', reason: data && data.message ? data.message : 'connection_error' });
            },
            onBattleStart: function (session, battleRoom) {
                room = battleRoom;
                setupState.battleRoom = true;
                clearTimeout(setupRetryHandle);
                sessionRef = session;
                clearTimeout(setupTimeoutHandle);
                battleTimeoutHandle = setTimeout(function () {
                    timedOut = true;
                    finish({ result: 'timeout', reason: 'battle_timeout' });
                }, config.battleTimeoutMs);
                if (config.noTimer) {
                    try { client.sendRoom(battleRoom, 'timer off'); } catch (error) {}
                }
            },
            onBattleEnd: function (session, event, battleRoom) {
                room = room || battleRoom;
                sessionRef = sessionRef || session;
                var winner = event && event.subject ? event.subject : null;
                var outcome = event && event.type === 'tie' ? 'tie' :
                    (winner && toId(winner) === toId(username) ? 'win' : (winner ? 'loss' : 'error'));
                finish({
                    result: outcome,
                    winner: winner,
                    reason: event && event.type ? event.type : null
                });
            },
            onProtocol: function (event, battleRoom) {
                if (!event || !event.type) return;
                if (!battleRoom) {
                    if (event.type === 'global') {
                        var globalLines = String(event.raw || '').split(/\r?\n/);
                        for (var globalIndex = 0; globalIndex < globalLines.length; globalIndex++) {
                            var globalLine = globalLines[globalIndex];
                            if (!globalLine || !/^\|(challstr|updateuser|updatesearch|popup|error|pm)\|/.test(globalLine)) continue;
                            var safeGlobalLine = redactProtocolLine(globalLine);
                            setupSignals.push({ type: 'global', raw: safeGlobalLine, time: nowIso() });
                            connectionEvents.push({ type: 'global', data: { raw: safeGlobalLine }, time: nowIso() });
                            if (globalLine.indexOf('|pm|') === 0 && globalLine.indexOf('|/challenge') !== -1) {
                                var pmFields = globalLine.split('|');
                                if (pmFields.length > 3 && toId(pmFields[2]) !== toId(username)) {
                                    setupState.challengeResponse = true;
                                }
                            }
                            if (globalLine.indexOf('|updatesearch|') === 0 && globalLine.indexOf('"battle-') !== -1) {
                                setupState.challengeResponse = true;
                            }
                            var lowerLine = globalLine.toLowerCase();
                            if ((lowerLine.indexOf('|popup|') === 0 || lowerLine.indexOf('|error|') === 0) &&
                                setupState.challengeSent) {
                                // 私服对 /cancelchallenge 的反馈是 User "" not found，
                                // 这是取消旧挑战的确认，不应被当成新挑战被拒绝。
                                if (challengeCancelRequested &&
                                    lowerLine.indexOf('user "" not found') !== -1) continue;
                                setupState.rejection = globalLine;
                                finish({ result: 'setup_timeout', reason: 'challenge_rejected' });
                                return;
                            }
                        }
                    }
                    return;
                }
                room = room || battleRoom;
                if (event.type === 'error') {
                    var errorText = (event.args || []).join('|').toLowerCase();
                    // 远程私服可能已经默认关闭 timer；这不是动作非法。
                    if (errorText.indexOf('timer is already off') === -1 &&
                        (errorText.indexOf('invalid choice') !== -1 ||
                         errorText.indexOf('cannot choose') !== -1 ||
                         errorText.indexOf("can't choose") !== -1)) {
                        invalidActions++;
                    }
                }
                protocol.push({
                    type: event.type,
                    rawType: event.rawType || event.type,
                    args: event.args || [],
                    turn: event.turn === undefined ? null : event.turn
                });
            }
        });

        if (config.observerUrl) {
            liveObserver = new observerModule.LiveObserver({
                url: config.observerUrl,
                announce: config.announce,
                logFile: config.observerLog,
                timeoutMs: config.observerTimeoutMs
            });
        }

        bridge = new bridgeModule.DecisionBridge({
            url: config.decisionUrl,
            shadow: false,
            agent: config.provider === 'random' ? 'random' : 'llm',
            account: username,
            providerHint: config.provider,
            onPreCommit: function (entry) {
                if (liveObserver && entry && entry.state) {
                    // 参考策略在实际动作发送前收到同一个 state；它不会发送动作。
                    liveObserver.observe(entry, client).catch(function () {});
                }
            },
            onSuggestion: function (entry) {
                if (entry && entry.error) {
                    decisions.push({
                        error: entry.error,
                        battleId: entry.room || room,
                        turn: null,
                        fallback: true,
                        latencyMs: null,
                        receivedAt: nowIso()
                    });
                    fallbackCount++;
                }
            },
            onRequest: onRequest
        });
        bridge.attachClient(client);

        armSetupTimeout();

        try {
            client.connect();
        } catch (error) {
            finish({ result: 'error', reason: error.message });
        }
    }).then(function (row) {
        return sleep(config.settleMs).then(function () { return row; });
    });
}

function main() {
    var parsed = parseArgs(process.argv.slice(2));
    if (parsed.help) {
        printHelp();
        return;
    }
    var config = formatDefaults(parsed);
    if (['random', 'rules', 'llm', 'foul-play', 'dual-view'].indexOf(config.provider) === -1) {
        throw new Error('provider must be random, rules, llm, foul-play or dual-view');
    }
    if (config.completedGames > 0 && config.maxAttempts === 0) {
        config.maxAttempts = Math.max(config.completedGames + 10, config.completedGames * 3);
    }
    if (config.completedGames <= 0 && (!config.games || config.games < 1)) throw new Error('games must be positive');
    ensureDir(config.output);
    var manifest = {
        schemaVersion: 'ps-benchmark/v1',
        startedAt: nowIso(),
        provider: config.provider,
        format: config.format,
        opponent: config.opponent,
        wsUrl: config.wsUrl,
        noTimer: config.noTimer,
        games: config.games,
        completedGames: config.completedGames,
        maxAttempts: config.maxAttempts,
        setupTimeoutMs: config.setupTimeoutMs,
        setupRetries: config.setupRetries,
        setupRetryDelayMs: config.setupRetryDelayMs,
        observerUrl: config.observerUrl || null,
        announce: config.announce,
        observerLog: config.observerLog || null,
        observerTimeoutMs: config.observerTimeoutMs
    };
    fs.writeFileSync(path.join(config.output, 'series-' + safePart(config.format + '-' + config.provider + '-' + Date.now()) + '.json'), JSON.stringify(manifest, null, 2));
    var chain = Promise.resolve();
    if (config.completedGames > 0) {
        var completed = 0;
        var attempts = 0;
        function runUntilCompleted() {
            if (completed >= config.completedGames || attempts >= config.maxAttempts) return Promise.resolve();
            attempts++;
            return runOne(config, attempts).then(function (row) {
                if (row && (row.result === 'win' || row.result === 'loss' || row.result === 'tie')) completed++;
                return runUntilCompleted();
            });
        }
        chain = chain.then(runUntilCompleted).then(function () {
            console.log('Series complete: ' + completed + ' completed game(s) in ' + attempts + ' attempt(s)');
            if (completed < config.completedGames) {
                throw new Error('completed game target not reached: ' + completed + '/' + config.completedGames);
            }
        });
    } else {
        for (var i = 1; i <= config.games; i++) {
            (function (gameIndex) {
                chain = chain.then(function () { return runOne(config, gameIndex); });
            }(i));
        }
    }
    chain.then(function () {
        if (config.completedGames <= 0) console.log('Series complete: ' + config.games + ' game(s)');
    }).catch(function (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    });
}

main();
