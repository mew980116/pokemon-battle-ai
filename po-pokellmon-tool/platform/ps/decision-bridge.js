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
    // 决策来源：'llm'（默认，调决策服务）| 'random'（纯本地随机合法动作，不请求服务）
    this.agent = options.agent || 'llm';
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
        actions: actions || [],
        teamPreview: !!(request && request.teamPreview),   // PO 的同名字段：决策服务据此走「开局选人」分支
        log: true   // 让决策服务把本回合（prompt / usage / toolLog）写进 logs/deepseek_tool_*.log，便于看 token 开销
    };
    var fieldKeys = Object.keys(session.field || {});
    for (var f = 0; f < fieldKeys.length; f++) if (fieldKeys[f].toLowerCase().indexOf('terrain') !== -1) state.terrain = fieldKeys[f];
    // 出战槽位以 request 为准（adapter 的 side.active 在换人后可能指向旧的）；
    // team preview 的 request 没有 active 标记（activeSlots 为空）→ 退回对象身份判断
    var activeSlots = {};
    var requestTeam = request && request.side && request.side.pokemon;
    if (requestTeam) {
        for (var a = 0; a < requestTeam.length; a++) if (requestTeam[a].active) activeSlots[a + 1] = true;
    }
    var useSlots = false;
    for (var sk in activeSlots) { useSlots = true; break; }
    for (var i = 0; i < (me.team || []).length; i++) {
        var mine = pokemonState(me.team[i], true);
        var slot = me.team[i].slot || (i + 1);
        state.myTeam.push(mine);
        // 替补席：排除出战中的和已濒死的（之前用对象身份判断，导致出战那只自己也出现在替补里）
        if (useSlots ? !!activeSlots[slot] : me.team[i] === activeMe) continue;
        if (me.team[i].fainted) continue;
        state.bench.push(mine);
    }
    for (var j = 0; j < (opp.team || []).length; j++) state.oppTeam.push(pokemonState(opp.team[j], true));
    // 当前可出招的招式：以 request 为准（战报事件里只有「用过的招式」，会漏掉没出过手的那几个）
    var reqActive = request && request.active && request.active[0];
    if (reqActive && reqActive.moves) {
        var usable = [];
        for (var k = 0; k < reqActive.moves.length; k++) {
            if (reqActive.moves[k].disabled) continue;
            usable.push({ name: reqActive.moves[k].move || reqActive.moves[k].id, type: '?', slot: k + 1, id: reqActive.moves[k].id || null });
        }
        if (usable.length) state.me.moves = usable;
        // 极巨化 / 钛晶化能力（gen8 给 canDynamax，gen9 给 canTerastallize=<属性>）
        if (reqActive.canDynamax) state.me.canDynamax = true;
        if (reqActive.canTerastallize) state.me.canTerastallize = reqActive.canTerastallize;
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

DecisionBridge.prototype.recordResult = function (state, session, suggestion, action, fallback) {
    var record = {
        battleId: session.roomId, turn: session.turn, state: state,
        suggestion: suggestion, action: action, shadow: this.shadow
    };
    if (fallback) record.fallback = true;
    // 先发送再回调：否则日志里的 sent 永远是"没发"（回调读取时还没赋值）
    if (!this.shadow && action && this.client) record.sent = this.client.chooseAction(action, session.roomId);
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
    var state = this.buildState(session, request, actions);
    if (this.agent === 'random') {
        var localAction = this.pickLocalAction(actions);
        return Promise.resolve(this.recordResult(state, session, localAction, this.toPSAction(localAction), true));
    }
    return this.fetchChoice(state).then(function (suggestion) {
        var action = self.pickServiceAction(suggestion, actions);
        // 服务有响应但翻不成动作、或动作不在可选项里（如 team preview 却给了招式）：退回本地，避免卡住
        if (action) return self.recordResult(state, session, suggestion, action);
        var fallbackAction = self.pickLocalAction(actions);
        return self.recordResult(state, session, suggestion, self.toPSAction(fallbackAction), true);
    }).catch(function (error) {
        self.onSuggestion({ error: error.message, room: session && session.roomId });
        var fallbackAction = self.pickLocalAction(actions);
        if (!fallbackAction) return null;
        return self.recordResult(state, session, fallbackAction, self.toPSAction(fallbackAction), true);
    });
};

module.exports = { DecisionBridge: DecisionBridge, pokemonState: pokemonState };
