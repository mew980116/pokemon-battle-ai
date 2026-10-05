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
    var match = text.match(/^(p[12])([a-z])?:\s*(.*)$/i);
    return {
        ident: text,
        side: match ? match[1].toLowerCase() : null,
        position: match && match[2] ? match[2].toLowerCase() : null,
        name: match ? match[3] : text
    };
}

function normalizeEffectId(value) {
    return String(value || '').toLowerCase().replace(/^move:\s*/, '').replace(/[^a-z0-9]+/g, '');
}

function sideConditionDuration(conditionId, side) {
    var defaults = {
        reflect: 5,
        lightscreen: 5,
        auroraveil: 5,
        safeguard: 5,
        mist: 5,
        tailwind: 4
    };
    if (defaults[conditionId] === undefined) return null;
    var duration = defaults[conditionId];
    var activeItem = side && side.active && side.active.item;
    if ((conditionId === 'reflect' ||
        conditionId === 'lightscreen' ||
        conditionId === 'auroraveil') &&
        normalizeEffectId(activeItem) === 'lightclay') {
        duration += 3;
    }
    return duration;
}

function speciesFromDetails(details) {
    return String(details || '').split(',')[0].trim();
}

function moveState(name, turn, type) {
    return {
        move: name || null,
        turn: Number(turn || 0),
        type: type || 'move'
    };
}

function volatileKey(pokemon, effectId) {
    var keys = Object.keys((pokemon && pokemon.volatile) || {});
    for (var i = 0; i < keys.length; i++) {
        if (normalizeEffectId(keys[i]) === effectId) return keys[i];
    }
    return null;
}

function setVolatile(pokemon, effect, duration) {
    if (!pokemon || !effect) return;
    var effectId = normalizeEffectId(effect);
    var key = volatileKey(pokemon, effectId) || effect;
    pokemon.volatile = pokemon.volatile || {};
    pokemon.volatileDurations = pokemon.volatileDurations || {};
    pokemon.volatile[key] = true;
    if (effectId === 'substitute') pokemon.substituteHit = false;
    if (pokemon.volatileDurations[key] === undefined) {
        pokemon.volatileDurations[key] = duration === undefined ? null : duration;
    }
}

function removeVolatile(pokemon, effect) {
    if (!pokemon || !effect) return;
    var effectId = normalizeEffectId(effect);
    var keys = Object.keys(pokemon.volatile || {});
    for (var i = 0; i < keys.length; i++) {
        if (normalizeEffectId(keys[i]) === effectId) {
            delete pokemon.volatile[keys[i]];
            delete pokemon.volatileDurations[keys[i]];
        }
    }
    if (effectId === 'substitute') pokemon.substituteHit = false;
}

function incrementVolatileDuration(pokemon, effectId) {
    var key = volatileKey(pokemon, effectId);
    if (!key) return;
    var current = Number((pokemon.volatileDurations || {})[key]);
    pokemon.volatileDurations[key] = Number.isFinite(current) ? current + 1 : 1;
}

function parseProtocol(input) {
    var lines = String(input || '').split(/\r?\n/);
    var events = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line || line.charAt(0) !== '|') continue;
        var fields = line.split('|');
        var rawType = fields[1] || '';
        var type = rawType;
        if (type.charAt(0) === '-') type = type.slice(1);
        if (type === 'request') {
            var rawRequest = fields.slice(2).join('|');
            var request = null;
            try { request = JSON.parse(rawRequest); } catch (error) { request = null; }
            events.push({ type: type, rawType: rawType, request: request, raw: rawRequest });
            continue;
        }
        var args = fields.slice(2);
        var event = { type: type, rawType: rawType, args: args };
        if (type === 'turn') event.turn = Number(args[0]);
        if (type === 'player') event.side = args[0];
        if (type === 'teamsize') event.side = args[0], event.size = Number(args[1]);
        if (type === 'switch' || type === 'drag' || type === 'replace') {
            event.actor = parseIdent(args[0]);
            event.details = args[1] || event.actor.name;
            event.hp = parseHp(args[2]);
        }
        if (type === 'detailschange' || type === 'formechange') {
            event.actor = parseIdent(args[0]);
            event.details = args[1] || event.actor.name;
        }
        if (type === 'move') {
            event.actor = parseIdent(args[0]);
            event.move = args[1] || null;
            event.target = args[2] ? parseIdent(args[2]) : null;
        }
        if (type === 'damage' || type === 'heal' || type === 'sethp') {
            event.target = parseIdent(args[0]);
            event.hp = parseHp(args[1]);
        }
        if (type === 'status' || type === 'curestatus' || type === 'start' || type === 'end') {
            event.target = parseIdent(args[0]);
            event.status = args[1] || null;
            event.effect = args[1] || null;
        }
        if (type === 'boost' || type === 'unboost' || type === 'setboost') {
            event.target = parseIdent(args[0]);
            event.stat = args[1] || null;
            event.amount = Number(args[2] || 0);
        }
        if (type === 'clearboost' || type === 'clearpositiveboost' || type === 'clearnegativeboost' ||
            type === 'copyboost' || type === 'clearallboost' || type === 'invertboost') {
            event.target = args[0] ? parseIdent(args[0]) : null;
            event.stat = args[1] || null;
        }
        if (type === 'singleturn' || type === 'mustrecharge') {
            event.target = args[0] ? parseIdent(args[0]) : null;
            event.effect = args[1] || rawType;
        }
        if (type === 'cant' || type === 'miss' || type === 'activate' || type === 'crit' ||
            type === 'immune' || type === 'supereffective' || type === 'resisted' ||
            type === 'ohko' || type === 'hitcount' || type === 'prepare') {
            event.target = args[0] ? parseIdent(args[0]) : null;
            event.actor = event.target;
            event.effect = args[1] || null;
        }
        if (type === 'terastallize' || type === 'dynamax' || type === 'transform') {
            event.actor = parseIdent(args[0]);
            if (type === 'transform') {
                event.target = args[1] ? parseIdent(args[1]) : null;
                event.form = null;
            } else {
                event.target = event.actor;
                event.form = args[1] || null;
            }
        }
        if (type === 'enditem' || type === 'item' || type === 'ability') {
            event.actor = parseIdent(args[0]);
            event.target = event.actor;
            event.value = args[1] || null;
        }
        if (type === 'weather') {
            event.weather = args[0] || null;
            event.weatherArgs = args.slice(1);
            event.upkeep = args.indexOf('[upkeep]') !== -1;
        }
        if (type === 'fieldstart' || type === 'fieldend') event.field = args[0] || null;
        if (type === 'sidestart' || type === 'sideend') {
            event.side = (args[0] || '').split(':')[0] || null;
            event.effect = args[1] || null;
        }
        if (type === 'faint' || type === 'win' || type === 'tie') event.subject = args[0] || null;
        if (type === 'tier' || type === 'gen' || type === 'rule') event.value = args[0] || null;
        events.push(event);
    }
    return events;
}

function emptySide() {
    return {
        id: null,
        name: null,
        teamSize: null,
        active: null,
        team: [],
        sideConditions: {},
        sideConditionDetails: {},
        effects: {
            wish: { turnsRemaining: 0, amount: 0, source: null },
            futureSight: { turnsRemaining: 0, source: null },
            healingWish: 0,
            batonPassing: false,
            shedTailing: false
        },
        lastUsedMove: null,
        lastSelectedMove: null
    };
}

function BattleSession(roomId) {
    this.roomId = roomId || null;
    this.turn = 0;
    this.sides = { p1: emptySide(), p2: emptySide() };
    this.weather = null;
    this.weatherState = { name: null, turnsRemaining: null, source: null };
    this.field = {};
    this.fieldState = {
        terrain: null,
        terrainTurnsRemaining: null,
        trickRoom: false,
        trickRoomTurnsRemaining: 0,
        gravity: false
    };
    this.history = [];
    this.request = null;
    this.pending = null;
    this.format = null;
    this.gen = null;
    this.result = null;
    this.ended = false;
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
        if (want && list[i].ident && normIdent(list[i].ident) === want) return list[i];
    }
    for (var j = 0; j < list.length; j++) {
        // |poke| 没有 ident，首次 |switch| 仍需按物种名把它合并回同一只。
        if (name && list[j].name === name && (!want || !list[j].ident)) return list[j];
    }
    return null;
};

BattleSession.prototype.upsertPokemon = function (info, details, hp) {
    if (!info || !info.side) return null;
    var side = this.sideFor(info.side);
    if (!side) return null;
    var pokemon = this.findPokemon(side, info.name, info.ident);
    if (!pokemon) {
        pokemon = {
            slot: null,
            ident: info.ident,
            name: info.name,
            details: details || info.name,
            level: levelFromDetails(details),
            hp: null,
            status: null,
            boosts: {},
            moves: [],
            moveDetails: {},
            movesUsedSinceSwitchIn: [],
            volatile: {},
            volatileDurations: {},
            substituteHit: false,
            lastUsedMove: null,
            fainted: false,
            reviving: false,
            teraType: null,
            terastallized: false,
            dynamaxed: false,
            transformed: false
        };
        side.team.push(pokemon);
    }
    if (!pokemon.ident && info.ident) pokemon.ident = info.ident;
    if (details) {
        pokemon.details = details;
        pokemon.level = levelFromDetails(details);
        // PS 的 ident 可能仍是基础形态名，但 details 会携带当前公开形态。
        // 决策状态必须使用当前形态，否则 Terapagos-Terastal、Deoxys-Attack
        // 等会被错误地还原成基础物种。
        var detailName = speciesFromDetails(details);
        if (detailName) pokemon.name = detailName;
        pokemon.unrevealed = false;
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
                p = {
                    slot: i + 1,
                    ident: item.ident || null,
                    name: species || null,
                    details: item.details || null,
                    level: levelFromDetails(item.details),
                    hp: null,
                    status: item.condition || null,
                    boosts: {},
                    moves: [],
                    moveDetails: {},
                    movesUsedSinceSwitchIn: [],
                    volatile: {},
                    volatileDurations: {},
                    substituteHit: false,
                    lastUsedMove: null,
                    fainted: false,
                    reviving: false,
                    teraType: null,
                    terastallized: false,
                    dynamaxed: false,
                    transformed: false
                };
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
            if (Array.isArray(item.moves) && item.moves.length) p.moves = item.moves.slice();
            if (item.reviving !== undefined) p.reviving = !!item.reviving;
            p.hp = parseHp(item.condition);
            p.status = item.condition && item.condition.indexOf(' ') !== -1 ? item.condition.split(' ')[1] : null;
            p.fainted = p.hp.fainted;
        }
    }
    // teamPreview 中所有队伍成员通常都会带 active:true，但这不代表已经上场。
    // 只有正式回合的 active 标记才能更新当前出战宝可梦。
    if (request.teamPreview) side.active = null;
    // 出战位：以 request 的 active 标记为准
    // （原来直接写 side.team[0] —— 只要首发不是 1 号槽，me.active 就指错，prompt/看板的"我方当前"会显示错的那只）
    if (!request.teamPreview) {
        for (var ai = 0; ai < (request.side.pokemon || []).length; ai++) {
            if (!request.side.pokemon[ai].active) continue;
            var act = this.pokemonBySlot(side, ai + 1);
            if (act) side.active = act;
            break;
        }
    }
    // request 是当前我方合法性和 PP 的权威来源；保留 disabled、PP 和原始 slot，
    // 供状态转换层与 Foul Play 的 update_from_request_json 对齐。
    var activeRequest = request.active && request.active[0];
    if (activeRequest && activeRequest.moves) {
        var activePokemon = side.active;
        if (activePokemon) {
            activePokemon.moveDetails = activePokemon.moveDetails || {};
            var previousMoves = activePokemon.moves.slice();
            activePokemon.moves = [];
            for (var am = 0; am < activeRequest.moves.length; am++) {
                var activeMove = activeRequest.moves[am] || {};
                var moveId = activeMove.id || activeMove.move || null;
                if (!moveId) continue;
                var displayMove = moveId;
                for (var pm = 0; pm < previousMoves.length; pm++) {
                    if (normalizeEffectId(previousMoves[pm]) === normalizeEffectId(moveId)) {
                        displayMove = previousMoves[pm];
                        break;
                    }
                }
                activePokemon.moves.push(displayMove);
                activePokemon.moveDetails[moveId] = {
                    id: moveId,
                    name: activeMove.move || moveId,
                    slot: am + 1,
                    disabled: !!activeMove.disabled,
                    pp: activeMove.pp === undefined ? null : activeMove.pp,
                    maxpp: activeMove.maxpp === undefined ? null : activeMove.maxpp
                };
            }
        }
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
    if (event.type === 'switch' || event.type === 'drag' || event.type === 'replace') {
        info = event.actor; pokemon = this.upsertPokemon(info, event.details, event.hp);
        side = this.sideFor(info.side);
        if (side) {
            // PS 在换人行末会标记 Baton Pass/Shed Tail；如果私服省略标记，
            // 则使用上一条 move 事件保存的 pending effect 作为后备。
            var switchSource = (event.args || []).map(function (arg) {
                return String(arg).toLowerCase();
            }).join('|');
            var batonPass = switchSource.indexOf('baton pass') !== -1 ||
                !!(side.effects && side.effects.batonPassing);
            var shedTail = switchSource.indexOf('shed tail') !== -1 ||
                !!(side.effects && side.effects.shedTailing);
            var previous = side.active;
            if (pokemon) {
                if (batonPass && previous) {
                    pokemon.boosts = Object.assign({}, previous.boosts || {});
                    pokemon.volatile = {};
                    pokemon.volatileDurations = {};
                    if (volatileKey(previous, 'substitute')) {
                        pokemon.volatile.substitute = true;
                        // Foul Play 只把 Substitute 本身传递给新宝可梦，
                        // 不传递上一只宝可梦的 substitute_hit 标记。
                        pokemon.substituteHit = false;
                    }
                    if (volatileKey(previous, 'leechseed')) {
                        pokemon.volatile.leechseed = true;
                    }
                } else if (shedTail && previous) {
                    pokemon.boosts = {};
                    pokemon.volatile = {};
                    pokemon.volatileDurations = {};
                    if (volatileKey(previous, 'substitute')) {
                        pokemon.volatile.substitute = true;
                        // Shed Tail 也只保留 Substitute，不保留旧宝可梦的命中标记。
                        pokemon.substituteHit = false;
                    }
                } else {
                    // 普通换人会清除 boost 和 volatile。
                    pokemon.boosts = {};
                    pokemon.volatile = {};
                    pokemon.volatileDurations = {};
                    pokemon.substituteHit = false;
                }
            }
            if (previous && previous !== pokemon) {
                // Foul Play 在换人时会清除被换下宝可梦的 boosts 和 volatile。
                // Baton Pass / Shed Tail 的保留内容已经在上面复制到新对象，
                // 不能让旧对象继续带着临时状态留在 reserve 中。
                previous.boosts = {};
                previous.volatile = {};
                previous.volatileDurations = {};
                previous.substituteHit = false;
                previous.movesUsedSinceSwitchIn = [];
            }
            if (pokemon) pokemon.movesUsedSinceSwitchIn = [];
            side.active = pokemon;
            side.lastUsedMove = moveState('switch ' + (pokemon && pokemon.name || info.name), this.turn, 'switch');
            if (pokemon) pokemon.unrevealed = false;
            if (side.effects) {
                side.effects.batonPassing = false;
                side.effects.shedTailing = false;
                // Healing Wish is consumed by the first valid replacement.
                side.effects.healingWish = 0;
            }
        }
    }
    if (event.type === 'detailschange' || event.type === 'formechange') {
        pokemon = this.upsertPokemon(event.actor, event.details, null);
        if (pokemon) pokemon.unrevealed = false;
    }
    if (event.type === 'move') {
        pokemon = this.upsertPokemon(event.actor, null, null);
        side = event.actor && this.sideFor(event.actor.side);
        if (pokemon && event.move) {
            var knownMove = false;
            for (var km = 0; km < pokemon.moves.length; km++) {
                if (normalizeEffectId(pokemon.moves[km]) === normalizeEffectId(event.move)) {
                    pokemon.moves[km] = event.move;
                    knownMove = true;
                    break;
                }
            }
            if (!knownMove) pokemon.moves.push(event.move);
            pokemon.movesUsedSinceSwitchIn.push(event.move);
            pokemon.lastUsedMove = moveState(event.move, this.turn, 'move');
            if (pokemon.moveDetails[event.move]) {
                pokemon.moveDetails[event.move].lastUsedTurn = this.turn;
            }
        }
        if (side && event.move) {
            side.lastUsedMove = moveState(event.move, this.turn, 'move');
            var moveId = normalizeEffectId(event.move);
            if (pokemon) {
                // upstream battle_modifier 在记录 move 时推进 Encore/Taunt 计时。
                if (volatileKey(pokemon, 'encore')) incrementVolatileDuration(pokemon, 'encore');
                if (volatileKey(pokemon, 'taunt')) incrementVolatileDuration(pokemon, 'taunt');
            }
            if (side.effects) {
                if (moveId === 'wish') {
                    var maxHp = pokemon && pokemon.hp && pokemon.hp.max;
                    side.effects.wish = {
                        turnsRemaining: 2,
                        amount: maxHp ? Math.floor(maxHp / 2) : 0,
                        source: pokemon && pokemon.name || event.actor.name
                    };
                } else if (moveId === 'futuresight') {
                    side.effects.futureSight = {
                        turnsRemaining: 3,
                        source: pokemon && pokemon.name || event.actor.name
                    };
                } else if (moveId === 'healingwish') {
                    side.effects.healingWish = 1;
                } else if (moveId === 'batonpass') {
                    side.effects.batonPassing = true;
                } else if (moveId === 'shedtail') {
                    side.effects.shedTailing = true;
                }
            }
        }
    }
    if (event.type === 'damage' || event.type === 'heal' || event.type === 'sethp') {
        pokemon = this.upsertPokemon(event.target, null, event.hp);
        if (pokemon) {
            pokemon.hp = event.hp;
            pokemon.fainted = event.hp.fainted;
            if (event.hp.fainted) {
                // 宝可梦倒下后，boost 和临时状态不会带入下一次出场。
                pokemon.boosts = {};
                pokemon.volatile = {};
                pokemon.volatileDurations = {};
            }
        }
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
    if (event.type === 'start') {
        pokemon = this.upsertPokemon(event.target, null, null);
        if (pokemon && event.effect) {
            var effectId = normalizeEffectId(event.effect);
            var initialDuration = (effectId === 'encore' ||
                effectId === 'taunt' ||
                effectId === 'lockedmove' ||
                effectId === 'yawn') ? 0 : null;
            setVolatile(pokemon, event.effect, initialDuration);
        }
    }
    if (event.type === 'end') {
        // |-end| 的第一个参数可能是全局效果（例如 Primordial Sea），
        // 只有带 side/position 的 ident 才能映射到宝可梦。
        pokemon = event.target && event.target.side ? this.upsertPokemon(event.target, null, null) : null;
        if (pokemon && event.effect) removeVolatile(pokemon, event.effect);
    }
    if (event.type === 'activate') {
        pokemon = this.upsertPokemon(event.target, null, null);
        if (pokemon && normalizeEffectId(event.effect) === 'substitute' &&
            (event.args || []).some(function (arg) {
                return String(arg).toLowerCase() === '[damage]';
            })) {
            pokemon.substituteHit = true;
        }
    }
    if (event.type === 'boost' || event.type === 'unboost' || event.type === 'setboost') {
        pokemon = this.upsertPokemon(event.target, null, null);
        if (pokemon && event.stat) {
            if (event.type === 'setboost') pokemon.boosts[event.stat] = event.amount;
            else {
                var nextBoost = (pokemon.boosts[event.stat] || 0) +
                    (event.type === 'boost' ? event.amount : -event.amount);
                pokemon.boosts[event.stat] = Math.max(-6, Math.min(6, nextBoost));
            }
        }
    }
    if (event.type === 'clearboost' || event.type === 'clearpositiveboost' || event.type === 'clearnegativeboost') {
        pokemon = this.upsertPokemon(event.target, null, null);
        if (pokemon) {
            var boostKeys = Object.keys(pokemon.boosts);
            for (var bi = 0; bi < boostKeys.length; bi++) {
                var boostValue = pokemon.boosts[boostKeys[bi]] || 0;
                if (event.type === 'clearboost' ||
                    (event.type === 'clearpositiveboost' && boostValue > 0) ||
                    (event.type === 'clearnegativeboost' && boostValue < 0)) {
                    pokemon.boosts[boostKeys[bi]] = 0;
                }
            }
        }
    }
    if (event.type === 'clearallboost') {
        for (var si = 0; si < 2; si++) {
            side = this.sideFor(si === 0 ? 'p1' : 'p2');
            if (!side) continue;
            for (var pi = 0; pi < side.team.length; pi++) side.team[pi].boosts = {};
        }
    }
    if (event.type === 'terastallize' || event.type === 'dynamax' || event.type === 'transform') {
        pokemon = this.upsertPokemon(event.actor, null, null);
        if (pokemon) {
            if (event.type === 'terastallize') pokemon.teraType = event.form;
            if (event.type === 'dynamax') pokemon.dynamaxed = true;
            if (event.type === 'transform') {
                pokemon.transformed = true;
                // Imposter/Transform 会复制目标当前的能力等级；复制只发生在
                // 变身时刻，之后双方的 boost 变化仍然独立记录。
                var source = event.target && this.upsertPokemon(event.target, null, null);
                pokemon.boosts = Object.assign({}, source && source.boosts || {});
            }
        }
    }
    if (event.type === 'singleturn' || event.type === 'mustrecharge') {
        pokemon = event.target && event.target.side ? this.upsertPokemon(event.target, null, null) : null;
        if (pokemon && event.effect) {
            setVolatile(pokemon, event.effect, null);
        }
    }
    if (event.type === 'upkeep') {
        var sides = [this.sides.p1, this.sides.p2];
        for (var ei = 0; ei < sides.length; ei++) {
            var effects = sides[ei] && sides[ei].effects;
            if (!effects) continue;
            if (effects.wish && effects.wish.turnsRemaining > 0) {
                effects.wish.turnsRemaining -= 1;
            }
            if (effects.futureSight && effects.futureSight.turnsRemaining > 0) {
                effects.futureSight.turnsRemaining -= 1;
            }
        }
        for (var si = 0; si < sides.length; si++) {
            var side = sides[si];
            if (!side || !side.active) continue;
            incrementVolatileDuration(side.active, 'yawn');
            incrementVolatileDuration(side.active, 'lockedmove');
        }
    }
    if (event.type === 'heal' && event.args && event.args.some(function (arg) {
        return String(arg).toLowerCase().indexOf('move: wish') !== -1;
    })) {
        var healingSide = event.target && this.sideFor(event.target.side);
        if (healingSide && healingSide.effects) {
            healingSide.effects.wish = { turnsRemaining: 0, amount: 0 };
        }
    }
    if (event.type === 'damage' && event.args && event.args.some(function (arg) {
        return String(arg).toLowerCase().indexOf('move: future sight') !== -1;
    })) {
        var futureSide = event.target && this.sideFor(event.target.side);
        if (futureSide && futureSide.effects) {
            futureSide.effects.futureSight = { turnsRemaining: 0, source: null };
        }
    }
    if (event.type === 'weather') {
        var weatherId = normalizeEffectId(event.weather);
        this.weather = weatherId === 'none' ? null : weatherId;
        this.weatherState = {
            name: weatherId && weatherId !== 'none' ? weatherId : null,
            turnsRemaining: event.upkeep ? null : this.weatherState.turnsRemaining,
            source: event.weatherArgs && event.weatherArgs.length ? event.weatherArgs.join('|') : null
        };
    }
    if (event.type === 'fieldstart') {
        this.field[event.field] = true;
        var fieldId = normalizeEffectId(event.field);
        if (fieldId === 'trickroom') {
            this.fieldState.trickRoom = true;
            this.fieldState.trickRoomTurnsRemaining = null;
        } else if (fieldId === 'gravity') {
            this.fieldState.gravity = true;
        } else {
            this.fieldState.terrain = fieldId;
            this.fieldState.terrainTurnsRemaining = null;
        }
    }
    if (event.type === 'fieldend') {
        delete this.field[event.field];
        var endFieldId = normalizeEffectId(event.field);
        if (endFieldId === 'trickroom') {
            this.fieldState.trickRoom = false;
            this.fieldState.trickRoomTurnsRemaining = 0;
        } else if (endFieldId === 'gravity') {
            this.fieldState.gravity = false;
        } else if (!endFieldId || normalizeEffectId(this.fieldState.terrain) === endFieldId) {
            this.fieldState.terrain = null;
            this.fieldState.terrainTurnsRemaining = 0;
        }
    }
    if (event.type === 'sidestart' || event.type === 'sideend') {
        side = this.sideFor(event.side);
        if (side) {
            var conditionId = normalizeEffectId(event.effect);
            if (event.type === 'sidestart') {
                side.sideConditions[event.effect] = true;
                var detail = side.sideConditionDetails[event.effect] || {
                    id: conditionId,
                    count: 0,
                    startedTurn: this.turn,
                    turnsRemaining: null,
                    duration: sideConditionDuration(conditionId, side)
                };
                detail.count = (conditionId === 'spikes' || conditionId === 'toxicspikes') ?
                    detail.count + 1 : 1;
                detail.startedTurn = detail.startedTurn === undefined ? this.turn : detail.startedTurn;
                if (detail.duration === undefined) {
                    detail.duration = sideConditionDuration(conditionId, side);
                }
                side.sideConditionDetails[event.effect] = detail;
            } else {
                Object.keys(side.sideConditions).forEach(function (key) {
                    if (normalizeEffectId(key) === conditionId) delete side.sideConditions[key];
                });
                Object.keys(side.sideConditionDetails).forEach(function (key) {
                    if (normalizeEffectId(key) === conditionId) {
                        delete side.sideConditionDetails[key];
                    }
                });
            }
        }
    }
    if (event.type === 'faint') {
        info = parseIdent(event.subject);
        pokemon = this.upsertPokemon(info, null, parseHp('0 fnt'));
        if (pokemon) {
            pokemon.fainted = true;
            pokemon.hp = parseHp('0 fnt');
            pokemon.boosts = {};
            pokemon.volatile = {};
            pokemon.volatileDurations = {};
        }
    }
    if (event.type === 'tier') this.format = event.value;
    if (event.type === 'gen') this.gen = Number(event.value) || null;
    if (event.type === 'win' || event.type === 'tie') {
        this.result = event.type === 'tie' ? { type: 'tie' } : { type: 'win', winner: event.subject || null };
        this.ended = true;
    }
    if (event.type === 'deinit') this.ended = true;
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

BattleSession.prototype.recordSelectedAction = function (request, action) {
    if (!request || !action) return this;
    var side = this.sideFor(request.side && request.side.id);
    if (!side) return this;
    var turn = this.turn;
    var selected = null;
    if (action.type === 'move') {
        var activeRows = request.active && request.active[0] && request.active[0].moves;
        var moveRow = activeRows && activeRows[Number(action.slot) - 1];
        var moveName = moveRow && (moveRow.id || moveRow.move);
        selected = moveState(moveName || ('slot ' + action.slot), turn, 'move');
    } else if (action.type === 'switch') {
        var rows = request.side && request.side.pokemon;
        var row = rows && rows[Number(action.slot) - 1];
        selected = moveState(
            'switch ' + String(row && row.details || 'slot ' + action.slot).split(',')[0],
            turn,
            'switch'
        );
    } else if (action.type === 'team') {
        selected = moveState('team ' + String(action.order || ''), turn, 'team');
    }
    if (selected) {
        side.lastSelectedMove = selected;
        if (side.active) side.active.lastSelectedMove = selected;
    }
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
