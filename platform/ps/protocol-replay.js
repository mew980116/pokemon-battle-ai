'use strict';

var fs = require('fs');
var adapter = require('./adapter.js');

function isObject(value) {
    return value !== null && typeof value === 'object';
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function rawTypeForEvent(event) {
    if (event.rawType) return String(event.rawType);
    if (event.type === 'damage' || event.type === 'heal' || event.type === 'sethp' ||
        event.type === 'boost' || event.type === 'unboost' || event.type === 'status' ||
        event.type === 'weather' || event.type === 'fieldstart' || event.type === 'fieldend' ||
        event.type === 'sidestart' || event.type === 'sideend' || event.type === 'item' ||
        event.type === 'enditem' || event.type === 'ability' || event.type === 'terastallize') {
        return '-' + event.type;
    }
    return String(event.type || '');
}

function eventToProtocolLine(event) {
    if (!event || !event.type) return '';
    var rawType = rawTypeForEvent(event);
    if (event.type === 'request' || rawType === 'request') {
        var request = event.request;
        if (request === undefined && event.raw) request = event.raw;
        if (request === undefined && event.args && event.args.length) request = event.args[0];
        if (isObject(request)) request = JSON.stringify(request);
        return '|request|' + String(request || '');
    }
    var args = Array.isArray(event.args) ? event.args : [];
    return '|' + rawType + (args.length ? '|' + args.join('|') : '');
}

function eventRecordsToProtocol(records, roomFilter) {
    var lines = [];
    var roomId = null;
    for (var i = 0; i < records.length; i++) {
        var row = records[i];
        if (!row) continue;

        if (row.protocol && Array.isArray(row.protocol)) {
            if (!roomId && row.room) roomId = row.room;
            if (roomFilter && row.room && row.room !== roomFilter) continue;
            for (var p = 0; p < row.protocol.length; p++) {
                var protocolLine = eventToProtocolLine(row.protocol[p]);
                if (protocolLine) lines.push(protocolLine);
            }
            continue;
        }

        if (row.type === 'protocol' && row.data && row.data.event) {
            if (!roomId && row.data.room) roomId = row.data.room;
            if (roomFilter && row.data.room && row.data.room !== roomFilter) continue;
            var loggedEvent = row.data.event;
            if (loggedEvent.raw && loggedEvent.type === 'global') {
                lines.push(String(loggedEvent.raw));
            } else {
                var loggedLine = eventToProtocolLine(loggedEvent);
                if (loggedLine) lines.push(loggedLine);
            }
            continue;
        }

        if (row.event && row.event.type) {
            if (!roomId && row.room) roomId = row.room;
            if (roomFilter && row.room && row.room !== roomFilter) continue;
            var eventLine = eventToProtocolLine(row.event);
            if (eventLine) lines.push(eventLine);
            continue;
        }

        if (row.type && row.rawType) {
            var directLine = eventToProtocolLine(row);
            if (directLine) lines.push(directLine);
        }
    }
    return { roomId: roomId, text: lines.join('\n') };
}

function parseJsonRecords(text) {
    var trimmed = String(text || '').trim();
    if (!trimmed) return null;

    try {
        var parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return [parsed];
    } catch (error) {
        // Continue with JSONL parsing.
    }

    var records = [];
    var lines = trimmed.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try {
            records.push(JSON.parse(lines[i]));
        } catch (error) {
            return null;
        }
    }
    return records.length ? records : null;
}

function extractRoomId(text) {
    var match = String(text || '').match(/^>(battle-[^\r\n]+)/m);
    return match ? match[1] : null;
}

function normalizeInput(text, options) {
    var source = String(text || '');
    var records = parseJsonRecords(source);
    if (records) {
        var converted = eventRecordsToProtocol(records, options.room);
        return {
            roomId: converted.roomId || options.room || null,
            text: converted.text,
            sourceType: 'json'
        };
    }

    return {
        roomId: options.room || extractRoomId(source),
        text: source,
        sourceType: 'protocol'
    };
}

function pokemonSummary(pokemon) {
    if (!pokemon) return null;
    return {
        slot: pokemon.slot,
        ident: pokemon.ident,
        name: pokemon.name,
        details: pokemon.details,
        level: pokemon.level,
        hp: pokemon.hp ? clone(pokemon.hp) : null,
        status: pokemon.status,
        item: pokemon.item === undefined ? null : pokemon.item,
        ability: pokemon.ability === undefined ? null : pokemon.ability,
        teraType: pokemon.teraType === undefined ? null : pokemon.teraType,
        fainted: !!pokemon.fainted,
        moves: Array.isArray(pokemon.moves) ? pokemon.moves.slice() : [],
        boosts: clone(pokemon.boosts || {}),
        volatile: clone(pokemon.volatile || {})
    };
}

function sideSummary(side) {
    return {
        id: side.id,
        name: side.name,
        teamSize: side.teamSize,
        active: pokemonSummary(side.active),
        team: side.team.map(pokemonSummary),
        sideConditions: clone(side.sideConditions || {})
    };
}

function sessionSummary(session) {
    return {
        roomId: session.roomId,
        turn: session.turn,
        gen: session.gen,
        format: session.format,
        weather: session.weather,
        field: clone(session.field || {}),
        ended: !!session.ended,
        result: session.result ? clone(session.result) : null,
        sides: {
            p1: sideSummary(session.sides.p1),
            p2: sideSummary(session.sides.p2)
        }
    };
}

function replayText(text, options) {
    options = options || {};
    var normalized = normalizeInput(text, options);
    var events = adapter.parseProtocol(normalized.text);
    var session = new adapter.BattleSession(normalized.roomId);
    var snapshots = [];

    for (var i = 0; i < events.length; i++) {
        var event = events[i];
        if (event.type === 'request') session.applyRequest(event.request);
        else session.applyEvent(event);

        if (options.snapshots && (event.type === 'request' || event.type === 'turn' ||
            event.type === 'win' || event.type === 'tie' || event.type === 'deinit')) {
            snapshots.push({
                index: i,
                type: event.type,
                turn: session.turn,
                summary: sessionSummary(session)
            });
        }
    }

    return {
        sourceType: normalized.sourceType,
        roomId: normalized.roomId,
        eventCount: events.length,
        events: events,
        snapshots: snapshots,
        session: session,
        summary: sessionSummary(session)
    };
}

function replayFile(file, options) {
    return replayText(fs.readFileSync(file, 'utf8'), options);
}

function printUsage() {
    console.log('Usage: node platform/ps/protocol-replay.js <file> [--room <room>] [--snapshots] [--json] [--out <file>]');
    console.log('Input may be raw PS protocol, a benchmark JSON row, a JSON array, or JSONL protocol logs.');
}

function main(argv) {
    var args = argv.slice(2);
    if (!args.length || args[0] === '--help' || args[0] === '-h') {
        printUsage();
        return args.length ? 0 : 1;
    }

    var file = args[0];
    var options = { snapshots: false, room: null };
    var jsonOutput = false;
    var outputFile = null;
    for (var i = 1; i < args.length; i++) {
        if (args[i] === '--room') options.room = args[++i];
        else if (args[i] === '--snapshots') options.snapshots = true;
        else if (args[i] === '--json') jsonOutput = true;
        else if (args[i] === '--out') outputFile = args[++i];
        else throw new Error('Unknown argument: ' + args[i]);
    }

    var result = replayFile(file, options);
    var output = jsonOutput ? JSON.stringify({
        sourceType: result.sourceType,
        roomId: result.roomId,
        eventCount: result.eventCount,
        snapshots: result.snapshots,
        summary: result.summary
    }, null, 2) : [
        'room: ' + (result.roomId || 'unknown'),
        'events: ' + result.eventCount,
        'turn: ' + result.summary.turn,
        'format: ' + (result.summary.format || 'unknown'),
        'result: ' + JSON.stringify(result.summary.result),
        'ended: ' + result.summary.ended
    ].join('\n');

    if (outputFile) fs.writeFileSync(outputFile, output + '\n');
    else console.log(output);
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = main(process.argv);
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}

module.exports = {
    eventToProtocolLine: eventToProtocolLine,
    normalizeInput: normalizeInput,
    replayText: replayText,
    replayFile: replayFile,
    sessionSummary: sessionSummary
};
