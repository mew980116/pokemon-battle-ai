// =====================================================================
// po-pokellmon/po-script.js — PO 侧脚本（移植 PokeLLMon 方案）
// 把本文件全文贴进 PO 的 battle script 窗口。
//
// 职责：采集战场状态（含历史回合/Status/招式 num/name/type）→ 调本地
//       po-pokellmon/server.js 的 /choice → 解析动作（招式名/宝可梦名）
//       → 名字映射回 slot → battle.battleCommand 执行。
//
// 依赖本地代理：node po-pokellmon/server.js（默认 127.0.0.1:8091）
//
// 聊天命令（战斗内）：
//   /llm on     -> 开启 LLM 决策（自动执行）
//   /llm off    -> 关闭（手动操作）
//   /llm shadow -> 影子模式：照发 DS 请求并记 log，但不执行 DS 指令，改由你手动操作（对比人 vs DS 决策）
// 自动开启：账号 id 转小写为 "mew's" 时自动开启，无需手动 /llm on；其他账号需手动开启。
// =====================================================================

var useAI = true;
var useLLM = false;               // 默认关闭，聊天 /llm on 开启
var battleEnd = false;
var PKLM_URL = "http://127.0.0.1:8091";
var PKLM_VERSION = "0.4.7";       // 脚本版本（改动时 bump，随日志记录）

// 自动开启：账号 id 转小写为 "mew's" 时自动开启 LLM 决策（其他账号手动 /llm on）
var pklmAccount = "";             // 我方账号名
var pklmLogEnabled = false;       // 是否写日志（仅 mew's 自动开）
function pklmAutoEnable() {
    try {
        pklmAccount = String(battle.data.team(battle.me).name);
        if (pklmAccount.toLowerCase() === "mew's") {
            if (!useLLM) {
                useLLM = true;
                print("[POKELLMON] auto-enabled (account: mew's)");
            }
            if (!pklmLogEnabled) {
                pklmLogEnabled = true;
                print("[POKELLMON] logging enabled");
            }
        }
    } catch (e) {}
}
pklmAutoEnable();

// 属性编号 -> 名称（0-17，与 PO 的 sys.type 对齐）
var PKLM_TYPE_NAMES = ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel", "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"];

// 历史回合记录（ICRL）：最近 N 回合文本
var pklmHistory = [];
var pklmFullHistory = [];          // 完整战报（不限长度，供 tool 的 get_battle_history 读取）
var pklmTurnLog = "";
var pklmCurrentTurn = 0;
var pklmOppMoves = {};           // 对手每只宝可梦（按 numRef 区分）已暴露招式 { numRef: [{name,type}] }
var pklmOppSeen = [];             // 对手已暴露的后备宝可梦名列表（含场上）
var pklmLastAttackSlot = -1;      // 上一回合使用的攻击槽位（-1 表示未攻击）
var pklmLockedSlot = -1;          // 当前被锁定的招式槽位（Choice 道具锁招）
var pklmBannedSlots = [];         // 本轮被 PO 拒绝的招式槽位（拒绝后 ban 掉重新决策）
var pklmMessages = [];            // 对战中发送的 message（评论，进日志）
var pklmFinalAttack = false;      // 保底标志：全 ban 后强制 attack，不再响应取消
var pklmShadowMode = false;       // 影子模式：照发 DS 请求并记 log，但不执行 DS 指令，改由用户手动操作

// 招式是否不可用（锁招 + 被 ban）
function pklmIsMoveDisabled(m) {
    if (m === pklmLockedSlot) return true;
    if (pklmBannedSlots.indexOf(m) !== -1) return true;
    return false;
}

// 是否还能换人（有未 KO 的后备宝可梦）
function pklmCanSwitch() {
    for (var i = 1; i < 6; i++) {
        try {
            if (!pklmTpoke(i).isKoed()) return true;
        } catch (e) {}
    }
    return false;
}

// 锁招检测：Choice 道具（4=Band/5=Scarf/6=Specs）下，上一回合用过 attack 则锁定该招式
function pklmCheckLock() {
    pklmLockedSlot = -1;
    try {
        var item = pklmPoke(battle.me).item;
        if (([4, 5, 6]).indexOf(item) !== -1 && pklmLastAttackSlot >= 0) {
            pklmLockedSlot = pklmLastAttackSlot;
        }
    } catch (e) {}
}

function pklmTypeName(n) {
    if (n === undefined || n === null || n < 0 || n > 17) return null;
    return PKLM_TYPE_NAMES[n];
}

function pklmStatusName(s) {
    if (s === undefined || s === null || s === 0) return null;
    // PO status 编号（对齐 board-standalone.js 的 boardStatusName + 主脚本 status===1 减速语义）
    if (s === 1) return "paralysis";   // 麻痹（速度减半）
    if (s === 2) return "sleep";
    if (s === 3) return "freeze";
    if (s === 4) return "burn";        // 烧伤（物理攻击减半）
    if (s === 5) return "poison";
    return null;
}

// 名字归一化：小写 + 去空格/连字符（中文名保持不变，英文名去分隔）
function pklmNorm(s) {
    return String(s).toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

function pklmPoke(spot) {
    if (spot !== battle.me && spot !== battle.opp) spot = battle.me;
    return battle.data.team(spot).poke(0);
}

function pklmFpoke(spot) {
    if (spot !== battle.me && spot !== battle.opp) spot = battle.me;
    return battle.data.field.poke(spot);
}

function pklmTpoke(ind) {
    if (ind < 0 || ind > 5) ind = 0;
    return battle.data.team(battle.me).poke(ind);
}

function pklmPrint(m) {
    print("[POKELLMON] " + m);
}

// 采集一个宝可梦的招式列表（我方含 num/pp/slot，对手只含 name/type）
// skipLocked：过滤被 Choice 锁定的招式（仅我方场上生效）
function pklmCollectMoves(tp, withNum, skipLocked) {
    var arr = [];
    for (var m = 0; m < 4; m++) {
        try {
            if (skipLocked && pklmIsMoveDisabled(m)) continue;
            var mv = tp.move(m);
            if (mv && mv.num > 0) {
                var o = {
                    slot: m,
                    name: sys.move(mv.num),
                    type: pklmTypeName(sys.moveType(mv.num))
                };
                if (withNum) {
                    o.num = mv.num;
                    o.pp = mv.PP;
                }
                arr.push(o);
            }
        } catch (e) {}
    }
    return arr;
}

// 采集场上宝可梦的能力等级变化（statBoost，非 0 才记录）
// 索引：1=Atk 2=Def 3=SpA 4=SpD 5=Spe 6=Acc 7=Eva
function pklmCollectBoosts(spot) {
    var b = [];
    try {
        var fp = pklmFpoke(spot);
        var names = ["Atk", "Def", "SpA", "SpD", "Spe", "Acc", "Eva"];
        for (var i = 0; i < 7; i++) {
            var v = fp.statBoost(i + 1);
            if (v) b.push(names[i] + (v > 0 ? "+" : "") + v);
        }
    } catch (e) {}
    return b;
}

// 采集我方场上宝可梦
function pklmCollectMyActive() {
    var o = { name: "?", types: [], hpPct: 0, status: null, moves: [] };
    try {
        var tp = pklmTpoke(0);
        var fp = pklmFpoke(battle.me);
        o.name = sys.pokemon(tp.numRef);
        var t1 = pklmTypeName(fp.type1());
        var t2 = pklmTypeName(fp.type2());
        if (t1) o.types.push(t1);
        if (t2 && t2 !== t1) o.types.push(t2);
        o.hpPct = (tp.totalLife > 0) ? Math.floor(tp.life / tp.totalLife * 100) : 0;
        o.status = pklmStatusName(tp.status);
        o.moves = pklmCollectMoves(tp, true, true);
        o.boosts = pklmCollectBoosts(battle.me);
    } catch (e) {}
    return o;
}

// 采集对手场上宝可梦
function pklmCollectOppActive() {
    var o = { name: "?", types: [], hpPct: 0, status: null, moves: [] };
    try {
        var fp = pklmFpoke(battle.opp);
        o.name = sys.pokemon(fp.pokemon.numRef);
        var t1 = pklmTypeName(fp.type1());
        var t2 = pklmTypeName(fp.type2());
        if (t1) o.types.push(t1);
        if (t2 && t2 !== t1) o.types.push(t2);
        var l = fp.pokemon.life;
        var t = fp.pokemon.totalLife;
        o.hpPct = (t > 0) ? Math.floor(l / t * 100) : 0;
        o.status = pklmStatusName(fp.pokemon.status);
        o.moves = pklmOppMoves[fp.pokemon.numRef] || [];   // 只取当前场上这只已暴露的招式
        o.boosts = pklmCollectBoosts(battle.opp);
    } catch (e) {}
    return o;
}

// 采集我方后备（可换）宝可梦
function pklmCollectBench() {
    var arr = [];
    for (var i = 1; i < 6; i++) {
        try {
            var tp = pklmTpoke(i);
            if (tp.isKoed()) continue;
            var o = {
                slot: i,
                name: sys.pokemon(tp.numRef),
                types: [],
                hpPct: (tp.totalLife > 0) ? Math.floor(tp.life / tp.totalLife * 100) : 0,
                status: pklmStatusName(tp.status),
                moves: pklmCollectMoves(tp, false, false)
            };
            var f = pklmFpoke(battle.me); // 场上类型用 field 拿，后备用 sys.pokeType1/2
            var bt1 = pklmTypeName(sys.pokeType1(tp.numRef));
            var bt2 = pklmTypeName(sys.pokeType2(tp.numRef));
            if (bt1) o.types.push(bt1);
            if (bt2 && bt2 !== bt1) o.types.push(bt2);
            arr.push(o);
        } catch (e) {}
    }
    return arr;
}

// 采集我方完整队伍（6 只，含 KO，用于日志）
function pklmCollectMyTeam() {
    var arr = [];
    for (var i = 0; i < 6; i++) {
        try {
            var tp = pklmTpoke(i);
            arr.push({
                slot: i,
                name: sys.pokemon(tp.numRef),
                hpPct: (tp.totalLife > 0) ? Math.floor(tp.life / tp.totalLife * 100) : 0,
                ko: tp.isKoed(),
                status: pklmStatusName(tp.status)
            });
        } catch (e) {}
    }
    return arr;
}

// 组合完整战场状态
function pklmCollectState() {
    var oppRemaining = 0;
    try {
        for (var i = 0; i < 6; i++) {
            var op = battle.data.team(battle.opp).poke(i);
            // 31=KO（与主脚本 getPokeCount 对齐）。注意：对手未露面的宝可梦 numRef 可能为 0，
            // 但 status 仍为 0（存活），因此不能靠 numRef 判断存在性，只能用 status !== 31。
            if (op && op.status !== 31) oppRemaining++;
        }
    } catch (e) {}

    // 历史包含「当前回合已发生的事件」，避免决策时看到的历史晚一回合
    // （如换人后本回合已用过的招式尚未 push 进 pklmHistory）
    var hist = pklmHistory.slice();
    if (pklmTurnLog) {
        var prefix = "Turn " + pklmCurrentTurn + ": ";
        if (pklmTurnLog.length > prefix.length) hist.push(pklmTurnLog);
    }

    // 完整战报（含当前回合），供 tool 的 get_battle_history 按需读取
    var fullHist = pklmFullHistory.slice();
    if (pklmTurnLog) {
        var prefix2 = "Turn " + pklmCurrentTurn + ": ";
        if (pklmTurnLog.length > prefix2.length) fullHist.push(pklmTurnLog);
    }

    return {
        account: pklmAccount,
        log: pklmLogEnabled,
        battleId: battle.id,
        scriptVersion: PKLM_VERSION,
        turn: pklmCurrentTurn,
        shadow: pklmShadowMode,
        history: hist,
        fullHistory: fullHist,
        messages: pklmMessages.slice(),
        oppRemaining: oppRemaining,
        opp: pklmCollectOppActive(),
        oppSeen: pklmOppSeen.slice(),
        me: pklmCollectMyActive(),
        myTeam: pklmCollectMyTeam(),
        bench: pklmCollectBench()
    };
}

// 执行战斗指令
function pklmSendCommand(choice) {
    try {
        battle.battleCommand(battle.id, choice);
        pklmPrint("executed: type=" + choice.type + " attackSlot=" + choice.attackSlot + " pokeSlot=" + choice.pokeSlot);
    } catch (e) {
        pklmPrint("execute error: " + e.message);
    }
}

// 兜底：用第一个招式
function pklmFallbackAttack() {
    pklmSendCommand({ slot: battle.me, type: "attack", attackSlot: 0 });
}

// 主决策：采集状态 -> 调 /choice -> server.js 返回 slot 模式 -> 直接执行
function pklmDecideAndAct() {
    pklmCheckLock();   // 先检测锁招（Choice 道具）
    var state = pklmCollectState();
    var u = PKLM_URL + "/choice?state=" + encodeURIComponent(JSON.stringify(state));
    try {
        var resp = sys.synchronousWebCall(u);
        resp = String(resp).replace(/^\s+|\s+$/g, "");
        pklmPrint("raw => " + resp);
        var d = JSON.parse(resp);
        // fallback 告警：DS 返回无法解析（重试后仍失败），PO 界面可见
        if (d.fallback) {
            pklmPrint("!! DS FALLBACK (reason=" + (d.reason || "?") + ") 决策质量告警");
        }
        // 影子模式：DS 决策仅记录不执行，交回用户手动操作（用于对比人 vs DS）
        if (pklmShadowMode) {
            var hint = (d.type === "switch") ? ("switch pokeSlot=" + d.pokeSlot) : ("attack attackSlot=" + d.attackSlot);
            pklmPrint("SHADOW (not executed): DS => " + hint);
            return;
        }
        if (d.type === "switch") {
            var ps = parseInt(d.pokeSlot, 10);
            if (ps >= 1 && ps <= 5) {
                pklmSendCommand({ slot: battle.me, type: "switch", pokeSlot: ps });
                pklmLastAttackSlot = -1;   // 换人后重置锁招
            } else {
                pklmPrint("invalid pokeSlot, fallback attack");
                pklmFallbackAttack();
            }
        } else {
            var ms = parseInt(d.attackSlot, 10);
            if (isNaN(ms) || ms < 0 || ms > 3) ms = 0;
            pklmSendCommand({ slot: battle.me, type: "attack", attackSlot: ms });
            pklmLastAttackSlot = ms;   // 记录上一回合攻击槽位（用于下回合锁招检测）
        }
    } catch (e) {
        pklmPrint("decide error: " + e.message);
        if (!pklmShadowMode) pklmFallbackAttack();   // 影子模式不兜底执行，交回用户手动
    }
}

// 历史回合记录辅助
function pklmPushTurn() {
    if (pklmTurnLog) {
        pklmHistory.push(pklmTurnLog);
        if (pklmHistory.length > 5) pklmHistory.shift();
        pklmFullHistory.push(pklmTurnLog);   // 完整战报，不截断（供 get_battle_history tool）
    }
    pklmTurnLog = "";
}

function pklmSpotLabel(spot) {
    return spot === battle.me ? "You" : "opposing";
}

({
    onPlayerMessage: function (player, message) {
        if (player !== battle.me) return;
        // 记录 message（评论进日志）
        try {
            pklmMessages.push({ turn: pklmCurrentTurn, msg: message });
        } catch (e) {}
        if (message.indexOf("/llm on") === 0) {
            useLLM = true;
            pklmShadowMode = false;
            pklmPrint("LLM decision ON");
            return;
        }
        if (message.indexOf("/llm off") === 0) {
            useLLM = false;
            pklmShadowMode = false;
            pklmPrint("LLM decision OFF");
            return;
        }
        if (message.indexOf("/llm shadow") === 0) {
            useLLM = true;
            pklmShadowMode = true;
            pklmPrint("SHADOW mode ON: DS 决策仅记录不执行，请手动操作对战");
            return;
        }
    },
    onBeginTurn: function (turn) {
        pklmCurrentTurn = turn;
        pklmBannedSlots = [];        // 新回合清空 ban 列表
        pklmFinalAttack = false;     // 新回合重置保底标志
        pklmPushTurn();
        pklmTurnLog = "Turn " + turn + ": ";
    },
    onUseAttack: function (spot, attack) {
        try {
            pklmTurnLog += pklmSpotLabel(spot) + " used " + sys.move(attack) + ". ";
            if (spot === battle.opp) {
                var mv = { name: sys.move(attack), type: pklmTypeName(sys.moveType(attack)) };
                // 记到「当前场上这只」名下（按 numRef 区分），换人后招式不串
                var num = pklmFpoke(battle.opp).pokemon.numRef;
                var list = pklmOppMoves[num] || [];
                var dup = false;
                for (var i = 0; i < list.length; i++) {
                    if (list[i].name === mv.name) { dup = true; break; }
                }
                if (!dup) list.push(mv);
                pklmOppMoves[num] = list;
            }
        } catch (e) {}
    },
    onDamageDone: function (spot, damage) {
        try {
            // 对手 damage 是血量百分比，我方是实际 HP（与主脚本 onDamageDone 语义一致）
            if (spot === battle.opp) {
                pklmTurnLog += "opposing lost " + damage + "%. ";
            } else {
                pklmTurnLog += "You lost " + damage + " HP. ";
            }
        } catch (e) {}
    },
    onKo: function (spot) {
        try {
            pklmTurnLog += pklmSpotLabel(spot) + "'s pokemon fainted. ";
        } catch (e) {}
    },
    onSendOut: function (spot, prevIndex) {
        try {
            var nm = sys.pokemon(pklmFpoke(spot).pokemon.numRef);
            pklmTurnLog += pklmSpotLabel(spot) + " sent out " + nm + ". ";
            if (spot === battle.opp) {
                var seen = false;
                for (var i = 0; i < pklmOppSeen.length; i++) {
                    if (pklmOppSeen[i] === nm) { seen = true; break; }
                }
                if (!seen) pklmOppSeen.push(nm);
            }
        } catch (e) {}
    },
    onChoiceSelection: function (player) {
        if (player !== battle.me) return;
        if (!useAI || battleEnd || !useLLM) return;
        pklmDecideAndAct();
    },
    onBattleEnd: function (result, winner) { battleEnd = true; },

    // 其余回调保留空实现（保持 28 个钩子完整，避免 PO 报错）
    onMiss: function (spot) {},
    onAvoid: function (spot) {},
    onStatusDamage: function (spot, status) {},
    onSendBack: function (spot) {},
    onItemMessage: function (spot, item, part, foe, berry, other) {},
    onMoveMessage: function (spot, move, part, type, foe, other, q) {},
    onAbilityMessage: function (spot, ab, part, type, foe, other) {},
    onTierNotification: function (tier) {
        pklmAutoEnable();
    },
    onClauseActivated: function (clause) {},
    onEffectiveness: function (spot, effectiveness) {},
    onAttackFailing: function (spot, silent) {},
    onOfferChoice: function (player, choice) {},
    onCriticalHit: function (spot) {},
    onChoiceCancellation: function (player) {
        if (player !== battle.me) return;
        if (battleEnd || !useLLM) return;
        if (pklmFinalAttack) return;   // 已保底过，不再响应取消
        // 指令被 PO 拒绝：ban 掉刚发的招式槽位，重新召唤 DS 决策
        if (pklmLastAttackSlot >= 0 && pklmBannedSlots.indexOf(pklmLastAttackSlot) === -1) {
            pklmBannedSlots.push(pklmLastAttackSlot);
            pklmPrint("slot " + pklmLastAttackSlot + " rejected, banned, re-decide");
        } else {
            pklmPrint("choice cancelled, re-decide (no slot to ban)");
        }
        // 4 招式全 ban 且无法换人 -> 只能用挣扎 -> 点攻击按钮（主脚本方式）
        if (pklmBannedSlots.length >= 4 && !pklmCanSwitch()) {
            pklmFinalAttack = true;
            pklmPrint("all moves banned and no switch, force attackButton (struggle)");
            battle.attackButton();
            return;
        }
        pklmDecideAndAct();
    },
    onDrawRequest: function (player) {},
    onChoiceCancelled: function (player) {},
    onMajorStatusChange: function (spot, status, multipleTurns, silent) {},
    onStatusOver: function (spot, status) {},
    onFlinch: function (spot) {},
    onReconnect: function (player) {}
});
