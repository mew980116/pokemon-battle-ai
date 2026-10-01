'use strict';

var CONTRACT_VERSION = 'battle-state/v1';

function cloneAction(action) {
    var result = {};
    var keys = Object.keys(action || {});
    for (var i = 0; i < keys.length; i++) result[keys[i]] = action[keys[i]];
    return result;
}

function actionId(action) {
    if (!action) return '';
    if (action.id) return String(action.id);
    if (action.type === 'team') return 'team:' + String(action.lead || 0);
    if (action.type === 'move' || action.type === 'attack' || action.type === 'attackSlot') {
        var moveId = 'move:' + String(action.slot !== undefined ? action.slot : action.attackSlot);
        if (action.dynamax) moveId += ':dynamax';
        if (action.tera || action.terastallize) moveId += ':tera';
        return moveId;
    }
    if (action.type === 'switch' || action.type === 'switchSlot') {
        return 'switch:' + String(action.slot !== undefined ? action.slot : action.pokeSlot);
    }
    return '';
}

function fromPoState(state) {
    var result = [];
    var me = state && state.me ? state.me : {};
    var moves = Array.isArray(me.moves) ? me.moves : [];
    var bench = Array.isArray(state && state.bench) ? state.bench : [];

    if (!me.fainted) {
        for (var i = 0; i < moves.length; i++) {
            result.push({
                id: 'move:' + String(moves[i].slot),
                type: 'move',
                slot: Number(moves[i].slot),
                name: moves[i].name || null
            });
        }
    }
    for (var j = 0; j < bench.length; j++) {
        result.push({
            id: 'switch:' + String(bench[j].slot),
            type: 'switch',
            slot: Number(bench[j].slot),
            name: bench[j].name || null
        });
    }
    return result;
}

function getActionCandidates(state) {
    var actions = state && Array.isArray(state.actions) ? state.actions : null;
    if (!actions || !actions.length) actions = fromPoState(state || {});
    var result = [];
    for (var i = 0; i < actions.length; i++) {
        if (!actions[i] || !actions[i].type) continue;
        var item = cloneAction(actions[i]);
        item.id = actionId(item);
        result.push(item);
    }
    return result;
}

function normalizeState(state) {
    var input = state && typeof state === 'object' ? state : {};
    var result = input;
    if (!result.schemaVersion) result.schemaVersion = CONTRACT_VERSION;
    if (!result.platform) result.platform = 'unknown';
    if (!result.account) result.account = '';
    if (result.providerHint !== undefined && result.providerHint !== null) {
        result.providerHint = String(result.providerHint).trim().toLowerCase();
    }
    if (!Array.isArray(result.actions)) result.actions = getActionCandidates(result);
    if (!result.capabilities || typeof result.capabilities !== 'object') result.capabilities = {};
    return result;
}

function toResponseAction(action, platform) {
    if (!action) return null;
    var type = String(action.type || '');
    var slot = action.slot;
    if (slot === undefined || slot === null) {
        slot = type === 'switch' || type === 'switchSlot' ? action.pokeSlot : action.attackSlot;
    }

    if (type === 'team') {
        return {
            type: 'team',
            lead: action.lead !== undefined ? Number(action.lead) : 0,
            order: action.order || null
        };
    }
    if (type === 'switch' || type === 'switchSlot') {
        var switchSlot = Number(slot);
        return {
            type: 'switch',
            slot: switchSlot,
            pokeSlot: switchSlot
        };
    }
    if (type === 'move' || type === 'attack' || type === 'attackSlot') {
        var moveSlot = Number(slot);
        var move = {
            type: platform === 'ps' ? 'move' : 'attack',
            slot: moveSlot,
            attackSlot: moveSlot
        };
        if (action.dynamax) move.dynamax = true;
        if (action.tera || action.terastallize) move.tera = true;
        if (action.teraType) move.teraType = action.teraType;
        return move;
    }
    return null;
}

function validateResponseAction(action, state) {
    if (!action) return false;
    var candidates = getActionCandidates(state || {});
    var normalized = toResponseAction(action, state && state.platform);
    if (!normalized) return false;
    if (!candidates.length) return true;

    for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
        var candidateType = candidate.type === 'move' ? 'move' : candidate.type;
        var responseType = normalized.type === 'attack' ? 'move' : normalized.type;
        if (candidateType !== responseType) continue;
        if (candidateType === 'team') {
            if (candidate.lead === undefined || normalized.lead === undefined) return true;
            // 不能直接 return 比较结果：team preview 有 N 个候选，第一个不匹配就 return false
            // 会把 LLM 选的非 1 号首发误判为非法（0.9.11 修：battle-gen8battlefactory-11 实测，
            // LLM 选 lead 5 被判 parse_failed → fallback 成 switch，team preview 卡死）
            if (Number(candidate.lead) === Number(normalized.lead)) return true;
            continue;
        }
        if (Number(candidate.slot) === Number(normalized.slot)) return true;
    }
    return false;
}

module.exports = {
    CONTRACT_VERSION: CONTRACT_VERSION,
    actionId: actionId,
    getActionCandidates: getActionCandidates,
    normalizeState: normalizeState,
    toResponseAction: toResponseAction,
    validateResponseAction: validateResponseAction
};
