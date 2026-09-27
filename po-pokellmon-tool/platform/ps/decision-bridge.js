'use strict';

var http = require('http');
var https = require('https');
var url = require('url');

function hpPercent(pokemon) {
    if (!pokemon || !pokemon.hp) return null;
    return pokemon.hp.percent !== null && pokemon.hp.percent !== undefined ? pokemon.hp.percent : null;
}

function pokemonState(pokemon, reveal) {
    if (!pokemon) return null;
    var result = {
        name: reveal ? pokemon.name : null,
        hpPct: hpPercent(pokemon),
        status: pokemon.status || null,
        boosts: [],
        moves: [],
        fainted: !!pokemon.fainted,
        ko: !!pokemon.fainted,
        revealed: !!reveal,
        slot: pokemon.slot
    };
    var boosts = pokemon.boosts || {};
    var keys = Object.keys(boosts);
    for (var i = 0; i < keys.length; i++) if (boosts[keys[i]]) result.boosts.push(keys[i] + (boosts[keys[i]] > 0 ? '+' : '') + boosts[keys[i]]);
    if (reveal && pokemon.moves) {
        for (var m = 0; m < pokemon.moves.length; m++) result.moves.push({ name: pokemon.moves[m], type: '?', slot: m + 1 });
    }
    return result;
}

function sideHazards(side) {
    var result = [];
    var conditions = side && side.sideConditions ? side.sideConditions : {};
    var keys = Object.keys(conditions);
    for (var i = 0; i < keys.length; i++) result.push(keys[i]);
    return result;
}

function eventText(event) {
    if (!event) return '';
    var args = event.args || [];
    return '|' + event.type + (args.length ? '|' + args.join('|') : '');
}

function DecisionBridge(options) {
    options = options || {};
    this.url = options.url || process.env.POKELLMON_TOOL_URL || 'http://127.0.0.1:8092/choice';
    this.shadow = options.shadow !== undefined ? !!options.shadow : process.env.PS_SHADOW !== '0' && process.env.PS_SHADOW !== 'false';
    this.request = options.request || null;
    this.client = null;
    this.onRequest = options.onRequest || function () {};
    this.onSuggestion = options.onSuggestion || function () {};
    this.suggestions = [];
}

DecisionBridge.prototype.attachClient = function (client) {
    var self = this;
    this.client = client;
    var previous = client.onRequest;
    client.onRequest = function (request, actions, session) {
        if (previous) previous(request, actions, session);
        self.handleRequest(request, actions, session).catch(function (error) {
            self.onSuggestion({ error: error.message, room: session && session.roomId });
        });
    };
    return this;
};

DecisionBridge.prototype.buildState = function (session, request, actions) {
    var meSide = request && request.side && request.side.id ? request.side.id : 'p1';
    var oppSide = meSide === 'p1' ? 'p2' : 'p1';
    var me = session.sides[meSide] || { team: [] };
    var opp = session.sides[oppSide] || { team: [] };
    var activeMe = me.active || (me.team && me.team[0]);
    var activeOpp = opp.active || (opp.team && opp.team[0]);
    var state = {
        turn: session.turn,
        battleId: session.roomId,
        gen: 8,
        format: 'gen8 singles',
        history: session.history.map(eventText),
        fullHistory: session.history.map(eventText),
        weather: session.weather || null,
        terrain: null,
        myHazards: sideHazards(me),
        oppHazards: sideHazards(opp),
        screens: { me: [], opp: [] },
        me: pokemonState(activeMe, true) || {},
        opp: pokemonState(activeOpp, true) || {},
        myTeam: [],
        oppTeam: [],
        bench: [],
        request: request || null,
        actions: actions || []
    };
    var fieldKeys = Object.keys(session.field || {});
    for (var f = 0; f < fieldKeys.length; f++) if (fieldKeys[f].toLowerCase().indexOf('terrain') !== -1) state.terrain = fieldKeys[f];
    for (var i = 0; i < (me.team || []).length; i++) {
        var mine = pokemonState(me.team[i], true);
        state.myTeam.push(mine);
        if (me.team[i] !== activeMe && !me.team[i].fainted) state.bench.push(mine);
    }
    for (var j = 0; j < (opp.team || []).length; j++) state.oppTeam.push(pokemonState(opp.team[j], true));
    if (state.me.moves.length === 0 && request && request.active && request.active[0]) {
        var moves = request.active[0].moves || [];
        for (var k = 0; k < moves.length; k++) if (!moves[k].disabled) state.me.moves.push({ name: moves[k].move || moves[k].id, type: '?', slot: k + 1, id: moves[k].id || null });
    }
    return state;
};

DecisionBridge.prototype.fetchChoice = function (state) {
    var target = url.parse(this.url);
    var transport = target.protocol === 'https:' ? https : http;
    var query = (target.search ? target.search + '&' : '?') + 'state=' + encodeURIComponent(JSON.stringify(state));
    var options = { hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? 443 : 80), path: target.pathname + query, method: 'GET' };
    var requester = this.request || transport.request;
    return new Promise(function (resolve, reject) {
        var req = requester.call(transport, options, function (res) {
            var body = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) { body += chunk; });
            res.on('end', function () {
                if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('decision service HTTP ' + res.statusCode));
                try { resolve(JSON.parse(body)); } catch (error) { reject(new Error('decision service returned invalid JSON')); }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

DecisionBridge.prototype.toPSAction = function (action) {
    if (!action || !action.type) return null;
    if (action.type === 'attack' || action.type === 'attackSlot' || action.type === 'move') return { type: 'move', slot: Number(action.attackSlot || action.slot) };
    if (action.type === 'switch' || action.type === 'switchSlot') return { type: 'switch', slot: Number(action.pokeSlot || action.slot) };
    if (action.type === 'team') return { type: 'team', order: action.order };
    return null;
};

DecisionBridge.prototype.handleRequest = function (request, actions, session) {
    var self = this;
    var state = this.buildState(session, request, actions);
    return this.fetchChoice(state).then(function (suggestion) {
        var action = self.toPSAction(suggestion);
        var record = { battleId: session.roomId, turn: session.turn, state: state, suggestion: suggestion, action: action, shadow: self.shadow };
        self.suggestions.push(record);
        self.onSuggestion(record);
        self.onRequest(record);
        if (!self.shadow && action && self.client) record.sent = self.client.chooseAction(action, session.roomId);
        return record;
    });
};

module.exports = { DecisionBridge: DecisionBridge, pokemonState: pokemonState };
