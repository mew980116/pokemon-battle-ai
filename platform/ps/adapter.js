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

// 归一化 ident：出战位带 a/b 后缀（p1a: Foo），request 的 side.pokemon 只有 p1: Foo，
// 不归一化会被当成两只 → 队伍里出现重复条目、替补席算错
function normIdent(ident) { return String(ident || '').replace(/^(p[12])[a-z]:/, '$1:'); }

// 从 PS 的 details（"Cresselia, L80, F"）里取等级；没写就是 100（PS 对满级不写 L100）
function levelFromDetails(details) {
    var m = String(details || '').match(/L(\d+)/);
    return m ? Number(m[1]) : 100;
}

BattleSession.prototype.findPokemon = function (side, name, ident) {
    var want = normIdent(ident);
    var list = side.team;
    for (var i = 0; i < list.length; i++) {
        if ((want && normIdent(list[i].ident) === want) || (name && list[i].name === name)) return list[i];
    }
    return null;
};

BattleSession.prototype.upsertPokemon = function (info, details, hp) {
    var side = this.sideFor(info.side);
    if (!side) return null;
    var pokemon = this.findPokemon(side, info.name, info.ident);
    if (!pokemon) {
        pokemon = { slot: null, ident: info.ident, name: info.name, details: details || info.name, level: levelFromDetails(details), hp: null, status: null, boosts: {}, moves: [], fainted: false };
        side.team.push(pokemon);
    }
    if (details) {
        pokemon.details = details;
        pokemon.level = levelFromDetails(details);
    }
    if (hp && hp.raw) pokemon.hp = hp;
    return pokemon;
};

BattleSession.prototype.pokemonBySlot = function (side, slot) {
    for (var i = 0; i < side.team.length; i++) if (Number(side.team[i].slot) === Number(slot)) return side.team[i];
    return null;
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
            // name 统一取物种名（details 是 "Cresselia, L80, F"）：这样喂给 get_pokemon_info 之类的 tool 才查得到
            var species = String(item.details || '').split(',')[0].trim();
            // 按物种名去重（不能拿 ident 当名字传：那会让先前的 |poke| 条目匹配不上）
            var p = this.findPokemon(side, species, item.ident);
            if (!p) {
                p = { slot: i + 1, ident: item.ident || null, name: species || null, details: item.details || null, level: levelFromDetails(item.details), hp: null, status: item.condition || null, boosts: {}, moves: [], fainted: false };
                side.team.push(p);
            }
            p.slot = i + 1;
            p.name = species || p.name;
            p.details = item.details || p.details;
            p.level = levelFromDetails(item.details);
            // request 里带着我方每只的道具/特性/六维（对手的要等战报暴露）
            if (item.item) p.item = item.item;
            if (item.ability) p.ability = item.ability;
            if (item.stats) p.stats = item.stats;
            p.hp = parseHp(item.condition);
            p.status = item.condition && item.condition.indexOf(' ') !== -1 ? item.condition.split(' ')[1] : null;
            p.fainted = p.hp.fainted;
        }
    }
    // 出战位：以 request 的 active 标记为准
    // （原来直接写 side.team[0] —— 只要首发不是 1 号槽，me.active 就指错，prompt/看板的"我方当前"会显示错的那只）
    for (var ai = 0; ai < (request.side.pokemon || []).length; ai++) {
        if (!request.side.pokemon[ai].active) continue;
        var act = this.pokemonBySlot(side, ai + 1);
        if (act) side.active = act;
        break;
    }
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
    // |poke|p2|Species, M| —— 开局（team preview / 工厂）先亮出的队伍成员，还没有血量信息
    if (event.type === 'poke') {
        side = this.sideFor(event.args[0]);
        if (side) {
            var pokeName = String(event.args[1] || '').split(',')[0].trim();
            if (pokeName && !this.findPokemon(side, pokeName, null)) {
                side.team.push({ slot: side.team.length + 1, ident: null, name: pokeName, details: event.args[1], hp: null, status: null, boosts: {}, moves: [], fainted: false, unrevealed: true });
            }
        }
    }
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
    // 道具 / 特性暴露：|ability|p1a: X|Moxie|boost、|item|p2a: X|Leftovers、|-enditem|p2a: X|Leftovers|...
    if (event.type === 'ability' && event.args.length > 1) {
        pokemon = this.upsertPokemon(parseIdent(event.args[0]), null, null);
        if (pokemon && event.args[1]) pokemon.ability = event.args[1];
    }
    if (event.type === 'item' && event.args.length > 1) {
        pokemon = this.upsertPokemon(parseIdent(event.args[0]), null, null);
        if (pokemon && event.args[1]) pokemon.item = event.args[1];
    }
    if (event.type === 'enditem') {
        pokemon = this.upsertPokemon(parseIdent(event.args[0]), null, null);
        if (pokemon) pokemon.item = null;
    }
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

// 替补席（可以换上来的）队伍槽位：排除出战中的和已濒死的
function benchSwitches(request) {
    var list = [];
    var team = request.side && request.side.pokemon;
    if (!team) return list;
    for (var p = 0; p < team.length; p++) {
        if (team[p].active === true) continue;
        if (team[p].condition && team[p].condition.indexOf('fnt') !== -1) continue;
        list.push({ type: 'switch', slot: p + 1 });
    }
    return list;
}

function requestActions(request) {
    var actions = [];
    if (!request) return actions;
    // wait:true 是「等对手出招」的通知，没有可选项；此时乱发 /choose 会被拒（[Invalid choice] There's nothing to choose）
    if (request.wait) return actions;
    if (request.teamPreview) {
        // 开局选人：每个候选 = 「谁首发」+ 对应的整队顺序（其余按队伍槽位依次）
        var preview = (request.side && request.side.pokemon) || [];
        if (!preview.length) return [{ type: 'team', order: '123456' }];
        var leads = [];
        for (var t = 0; t < preview.length; t++) {
            var order = String(t + 1);
            for (var rest = 1; rest <= preview.length; rest++) if (rest !== t + 1) order += String(rest);
            leads.push({ type: 'team', lead: t + 1, order: order });
        }
        return leads;
    }
    // forceSwitch[i]=true 表示第 i 个出战位必须换人：可选的是替补席的队伍槽位，不是 i+1
    if (request.forceSwitch) {
        var mustSwitch = false;
        for (var i = 0; i < request.forceSwitch.length; i++) if (request.forceSwitch[i]) mustSwitch = true;
        if (mustSwitch) return benchSwitches(request);
    }
    var active = request.active && request.active[0];
    if (active && active.moves) {
        for (var m = 0; m < active.moves.length; m++) {
            if (!active.moves[m].disabled) actions.push({ type: 'move', slot: m + 1, id: active.moves[m].id || null, name: active.moves[m].move || null });
        }
        // 极巨化 / 钛晶化：PS 侧命令是 /choose move N dynamax | terastallize
        // （gen8 的 request 给 canDynamax + maxMoves，gen9 给 canTerastallize=<属性>）
        var variants = [];
        if (active.canDynamax) variants.push('dynamax');
        if (active.canTerastallize) variants.push('tera');
        for (var v = 0; v < variants.length; v++) {
            for (var mv = 0; mv < active.moves.length; mv++) {
                if (active.moves[mv].disabled) continue;
                var boosted = { type: 'move', slot: mv + 1, id: active.moves[mv].id || null, name: active.moves[mv].move || null };
                if (variants[v] === 'dynamax') {
                    boosted.dynamax = true;
                } else {
                    boosted.tera = true;
                    if (typeof active.canTerastallize === 'string') boosted.teraType = active.canTerastallize;
                }
                actions.push(boosted);
            }
        }
    }
    // 被困住时 PS 不允许换人；否则随机策略可能选中无效的 switch，
    // 收到 [Invalid choice] 后同一个 rqid 不会再次触发决策，对局会卡住。
    if (!active || !active.trapped) {
        var bench = benchSwitches(request);
        for (var b = 0; b < bench.length; b++) actions.push(bench[b]);
    }
    return actions;
}

function actionToCommand(action) {
    if (!action || !action.type) return null;
    if (action.type === 'move') {
        var command = '/choose move ' + action.slot;
        if (action.dynamax) command += ' dynamax';
        else if (action.tera) command += ' terastallize';
        return command;
    }
    if (action.type === 'switch') return '/choose switch ' + action.slot;
    if (action.type === 'team') return '/choose team ' + action.order;
    return null;
}

module.exports = { parseHp: parseHp, parseIdent: parseIdent, parseProtocol: parseProtocol, BattleSession: BattleSession, requestActions: requestActions, actionToCommand: actionToCommand };
