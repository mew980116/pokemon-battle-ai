// =====================================================================
// DeepSeek bridge — auto-command + battlefield state injection — PO script
// Paste this WHOLE file into PO's battle script window.
//
// Chat commands (in a battle):
//   /ds on              -> enable auto-decide (DeepSeek picks attack/switch)
//   /ds off             -> disable auto-decide (play manually)
//   /ds switch          -> force a switch to first switchable slot (debug)
//   /deepseek [text]    -> dummy connectivity test (prints DeepSeek reply)
//
// Requires the local bridge running:  node deepseek-bridge/server.js
// =====================================================================

var useAI = true;
var useDeepSeek = false;    // 默认关闭，聊天 /ds on 开启自动出招
var battleEnd = false;
var DS_URL = "http://127.0.0.1:8090";
var dsTurn = 0;

// 招式数据库（可选，用于招式威力显示）
var moveDataObj = null;
try { moveDataObj = JSON.parse(sys.getFileContent("movedata.json")); }
catch (e) {}

// 属性编号 -> 名称（0-17）
var DS_TYPE_NAMES = ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel", "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"];

function dsTypeName(n) {
    if (n === undefined || n === null || n < 0 || n > 17) return null;
    return DS_TYPE_NAMES[n];
}

function dsWeatherName(w) {
    if (w === 1) return "hail";
    if (w === 2 || w === 6) return "rain";
    if (w === 3) return "sandstorm";
    if (w === 4 || w === 5) return "sun";
    return null;
}

function dsTerrainName(t) {
    if (t === 1) return "electric";
    if (t === 2) return "grassy";
    if (t === 3) return "misty";
    if (t === 4) return "psychic";
    return null;
}

function poke(spot) {
    if (spot !== battle.me && spot !== battle.opp) spot = battle.me;
    return battle.data.team(spot).poke(0);
}

function fpoke(spot) {
    if (spot !== battle.me && spot !== battle.opp) spot = battle.me;
    return battle.data.field.poke(spot);
}

function tpoke(ind) {
    if (ind < 0 || ind > 5) ind = 0;
    return battle.data.team(battle.me).poke(ind);
}

function dsMovePower(n) {
    try { if (moveDataObj && moveDataObj[n]) return moveDataObj[n].power; } catch (e) {}
    return 0;
}

function dsPrint(m) {
    print("[DEEPSEEK] " + m);
}

// 采集我方场上宝可梦
function dsCollectMyActive() {
    var o = { name: "?", level: 0, types: [], hp: 0, maxHp: 0, moves: [] };
    try {
        var tp = tpoke(0);
        var fp = fpoke(battle.me);
        o.name = sys.pokemon(tp.numRef);
        o.level = tp.level;
        o.hp = tp.life;
        o.maxHp = tp.totalLife;
        var t1 = dsTypeName(fp.type1());
        var t2 = dsTypeName(fp.type2());
        if (t1) o.types.push(t1);
        if (t2 && t2 !== t1) o.types.push(t2);
        for (var m = 0; m < 4; m++) {
            try {
                var mv = tp.move(m);
                if (mv && mv.num > 0) {
                    o.moves.push({ name: sys.move(mv.num), type: dsTypeName(sys.moveType(mv.num)), power: dsMovePower(mv.num), pp: mv.PP });
                }
            } catch (e2) {}
        }
    } catch (e) {}
    return o;
}

// 采集对手场上宝可梦（HP 只用百分比；已暴露招式）
function dsCollectOppActive() {
    var o = { name: "?", level: 0, types: [], hpPct: 0, moves: [] };
    try {
        var fp = fpoke(battle.opp);
        o.name = sys.pokemon(fp.pokemon.numRef);
        o.level = fp.pokemon.level;
        var l = fp.pokemon.life;
        var t = fp.pokemon.totalLife;
        o.hpPct = (t > 0) ? Math.floor(l / t * 100) : 0;
        var t1 = dsTypeName(fp.type1());
        var t2 = dsTypeName(fp.type2());
        if (t1) o.types.push(t1);
        if (t2 && t2 !== t1) o.types.push(t2);
        for (var m = 0; m < 4; m++) {
            try {
                var mv = fp.pokemon.move(m);
                if (mv && mv.num > 0) {
                    o.moves.push({ name: sys.move(mv.num), type: dsTypeName(sys.moveType(mv.num)), power: dsMovePower(mv.num) });
                }
            } catch (e2) {}
        }
    } catch (e) {}
    return o;
}

// 采集我方后备（可换）宝可梦
function dsCollectBench() {
    var arr = [];
    for (var i = 1; i < 6; i++) {
        try {
            var tp = tpoke(i);
            arr.push({ slot: i, name: sys.pokemon(tp.numRef), hp: tp.life, maxHp: tp.totalLife, ko: tp.isKoed() });
        } catch (e) {}
    }
    return arr;
}

// 组合完整战场状态
function dsCollectState() {
    var weather = null;
    var terrain = null;
    try { weather = dsWeatherName(battle.data.field.weather); } catch (e) {}
    try { terrain = dsTerrainName(battle.data.field.terrain); } catch (e) {}
    return {
        turn: dsTurn,
        weather: weather,
        terrain: terrain,
        me: dsCollectMyActive(),
        opp: dsCollectOppActive(),
        bench: dsCollectBench()
    };
}

// 执行一个战斗指令（支持 attack / switch）
function dsSendCommand(id, choice) {
    try {
        battle.battleCommand(id, choice);
        dsPrint("executed: type=" + choice.type + " attackSlot=" + choice.attackSlot + " pokeSlot=" + choice.pokeSlot);
    } catch (e) {
        dsPrint("execute error: " + e.message);
    }
}

// 采集可换人的槽位（1-5 中未 KO 的）
function dsGetSwitches() {
    var list = [];
    for (var i = 1; i < 6; i++) {
        try {
            if (!tpoke(i).isKoed()) list.push(i);
        } catch (e) {}
    }
    return list;
}

// 同步向本地代理请求一个战斗指令并执行（attack 或 switch）
function dsDecideAndAct() {
    var switches = dsGetSwitches();
    var state = JSON.stringify(dsCollectState());
    var u = DS_URL + "/choice?state=" + encodeURIComponent(state) + "&switches=" + encodeURIComponent(switches.join(","));
    try {
        var resp = sys.synchronousWebCall(u);
        resp = String(resp).replace(/^\s+|\s+$/g, "");
        dsPrint("choice raw => " + resp);
        var d = JSON.parse(resp);
        if (d.type === "switch") {
            var pokeSlot = parseInt(d.pokeSlot, 10);
            if (isNaN(pokeSlot) || switches.indexOf(pokeSlot) === -1) {
                dsPrint("invalid switch slot, fallback attack 0");
                dsSendCommand(battle.id, { slot: battle.me, type: "attack", attackSlot: 0 });
                return;
            }
            dsSendCommand(battle.id, { slot: battle.me, type: "switch", pokeSlot: pokeSlot });
            return;
        }
        var slot = parseInt(d.attackSlot, 10);
        if (isNaN(slot) || slot < 0 || slot > 3) slot = 0;
        dsSendCommand(battle.id, { slot: battle.me, type: "attack", attackSlot: slot });
    } catch (e) {
        dsPrint("decide error: " + e.message);
    }
}

// 同步往返测试（聊天/客户端上下文，已验证）
function dsSync(msg) {
    var u = DS_URL + "/decide?msg=" + encodeURIComponent(msg || "ping");
    try {
        var reply = sys.synchronousWebCall(u);
        dsPrint("DeepSeek reply => " + reply);
    } catch (e) {
        dsPrint("sync error: " + e.message);
    }
}

({
    onPlayerMessage: function (player, message) {
        if (player !== battle.me) return;
        if (message.indexOf("/ds on") === 0) {
            useDeepSeek = true;
            dsPrint("auto-decide ON (next choice will be picked by DeepSeek)");
            return;
        }
        if (message.indexOf("/ds off") === 0) {
            useDeepSeek = false;
            dsPrint("auto-decide OFF");
            return;
        }
        if (message.indexOf("/ds switch") === 0) {
            var switches = dsGetSwitches();
            if (switches.length === 0) {
                dsPrint("no switchable pokemon");
                return;
            }
            dsSendCommand(battle.id, { slot: battle.me, type: "switch", pokeSlot: switches[0] });
            return;
        }
        if (message.indexOf("/deepseek") === 0) {
            var rest = message.substring(9).replace(/^\s+|\s+$/g, "");
            dsSync(rest.length ? rest : "ping");
        }
    },
    onBeginTurn: function (turn) {
        dsTurn = turn;
    },
    onChoiceSelection: function (player) {
        if (player !== battle.me) return;
        if (!useAI || battleEnd || !useDeepSeek) return;
        dsDecideAndAct();
    },
    onMiss: function (spot) {},
    onAvoid: function (spot) {},
    onStatusDamage: function (spot, status) {},
    onKo: function (spot) {},
    onUseAttack: function (spot, attack) {},
    onSendBack: function (spot) {},
    onSendOut: function (spot, prevIndex) {},
    onItemMessage: function (spot, item, part, foe, berry, other) {},
    onMoveMessage: function (spot, move, part, type, foe, other, q) {},
    onAbilityMessage: function (spot, ab, part, type, foe, other) {},
    onTierNotification: function (tier) {},
    onClauseActivated: function (clause) {},
    onEffectiveness: function (spot, effectiveness) {},
    onAttackFailing: function (spot, silent) {},
    onBattleEnd: function (result, winner) { battleEnd = true; },
    onDamageDone: function (spot, damage) {},
    onOfferChoice: function (player, choice) {},
    onCriticalHit: function (spot) {},
    onChoiceCancellation: function (player) {},
    onDrawRequest: function (player) {},
    onChoiceCancelled: function (player) {},
    onMajorStatusChange: function (spot, status, multipleTurns, silent) {},
    onStatusOver: function (spot, status) {},
    onFlinch: function (spot) {},
    onReconnect: function (player) {}
});
