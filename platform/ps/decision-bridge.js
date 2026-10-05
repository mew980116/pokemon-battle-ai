'use strict';

var http = require('http');
var https = require('https');
var url = require('url');

function hpPercent(pokemon) {
    if (!pokemon || !pokemon.hp) return null;
    var pct = (pokemon.hp.percent !== null && pokemon.hp.percent !== undefined) ? pokemon.hp.percent : null;
    // 一位小数：别把 90.11406844106465 这种原始浮点丢给 LLM / 看板
    return pct === null ? null : Math.round(pct * 10) / 10;
}

// 属性/招式类型：PS 的协议都不给，只能查内嵌图鉴（对方给的是 PS 名，取最新世代；
// 与决策服务的 tools.speciesTypes 同源）
var CALC_DEX = null;
function calcDex() {
    if (!CALC_DEX) {
        var calc = require('../../po-pokellmon-tool/vendor/smogon-calc/index.js');
        CALC_DEX = calc.Generations.get(9) || calc.Generations.get(8);
    }
    return CALC_DEX;
}
function typesOf(name) {
    if (!name) return null;
    try {
        var sp = calcDex().species.get(String(name).toLowerCase().replace(/[^a-z0-9]+/g, ''));
        if (sp && sp.exists !== false && sp.types && sp.types.length) return sp.types;
    } catch (e) { /* 查不到就不给 */ }
    return null;
}
// 招式属性（看板的招式色点、prompt 都要用）；PS 只给 id（"earthquake"）或名字
function moveTypeOf(idOrName) {
    if (!idOrName) return null;
    try {
        var moveId = String(idOrName).toLowerCase().replace(/[^a-z0-9]+/g, '');
        var mv = calcDex().moves.get(moveId);
        if (mv && mv.exists !== false && mv.type) return mv.type;
    } catch (e) { /* 查不到就不给 */ }
    return null;
}

function nameId(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function requestActivePokemon(side, request) {
    var requestTeam = request && request.side && Array.isArray(request.side.pokemon) ?
        request.side.pokemon : [];
    var team = side && Array.isArray(side.team) ? side.team : [];
    for (var i = 0; i < requestTeam.length; i++) {
        if (!requestTeam[i].active) continue;
        var detailsName = String(requestTeam[i].details || '').split(',')[0].trim();
        for (var j = 0; j < team.length; j++) {
            if (nameId(team[j].name) === nameId(detailsName)) return team[j];
        }
    }
    return null;
}

function requestCondition(value) {
    var text = String(value || '').trim();
    if (!text) return { current: null, max: null, hpPct: null, fainted: false };
    if (text.indexOf('fnt') !== -1 || text === '0') {
        return { current: 0, max: null, hpPct: 0, fainted: true };
    }
    var match = text.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/);
    if (!match) return { current: null, max: null, hpPct: null, fainted: false };
    var current = Number(match[1]);
    var max = Number(match[2]);
    return {
        current: current,
        max: max,
        hpPct: max > 0 ? Math.round(current / max * 1000) / 10 : null,
        fainted: current <= 0
    };
}

function applyRequestSnapshot(target, requestPokemon, slot) {
    if (!target || !requestPokemon) return;
    var hp = requestCondition(requestPokemon.condition);
    if (hp.current !== null) target.hp = hp.current;
    if (hp.max !== null) target.maxHp = hp.max;
    if (hp.hpPct !== null) target.hpPct = hp.hpPct;
    target.fainted = !!hp.fainted;
    target.ko = !!hp.fainted;
    target.slot = slot;
    if (requestPokemon.details) {
        target.details = requestPokemon.details;
        target.name = String(requestPokemon.details).split(',')[0].trim();
    }
}

function levelOf(details) {
    var m = String(details || '').match(/L(\d+)/);
    return m ? Number(m[1]) : 100;
}

function detectFormat(request, session) {
    var format = request && (request.format || request.formatid || request.ruleset);
    if (!format && session) format = session.format || session.formatid;
    return format ? String(format) : null;
}
function detectGen(request, session, format) {
    var value = request && (request.gen || request.generation);
    if (value === undefined && session) value = session.gen || session.generation;
    if (value === undefined && session && Array.isArray(session.history)) {
        for (var i = session.history.length - 1; i >= 0; i--) {
            var event = session.history[i];
            if (event && event.type === 'gen' && event.args && event.args[0]) {
                value = event.args[0];
                break;
            }
        }
    }
    if (value !== undefined && value !== null && /^\d+$/.test(String(value))) return Number(value);
    var m = String(value || format || '').toLowerCase().match(/(?:gen|generation)[-_ ]?(\d+)/);
    return m ? Number(m[1]) : null;
}

function pokemonState(pokemon, reveal) {
    if (!pokemon) return null;
    var result = {
        name: reveal ? pokemon.name : null,
        hpPct: hpPercent(pokemon),
        hp: pokemon.hp && pokemon.hp.current !== null ? pokemon.hp.current : null,
        maxHp: pokemon.hp && pokemon.hp.max !== null ? pokemon.hp.max : null,
        status: pokemon.status || null,
        boosts: [],
        moves: [],
        moveDetails: {},
        volatile: {},
        substituteHit: !!pokemon.substituteHit,
        fainted: !!pokemon.fainted,
        ko: !!pokemon.fainted,
        revealed: !!reveal,
        slot: pokemon.slot
    };
    var boosts = pokemon.boosts || {};
    var keys = Object.keys(boosts);
    for (var i = 0; i < keys.length; i++) if (boosts[keys[i]]) result.boosts.push(keys[i] + (boosts[keys[i]] > 0 ? '+' : '') + boosts[keys[i]]);
    // 等级/道具/特性/属性：看板要显示，决策服务的 prompt 也用（原来全缺 → prompt 里 Type:?、克制提示空算）
    if (pokemon.level) result.level = pokemon.level;
    if (pokemon.item) result.item = pokemon.item;
    if (pokemon.ability) result.ability = pokemon.ability;
    if (reveal && pokemon.name) {
        var types = typesOf(pokemon.name);
        if (types) result.types = types;
    }
    if (reveal && pokemon.moves) {
        for (var m = 0; m < pokemon.moves.length; m++) {
            var mt = moveTypeOf(pokemon.moves[m]);
            result.moves.push({ name: pokemon.moves[m], type: mt || '?', slot: m + 1 });
        }
    }
    if (pokemon.moveDetails) result.moveDetails = Object.assign({}, pokemon.moveDetails);
    if (pokemon.volatile) {
        result.volatile = {
            active: Object.keys(pokemon.volatile),
            durations: Object.assign({}, pokemon.volatileDurations || {}),
            movesUsedSinceSwitchIn: (pokemon.movesUsedSinceSwitchIn || []).slice(),
            lastUsedMove: pokemon.lastUsedMove ? Object.assign({}, pokemon.lastUsedMove) : null,
            substituteHit: !!pokemon.substituteHit
        };
    }
    return result;
}

function normalizeConditionId(value) {
    return String(value || '').toLowerCase().replace(/^move:\s*/, '').replace(/[^a-z0-9]+/g, '');
}

function sideHazards(side, session, sideId) {
    var result = [];
    var conditions = side && side.sideConditions ? side.sideConditions : {};
    var keys = Object.keys(conditions);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var id = normalizeConditionId(key);
        var count = 1;
        // PS 用重复 sidestart 表示 Spikes/Toxic Spikes 的层数。adapter
        // 的 sideConditions 只保留存在性，因此这里从已保存协议事件恢复层数。
        if (session && session.history && (id === 'spikes' || id === 'toxicspikes')) {
            count = 0;
            for (var j = 0; j < session.history.length; j++) {
                var event = session.history[j];
                if (!event || event.type !== 'sidestart' || event.side !== sideId) continue;
                if (normalizeConditionId(event.effect) === id) count++;
            }
            if (!count) count = 1;
            for (var k = session.history.length - 1; k >= 0; k--) {
                var endEvent = session.history[k];
                if (!endEvent || endEvent.type !== 'sideend' || endEvent.side !== sideId) continue;
                if (normalizeConditionId(endEvent.effect) === id) {
                    count = 0;
                    for (var m = k + 1; m < session.history.length; m++) {
                        var later = session.history[m];
                        if (later && later.type === 'sidestart' &&
                            later.side === sideId &&
                            normalizeConditionId(later.effect) === id) count++;
                    }
                    break;
                }
            }
            if (!count) count = 1;
        }
        for (var repeat = 0; repeat < count; repeat++) result.push(key);
    }
    return result;
}

function sideScreens(side) {
    var result = [];
    var conditions = side && side.sideConditions ? side.sideConditions : {};
    var keys = Object.keys(conditions);
    for (var i = 0; i < keys.length; i++) {
        var id = String(keys[i]).toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (id.indexOf('reflect') !== -1 ||
            id.indexOf('lightscreen') !== -1 ||
            id.indexOf('auroraveil') !== -1 ||
            id.indexOf('tailwind') !== -1) {
            result.push(keys[i]);
        }
    }
    return result;
}

function toxicCountForSide(session, sideId) {
    var count = 0;
    var history = session && session.history ? session.history : [];
    for (var i = 0; i < history.length; i++) {
        var event = history[i];
        if (!event) continue;
        if ((event.type === 'switch' || event.type === 'drag' || event.type === 'replace') &&
            event.actor && event.actor.side === sideId) {
            count = 0;
            continue;
        }
        if (event.type === 'curestatus' &&
            event.target && event.target.side === sideId) {
            count = 0;
            continue;
        }
        if (event.type !== 'damage' || !event.target || event.target.side !== sideId) {
            continue;
        }
        var args = event.args || [];
        var condition = String(args[1] || '');
        var fromPoison = args.some(function (value) {
            return String(value || '').toLowerCase() === '[from] psn';
        });
        if (fromPoison && /\btox\b/i.test(condition)) count += 1;
    }
    return count;
}

function protectCountForSide(session, sideId) {
    var count = 0;
    var protectEffects = {
        protect: true,
        detect: true,
        kingsshield: true,
        spikyshield: true,
        banefulbunker: true,
        silktrap: true,
        burningbulwark: true
    };
    var history = session && session.history ? session.history : [];
    for (var i = 0; i < history.length; i++) {
        var event = history[i];
        if (!event) continue;
        if (event.type === 'singleturn' &&
            event.target && event.target.side === sideId &&
            protectEffects[normalizeConditionId(event.effect)]) {
            count += 2;
        } else if (event.type === 'upkeep') {
            count = Math.max(0, count - 1);
        }
    }
    return count;
}

function sideConditionDetails(side, session) {
    var result = {};
    var details = side && side.sideConditionDetails ? side.sideConditionDetails : {};
    var keys = Object.keys(details);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var detail = Object.assign({}, details[key]);
        if (detail.startedTurn !== undefined && detail.startedTurn !== null &&
            session && session.turn !== undefined && session.turn !== null) {
            detail.turn = session.turn;
        }
        var conditionId = normalizeConditionId(key);
        var durationDefaults = {
            reflect: 5,
            lightscreen: 5,
            auroraveil: 5,
            safeguard: 5,
            mist: 5,
            tailwind: 4
        };
        if (detail.turnsRemaining === null &&
            detail.startedTurn !== undefined &&
            detail.startedTurn !== null &&
            durationDefaults[conditionId] !== undefined) {
            var duration = detail.duration === undefined || detail.duration === null ?
                durationDefaults[conditionId] : detail.duration;
            var elapsed = Math.max(0, Number(session.turn || 0) - Number(detail.startedTurn));
            detail.turnsRemaining = Math.max(0, duration - elapsed);
        }
        result[key] = detail;
    }
    var toxicCount = toxicCountForSide(session, side && side.id);
    if (toxicCount > 0) {
        result.toxic_count = {
            id: 'toxic_count',
            count: toxicCount,
            startedTurn: null,
            turnsRemaining: null
        };
    }
    var protectCount = protectCountForSide(session, side && side.id);
    if (protectCount > 0) {
        result.protect = {
            id: 'protect',
            count: protectCount,
            startedTurn: null,
            turnsRemaining: null
        };
    }
    return result;
}

function liveFieldState(session) {
    var fieldState = session && session.fieldState ? session.fieldState : {};
    var fieldKeys = Object.keys(session && session.field || {});
    var terrain = fieldState.terrain || null;
    if (!terrain) {
        for (var i = 0; i < fieldKeys.length; i++) {
            var fieldId = normalizeConditionId(fieldKeys[i]);
            if (fieldId.indexOf('terrain') !== -1) {
                terrain = fieldKeys[i];
                break;
            }
        }
    }
    return {
        terrain: terrain,
        terrainTurnsRemaining: fieldState.terrainTurnsRemaining === undefined ?
            null : fieldState.terrainTurnsRemaining,
        trickRoom: !!fieldState.trickRoom,
        trickRoomTurnsRemaining: fieldState.trickRoomTurnsRemaining === undefined ?
            0 : fieldState.trickRoomTurnsRemaining,
        gravity: !!fieldState.gravity
    };
}

function liveWeatherState(session) {
    var state = session && session.weatherState ? session.weatherState : {};
    return {
        name: session && session.weather ? session.weather : null,
        turnsRemaining: state.turnsRemaining === undefined ? null : state.turnsRemaining,
        source: state.source || null
    };
}

function sideEffectDetails(side) {
    var effects = side && side.effects ? side.effects : {};
    var wish = effects.wish || {};
    var futureSight = effects.futureSight || {};
    return {
        wish: {
            turnsRemaining: Number(wish.turnsRemaining || 0),
            amount: Number(wish.amount || 0),
            source: wish.source || null
        },
        futureSight: {
            turnsRemaining: Number(futureSight.turnsRemaining || 0),
            source: futureSight.source || null
        },
        healingWish: Number(effects.healingWish || 0),
        batonPassing: !!effects.batonPassing,
        shedTailing: !!effects.shedTailing
    };
}

function pokemonVolatileState(pokemon) {
    if (!pokemon) return {};
    return {
        active: Object.keys(pokemon.volatile || {}),
        durations: Object.assign({}, pokemon.volatileDurations || {}),
        movesUsedSinceSwitchIn: (pokemon.movesUsedSinceSwitchIn || []).slice(),
        lastUsedMove: pokemon.lastUsedMove ? Object.assign({}, pokemon.lastUsedMove) : null
    };
}

function eventText(event) {
    if (!event) return '';
    var args = event.args || [];
    // Preserve the raw protocol type. The leading '-' distinguishes PS
    // state modifiers such as -boost, -damage, -ability, and -weather.
    var rawType = event.rawType || event.type;
    return '|' + rawType + (args.length ? '|' + args.join('|') : '');
}

function DecisionBridge(options) {
    options = options || {};
    this.url = options.url || process.env.POKELLMON_TOOL_URL || 'http://127.0.0.1:8092/choice';
    this.shadow = options.shadow !== undefined ? !!options.shadow : process.env.PS_SHADOW !== '0' && process.env.PS_SHADOW !== 'false';
    this.request = options.request || null;
    this.account = options.account || process.env.PS_ACCOUNT || '';
    this.providerHint = options.providerHint || '';
    // 决策来源：'llm'（默认，调决策服务）| 'random'（纯本地随机合法动作，不请求服务）
    this.agent = options.agent || 'llm';
    this.client = null;
    this.onRequest = options.onRequest || function () {};
    this.onSuggestion = options.onSuggestion || function () {};
    this.onPreCommit = options.onPreCommit || function () {};
    this.suggestions = [];
    this.jobs = {};
    this.activeByBattle = {};
    this.endedBattles = {};
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
    var previousEnd = client.onBattleEnd;
    client.onBattleEnd = function (session, event, room) {
        self.endBattle(session && session.roomId || room);
        if (previousEnd) previousEnd(session, event, room);
    };
    return this;
};

DecisionBridge.prototype.buildState = function (session, request, actions) {
    var meSide = request && request.side && request.side.id ? request.side.id : 'p1';
    var oppSide = meSide === 'p1' ? 'p2' : 'p1';
    var me = session.sides[meSide] || { team: [] };
    var opp = session.sides[oppSide] || { team: [] };
    // request.side.pokemon[].active is authoritative after a switch. The
    // adapter's side.active can still point at the previous object until the
    // next protocol event is folded into the session.
    var activeMe = requestActivePokemon(me, request) ||
        me.active || (me.team && me.team[0]);
    var activeOpp = opp.active || (opp.team && opp.team[0]);
    var format = detectFormat(request, session);
    var detectedGen = detectGen(request, session, format);
    var state = {
        schemaVersion: 'battle-state/v1',
        platform: 'ps',
        account: this.account || (this.client && this.client.username) || '',
        providerHint: this.providerHint || undefined,
        turn: session.turn,
        battleId: session.roomId,
        gen: detectedGen || undefined,
        format: format || undefined,
        rqid: request && request.rqid !== undefined ? request.rqid : undefined,
        history: session.history.map(eventText),
        fullHistory: session.history.map(eventText),
        lastSelectedMove: session.sides[meSide] && session.sides[meSide].lastSelectedMove ?
            Object.assign({}, session.sides[meSide].lastSelectedMove) : null,
        lastUsedMove: session.sides[meSide] && session.sides[meSide].lastUsedMove ?
            Object.assign({}, session.sides[meSide].lastUsedMove) : null,
        weather: session.weather || null,
        weatherState: liveWeatherState(session),
        terrain: null,
        fieldState: liveFieldState(session),
        myHazards: sideHazards(me, session, meSide),
        oppHazards: sideHazards(opp, session, oppSide),
        screens: { me: sideScreens(me), opp: sideScreens(opp) },
        sideConditionDetails: {
            me: sideConditionDetails(me, session),
            opp: sideConditionDetails(opp, session)
        },
        sideEffectDetails: {
            me: sideEffectDetails(me),
            opp: sideEffectDetails(opp)
        },
        me: pokemonState(activeMe, true) || {},
        opp: pokemonState(activeOpp, true) || {},
        myTeam: [],
        oppTeam: [],
        bench: [],
        request: request || null,
        actions: actions || [],
        capabilities: {
            hasFullRequest: true,
            hasOpponentMoves: 'observed',
            canSimulate: false,
            canExecute: true
        },
        teamPreview: !!(request && request.teamPreview),   // PO 的同名字段：决策服务据此走「开局选人」分支
        log: true   // 让决策服务把本回合（prompt / usage / toolLog）写进 logs/deepseek_tool_*.log，便于看 token 开销
    };
    state.terrain = state.fieldState.terrain;
    // 出战槽位以 request 为准（adapter 的 side.active 在换人后可能指向旧的）；
    // team preview 的 request 没有 active 标记（activeSlots 为空）→ 退回对象身份判断
    var activeSlots = {};
    var requestTeam = request && request.side && request.side.pokemon;
    if (requestTeam) {
        for (var a = 0; a < requestTeam.length; a++) if (requestTeam[a].active) activeSlots[a + 1] = true;
    }
    var useSlots = false;
    for (var sk in activeSlots) { useSlots = true; break; }
    var myTeamIndexBySlot = {};
    for (var i = 0; i < (me.team || []).length; i++) {
        var mine = pokemonState(me.team[i], true);
        mine.volatile = pokemonVolatileState(me.team[i]);
        var slot = me.team[i].slot || (i + 1);
        if (myTeamIndexBySlot[slot] !== undefined) {
            // formechange 可能让 adapter 暂时保留旧对象；同一队伍槽只保留最新信息，
            // 避免替补列表出现重复 slot，进而选错换人目标。
            var previous = state.myTeam[myTeamIndexBySlot[slot]];
            var merged = Object.assign({}, previous, mine);
            if ((!mine.moves || !mine.moves.length) && previous.moves) merged.moves = previous.moves;
            if ((!mine.types || !mine.types.length) && previous.types) merged.types = previous.types;
            state.myTeam[myTeamIndexBySlot[slot]] = merged;
            continue;
        }
        myTeamIndexBySlot[slot] = state.myTeam.length;
        state.myTeam.push(mine);
    }
    // 替补席：排除出战中的和已濒死的。
    for (var bi = 0; bi < state.myTeam.length; bi++) {
        var benchPokemon = state.myTeam[bi];
        var benchSlot = benchPokemon.slot || (bi + 1);
        if (useSlots ? !!activeSlots[benchSlot] : benchPokemon.name === (state.me && state.me.name)) continue;
        if (benchPokemon.fainted) continue;
        state.bench.push(benchPokemon);
    }
    var oppTeamIndexBySlot = {};
    for (var j = 0; j < (opp.team || []).length; j++) {
        var opponentPokemon = pokemonState(opp.team[j], true);
        opponentPokemon.volatile = pokemonVolatileState(opp.team[j]);
        var opponentSlot = opp.team[j].slot || (j + 1);
        if (oppTeamIndexBySlot[opponentSlot] !== undefined) {
            state.oppTeam[oppTeamIndexBySlot[opponentSlot]] = Object.assign(
                {},
                state.oppTeam[oppTeamIndexBySlot[opponentSlot]],
                opponentPokemon
            );
        } else {
            oppTeamIndexBySlot[opponentSlot] = state.oppTeam.length;
            state.oppTeam.push(opponentPokemon);
        }
    }
    // 对手道具/特性是「战报已证实」的推断值：决策服务的 from_state 读的是 *Inferred 字段
    for (var inf = 0; inf < state.oppTeam.length; inf++) {
        if (state.oppTeam[inf].item) state.oppTeam[inf].itemInferred = state.oppTeam[inf].item;
        if (state.oppTeam[inf].ability) state.oppTeam[inf].abilityInferred = state.oppTeam[inf].ability;
    }
    if (state.opp && state.opp.item) state.opp.itemInferred = state.opp.item;
    if (state.opp && state.opp.ability) state.opp.abilityInferred = state.opp.ability;
    // 对手还剩几只（看板要显示）：|teamsize| 给了总数，倒下的必然都已露过面
    if (opp.teamSize) {
        var oppFainted = 0;
        for (var of2 = 0; of2 < (opp.team || []).length; of2++) if (opp.team[of2].fainted) oppFainted++;
        state.oppRemaining = Math.max(0, opp.teamSize - oppFainted);
    }
    // 我方六维：request.side.pokemon[].stats 就是算好的实际能力值（PS 不暴露 randbats 的 EV/性格），
    // 直接放进 myStats[].stats —— get_my_stats 会原样返回（PO 那边给的是 ev/iv/nature 现算）
    if (requestTeam) {
        var statRows = [];
        for (var sr = 0; sr < requestTeam.length; sr++) {
            var rpStats = requestTeam[sr];
            if (!rpStats.stats) continue;
            var hpMax = String(rpStats.condition || '').match(/^(\d+)\/(\d+)/);
            statRows.push({
                slot: sr + 1,
                legacySlot: sr,
                name: String(rpStats.details || '').split(',')[0].trim(),
                level: levelOf(rpStats.details),
                item: rpStats.item || null,
                stats: {
                    hp: hpMax ? Number(hpMax[2]) : undefined,
                    atk: rpStats.stats.atk, def: rpStats.stats.def,
                    spa: rpStats.stats.spa, spd: rpStats.stats.spd, spe: rpStats.stats.spe
                },
                hp: hpMax ? Number(hpMax[2]) : undefined,
                atk: rpStats.stats.atk, def: rpStats.stats.def,
                spa: rpStats.stats.spa, spd: rpStats.stats.spd, spe: rpStats.stats.spe
            });
        }
        if (statRows.length) state.myStats = statRows;
    }
    // 当前可出招的招式：以 request 为准（战报事件里只有「用过的招式」，会漏掉没出过手的那几个）
    var reqActive = request && request.active && request.active[0];
    if (reqActive && reqActive.moves) {
        var usable = [];
        for (var k = 0; k < reqActive.moves.length; k++) {
            if (reqActive.moves[k].disabled) continue;
            usable.push({ name: reqActive.moves[k].move || reqActive.moves[k].id, type: moveTypeOf(reqActive.moves[k].id || reqActive.moves[k].move) || '?', slot: k + 1, id: reqActive.moves[k].id || null });
        }
        if (usable.length) state.me.moves = usable;
        // 极巨化 / 钛晶化能力（gen8 给 canDynamax，gen9 给 canTerastallize=<属性>）
        if (reqActive.canDynamax) state.me.canDynamax = true;
        if (reqActive.canTerastallize) state.me.canTerastallize = reqActive.canTerastallize;
    }
    // request.side.pokemon[].moves 对整队都可用；补到 myTeam，规则算法在换人时
    // 才能评估换入后的输出伤害，而不是把所有替补都当成没有招式。
    if (requestTeam) {
        for (var ti = 0; ti < state.myTeam.length; ti++) {
            var cand = state.myTeam[ti];
            var rp = requestTeam[(cand.slot || (ti + 1)) - 1];
            if (!rp) continue;
            cand.details = rp.details || '';
            cand.moveIds = rp.moves || [];
            cand.moves = [];
            for (var mi = 0; mi < (rp.moves || []).length; mi++) {
                var moveValue = rp.moves[mi];
                cand.moves.push({
                    name: moveValue,
                    id: moveValue,
                    type: moveTypeOf(moveValue) || '?',
                    slot: mi + 1
                });
            }
        }
        for (var rsi = 0; rsi < requestTeam.length; rsi++) {
            var requestPokemon = requestTeam[rsi];
            if (!requestPokemon) continue;
            var requestSlot = rsi + 1;
            for (var tsi = 0; tsi < state.myTeam.length; tsi++) {
                var teamEntry = state.myTeam[tsi];
                var sameSlot = Number(teamEntry.slot) === requestSlot;
                var requestName = String(requestPokemon.details || '').split(',')[0].trim();
                var sameName = requestName && nameId(teamEntry.name) === nameId(requestName);
                if (sameSlot || sameName) {
                    applyRequestSnapshot(teamEntry, requestPokemon, requestSlot);
                    break;
                }
            }
        }
        // The adapter can retain an older active object while the request
        // already contains the authoritative HP and active slot. Rebind
        // state.me to the merged team entry so damage and survival decisions
        // do not use stale full HP after taking damage or healing.
        var requestActiveIndex = -1;
        for (var rai = 0; rai < requestTeam.length; rai++) {
            if (requestTeam[rai] && requestTeam[rai].active) {
                requestActiveIndex = rai;
                break;
            }
        }
        if (requestActiveIndex >= 0) {
            var requestActiveSlot = requestActiveIndex + 1;
            var mergedActive = null;
            for (var mai = 0; mai < state.myTeam.length; mai++) {
                if (Number(state.myTeam[mai].slot) === requestActiveSlot) {
                    mergedActive = state.myTeam[mai];
                    break;
                }
            }
            if (!mergedActive) {
                var requestActiveName = String(requestTeam[requestActiveIndex].details || '')
                    .split(',')[0].trim();
                for (var mni = 0; mni < state.myTeam.length; mni++) {
                    if (nameId(state.myTeam[mni].name) === nameId(requestActiveName)) {
                        mergedActive = state.myTeam[mni];
                        break;
                    }
                }
            }
            if (mergedActive) {
                state.me = Object.assign({}, mergedActive);
                state.me.slot = requestActiveSlot;
                var activeRequest = request && request.active && request.active[0];
                if (activeRequest && Array.isArray(activeRequest.moves)) {
                    state.me.moves = [];
                    for (var ami = 0; ami < activeRequest.moves.length; ami++) {
                        if (activeRequest.moves[ami].disabled) continue;
                        var activeMove = activeRequest.moves[ami];
                        state.me.moves.push({
                            name: activeMove.move || activeMove.id,
                            id: activeMove.id || activeMove.move,
                            type: moveTypeOf(activeMove.id || activeMove.move) || '?',
                            slot: ami + 1
                        });
                    }
                }
            }
        }
    }
    return state;
};

DecisionBridge.prototype.fetchChoiceOnce = function (state, job) {
    var target = url.parse(this.url);
    var transport = target.protocol === 'https:' ? https : http;
    var body = JSON.stringify(state);
    var options = {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + (target.search || ''),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        },
        agent: false   // 不复用 keep-alive 连接：服务端空闲关连接后再复用会 ECONNRESET
    };
    var requester = this.request || transport.request;
    return new Promise(function (resolve, reject) {
        var req = requester.call(transport, options, function (res) {
            var body = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) { body += chunk; });
            res.on('end', function () {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    var detail = body ? ' ' + body.slice(0, 500) : '';
                    return reject(new Error('decision service HTTP ' + res.statusCode + detail));
                }
                try { resolve(JSON.parse(body)); } catch (error) { reject(new Error('decision service returned invalid JSON')); }
            });
        });
        if (job) job.req = req;
        req.on('error', function (error) {
            if (job && job.cancelled) return reject(error);
            reject(error);
        });
        req.end(body);
    });
};

DecisionBridge.prototype.fetchChoice = function (state, job) {
    var self = this;
    return this.fetchChoiceOnce(state, job).catch(function (error) {
        if (job && job.cancelled) throw error;
        // 瞬时断连（连接被重置/管道断开）重试一次：不能把一整轮决策直接降级成随机兜底
        if (!/ECONNRESET|EPIPE/.test(String((error && error.message) || ''))) throw error;
        return self.fetchChoiceOnce(state, job);
    });
};

DecisionBridge.prototype.toPSAction = function (action) {
    if (!action || !action.type) return null;
    if (action.type === 'attack' || action.type === 'attackSlot' || action.type === 'move') {
        var move = { type: 'move', slot: Number(action.attackSlot || action.slot) };
        if (action.dynamax) move.dynamax = true;
        else if (action.tera || action.terastallize) move.tera = true;
        return move;
    }
    if (action.type === 'switch' || action.type === 'switchSlot') return { type: 'switch', slot: Number(action.pokeSlot || action.slot) };
    if (action.type === 'team') return { type: 'team', lead: Number(action.lead || 0), order: action.order };
    return null;
};

// 本地兜底策略：从合法动作里随机取一个（team preview / 换人 / 招式都在列）。
// 用途：① 先把 PS 链路跑通、不依赖决策服务；② 决策服务异常时不让整场卡住。
DecisionBridge.prototype.pickLocalAction = function (actions) {
    if (!actions || !actions.length) return null;
    return actions[Math.floor(Math.random() * actions.length)];
};

// 「没得选」的请求（PS 的 wait:true）只记一笔，不进决策、不发动作
function recordSkip(bridge, session) {
    var record = {
        battleId: session.roomId, turn: session.turn,
        suggestion: null, action: null, shadow: bridge.shadow, skipped: true
    };
    bridge.suggestions.push(record);
    bridge.onRequest(record);
}

DecisionBridge.prototype.requestKey = function (request, session) {
    if (!request || request.rqid === undefined || request.rqid === null) return null;
    return String(session && session.roomId || '') + ':' + String(request.rqid);
};

DecisionBridge.prototype.endBattle = function (battleId) {
    if (!battleId) return;
    this.endedBattles[battleId] = true;
    var active = this.activeByBattle[battleId];
    if (active && active.req && typeof active.req.destroy === 'function') {
        active.cancelled = true;
        try { active.req.destroy(); } catch (error) {}
    }
    delete this.activeByBattle[battleId];
};

DecisionBridge.prototype.commitResult = function (request, session, state, suggestion, action, fallback) {
    var key = this.requestKey(request, session);
    if (key && this.jobs[key] && this.jobs[key].committed) return this.jobs[key].record;
    var record = this.recordResult(state, session, suggestion, action, fallback, request);
    if (key && this.jobs[key]) {
        this.jobs[key].committed = true;
        this.jobs[key].record = record;
    }
    return record;
};

DecisionBridge.prototype.recordResult = function (state, session, suggestion, action, fallback, request) {
    var record = {
        battleId: session.roomId, turn: session.turn, state: state,
        suggestion: suggestion, action: action, shadow: this.shadow
    };
    if (fallback) record.fallback = true;
    // 在实际发送前通知 shadow observer，使参考策略面对同一个不可变 state。
    // observer 只读取并记录，不拥有发送动作的权限。
    this.onPreCommit(record);
    if (session && typeof session.recordSelectedAction === 'function' && action) {
        session.recordSelectedAction(request, action);
    }
    // 先发送再回调：否则日志里的 sent 永远是"没发"（回调读取时还没赋值）
    if (!this.shadow && action && this.client) record.sent = this.client.chooseAction(action, session.roomId, request && request.rqid, { requestKey: this.requestKey(request, session) });
    this.suggestions.push(record);
    this.onSuggestion(record);
    this.onRequest(record);
    return record;
};

// 服务给的动作必须落在本次请求的可选项里（例如 team preview 只能选 team 动作）。
// 不匹配就当作不可用 → 交给本地兜底；否则会被服务器拒（[Invalid choice]）并把对局卡住。
DecisionBridge.prototype.pickServiceAction = function (suggestion, actions) {
    var action = this.toPSAction(suggestion);
    if (!action) return null;
    if (!actions || !actions.length) return action;
    for (var i = 0; i < actions.length; i++) {
        var cand = actions[i];
        if (cand.type !== action.type) continue;
        // 开局选人：按「谁首发」匹配本地候选（本地候选带着整队顺序，直接用它的）
        if (action.type === 'team') {
            if (!action.lead) return actions[0];
            if (Number(cand.lead) === Number(action.lead)) return cand;
            continue;
        }
        if (Number(cand.slot) !== Number(action.slot)) continue;
        // 招式 / 极巨化 / 钛晶化是三个不同选项，不能互相顶替
        if (!!cand.dynamax !== !!action.dynamax) continue;
        if (!!cand.tera !== !!action.tera) continue;
        return action;
    }
    return null;
};

DecisionBridge.prototype.handleRequest = function (request, actions, session) {
    var self = this;
    var key = this.requestKey(request, session);
    var previous = this.activeByBattle[session.roomId];
    if (this.endedBattles[session.roomId]) return Promise.resolve(null);
    if (key && this.jobs[key]) return this.jobs[key].promise;
    if (previous && key && previous.key !== key && previous.req && typeof previous.req.destroy === 'function') {
        previous.cancelled = true;
        try { previous.req.destroy(); } catch (error) {}
    }
    var job = this.jobs[key] = { key: key, committed: false, req: null };
    this.activeByBattle[session.roomId] = job;
    job.promise = this._handleRequest(request, actions, session, job);
    return job.promise;
};

DecisionBridge.prototype._handleRequest = function (request, actions, session, job) {
    var self = this;
    // 本次请求没有可选项（PS 的 wait:true「等对手出招」通知等）：不调决策服务 —— 否则白烧一整轮 LLM，
    // 而且服务给的答案必然不在可选项里（会被退回兜底），纯浪费。连 state 都不用算。
    if (!actions || !actions.length) {
        recordSkip(this, session);
        job.committed = true;
        return Promise.resolve(null);
    }
    var state = this.buildState(session, request, actions);
    if (this.agent === 'random') {
        var localAction = this.pickLocalAction(actions);
        return Promise.resolve(this.commitResult(request, session, state, localAction, this.toPSAction(localAction), true));
    }
    return this.fetchChoice(state, job).then(function (suggestion) {
        if (job.cancelled || self.endedBattles[session.roomId] || self.activeByBattle[session.roomId] !== job) return null;
        var action = self.pickServiceAction(suggestion, actions);
        if (action) return self.commitResult(request, session, state, suggestion, action);
        var fallbackAction = self.pickLocalAction(actions);
        return self.commitResult(request, session, state, suggestion, self.toPSAction(fallbackAction), true);
    }).catch(function (error) {
        if (job.cancelled || self.endedBattles[session.roomId] || self.activeByBattle[session.roomId] !== job) return null;
        self.onSuggestion({ error: error.message, room: session && session.roomId });
        var fallbackAction = self.pickLocalAction(actions);
        if (!fallbackAction) return null;
        return self.commitResult(request, session, state, fallbackAction, self.toPSAction(fallbackAction), true);
    });
};

module.exports = { DecisionBridge: DecisionBridge, pokemonState: pokemonState };
