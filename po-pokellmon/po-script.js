// =====================================================================
// po-pokellmon/po-script.js — PO 侧脚本（移植 PokeLLMon 方案）
// 把本文件全文贴进 PO 的 battle script 窗口。
//
// 职责：采集战场状态（含历史回合/Status/招式 num/name/type）→ 调本地
//       po-pokellmon/server.js 的 /choice → 解析动作（招式名/宝可梦名）
//       → 名字映射回 slot → battle.battleCommand 执行。
//
// 依赖本地代理：node po-pokellmon-tool/server.js（tool 版，默认 127.0.0.1:8092）
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
var PKLM_URL = "http://127.0.0.1:8092";
var PKLM_VERSION = "0.5.20";       // 脚本版本（改动时 bump，随日志记录）
var pklmLastWebFailTime = 0;       // 上次 webCall 失败时间戳（ms），用于断线时节流重发
var pklmSilent = false;            // 静默模式：清分少女等无人值守 BOT 账号不向 PO 窗口 print 任何脚本输出

// 自动开启：账号 id 转小写为 "mew's" 时自动开启 LLM 决策（其他账号手动 /llm on）
var pklmAccount = "";             // 我方账号名
var pklmLogEnabled = false;       // 是否写日志（仅 mew's 自动开）
function pklmAutoEnable() {
    try {
        pklmAccount = String(battle.data.team(battle.me).name);
        if (pklmAccount.toLowerCase() === "mew's") {
            if (!useLLM) {
                useLLM = true;
                pklmShadowMode = true;   // mew's 默认影子模式：只记 log 不执行 DS 指令；需执行时手动 /llm on
                pklmCbLog = true;        // mew's 默认开回调探针（调试专用账号）
                pklmPrint("auto-enabled (account: mew's, shadow mode + callback log)");
            }
            if (!pklmLogEnabled) {
                pklmLogEnabled = true;
                pklmPrint("logging enabled");
            }
        } else if (pklmAccount === "「木偶」析构万理的发条公主") {
            // 正式执行账号：自动 LLM 决策（非 shadow，不开探针）
            if (!useLLM) {
                useLLM = true;
                pklmShadowMode = false;
                pklmPrint("auto-enabled (account: 「木偶」析构万理的发条公主)");
            }
            if (!pklmLogEnabled) {
                pklmLogEnabled = true;
                pklmPrint("logging enabled");
            }
        } else if (pklmAccount.toLowerCase() === "[lv0.吧服bot]清分少女") {
            // 服务器无人值守 BOT 账号：自动 LLM 决策（非 shadow）+ 静默（无输出、不写日志）
            pklmSilent = true;
            if (!useLLM) {
                useLLM = true;
                pklmShadowMode = false;
            }
        }
    } catch (e) {}
}

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
var pklmLastMove = {};            // { spot: 最后使用的招式名 }，供消息解码 %m 占位符
var pklmMsgTables = { move: null, item: null, ability: null, berry: null };  // 消息表懒加载缓存
var pklmCbLog = false;            // 回调探针：开启后 print 各回调原始参数（/llm cb 切换，调试观察用）

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
    if (s === 6) return "confusion";   // 混乱（回调 onStatusDamage/onMajorStatusChange 用到）
    return null;
}

// 名字归一化：小写 + 去空格/连字符（中文名保持不变，英文名去分隔）
function pklmNorm(s) {
    return String(s).toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}

// ==== 战报消息解码（PO 侧读 *_message.txt 把「消息编号」还原成文本）====
// 回调 onMoveMessage/onItemMessage/onAbilityMessage 的 move/item/berry/ab 是「消息编号」，
// 不是真实编号。此处读 PO 根目录下的消息表文件（与 movedata.json 同级）解码。
// 部署：把 po-data/moves/move_message.txt、po-data/items/item_messages.txt、
//       po-data/items/berry_messages.txt、po-data/abilities/ability_messages.txt
//       复制到 PO 根目录；缺文件时相关回调静默降级为不产生文本。
var PKLM_STAT_NAMES = [null, "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed", "Accuracy", "Evasion"];

// 解析消息表：每行「编号 文本」，文本用 | 分隔多个变体（part 参数选第几个变体）
function pklmParseMsgTable(fileName) {
    var map = {};
    try {
        var raw = sys.getFileContent(fileName);
        if (!raw) return map;
        var lines = String(raw).split(/\r\n|\r|\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\uFEFF/, '');
            var sp = -1;
            for (var j = 0; j < line.length; j++) {
                var c = line.charAt(j);
                if (c === ' ' || c === '\t') { sp = j; break; }
            }
            if (sp <= 0) continue;
            var num = parseInt(line.substring(0, sp), 10);
            if (isNaN(num)) continue;
            map[num] = line.substring(sp + 1).replace(/^\s+/, '').split('|');
        }
    } catch (e) {}
    return map;
}

// 懒加载消息表（首次使用时读文件并缓存；读不到则缓存空表，避免每回合重试）
function pklmGetMsgTable(kind, fileName) {
    if (pklmMsgTables[kind] !== null) return pklmMsgTables[kind];
    pklmMsgTables[kind] = pklmParseMsgTable(fileName);
    return pklmMsgTables[kind];
}

// 战报消息表文件清单（需部署到 PO 根目录，与 movedata.json 同级）
var PKLM_MSG_FILES = [
    { kind: 'move', file: 'move_message.txt' },
    { kind: 'item', file: 'item_messages.txt' },
    { kind: 'berry', file: 'berry_messages.txt' },
    { kind: 'ability', file: 'ability_messages.txt' }
];

// 对战启动时扫描消息表文件：预热缓存 + 缺失告警（缺失则相关回调静默降级）
function pklmCheckMsgFiles() {
    var missing = [];
    for (var i = 0; i < PKLM_MSG_FILES.length; i++) {
        var f = PKLM_MSG_FILES[i];
        var map = pklmGetMsgTable(f.kind, f.file);
        var has = false;
        for (var k in map) { has = true; break; }
        if (!has) missing.push(f.file);
    }
    if (missing.length) {
        pklmPrint("WARN 缺战报消息表文件，相关效果无法解码（静默降级）: " + missing.join(", "));
        pklmPrint("请把这几个 *_message.txt 复制到 PO 根目录（与 movedata.json 同级）");
    } else {
        pklmPrint("战报消息表已就绪（" + PKLM_MSG_FILES.length + " 个）");
    }
}

// 渲染一条消息：查表 -> 选变体 -> 替换占位符
// ctx: { s,f,m,i,t,a,q,st,p,ts,tf }
function pklmRenderMsg(kind, fileName, msgNum, part, ctx) {
    if (msgNum === undefined || msgNum === null || msgNum === 0) return null;
    var map = pklmGetMsgTable(kind, fileName);
    var variants = map[msgNum];
    if (!variants || !variants.length) return null;
    if (part === undefined || part === null || part < 0 || part >= variants.length) part = 0;
    var t = variants[part];
    if (!t) return null;
    // 先替换三字符占位符（%st/%ts/%tf），避免被 %s/%t/%f 误伤
    var order = [['%st', ctx.st], ['%ts', ctx.ts], ['%tf', ctx.tf],
                 ['%s', ctx.s], ['%f', ctx.f], ['%m', ctx.m], ['%i', ctx.i],
                 ['%t', ctx.t], ['%a', ctx.a], ['%q', ctx.q], ['%p', ctx.p]];
    for (var k = 0; k < order.length; k++) {
        var val = order[k][1];
        if (val === undefined || val === null) val = '';
        t = t.split(order[k][0]).join(val);
    }
    return t;
}

function pklmOtherSpot(spot) {
    return spot === battle.me ? battle.opp : battle.me;
}

function pklmActiveName(spot) {
    try { return sys.pokemon(pklmFpoke(spot).pokemon.numRef); } catch (e) { return "?"; }
}

function pklmItemName(n) {
    if (!n) return '';
    try { return sys.item(n); } catch (e) { return ''; }
}

function pklmAbilityName(n) {
    if (!n) return '';
    try { return sys.ability(n); } catch (e) { return ''; }
}

// 构建消息替换上下文（%i/%a 用当前宝可梦持有的道具/特性，未知时为空——尽力而为）
function pklmMsgCtx(spot, type, other, q, abilityId) {
    return {
        s: pklmActiveName(spot),
        f: pklmActiveName(pklmOtherSpot(spot)),
        m: pklmLastMove[spot] || '',
        i: pklmItemName(pklmPoke(spot).item),
        t: pklmTypeName(type) || '',
        a: pklmAbilityName((abilityId !== undefined && abilityId !== null && abilityId !== 0) ? abilityId : pklmPoke(spot).ability),
        q: (q !== undefined && q !== null && q !== 0) ? String(q) : '',
        st: PKLM_STAT_NAMES[other] || '',
        p: pklmActiveName(spot),
        ts: pklmActiveName(spot),
        tf: pklmActiveName(pklmOtherSpot(spot))
    };
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
    if (!pklmSilent) print("[POKELLMON] " + m);
}

// 回调探针：pklmCbLog 开启时打印回调原始参数（观察实际触发哪些回调）
function pklmCb(name, args) {
    if (pklmCbLog && !pklmSilent) print("[CB] " + name + " " + args);
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
        o.ability = pklmAbilityName(tp.ability);
        o.item = pklmItemName(tp.item);
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
        o.fainted = (fp.pokemon.status === 31);   // 对手场上是否濒死（供 prompt 提示「会换人」）
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
                moves: pklmCollectMoves(tp, false, false),
                ability: pklmAbilityName(tp.ability),
                item: pklmItemName(tp.item)
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

// 采集我方全队 6 只的种族相关原始数据（等级/努力/个体/性格），供 get_my_stats tool 算无加成六维
// 索引：0=HP 1=Atk 2=Def 3=SpA 4=SpD 5=Spe（与主脚本 calcBaseStats 一致）
function pklmCollectMyStats() {
    var arr = [];
    for (var i = 0; i < 6; i++) {
        try {
            var tp = pklmTpoke(i);
            var ev = [], iv = [];
            for (var s = 0; s < 6; s++) {
                ev.push(tp.ev(s));
                iv.push(tp.iv(s));
            }
            arr.push({
                slot: i,
                name: sys.pokemon(tp.numRef),
                numRef: tp.numRef,
                level: tp.level,
                ev: ev,
                iv: iv,
                nature: tp.nature
            });
        } catch (e) {}
    }
    return arr;
}

// 采集对手全队 6 只的槽位情况（含场上+后备）：亮相名 / HP% / 状态 / KO / 未亮相
// 供 server 端 prompt 展示对手 bench 详情（替代「Opponent has N pokemons left」）
function pklmCollectOppTeam() {
    var arr = [];
    for (var i = 0; i < 6; i++) {
        var o = { name: null, revealed: false, ko: false, hpPct: null, status: null };
        try {
            var ep = battle.data.team(battle.opp).poke(i);
            o.ko = (ep.status === 31);
            if (ep.numRef && ep.numRef > 0) {
                o.revealed = true;
                o.name = sys.pokemon(ep.numRef);
                if (!o.ko && ep.totalLife > 0) {
                    o.hpPct = Math.floor(ep.life / ep.totalLife * 100);
                    o.status = pklmStatusName(ep.status);
                }
            }
        } catch (e) {}
        arr.push(o);
    }
    return arr;
}

// 组合完整战场状态
// 天气/场地取值 -> 英文名（与主脚本 battle.data.field.weather/terrain 编码对齐）
function pklmWeatherName(n) {
    switch (n) {
        case 1: return 'Hail';
        case 2: return 'Rain';
        case 3: return 'Sandstorm';
        case 4: return 'Sun';
        case 5: return 'Harsh Sunlight';
        case 6: return 'Heavy Rain';
        default: return '';
    }
}
function pklmTerrainName(n) {
    switch (n) {
        case 1: return 'Electric Terrain';
        case 2: return 'Grassy Terrain';
        case 3: return 'Misty Terrain';
        case 4: return 'Psychic Terrain';
        default: return '';
    }
}
// 采集某方场地的入场陷阱（隐形岩/地钉/毒钉/虫网），返回文本数组
function pklmCollectHazards(spot) {
    var parts = [];
    try {
        var z = battle.data.field.zone(spot);
        if (z.stealthRocks) parts.push('Stealth Rock');
        if (z.spikesLevel > 0) parts.push('Spikes x' + z.spikesLevel);
        if (z.toxicSpikesLevel > 0) parts.push('Toxic Spikes x' + z.toxicSpikesLevel);
        if (z.stickyWeb) parts.push('Sticky Web');
    } catch (e) {}
    return parts;
}

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
        weather: pklmWeatherName(battle.data.field.weather) || null,
        terrain: pklmTerrainName(battle.data.field.terrain) || null,
        myHazards: pklmCollectHazards(battle.me),
        oppHazards: pklmCollectHazards(battle.opp),
        opp: pklmCollectOppActive(),
        oppTeam: pklmCollectOppTeam(),
        oppSeen: pklmOppSeen.slice(),
        me: pklmCollectMyActive(),
        myTeam: pklmCollectMyTeam(),
        myStats: pklmCollectMyStats(),
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

    // 断线节流：上次 webCall 失败后 2 秒内不再重发（避免断线时 onChoiceCancellation 快速循环刷屏 / 触发 antidos）
    var now = new Date().getTime();
    if (pklmLastWebFailTime > 0 && (now - pklmLastWebFailTime) < 2000) {
        return;
    }

    var state = pklmCollectState();
    var u = PKLM_URL + "/choice?state=" + encodeURIComponent(JSON.stringify(state));
    try {
        var resp = sys.synchronousWebCall(u);
        resp = String(resp).replace(/^\s+|\s+$/g, "");
        pklmPrint("raw => " + resp);
        var d = JSON.parse(resp);
        pklmLastWebFailTime = 0;   // 成功，重置失败时间戳
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
        pklmLastWebFailTime = new Date().getTime();   // 记录失败时间戳，供节流
        pklmPrint("decide error: " + e.message);
        if (!pklmShadowMode) pklmFallbackAttack();   // 影子模式不兜底执行，交回用户手动
    }
}

// 历史回合记录辅助
function pklmPushTurn() {
    if (pklmTurnLog) {
        pklmTurnLog += pklmTurnSnapshot();
        pklmHistory.push(pklmTurnLog);
        if (pklmHistory.length > 5) pklmHistory.shift();
        pklmFullHistory.push(pklmTurnLog);   // 完整战报，不截断（供 get_battle_history tool）
    }
    pklmTurnLog = "";
}

// 采集「回合结束时」的场况快照（天气/场地/双方场上能力等级），追加进战报文本。
// 弥补 PO 无通用 stat 变化回调（剑舞/近身战等）、天气/场地特性触发消息不走 onAbilityMessage 的缺口。
function pklmTurnSnapshot() {
    try {
        var w = pklmWeatherName(battle.data.field.weather) || 'None';
        var t = pklmTerrainName(battle.data.field.terrain) || 'None';
        var mb = pklmCollectBoosts(battle.me);
        var ob = pklmCollectBoosts(battle.opp);
        return '[Weather:' + w + ', Terrain:' + t +
            ', You:' + (mb.length ? mb.join('+') : 'None') +
            ', Opp:' + (ob.length ? ob.join('+') : 'None') + '] ';
    } catch (e) {
        return '';
    }
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
        if (message.indexOf("/llm cb") === 0) {
            pklmCbLog = !pklmCbLog;
            pklmPrint("callback log " + (pklmCbLog ? "ON" : "OFF"));
            return;
        }
        if (message.indexOf("/eval ") === 0) {
            try {
                var res = eval(message.substring(6));
                pklmPrint("eval => " + res);
            } catch (e) {
                pklmPrint("eval error: " + e);
            }
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
            pklmLastMove[spot] = sys.move(attack);   // 记录最后招式名（供 %m 占位符）
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
            var nm = pklmActiveName(spot);
            // 对手 damage 是血量百分比，我方是实际 HP（与主脚本 onDamageDone 语义一致）
            if (spot === battle.opp) {
                pklmTurnLog += "opposing " + nm + " lost " + damage + "%. ";
            } else {
                pklmTurnLog += "You " + nm + " lost " + damage + " HP. ";
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
    onBattleEnd: function (result, winner) {
        battleEnd = true;
        // 对战结束：通知 server 追加 LLM 笔记汇总到 log 末尾（fire-and-forget，404 也无妨）
        try {
            var su = PKLM_URL + "/summary?battleId=" + battle.id + "&result=" + encodeURIComponent(String(result)) + "&winner=" + winner;
            sys.synchronousWebCall(su);
        } catch (e) {}
        // 清分少女无人值守：战斗结束 7 秒后自动关闭战斗窗口（对齐主脚本）
        if (pklmAccount.toLowerCase() === "[lv0.吧服bot]清分少女") {
            sys.setTimer(function () {
                try { battle.close(); } catch (e) {}
            }, 7000, 0);
        }
    },

    // ===== 战报细节回调：把战斗过程细节补进 pklmTurnLog（进 history/fullHistory）=====
    onMiss: function (spot) {
        try { pklmTurnLog += pklmSpotLabel(spot) + "'s attack missed. "; } catch (e) {}
    },
    onAvoid: function (spot) {
        try { pklmTurnLog += pklmSpotLabel(spot) + " avoided the attack. "; } catch (e) {}
    },
    onStatusDamage: function (spot, status) {
        try {
            pklmCb("onStatusDamage", "status=" + status);
            var sn = pklmStatusName(status) || "status";
            pklmTurnLog += pklmSpotLabel(spot) + " suffered " + sn + " damage. ";
        } catch (e) {}
    },
    onSendBack: function (spot) {
        try { pklmTurnLog += pklmSpotLabel(spot) + " called back its pokemon. "; } catch (e) {}
    },
    onItemMessage: function (spot, item, part, foe, berry, other) {
        try {
            pklmCb("onItemMessage", "item=" + item + " part=" + part + " foe=" + foe + " berry=" + berry + " other=" + other);
            var kind = (berry && berry !== 0) ? 'berry' : 'item';
            var file = (kind === 'berry') ? 'berry_messages.txt' : 'item_messages.txt';
            var msgNum = (kind === 'berry') ? berry : item;
            var txt = pklmRenderMsg(kind, file, msgNum, part, pklmMsgCtx(spot, undefined, other, undefined));
            if (txt) pklmTurnLog += txt + ". ";
        } catch (e) {}
    },
    onMoveMessage: function (spot, move, part, type, foe, other, q) {
        try {
            pklmCb("onMoveMessage", "move=" + move + " part=" + part + " type=" + type + " foe=" + foe + " other=" + other + " q=" + q);
            var txt = pklmRenderMsg('move', 'move_message.txt', move, part, pklmMsgCtx(spot, type, other, q));
            if (txt) pklmTurnLog += txt + ". ";
        } catch (e) {}
    },
    onAbilityMessage: function (spot, ab, part, type, foe, other) {
        try {
            pklmCb("onAbilityMessage", "ab=" + ab + " part=" + part + " type=" + type + " foe=" + foe + " other=" + other);
            var txt = pklmRenderMsg('ability', 'ability_messages.txt', ab, part, pklmMsgCtx(spot, type, other, undefined, other));
            if (txt) pklmTurnLog += txt + ". ";
        } catch (e) {}
    },
    onTierNotification: function (tier) {
        pklmAutoEnable();
        pklmCheckMsgFiles();   // 对战启动扫描消息表文件依赖，缺失则提示
    },
    onClauseActivated: function (clause) {},
    onEffectiveness: function (spot, effectiveness) {
        try {
            pklmCb("onEffectiveness", "effectiveness=" + effectiveness);
            var t = null;
            if (effectiveness === 0) t = "It had no effect";
            else if (effectiveness === 1 || effectiveness === 2) t = "It's not very effective";
            else if (effectiveness === 8 || effectiveness === 16) t = "It's super effective";
            if (t) pklmTurnLog += t + ". ";
        } catch (e) {}
    },
    onAttackFailing: function (spot, silent) {
        try { if (!silent) pklmTurnLog += pklmSpotLabel(spot) + "'s attack failed. "; } catch (e) {}
    },
    onOfferChoice: function (player, choice) {},
    onCriticalHit: function (spot) {
        try { pklmTurnLog += "A critical hit! "; } catch (e) {}
    },
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
    onMajorStatusChange: function (spot, status, multipleTurns, silent) {
        try {
            pklmCb("onMajorStatusChange", "status=" + status + " multi=" + multipleTurns + " silent=" + silent);
            if (status === 31) return;   // 31=濒死(faint)，已由 onKo 记录，避免重复
            var sn = pklmStatusName(status) || ("status " + status);
            pklmTurnLog += pklmSpotLabel(spot) + " is now " + sn + ". ";
        } catch (e) {}
    },
    onStatusOver: function (spot, status) {
        try {
            pklmCb("onStatusOver", "status=" + status);
            var sn = pklmStatusName(status) || ("status " + status);
            pklmTurnLog += pklmSpotLabel(spot) + "'s " + sn + " ended. ";
        } catch (e) {}
    },
    onFlinch: function (spot) {
        try { pklmTurnLog += pklmSpotLabel(spot) + " flinched. "; } catch (e) {}
    },
    onReconnect: function (player) {}
});
