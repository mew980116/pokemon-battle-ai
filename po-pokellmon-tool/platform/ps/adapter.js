'use strict';

function parseHp(value) {
    var text = String(value || '').trim();
    var result = { raw: text, current: null, max: null, percent: null, fainted: false };
    if (text.indexOf('fnt') !== -1 || text === '0') {
        result.current = 0;
        result.percent = 0;
        result.fainted = true;
        return result;
    }
    var match = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (match) {
        result.current = Number(match[1]);
        result.max = Number(match[2]);
        result.percent = result.max ? result.current / result.max * 100 : null;
        return result;
    }
    match = text.match(/^(\d+(?:\.\d+)?)\s*%/);
    if (match) result.percent = Number(match[1]);
    return result;
}

function parseIdent(ident) {
    var text = String(ident || '');
    var match = text.match(/^(p[12])([a-f])?:\s*(.*)$/i);
    return {
        ident: text,
        side: match ? match[1].toLowerCase() : null,
        position: match && match[2] ? match[2].toLowerCase() : null,
        name: match ? match[3] : text
    };
}

function parseProtocol(input) {
    var lines = String(input || '').split(/\r?\n/);
    var events = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line || line.charAt(0) !== '|') continue;
        var fields = line.split('|');
        var type = fields[1] || '';
        if (type.charAt(0) === '-') type = type.slice(1);
        if (type === 'request') {
            var rawRequest = fields.slice(2).join('|');
            var request = null;
            try { request = JSON.parse(rawRequest); } catch (error) { request = null; }
            events.push({ type: type, request: request, raw: rawRequest });
            continue;
        }
        var args = fields.slice(2);
        var event = { type: type, args: args };
        if (type === 'turn') event.turn = Number(args[0]);
        if (type === 'player') event.side = args[0];
        if (type === 'teamsize') event.side = args[0], event.size = Number(args[1]);
        if (type === 'switch' || type === 'drag') {
            event.actor = parseIdent(args[0]);
            event.details = args[1] || event.actor.name;
            event.hp = parseHp(args[2]);
        }
        if (type === 'move') {
            event.actor = parseIdent(args[0]);
            event.move = args[1] || null;
            event.target = args[2] ? parseIdent(args[2]) : null;
        }
        if (type === 'damage' || type === 'heal') {
            event.target = parseIdent(args[0]);
            event.hp = parseHp(args[1]);
        }
        if (type === 'status' || type === 'curestatus') {
            event.target = parseIdent(args[0]);
            event.status = args[1] || null;
        }
        if (type === 'boost' || type === 'unboost') {
            event.target = parseIdent(args[0]);
            event.stat = args[1] || null;
            event.amount = Number(args[2]);
        }
        if (type === 'weather') event.weather = args[0] || null;
        if (type === 'fieldstart' || type === 'fieldend') event.field = args[0] || null;
        if (type === 'sidestart' || type === 'sideend') {
            event.side = (args[0] || '').split(':')[0] || null;
            event.effect = args[1] || null;
        }
        if (type === 'faint' || type === 'win' || type === 'tie') event.subject = args[0] || null;
        events.push(event);
    }
    return events;
}

function emptySide() {
    return { id: null, name: null, teamSize: null, active: null, team: [], sideConditions: {} };
}

function BattleSession(roomId) {
    this.roomId = roomId || null;
    this.turn = 0;
    this.sides = { p1: emptySide(), p2: emptySide() };
    this.weather = null;
    this.field = {};
    this.history = [];
    this.request = null;
    this.pending = null;
}

BattleSession.prototype.sideFor = function (side) {
    return side && this.sides[side] ? this.sides[side] : null;
};

BattleSession.prototype.findPokemon = function (side, name, ident) {
    var list = side.team;
    for (var i = 0; i < list.length; i++) {
        if ((ident && list[i].ident === ident) || (name && list[i].name === name)) return list[i];
    }
    return null;
};

BattleSession.prototype.upsertPokemon = function (info, details, hp) {
    var side = this.sideFor(info.side);
    if (!side) return null;
    var pokemon = this.findPokemon(side, info.name, info.ident);
    if (!pokemon) {
        pokemon = { slot: null, ident: info.ident, name: info.name, details: details || info.name, hp: null, status: null, boosts: {}, moves: [], fainted: false };
        side.team.push(pokemon);
    }
    if (details) pokemon.details = details;
    if (hp && hp.raw) pokemon.hp = hp;
    return pokemon;
};

BattleSession.prototype.applyRequest = function (request) {
    this.request = request || null;
    this.pending = null;
    if (!request || !request.side) return this;
    var side = this.sideFor(request.side.id);
    if (!side) return this;
    side.id = request.side.id;
    if (request.side.name) side.name = request.side.name;
    if (request.side.pokemon) {
        for (var i = 0; i < request.side.pokemon.length; i++) {
            var item = request.side.pokemon[i];
            var p = this.findPokemon(side, item.ident || item.details, item.ident);
            if (!p) {
                p = { slot: i + 1, ident: item.ident || null, name: item.details || null, details: item.details || null, hp: null, status: item.condition || null, boosts: {}, moves: [], fainted: false };
                side.team.push(p);
            }
            p.slot = i + 1;
            p.name = item.details || p.name;
            p.details = item.details || p.details;
            p.hp = parseHp(item.condition);
            p.status = item.condition && item.condition.indexOf(' ') !== -1 ? item.condition.split(' ')[1] : null;
            p.fainted = p.hp.fainted;
        }
    }
    if (request.active && request.active[0]) side.active = side.team[0] || null;
    if (request.forceSwitch) this.pending = { type: 'forceSwitch', slots: request.forceSwitch };
    else if (request.teamPreview) this.pending = { type: 'teamPreview' };
    return this;
};

BattleSession.prototype.applyEvent = function (event) {
    if (!event) return this;
    this.history.push(event);
    var side, pokemon, info;
    if (event.type === 'turn') this.turn = event.turn;
    if (event.type === 'player') { side = this.sideFor(event.side); if (side) { side.id = event.side; side.name = event.args[1] || null; } }
    if (event.type === 'teamsize') { side = this.sideFor(event.side); if (side) side.teamSize = event.size; }
    if (event.type === 'switch' || event.type === 'drag') {
        info = event.actor; pokemon = this.upsertPokemon(info, event.details, event.hp);
        side = this.sideFor(info.side);
        if (side) side.active = pokemon;
    }
    if (event.type === 'move') {
        pokemon = this.upsertPokemon(event.actor, null, null);
        if (pokemon && event.move && pokemon.moves.indexOf(event.move) === -1) pokemon.moves.push(event.move);
    }
    if (event.type === 'damage' || event.type === 'heal') {
        pokemon = this.upsertPokemon(event.target, null, event.hp);
        if (pokemon) { pokemon.hp = event.hp; pokemon.fainted = event.hp.fainted; }
    }
    if (event.type === 'status') { pokemon = this.upsertPokemon(event.target, null, null); if (pokemon) pokemon.status = event.status; }
    if (event.type === 'curestatus') { pokemon = this.upsertPokemon(event.target, null, null); if (pokemon) pokemon.status = null; }
    if (event.type === 'boost' || event.type === 'unboost') { pokemon = this.upsertPokemon(event.target, null, null); if (pokemon) pokemon.boosts[event.stat] = (pokemon.boosts[event.stat] || 0) + (event.type === 'boost' ? event.amount : -event.amount); }
    if (event.type === 'weather') this.weather = event.weather;
    if (event.type === 'fieldstart') this.field[event.field] = true;
    if (event.type === 'fieldend') delete this.field[event.field];
    if (event.type === 'sidestart' || event.type === 'sideend') { side = this.sideFor(event.side); if (side) { if (event.type === 'sidestart') side.sideConditions[event.effect] = true; else delete side.sideConditions[event.effect]; } }
    if (event.type === 'faint') { info = parseIdent(event.subject); pokemon = this.upsertPokemon(info, null, parseHp('0 fnt')); if (pokemon) { pokemon.fainted = true; pokemon.hp = parseHp('0 fnt'); } }
    return this;
};

BattleSession.prototype.apply = function (input) {
    if (typeof input === 'string') {
        var events = parseProtocol(input);
        for (var i = 0; i < events.length; i++) { if (events[i].type === 'request') this.applyRequest(events[i].request); else this.applyEvent(events[i]); }
    } else if (input && input.type) this.applyEvent(input);
    else if (input) this.applyRequest(input);
    return this;
};

function requestActions(request) {
    var actions = [];
    if (!request) return actions;
    if (request.forceSwitch) {
        for (var i = 0; i < request.forceSwitch.length; i++) if (request.forceSwitch[i]) actions.push({ type: 'switch', slot: i + 1, forced: true });
        return actions;
    }
    if (request.teamPreview) return [{ type: 'team', order: '123456'.slice(0, request.side && request.side.pokemon ? request.side.pokemon.length : 6) }];
    var active = request.active && request.active[0];
    if (active && active.moves) for (var m = 0; m < active.moves.length; m++) if (!active.moves[m].disabled) actions.push({ type: 'move', slot: m + 1, id: active.moves[m].id || null, name: active.moves[m].move || null });
    if (request.side && request.side.pokemon) for (var p = 0; p < request.side.pokemon.length; p++) if (request.side.pokemon[p].condition && request.side.pokemon[p].condition.indexOf('fnt') === -1 && request.side.pokemon[p].active !== true) actions.push({ type: 'switch', slot: p + 1 });
    return actions;
}

function actionToCommand(action) {
    if (!action || !action.type) return null;
    if (action.type === 'move') return '/choose move ' + action.slot;
    if (action.type === 'switch') return '/choose switch ' + action.slot;
    if (action.type === 'team') return '/choose team ' + action.order;
    return null;
}

module.exports = { parseHp: parseHp, parseIdent: parseIdent, parseProtocol: parseProtocol, BattleSession: BattleSession, requestActions: requestActions, actionToCommand: actionToCommand };
