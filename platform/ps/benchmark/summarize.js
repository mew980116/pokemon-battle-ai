'use strict';

var fs = require('fs');
var path = require('path');
var battleStats = require('./battle-stats.js');

var dir = process.argv[2] || path.join(__dirname, 'results');

function findMatchFiles(root) {
    if (!fs.existsSync(root)) return [];
    var rootStat = fs.statSync(root);
    if (rootStat.isFile()) return path.basename(root) === 'matches.jsonl' ? [root] : [];
    var result = [];
    var names = fs.readdirSync(root);
    for (var i = 0; i < names.length; i++) {
        var child = path.join(root, names[i]);
        var childStat;
        try { childStat = fs.statSync(child); } catch (error) { continue; }
        if (childStat.isDirectory()) result = result.concat(findMatchFiles(child));
        else if (names[i] === 'matches.jsonl') result.push(child);
    }
    return result;
}

var files = findMatchFiles(dir);
var rows = [];
for (var fileIndex = 0; fileIndex < files.length; fileIndex++) {
    var lines = fs.readFileSync(files[fileIndex], 'utf8').split(/\r?\n/);
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (!lines[lineIndex]) continue;
        try {
            var row = JSON.parse(lines[lineIndex]);
            row.sourceFile = files[fileIndex];
            rows.push(row);
        } catch (error) {}
    }
}

function countBy(list, key) {
    var result = {};
    for (var i = 0; i < list.length; i++) {
        var value = list[i][key] || 'unknown';
        result[value] = (result[value] || 0) + 1;
    }
    return result;
}

function sum(list, key) {
    var total = 0;
    for (var i = 0; i < list.length; i++) total += Number(list[i][key] || 0);
    return total;
}

function quantile(values, q) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var index = Math.ceil(q * sorted.length) - 1;
    index = Math.max(0, Math.min(sorted.length - 1, index));
    return sorted[index];
}

function rounded(value) {
    return value === null || value === undefined ? null : Math.round(value * 100) / 100;
}

function metricNames() {
    return [
        'finalAlive', 'switches', 'allSwitches', 'nonInitialSwitches',
        'boostEvents', 'boostAmount', 'unboostEvents', 'moveCount',
        'attackMoveCount', 'teraUses', 'faints', 'residualFaints', 'firstStrikeKOs',
        'switchInKOs'
    ];
}

function normalizedMetricNames() {
    return [
        'switches', 'allSwitches', 'nonInitialSwitches', 'boostEvents',
        'boostAmount', 'unboostEvents', 'moveCount', 'attackMoveCount',
        'teraUses',
        'faints', 'residualFaints', 'firstStrikeKOs', 'switchInKOs'
    ];
}

function ensureStats(row) {
    if (row.technicalStats && row.technicalStats.sides &&
        row.technicalStats.normalized && row.technicalStats.survivalLeadTimeline &&
        row.technicalStats.sides.p1 && row.technicalStats.sides.p2 &&
        Object.prototype.hasOwnProperty.call(row.technicalStats.sides.p1, 'teraUses') &&
        Object.prototype.hasOwnProperty.call(row.technicalStats.sides.p2, 'teraUses')) {
        return row.technicalStats;
    }
    if (row.result === 'win' || row.result === 'loss' || row.result === 'tie') {
        return battleStats.analyzeBattle(row);
    }
    return null;
}

function summarizeValues(values) {
    if (!values.length) {
        return { count: 0, average: null, p25: null, median: null, p75: null, min: null, max: null };
    }
    var total = values.reduce(function (a, b) { return a + b; }, 0);
    return {
        count: values.length,
        average: rounded(total / values.length),
        p25: rounded(quantile(values, 0.25)),
        median: rounded(quantile(values, 0.50)),
        p75: rounded(quantile(values, 0.75)),
        min: rounded(Math.min.apply(Math, values)),
        max: rounded(Math.max.apply(Math, values))
    };
}

function aggregateMetricRows(list) {
    var names = metricNames();
    var rateNames = normalizedMetricNames();
    var values = { turns: [] };
    var sideNames = ['p1', 'p2', 'self', 'opponent'];
    for (var sideIndex = 0; sideIndex < sideNames.length; sideIndex++) {
        values[sideNames[sideIndex]] = {};
        for (var metricIndex = 0; metricIndex < names.length; metricIndex++) {
            values[sideNames[sideIndex]][names[metricIndex]] = [];
        }
        values[sideNames[sideIndex] + 'PerTurn'] = {};
        for (var rateIndex = 0; rateIndex < rateNames.length; rateIndex++) {
            values[sideNames[sideIndex] + 'PerTurn'][rateNames[rateIndex]] = [];
        }
        values[sideNames[sideIndex] + 'FirstTeraTurn'] = [];
    }
    var checkpointProgresses = [0, 0.25, 0.5, 0.75, 1];
    var leadValues = {};
    for (var checkpointIndex = 0; checkpointIndex < checkpointProgresses.length; checkpointIndex++) {
        var checkpointKey = String(checkpointProgresses[checkpointIndex]);
        leadValues[checkpointKey] = {
            selfAlive: [],
            opponentAlive: [],
            selfMinusOpponent: []
        };
    }
    var technicalCount = 0;
    for (var rowIndex = 0; rowIndex < list.length; rowIndex++) {
        var technical = ensureStats(list[rowIndex]);
        if (!technical) continue;
        technicalCount++;
        if (Number.isFinite(Number(technical.turns))) values.turns.push(Number(technical.turns));
        var technicalSides = technical.sides || {};
        for (var sideIndex2 = 0; sideIndex2 < sideNames.length; sideIndex2++) {
            var sideName = sideNames[sideIndex2];
            var side = technicalSides[sideName];
            if (!side) continue;
            for (var metricIndex2 = 0; metricIndex2 < names.length; metricIndex2++) {
                var metric = names[metricIndex2];
                if (Number.isFinite(Number(side[metric]))) {
                    values[sideName][metric].push(Number(side[metric]));
                }
            }
            if (side.firstTeraTurn !== null && side.firstTeraTurn !== undefined &&
                Number.isFinite(Number(side.firstTeraTurn))) {
                values[sideName + 'FirstTeraTurn'].push(Number(side.firstTeraTurn));
            }
            var normalizedSide = technical.normalized[sideName] || {};
            for (var rateIndex2 = 0; rateIndex2 < rateNames.length; rateIndex2++) {
                var rateMetric = rateNames[rateIndex2];
                var rateValue = normalizedSide[rateMetric + 'PerTurn'];
                if (Number.isFinite(Number(rateValue))) {
                    values[sideName + 'PerTurn'][rateMetric].push(Number(rateValue));
                }
            }
        }
        var timeline = Array.isArray(technical.survivalLeadTimeline) ?
            technical.survivalLeadTimeline : [];
        for (var timelineIndex = 0; timelineIndex < timeline.length; timelineIndex++) {
            var timelineEntry = timeline[timelineIndex];
            var timelineKey = String(timelineEntry.progress);
            if (!leadValues[timelineKey]) continue;
            if (Number.isFinite(Number(timelineEntry.selfAlive))) {
                leadValues[timelineKey].selfAlive.push(Number(timelineEntry.selfAlive));
            }
            if (Number.isFinite(Number(timelineEntry.opponentAlive))) {
                leadValues[timelineKey].opponentAlive.push(Number(timelineEntry.opponentAlive));
            }
            if (Number.isFinite(Number(timelineEntry.selfMinusOpponent))) {
                leadValues[timelineKey].selfMinusOpponent.push(Number(timelineEntry.selfMinusOpponent));
            }
        }
    }

    var output = {
        gamesWithTechnicalStats: technicalCount,
        turns: summarizeValues(values.turns)
    };
    for (var sideIndex3 = 0; sideIndex3 < sideNames.length; sideIndex3++) {
        var outputSide = sideNames[sideIndex3];
        output[outputSide] = {};
        for (var metricIndex3 = 0; metricIndex3 < names.length; metricIndex3++) {
            var outputMetric = names[metricIndex3];
            output[outputSide][outputMetric] = summarizeValues(values[outputSide][outputMetric]);
        }
        output[outputSide].perTurn = {};
        for (var rateIndex3 = 0; rateIndex3 < rateNames.length; rateIndex3++) {
            var outputRateMetric = rateNames[rateIndex3];
            output[outputSide].perTurn[outputRateMetric] =
                summarizeValues(values[outputSide + 'PerTurn'][outputRateMetric]);
        }
        output[outputSide].teraUsedGames = values[outputSide].teraUses ?
            values[outputSide].teraUses.filter(function (value) { return value > 0; }).length : 0;
        output[outputSide].teraUseRate = technicalCount ?
            rounded(output[outputSide].teraUsedGames / technicalCount) : null;
        output[outputSide].firstTeraTurn = summarizeValues(
            values[outputSide + 'FirstTeraTurn']
        );
    }
    output.selfMinusOpponent = {};
    for (var comparisonIndex = 0; comparisonIndex < names.length; comparisonIndex++) {
        var comparisonMetric = names[comparisonIndex];
        var selfAverage = output.self[comparisonMetric].average;
        var opponentAverage = output.opponent[comparisonMetric].average;
        output.selfMinusOpponent[comparisonMetric] =
            selfAverage === null || opponentAverage === null ? null : rounded(selfAverage - opponentAverage);
    }
    output.survivalLeadTimeline = {};
    for (var checkpointIndex2 = 0; checkpointIndex2 < checkpointProgresses.length; checkpointIndex2++) {
        var checkpointProgress = checkpointProgresses[checkpointIndex2];
        var checkpointKey2 = String(checkpointProgress);
        output.survivalLeadTimeline[checkpointKey2] = {
            progress: checkpointProgress,
            selfAlive: summarizeValues(leadValues[checkpointKey2].selfAlive),
            opponentAlive: summarizeValues(leadValues[checkpointKey2].opponentAlive),
            selfMinusOpponent: summarizeValues(leadValues[checkpointKey2].selfMinusOpponent)
        };
    }
    return output;
}

var decisionLatencies = [];
for (var rowIndex2 = 0; rowIndex2 < rows.length; rowIndex2++) {
    var decisions = Array.isArray(rows[rowIndex2].decisions) ? rows[rowIndex2].decisions : [];
    for (var decisionIndex = 0; decisionIndex < decisions.length; decisionIndex++) {
        var latency = Number(decisions[decisionIndex].latencyMs);
        if (Number.isFinite(latency) && latency >= 0) decisionLatencies.push(latency);
    }
}

var completedRows = rows.filter(function (row) {
    return row.result === 'win' || row.result === 'loss' || row.result === 'tie';
});
var groups = {};
var groupBuckets = {};
for (var groupIndex = 0; groupIndex < rows.length; groupIndex++) {
    var groupRow = rows[groupIndex];
    var groupKey = String(groupRow.provider || 'unknown') + '|' +
        String(groupRow.format || 'unknown') + '|' +
        String(groupRow.result || 'unknown');
    if (!groupBuckets[groupKey]) groupBuckets[groupKey] = [];
    groupBuckets[groupKey].push(groupRow);
}
Object.keys(groupBuckets).forEach(function (key) {
    var groupRows = groupBuckets[key];
    groups[key] = {
        matches: groupRows.length,
        providers: countBy(groupRows, 'provider'),
        formats: countBy(groupRows, 'format'),
        results: countBy(groupRows, 'result'),
        technicalStats: aggregateMetricRows(groupRows)
    };
});

var summary = {
    schemaVersion: 'ps-benchmark-summary/v3',
    directory: path.resolve(dir),
    sourceFiles: files.map(function (file) { return path.resolve(file); }),
    matches: rows.length,
    providers: countBy(rows, 'provider'),
    formats: countBy(rows, 'format'),
    results: countBy(rows, 'result'),
    winners: countBy(rows, 'winner'),
    fallbackCount: sum(rows, 'fallbackCount'),
    invalidActionCount: sum(rows, 'invalidActionCount'),
    decisionCount: sum(rows, 'decisionCount'),
    totalDurationMs: sum(rows, 'durationMs'),
    averageDurationMs: rows.length ? Math.round(sum(rows, 'durationMs') / rows.length) : 0,
    averageTurns: completedRows.length ? rounded(sum(completedRows, 'turns') / completedRows.length) : null,
    decisionLatencyMs: {
        count: decisionLatencies.length,
        average: decisionLatencies.length ?
            rounded(decisionLatencies.reduce(function (a, b) { return a + b; }, 0) / decisionLatencies.length) : null,
        p50: quantile(decisionLatencies, 0.50),
        p95: quantile(decisionLatencies, 0.95),
        max: decisionLatencies.length ? Math.max.apply(Math, decisionLatencies) : null
    },
    wins: rows.filter(function (row) { return row.result === 'win'; }).length,
    losses: rows.filter(function (row) { return row.result === 'loss'; }).length,
    ties: rows.filter(function (row) { return row.result === 'tie'; }).length,
    completed: completedRows.length,
    timedOut: rows.filter(function (row) { return row.result === 'timeout'; }).length,
    setupTimeouts: rows.filter(function (row) { return row.result === 'setup_timeout'; }).length,
    errors: rows.filter(function (row) { return row.result === 'error'; }).length,
    technicalStats: aggregateMetricRows(completedRows),
    comparisons: groups
};

console.log(JSON.stringify(summary, null, 2));
