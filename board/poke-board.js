// =====================================================================
// PO Battle Board - state collector & pusher (standalone module)
// Runs in PO Qt ScriptEngine (pre-ES6). Loaded by the battle script via:
//   var __boardCb = ({ ...original callbacks... });
//   try { eval(sys.getFileContent("poke-board.js")); boardHook(__boardCb); } catch(e){ print_s("[board] load err: "+e); }
//   __boardCb;
//
// Dependencies (provided by battle script scope): sys, battle, poke, fpoke,
//   tpoke, moveDataObj, foeInformation, print_s, recordBug
//
// Design:
//   - READ-ONLY: never writes engine/AI state.
//   - "只加不改": only wraps callbacks (boardHook), never edits AI logic.
//   - boardEnabled=false -> all pushes no-op.
//   - Each pokemon / each field wrapped in try/catch -> one failure never
//     crashes the whole collect (fills placeholder).
//   - Opponent active: ONLY battle-object-direct fields (hp %, status,
//     boosts, types, level, name). NO foeInformation inference (ability/item
//     left null) per layout spec.
//   - State schema == board/index.html MOCK / DEMO_SCRIPT frame, so the
//     browser render() needs zero changes.
// =====================================================================

// ---- config / globals ----
var boardEnabled = true;
var boardUrl = "http://127.0.0.1:8080/state";
var boardLastPushMs = 0;
var boardMinIntervalMs = 250;
var boardForcePush = false;
var boardCurrentTurn = 0;

// ---- number -> string maps (board-side, no inference) ----
// type num: 0 Normal 1 Fighting 2 Flying 3 Poison 4 Ground 5 Rock 6 Bug
//           7 Ghost 8 Steel 9 Fire 10 Water 11 Grass 12 Electric
//           13 Psychic 14 Ice 15 Dragon 16 Dark 17 Fairy 18 none
var BOARD_TYPE_NAMES = ["Normal","Fighting","Flying","Poison","Ground","Rock","Bug","Ghost","Steel","Fire","Water","Grass","Electric","Psychic","Ice","Dragon","Dark","Fairy"];
function boardTypeName(n){
    // self-built english table; do NOT use sys.type (returns localized name,
    // would break frontend TYPE_COLOR/TYPE_CN keys which are english).
    if (n === undefined || n === null || n < 0 || n > 17) return null;
    return BOARD_TYPE_NAMES[n];
}
// weather num (per main script usage): 1 sandstorm 2 sun 3 hail 4 rain 6 harsh-sun
function boardWeatherName(w){
    if (w === 1) return "sandstorm";
    if (w === 2 || w === 6) return "sun";
    if (w === 3) return "hail";
    if (w === 4) return "rain";
    return null;
}
// terrain num: TODO verify at runtime (eval battle.data.field.terrain).
// Provisional: 1 electric 2 grassy 3 misty 4 psychic
function boardTerrainName(t){
    if (t === 1) return "electric";
    if (t === 2) return "grassy";
    if (t === 3) return "misty";
    if (t === 4) return "psychic";
    return null;
}
// status num (per main script): 1 paralysis 2 sleep 3 freeze 4 burn 5 poison 31 KO
function boardStatusName(s){
    if (s === 1) return "paralysis";
    if (s === 2) return "sleep";
    if (s === 3) return "freeze";
    if (s === 4) return "burn";
    if (s === 5) return "poison";
    // 6 (confusion) intentionally NOT mapped: confusion is a volatile status,
    // not a major status, even though PO delivers it via onMajorStatusChange.
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

// ---- single pokemon collect (own side; ind 0 = active, 1-5 = bench) ----
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
                        maxPp: mv.totalPP || mv.PP   // totalPP preferred; fall back to PP
                    });
                }
            } catch(em){}
        }
    } catch(e){ print_s("[board] my poke "+ind+" err: "+e); }
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
    } catch(e){ print_s("[board] my extras err: "+e); }
}

// ---- opponent active (ONLY direct fields, no inference) ----
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
        // ability/item intentionally null: those need foeInformation inference
    } catch(e){ print_s("[board] opp active err: "+e); }
    return o;
}

// ---- opponent bench (5 non-active; unrevealed -> name null) ----
function boardCollectOppBench(){
    var arr = [];
    try {
        var activeIdx = -1;
        try { activeIdx = foeInformation.pokemon[foeInformation.currentSlot].currentIndex; } catch(e){}
        for (var i = 0; i < 6; i++) {
            if (i === activeIdx) continue;
            var b = { name:null, revealed:false, ko:false, hpPct:null };
            try {
                var ep = battle.data.team(battle.opp).poke(i);
                var ko = (ep.status === 31);
                b.ko = ko;
                var info = null;
                try { info = foeInformation.pokemon[foeInformation.findSlotFromIndex(i)]; } catch(e2){}
                if (info && info.pokeNum > 0) {
                    b.revealed = true;
                    b.name = sys.pokemon(info.pokeNum);
                    if (ko) b.hpPct = 0;
                    else if (ep.totalLife > 0) b.hpPct = boardPct(ep.life, ep.totalLife);
                    else { var pct0 = info.hpPercentageWhenLeave; b.hpPct = (pct0 > 0) ? Math.floor(pct0 * 100) : null; }
                } else if (ko) {
                    b.revealed = true;
                    b.name = sys.pokemon(ep.numRef);
                    b.hpPct = 0;
                }
            } catch(eb){}
            arr.push(b);
        }
    } catch(e){ print_s("[board] opp bench err: "+e); }
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
    } catch(e){ print_s("[board] hazards err: "+e); }
    return h;
}

// ---- full state ----
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

// ---- push (async webCall, fire-and-forget) ----
function boardPushNow(force){
    if (!boardEnabled) return;
    if (typeof battleEnd !== "undefined" && battleEnd) return;  // stop after battle end
    var now = (new Date()).getTime();
    if (force) boardForcePush = true;
    if (!boardForcePush && (now - boardLastPushMs) < boardMinIntervalMs) return;  // throttle BEFORE collect (save CPU)
    boardLastPushMs = now;
    boardForcePush = false;
    try {
        var state = collectBoardState();
        sys.webCall(boardUrl, " ", { state: JSON.stringify(state) });
    } catch(e){ print_s("[board] pushNow err: "+e); }
}

// ---- callback hook: wrap key callbacks to push after they run ----
// Runs the original callback first (AI logic untouched), then pushes state.
function boardHook(cb){
    function wrap(key, force, before){
        var orig = cb[key];
        if (typeof orig !== "function") return;
        cb[key] = function(){
            if (before) { try { before.apply(null, arguments); } catch(e){} }
            var r = orig.apply(this, arguments);
            try { boardPushNow(force); } catch(e){ print_s("[board] push err "+key+": "+e); }
            return r;
        };
    }
    wrap("onBeginTurn", true, function(turn){ boardCurrentTurn = turn; });
    wrap("onDamageDone", false);
    wrap("onSendOut", true);
    wrap("onSendBack", true);
    wrap("onKo", true);
    wrap("onMajorStatusChange", true);
    wrap("onStatusOver", true);
    wrap("onBattleEnd", true);
}
