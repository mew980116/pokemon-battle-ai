'use strict';

var fs = require('fs');
var path = require('path');

var file = process.argv[2] || path.join(process.cwd(), 'decisions.jsonl');

function readRows(target) {
    if (!fs.existsSync(target)) return [];
    var lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        try { rows.push(JSON.parse(lines[i])); } catch (error) {}
    }
    return rows;
}

function keyOf(row) {
    return String(row.battleId || '') + ':' +
        String(row.predictedRqid === undefined ? '' : row.predictedRqid) + ':' +
        String(row.predictedTurn === undefined ? '' : row.predictedTurn);
}

var rows = readRows(file);
var predictionRows = rows.filter(function (row) {
    return row.schemaVersion === 'live-observer/v1' &&
        row.opponentPrediction &&
        Array.isArray(row.opponentPrediction.top3) &&
        row.opponentPrediction.top3.length > 0;
});
var outcomeRows = rows.filter(function (row) {
    return row.schemaVersion === 'live-observer/opponent-prediction/v1';
});
var outcomeByKey = {};
for (var i = 0; i < outcomeRows.length; i++) outcomeByKey[keyOf(outcomeRows[i])] = outcomeRows[i];

var evaluated = outcomeRows.filter(function (row) { return row.scorable; });
var forced = outcomeRows.filter(function (row) { return !row.scorable; });
var top1Correct = evaluated.filter(function (row) { return row.top1Correct; }).length;
var top3Correct = evaluated.filter(function (row) { return row.top3Correct; }).length;
var probabilitySum = evaluated.reduce(function (total, row) {
    return total + Number(row.actualActionProbability || 0);
}, 0);
var pending = predictionRows.filter(function (row) {
    var key = String(row.battleId || '') + ':' +
        String(row.rqid === undefined ? '' : row.rqid) + ':' +
        String(row.turn === undefined ? '' : row.turn);
    return !outcomeByKey[key];
}).length;

var summary = {
    schemaVersion: 'opponent-prediction-summary/v1',
    file: path.resolve(file),
    predictionsLogged: predictionRows.length,
    outcomesLogged: outcomeRows.length,
    evaluated: evaluated.length,
    forcedOrUnscorable: forced.length,
    pending: pending,
    top1Correct: top1Correct,
    top3Correct: top3Correct,
    top1Accuracy: evaluated.length ? top1Correct / evaluated.length : null,
    top3Accuracy: evaluated.length ? top3Correct / evaluated.length : null,
    meanActualActionProbability: evaluated.length ? probabilitySum / evaluated.length : null
};

console.log(JSON.stringify(summary, null, 2));
