// =====================================================================
// po-pokellmon/probe-weather.js — 天气扣血采集探针（临时脚本，测完可删）
//
// 目的：查清 PO 在「天气回合末伤害」（沙暴/冰雹等）时到底触发什么，以及能否直接读到 HP 变化。
// 背景：battle71 里 LLM 用「沙暴回合没看到掉血」推断对手是魔法守护（并排除天然），
//      但我们的战报**根本不记录天气伤害**（我方超能系宝可梦在沙暴下同样没有掉血行）。
//
// 用法：
//   1. 把本文件全文贴进 PO 的 battle script 窗口（**替换** po-script.js，测完再贴回去），再开一局
//   !! 关键（首次实测踩坑）：PO 取「脚本求值的**完成值**」当回调表 —— 回调必须写成
//      最后一条**裸对象字面量** `({ onXxx: function () {...}, ... });`（本文件结尾就是这个形状）。
//      写成 `var script = {...}` 或末尾再跟别的语句 → 完成值是 undefined：顶层代码照跑
//      （print 有输出、不报错），但**一个回调都不会绑定**（整局没有半条 [PROBE] onXxx 行）。
//   2. 找一局会出现**沙暴/冰雹/晴天/雨天**的对战（带 Sand Stream / Snow Warning / 沙暴招式都行）
//   3. 至少打到天气生效后的 2-3 个回合末，然后把 PO 窗口里所有 [PROBE] 行贴回来
//   4. 关注点：回合末有没有出现任何 onXXX 行；以及同一只宝可梦在两个 onBeginTurn / onOfferChoice
//      之间的 life 差值（dump 里直接打 `Δ-21`）是否等于「招式伤害 ± 剩饭」（差出来的那一份就是天气伤害）
//   5. 现场排查用（聊天框里发）：`/probe` 立刻 dump 一次；`/eval <表达式>` 现场求值，例如
//      /eval battle.data.team(battle.opp).poke(0).item   → 对手道具（PO 客户端是否直接可见）
//      /eval battle.data.field.zone(battle.opp,0)       → 对手场地陷阱
//
// 自检：贴好后开一局，只要看到 [PROBE #n] === onOfferChoice (heartbeat) === 就说明绑定成功。
// 注意：每行都带自增序号 #n —— PO 的文本控件会折叠「连续完全相同」的行（复制粘贴时最容易丢重复行），
//       有了序号每行都唯一，既不会丢、也能数出回调真实触发了几次。
// =====================================================================

// 每条都带自增序号：PO 的文本控件会把**连续完全相同**的行折叠（粘贴时尤其容易丢），
// 加上 #N 后每行都唯一 → 不会丢，也能数出回调真实触发了几次。
var pProbeSeq = 0;
function pProbe() {
    var a = [];
    for (var i = 0; i < arguments.length; i++) a.push(String(arguments[i]));
    pProbeSeq++;
    print('[PROBE #' + pProbeSeq + '] ' + a.join(' '));
}

function pProbeSpot(spot) {
    try { return (spot === battle.me) ? 'ME' : ((spot === battle.opp) ? 'OPP' : '?'); } catch (e) { return '?'; }
}

function pklmSafe(fn, v) {
    try { var r = fn(v); return (r === undefined || r === null || r === '') ? ('#' + v) : r; } catch (e) { return 'ERR'; }
}

// 单只：HP + 状态 + 道具 + 特性（道具/特性都 try/catch —— 用来确认 PO 客户端能不能直接读到对手的道具/特性）
function pProbePoke(tag, i, tp) {
    var s = tag + i + '(' + sys.pokemon(tp.numRef) + ')=' + tp.life + '/' + tp.totalLife;
    try { s += ' st=' + tp.status; } catch (e) {}
    try { s += ' item=' + pklmSafe(sys.item, tp.item); } catch (e) {}
    try { s += ' ab=' + pklmSafe(sys.ability, tp.ability); } catch (e) {}
    return s;
}

// 上次 dump 的 HP 快照（用于打印回合间 Δ —— 天气扣血若没有回调，就只能靠这个差值看出来）
var pProbePrev = {};

// 打印天气/场地 + 双方全队 HP/状态/道具/特性 + 相对上次 dump 的 Δ（含后备）
function pProbeDump(tag) {
    var out = tag + ' weather=' + battle.data.field.weather + ' terrain=' + battle.data.field.terrain;
    var sides = [['ME', battle.me], ['OPP', battle.opp]];
    for (var s = 0; s < sides.length; s++) {
        for (var i = 0; i < 6; i++) {
            try {
                var tp = battle.data.team(sides[s][1]).poke(i);
                var key = sides[s][0] + i;
                var str = pProbePoke(sides[s][0], i, tp);
                var prev = pProbePrev[key];
                if (prev !== undefined && prev !== tp.life) str += ' Δ' + (tp.life - prev);
                pProbePrev[key] = tp.life;
                out += ' | ' + str;
            } catch (e) {}
        }
    }
    pProbe(out);
}

print('[PROBE] installed — 开一局有天气的对战（沙暴/冰雹最好），把 [PROBE] 行贴回来');

// !! 下面这条裸对象字面量必须是本文件的**最后一条语句**：PO 取它的值当回调表。
({
    // 交互命令（在 PO 聊天框里发）：/probe 立刻 dump 一次；/eval <表达式> 现场求值（如
    //   /eval battle.data.team(battle.opp).poke(0).item   或   /eval battle.data.field.zone(battle.opp,0)
    onPlayerMessage: function (player, message) {
        try {
            if (player !== battle.me) return;
            if (message.indexOf('/probe') === 0) { pProbe('=== manual dump ==='); pProbeDump('MANUAL'); return; }
            if (message.indexOf('/eval ') === 0) {
                try { pProbe('eval => ' + eval(message.substring(6))); } catch (e) { pProbe('eval error: ' + e); }
                return;
            }
        } catch (e) { pProbe('onPlayerMessage error: ' + e); }
    },
    // 每回合必然触发的「心跳」：PO 每次要我方决策都会调它 —— 只要看到这条，就说明探针绑定成功。
    // 它同时也是最有用的 HP 快照点：决策时 = 上回合结算完后，正好用来算回合间的 HP 差。
    onOfferChoice: function (player, choice) { pProbe('=== onOfferChoice (heartbeat) ==='); pProbeDump('CHOICE'); },
    onChoiceSelection: function (player) { pProbe('=== onChoiceSelection (heartbeat) ==='); },
    onBeginTurn: function (turn) { pProbe('=== onBeginTurn turn=' + turn + ' ==='); pProbeDump('T' + turn); },
    onEndTurn: function () { pProbe('=== onEndTurn ==='); pProbeDump('END'); },
    onTurnEnd: function () { pProbe('=== onTurnEnd ==='); pProbeDump('TURNEND'); },

    // 与间接伤害可能相关的回调
    onStatusDamage: function (spot, status) { pProbe('onStatusDamage spot=' + pProbeSpot(spot) + ' status=' + status); },
    onDamageDone: function (spot, damage) { pProbe('onDamageDone spot=' + pProbeSpot(spot) + ' dmg=' + damage); },
    onKo: function (spot) { pProbe('onKo spot=' + pProbeSpot(spot)); },
    onMajorStatusChange: function (spot, status, multipleTurns, silent) { pProbe('onMajorStatusChange spot=' + pProbeSpot(spot) + ' status=' + status); },
    onStatusOver: function (spot, status) { pProbe('onStatusOver spot=' + pProbeSpot(spot) + ' status=' + status); },

    // 消息类（天气伤害若有文案，多半从这里出）
    onMoveMessage: function (spot, move, part, type, foe, other, q) { pProbe('onMoveMessage spot=' + pProbeSpot(spot) + ' move=' + move + ' part=' + part + ' type=' + type + ' foe=' + foe + ' other=' + other); },
    onAbilityMessage: function (spot, ab, part, type, foe, other) { pProbe('onAbilityMessage spot=' + pProbeSpot(spot) + ' ab=' + ab + ' part=' + part + ' type=' + type + ' foe=' + foe + ' other=' + other); },
    onItemMessage: function (spot, item, part, foe, berry, other) { pProbe('onItemMessage spot=' + pProbeSpot(spot) + ' item=' + item + ' part=' + part + ' berry=' + berry + ' other=' + other); },

    // 其余回调一律打印（用于确认「天气回合末到底有没有任何回调触发」）
    onUseAttack: function (spot, attack) { pProbe('onUseAttack spot=' + pProbeSpot(spot) + ' attack=' + attack); },
    onSendOut: function (spot, prevIndex) { pProbe('onSendOut spot=' + pProbeSpot(spot) + ' prev=' + prevIndex); },
    onSendBack: function (spot) { pProbe('onSendBack spot=' + pProbeSpot(spot)); },
    onEffectiveness: function (spot, effectiveness) { pProbe('onEffectiveness spot=' + pProbeSpot(spot) + ' eff=' + effectiveness); },
    onAttackFailing: function (spot, silent) { pProbe('onAttackFailing spot=' + pProbeSpot(spot) + ' silent=' + silent); },
    onCriticalHit: function (spot) { pProbe('onCriticalHit spot=' + pProbeSpot(spot)); },
    onMiss: function (spot) { pProbe('onMiss spot=' + pProbeSpot(spot)); },
    onAvoid: function (spot) { pProbe('onAvoid spot=' + pProbeSpot(spot)); },
    onFlinch: function (spot) { pProbe('onFlinch spot=' + pProbeSpot(spot)); },
    onClauseActivated: function (clause) { pProbe('onClauseActivated clause=' + clause); },
    onTierNotification: function (tier) { pProbe('onTierNotification tier=' + tier); },
    onBattleEnd: function (result, winner) { pProbe('onBattleEnd result=' + result + ' winner=' + winner); pProbeDump('BATTLEEND'); }
});
