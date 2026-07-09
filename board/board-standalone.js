// =====================================================================
// PO Battle Board - STANDALONE battle script (no AI)
// Paste this WHOLE file into PO's battle script window. No main AI script
// needed. Only displays battle state to the board; does NOT make decisions
// (play manually or spectate).
//
// Runtime: PO Qt ScriptEngine (pre-ES6). Depends on PO globals: sys, battle.
// Optional: movedata.json in PO root dir (for move power; if absent, power=0).
// Board server: node board/server.js  (default http://127.0.0.1:8080)
// =====================================================================

// ---- config ----
var boardEnabled = true;
var boardUrl = "http://127.0.0.1:8080/state";
var boardLastPushMs = 0;
var boardMinIntervalMs = 250;
var boardForcePush = false;
var boardCurrentTurn = 0;
var boardBattleEnded = false;

// ---- minimal helpers (self-contained, same semantics as main script) ----
function print_s(m){ print("[board] " + m); }
function poke(spot){
    if (spot !== battle.me && spot !== battle.opp) spot = battle.me;
    return battle.data.team(spot).poke(0);
}
function fpoke(spot){
    if (spot !== battle.me && spot !== battle.opp) spot = battle.me;
    return battle.data.field.poke(spot);
}
function tpoke(ind){
    if (ind < 0 || ind > 5) ind = 0;
    return battle.data.team(battle.me).poke(ind);
}

// ---- move data (optional; for move power display) ----
var moveDataObj = null;
try { moveDataObj = JSON.parse(sys.getFileContent("movedata.json")); }
catch(e){ print_s("movedata.json not loaded (move power will be 0): " + e); }

// ---- number -> string maps ----
var BOARD_TYPE_NAMES = ["Normal","Fighting","Flying","Poison","Ground","Rock","Bug","Ghost","Steel","Fire","Water","Grass","Electric","Psychic","Ice","Dragon","Dark","Fairy"];
function boardTypeName(n){
    if (n === undefined || n === null || n < 0 || n > 17) return null;
    return BOARD_TYPE_NAMES[n];
}
function boardWeatherName(w){
    if (w === 1) return "sandstorm";
    if (w === 2 || w === 6) return "sun";
    if (w === 3) return "hail";
    if (w === 4) return "rain";
    return null;
}
function boardTerrainName(t){
    if (t === 1) return "electric";
    if (t === 2) return "grassy";
    if (t === 3) return "misty";
    if (t === 4) return "psychic";
    return null;
}
function boardStatusName(s){
    if (s === 1) return "paralysis";
    if (s === 2) return "sleep";
    if (s === 3) return "freeze";
    if (s === 4) return "burn";
    if (s === 5) return "poison";
    // 6 (confusion) intentionally not mapped (volatile, not a major status)
    return null;
}
function boardPct(l, t){
    if (!t || t <= 0) return 0;
    var p = Math.floor(l / t * 100);
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    return p;
}
function boardMoveName(n){ try { return sys.move(n); } catch(e){ return "?"; } }
function boardMovePow(n){ try { if (moveDataObj && moveDataObj[n]) return moveDataObj[n].power; } catch(e){} return 0; }
function boardMoveType(n){ try { return boardTypeName(sys.moveType(n)); } catch(e){ return null; } }

// ---- collectors ----
function boardCollectMyPoke(ind){
    var o = { name:"?", level:100, types:[], hp:0, maxHp:0, hpPct:0, status:null, ko:false, moves:[] };
    try {
        var tp = tpoke(ind);
        o.name = sys.pokemon(tp.numRef);
        o.level = tp.level;
        o.hp = tp.life;
        o.maxHp = tp.totalLife;
        o.hpPct = boardPct(tp.life, tp.totalLife);
        o.ko = (tp.status === 31) || (tp.life <= 0);
        o.status = o.ko ? null : boardStatusName(tp.status);
        if (ind === 0) {
            var a = boardTypeName(fpoke(battle.me).type1());
            var b = boardTypeName(fpoke(battle.me).type2());
            if (a) o.types.push(a);
            if (b && b !== a) o.types.push(b);
        } else {
            var c = boardTypeName(sys.pokeType1(tp.numRef));
            var d = boardTypeName(sys.pokeType2(tp.numRef));
            if (c) o.types.push(c);
            if (d && d !== c) o.types.push(d);
        }
        for (var m = 0; m < 4; m++) {
            try {
                var mv = tp.move(m);
                if (mv && mv.num > 0) {
                    o.moves.push({
                        name: boardMoveName(mv.num),
                        type: boardMoveType(mv.num),
                        power: boardMovePow(mv.num),
                        pp: mv.PP,
                        maxPp: mv.totalPP || mv.PP
                    });
                }
            } catch(em){}
        }
    } catch(e){ print_s("my poke "+ind+" err: "+e); }
    return o;
}
function boardCollectMyActiveExtras(a){
    try {
        a.boosts = {
            atk: fpoke(battle.me).statBoost(1),
            def: fpoke(battle.me).statBoost(2),
            spa: fpoke(battle.me).statBoost(3),
            spd: fpoke(battle.me).statBoost(4),
            spe: fpoke(battle.me).statBoost(5),
            acc: fpoke(battle.me).statBoost(6),
            eva: fpoke(battle.me).statBoost(7)
        };
        a.ability = sys.ability(poke(battle.me).ability);
        a.item = poke(battle.me).item ? sys.item(poke(battle.me).item) : null;
    } catch(e){ print_s("my extras err: "+e); }
}
function boardCollectOppActive(){
    var o = { name:"?", level:100, types:[], hpPct:0, status:null,
              boosts:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0}, ability:null, item:null, moves:null };
    try {
        var fp = fpoke(battle.opp);
        o.name = sys.pokemon(fp.pokemon.numRef);
        o.level = fp.pokemon.level;
        o.hpPct = boardPct(fp.pokemon.life, fp.pokemon.totalLife);
        o.status = (fp.pokemon.status === 31) ? null : boardStatusName(fp.pokemon.status);
        var a = boardTypeName(fp.type1());
        var b = boardTypeName(fp.type2());
        if (a) o.types.push(a);
        if (b && b !== a) o.types.push(b);
        o.boosts = {
            atk: fp.statBoost(1), def: fp.statBoost(2), spa: fp.statBoost(3),
            spd: fp.statBoost(4), spe: fp.statBoost(5), acc: fp.statBoost(6), eva: fp.statBoost(7)
        };
    } catch(e){ print_s("opp active err: "+e); }
    return o;
}
// Opponent bench: read battle.data.team(opp).poke(1..5) directly (no foeInformation).
// Assumes slot 0 = active (same as main script's poke() convention). A bench mon
// is "revealed" only if PO exposes its numRef (>0). KO if status===31.
function boardCollectOppBench(){
    var arr = [];
    for (var i = 1; i < 6; i++) {
        var b = { name:null, revealed:false, ko:false, hpPct:null };
        try {
            var ep = battle.data.team(battle.opp).poke(i);
            var ko = (ep.status === 31);
            b.ko = ko;
            if (ep.numRef && ep.numRef > 0) {
                b.revealed = true;
                b.name = sys.pokemon(ep.numRef);
                if (ko) b.hpPct = 0;
                else if (ep.totalLife > 0) b.hpPct = boardPct(ep.life, ep.totalLife);
            }
        } catch(e){}
        arr.push(b);
    }
    while (arr.length > 5) arr.pop();
    while (arr.length < 5) arr.push({name:null, revealed:false, ko:false, hpPct:null});
    return arr;
}
function boardCollectHazards(spot){
    var h = { stealthRocks:false, spikes:0, toxicSpikes:0, stickyWeb:false };
    try {
        var z = battle.data.field.zone(spot);
        h.stealthRocks = z.stealthRocks ? true : false;
        h.spikes = z.spikesLevel || 0;
        h.toxicSpikes = z.toxicSpikesLevel || 0;
        h.stickyWeb = z.stickyWeb ? true : false;
    } catch(e){}
    return h;
}
function collectBoardState(){
    var meActive = boardCollectMyPoke(0);
    boardCollectMyActiveExtras(meActive);
    var meBench = [];
    for (var i = 1; i < 6; i++) meBench.push(boardCollectMyPoke(i));
    var weather = null, terrain = null;
    try { weather = boardWeatherName(battle.data.field.weather); } catch(e){}
    try { terrain = boardTerrainName(battle.data.field.terrain); } catch(e){}
    return {
        turn: boardCurrentTurn,
        weather: weather,
        terrain: terrain,
        me: { active: meActive, bench: meBench, hazards: boardCollectHazards(battle.me) },
        opp: { active: boardCollectOppActive(), bench: boardCollectOppBench(), hazards: boardCollectHazards(battle.opp) },
        battleLog: [],
        aiDecision: null
    };
}

// ---- push ----
function boardPushNow(force){
    if (!boardEnabled) return;
    if (boardBattleEnded && !force) return;
    var now = (new Date()).getTime();
    if (force) boardForcePush = true;
    if (!boardForcePush && (now - boardLastPushMs) < boardMinIntervalMs) return;
    boardLastPushMs = now;
    boardForcePush = false;
    try {
        var state = collectBoardState();
        sys.webCall(boardUrl, " ", { state: JSON.stringify(state) });
    } catch(e){ print_s("pushNow err: "+e); }
}

// ---- callback object (collects state on key events; no AI decisions) ----
({
    onBeginTurn: function (turn) {
        boardCurrentTurn = turn;
        boardPushNow(true);
    },
    onDamageDone: function (spot, damage) { boardPushNow(false); },
    onSendOut: function (spot, prevIndex) { boardPushNow(true); },
    onSendBack: function (spot) { boardPushNow(true); },
    onKo: function (spot) { boardPushNow(true); },
    onMajorStatusChange: function (spot, status, multipleTurns, silent) { boardPushNow(true); },
    onStatusOver: function (spot, status) { boardPushNow(true); },
    onBattleEnd: function (result, winner) {
        boardBattleEnded = true;
        boardPushNow(true);
    },
    // no decision logic: PO will let you pick manually (or you're spectating)
    onOfferChoice: function (player, choice) {},
    onChoiceSelection: function (player) {},
    onChoiceCancellation: function (player) {},
    onChoiceCancelled: function (player) {},
    onDrawRequest: function (player) {},
    onMiss: function (spot) {},
    onAvoid: function (spot) {},
    onStatusDamage: function (spot, status) { boardPushNow(false); },
    onUseAttack: function (spot, attack) {},
    onItemMessage: function (spot, item, part, foe, berry, other) {},
    onMoveMessage: function (spot, move, part, type, foe, other, q) {},
    onAbilityMessage: function (spot, ab, part, type, foe, other) {},
    onTierNotification: function (tier) {},
    onClauseActivated: function (clause) {},
    onEffectiveness: function (spot, effectiveness) {},
    onAttackFailing: function (spot, silent) {},
    onCriticalHit: function (spot) {},
    onFlinch: function (spot) {},
    onPlayerMessage: function (player, message) {},
    onReconnect: function (player) {}
});
