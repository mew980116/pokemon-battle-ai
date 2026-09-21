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
var PKLM_VERSION = "0.6.30";      // 脚本版本（改动时 bump，随日志记录）
var pklmLastWebFailTime = 0;       // 上次 webCall 失败时间戳（ms），用于断线时节流重发
var pklmSilent = false;            // 静默模式：清分少女等无人值守 BOT 账号不向 PO 窗口 print 任何脚本输出
var pklmFailCount = 0;             // 连续 webCall 失败次数（成功即归零）
var pklmFirstFailTime = 0;         // 首次失败时间戳（ms），配合 15s 时间窗口判定 server 是否不可用

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
            // 服务器无人值守 BOT 账号：自动 LLM 决策（非 shadow）+ 静默（无 print 输出，日志仍写文件）
            pklmSilent = true;
            if (!useLLM) {
                useLLM = true;
                pklmShadowMode = false;
            }
            if (!pklmLogEnabled) {
                pklmLogEnabled = true;
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
var pklmOppMoves = [[], [], [], [], [], []];  // 对手每只宝可梦（按记录 slot 区分）已暴露招式 [slot]: [{name,type,num}]
var pklmOppMoveUse = [{}, {}, {}, {}, {}, {}];  // 对手每只（记录 slot）每招已使用次数 [slot]: {招式编号: 次数}（PO 不给对手 PP，只能自己记）
var pklmOppSlots = [0, 1, 2, 3, 4, 5];        // 记录 slot i 当前在哪个队伍槽位（0=场上，1-5=后备；初始 i→i）
var pklmCurrentOppSlot = 0;                    // 当前场上对手宝可梦对应的记录 slot
var pklmOppAbility = [-1, -1, -1, -1, -1, -1]; // 记录 slot → 已确定特性 ID（-1 未知）
var pklmOppItem = [null, null, null, null, null, null]; // 记录 slot → 已暴露的道具名（从 item 消息得到）
// 双墙（反射壁/光墙/极光幕）：PO 不放在 field.zone，靠 move_message 的 73/236 号「%ts 队伍」消息跟踪。
// 73: part 0/2=反射壁开, 1/3=光墙开, 4=反射壁关, 5=光墙关；236: part 0=极光幕开, 1=关。
// 值 = 设置时的回合数（超过 8 回合未收到「wore off」就自动过期，兜底光之黏土上限）。
var pklmScreens = { me: {}, opp: {} };
// 换人当回合 PO 的 field.poke().statBoost() 会残留换下那只的能力等级（battle92 T11 实锤）→ 置位期间报 0
var pklmBoostsReset = { me: false, opp: false };
var pklmOppPossible = [[], [], [], [], [], []]; // 记录 slot → 可能特性列表（sys.pokeAbility 3 个）
var pklmOppJustSwitched = false;               // 换入后待反向排除入场特性的标记
var pklmOppAbilityTriggered = false;           // 换入后是否已触发过特性消息
var pklmOppSeen = [];             // 对手已暴露的后备宝可梦名列表（含场上）
var pklmMyRevealed = [];          // 我方已出场过的宝可梦 numRef 列表（非 team preview 时用于标记对方未知的宝可梦）
var pklmTeamPreview = null;       // null=未检测, true=有 team preview, false=无（首次决策时检测并缓存）
var pklmLastAttackSlot = -1;      // 上一回合使用的攻击槽位（-1 表示未攻击）
var pklmPrevAttackSlot = -1;      // 本次决策发送前的 pklmLastAttackSlot（被 PO 拒绝时回滚，避免锁招槽漂移）
var pklmLockedSlot = -1;          // 当前被锁定的招式槽位（Choice 道具锁招）
var pklmBannedSlots = [];         // 本轮被 PO 拒绝的招式槽位（拒绝后 ban 掉重新决策）
var pklmItemProbe = [];           // 临时道具探针：每次 onItemMessage 记录原始编号（结案后删）
var pklmLastSwitchSlot = -1;      // 上一回合尝试的换人槽位（-1 表示未换人）
var pklmBannedSwitch = [];        // 被 PO 拒绝的换人槽位（踩影等禁换人）
var pklmMessages = [];            // 对战中发送的 message（评论，进日志）
var pklmFinalAttack = false;      // 保底标志：全 ban 后强制 attack，不再响应取消
var pklmShadowMode = false;       // 影子模式：照发 DS 请求并记 log，但不执行 DS 指令，改由用户手动操作
var pklmLastMove = {};            // { spot: 最后使用的招式名 }，供消息解码 %m 占位符
var pklmMsgTables = { move: null, item: null, ability: null, berry: null };  // 消息表懒加载缓存
var pklmCbLog = false;            // 回调探针：开启后 print 各回调原始参数（/llm cb 切换，调试观察用）

// ===== 对手 slot 追踪 + 特性解析（按记录 slot 固定身份，解决 numRef 重复；currentIndex 追踪队伍槽位）=====

// 入场必定触发消息的特性（换入后若没触发任何特性消息，可从 possible 排除这些）
var pklmEntryAbilities = [22, 2, 70, 45, 117, 198, 219, 220, 218, 104, 164, 46, 36, 88, 150, 234, 235];

// 队伍槽位 i → 记录 slot
function pklmOppSlotOf(teamSlot) {
    for (var i = 0; i < 6; i++) {
        if (pklmOppSlots[i] === teamSlot) return i;
    }
    return teamSlot;
}

// 对手换人：prevIndex = 新宝可梦上场前所在的队伍槽位（0=首发不更新）
function pklmOppSwap(prevIndex) {
    if (prevIndex === 0) return;
    var oldSlot = pklmCurrentOppSlot;
    var newSlot = -1;
    for (var i = 0; i < 6; i++) {
        if (pklmOppSlots[i] === prevIndex) { newSlot = i; break; }
    }
    if (newSlot < 0) newSlot = prevIndex;
    pklmOppSlots[newSlot] = 0;        // 新宝可梦到场上（槽位 0）
    pklmOppSlots[oldSlot] = prevIndex; // 旧宝可梦到后备（槽位 prevIndex）
    pklmCurrentOppSlot = newSlot;
}

// 加载当前场上对手宝可梦的可能特性列表（首次出场时加载）
function pklmLoadOppPossible() {
    var slot = pklmCurrentOppSlot;
    if (pklmOppPossible[slot].length > 0) return;
    try {
        var numRef = pklmFpoke(battle.opp).pokemon.numRef;
        if (!numRef || numRef <= 0) return;
        var possible = [];
        for (var i = 0; i < 3; i++) {
            var ab = sys.pokeAbility(numRef, i, 8);
            if (ab && ab > 0 && possible.indexOf(ab) === -1) possible.push(ab);
        }
        pklmOppPossible[slot] = possible;
    } catch (e) {}
}

// 反向排除：换入后没触发任何入场特性消息，则从 possible 排除入场必触发特性
function pklmExcludeEntryAbilities() {
    var slot = pklmCurrentOppSlot;
    var possible = pklmOppPossible[slot];
    for (var i = 0; i < pklmEntryAbilities.length; i++) {
        var idx = possible.indexOf(pklmEntryAbilities[i]);
        if (idx !== -1) possible.splice(idx, 1);
    }
    pklmOppPossible[slot] = possible;
}

// 通过特性消息编号 ab 正向解析特性 ID（移植主脚本 analyseCurrentAbility）
function pklmAnalyseAbility(ab, part, other, type) {
    var ability = 0;
    switch (ab) {
        case 2: ability = 106; break;
        case 3: ability = 83; break;
        case 4: ability = 107; break;
        case 9: ability = 16; break;
        case 11: ability = 56; break;
        case 12: ability = 39; break;
        case 13: ability = 88; break;
        case 14: ability = [117, 2, 45, 70][part]; break;
        case 15: ability = 87; break;
        case 16: ability = 27; break;
        case 17: ability = 142; break;
        case 18: ability = other; break;
        case 19: ability = 18; break;
        case 21: ability = 59; break;
        case 22: ability = 108; break;
        case 23: ability = 119; break;
        case 24: ability = 19; break;
        case 29: ability = 93; break;
        case 30: ability = other; break;
        case 31: ability = other; break;
        case 32: ability = other; break;
        case 33: ability = other; break;
        case 34: ability = 22; break;
        case 37: ability = 102; break;
        case 38: ability = other; break;
        case 40: ability = other; break;
        case 41: ability = 78; break;
        case 44: ability = 20; break;   // Own Tempo 我行我素（模板自证 `%s's Own Tempo cures its confusion!`；原移植值 22=Intimidate 是错的，已由 test-ability-table.js 抓出）
        case 45: ability = 90; break;
        case 46: ability = 46; break;
        case 47: ability = 152; break;
        case 50: ability = other; break;
        case 54: ability = 61; break;
        case 55: ability = 112; break;
        case 56: ability = 94; break;
        case 57: ability = 43; break;
        case 58: ability = [3, 154][part]; break;   // 加速 Speed Boost / 正义之心 Justified（同一条消息的两个变体是**不同特性**）
        case 60: ability = 80; break;
        case 61: ability = 28; break;
        case 66: ability = 36; break;
        case 67: ability = 54; break;
        case 68: ability = other; break;
        case 70: ability = other; break;
        case 71: ability = 25; break;
        case 74: ability = 133; break;
        case 77: ability = 161; break;
        case 78: ability = 124; break;
        case 80: ability = other; break;
        case 81: ability = 150; break;
        case 85: ability = 140; break;
        case 86: ability = 144; break;
        case 88: ability = 139; break;
        case 89: ability = other; break;
        case 90: ability = 147; break;
        case 91: ability = 5; break;
        case 93: ability = 53; break;
        case 94: ability = 154; break;
        case 95: ability = 141; break;
        case 96: ability = 130; break;
        case 97: ability = 155; break;
        case 99: ability = 131; break;
        case 102: ability = 127; break;
        case 103: ability = [168, 169][type - 16]; break;
        case 104: ability = other; break;
        case 107: ability = 175; break;
        case 110: ability = 177; break;
        case 112: ability = [179, 184][part]; break; // 香甜气息 Sweet Veil / 芳香气息 Aroma Veil（同一条消息两个变体是不同特性；模板用「气息」指代，审计脚本抓不到）
        case 115: ability = 183; break;
        case 117: ability = 166; break;
        case 118: ability = 185; break;
        case 120: ability = 26; break;
        case 122: ability = 60; break;
        case 124: ability = 188; break;
        case 125: ability = 167; break;
        case 126: ability = [189, 190, 191][part]; break;
        case 127: ability = 194; break;
        case 128: ability = [198, 219, 220, 218][part]; break;
        case 129: ability = 199; break;
        case 133: ability = 205; break;  // ⚠ 死条目：消息 133 在 po-data 的英/中两张 ability_messages 表里都不存在 → 永远不会命中（保留以防 PO 版本差异，别当成已覆盖）
        case 138: ability = 203; break;
        case 139: ability = 210; break;
        case 140: ability = 208; break;
        case 141: ability = 215; break;
        case 142: ability = 196; break;
        case 143: ability = 216; break;
        case 147: ability = 211; break;
        case 148: ability = 195; break;
        case 149: ability = 209; break;
        default: ability = 0;
    }
    return ability;
}

// 特性 ID 数组 → 特性名数组
function pklmAbilityNames(ids) {
    var names = [];
    for (var i = 0; i < ids.length; i++) {
        var n = pklmAbilityName(ids[i]);
        if (n) names.push(n);
    }
    return names;
}

// 招式是否不可用（仅：被 PO 拒绝过的槽位）
// 注意：专爱锁招**不能**在这里剔除 —— 锁招时那一招是唯一能点的攻击，把它藏起来反而把 3 个非法招摆给 LLM，
// 导致每回合都先被 PO 拒绝一次、再重试（还让锁定槽漂移）。锁招改为在招式对象上打 `locked` 标记，由 prompt 明示。
function pklmIsMoveDisabled(m) {
    return pklmBannedSlots.indexOf(m) !== -1;
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
// 取消息模板原文（part 越界时退回 part 0）
function pklmMsgTemplate(kind, fileName, msgNum, part) {
    if (msgNum === undefined || msgNum === null || msgNum === 0) return null;
    var map = pklmGetMsgTable(kind, fileName);
    var variants = map[msgNum];
    if (!variants || !variants.length) return null;
    if (part === undefined || part === null || part < 0 || part >= variants.length) part = 0;
    return variants[part] || null;
}

// 模板里有没有某个占位符（用来判断该占位符要不要换成「别的来源」的值）
function pklmMsgHas(kind, fileName, msgNum, part, ph) {
    var t = pklmMsgTemplate(kind, fileName, msgNum, part);
    return !!(t && t.indexOf(ph) >= 0);
}

function pklmRenderMsg(kind, fileName, msgNum, part, ctx) {
    var t = pklmMsgTemplate(kind, fileName, msgNum, part);
    if (!t) return null;
    // 先替换三字符占位符（%st/%ts/%tf），避免被 %s/%t/%f 误伤
    var order = [['%st', ctx.st], ['%ts', ctx.ts], ['%tf', ctx.tf],
                 ['%s', ctx.s], ['%f', ctx.f], ['%m', ctx.m], ['%i', ctx.i],
                 ['%t', ctx.t], ['%a', ctx.a], ['%q', ctx.q], ['%d', ctx.d], ['%p', ctx.p], ['%e', ctx.e]];
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

// 对手道具推断用的受控清单（英文名）。来源：PO 的 item_messages.txt / berry_messages.txt 里
// **文本直接写着道具名**的那些道具（由 po-data 统计得到，31 项，改数据后需重新统计）。
// 用途：PO 不给脚本读对手道具（poke.item 恒 0 → sys.item() 返回 "(No Item)"），
// 但道具消息（"…restored a little HP using its Leftovers!"）和部分招式消息（吹落/戏法类）文本里有道具名。
var PKLM_ITEM_HINTS = ["Adrenaline Orb", "Air Balloon", "Berry Juice", "Berserk Gene", "Black Sludge", "Blunder Policy", "Destiny Knot", "Eject Button", "Eject Pack", "Flame Orb", "Focus Band", "Focus Sash", "Leftovers", "Life Orb", "Mental Herb", "Power Herb", "Protective Pads", "Quick Claw", "Red Card", "Rocky Helmet", "Room Service", "Safety Goggles", "Shell Bell", "Sticky Barb", "Throat Spray", "Toxic Orb", "Utility Umbrella", "Weakness Policy", "White Herb", "Stick"];
PKLM_ITEM_HINTS.sort(function (a, b) { return b.length - a.length; });   // 长的优先，避免 "Berry Juice" 被 "Stick" 之类的短名抢先

function pklmItemName(n) {
    if (!n) return '';
    try { return sys.item(n); } catch (e) { return ''; }
}

function pklmAbilityName(n) {
    if (!n) return '';
    try { return sys.ability(n); } catch (e) { return ''; }
}

function pklmMoveName(n) {
    if (!n) return '';
    try { return sys.move(n); } catch (e) { return ''; }
}

// ==== 渲染探针（`/llm probe` 开关）====
// 用途：把「原始参数 + 选中的模板 + 我们渲染出的文本」打到 PO 窗口，**与 PO 自己那行战报并排**。
// 用户打完一局把整段贴回来 → 逐行对照就能确认占位符语义（%s/%f/%i/%m/%a/%t/%d/%q/%p/%e 各自是谁），
// 也能看出「我们渲染成 null（模板没命中）」「占位符没替换留下字面量」「方向反了」这几类问题。
// 默认 ON（当前是占位符核对轮次）；`/llm probe` 可随时切。
var pklmMsgProbe = true;
// probe 同时**落盘**（`sys.appendToFile`）：PO 窗口的内容不会进它自己保存的战报 HTML，
// 而 PO 原版战报（Logs/Battle Logs/<日期>/….html，含 class="MoveMessage"/"ItemMessage" 分类与
// PO 自己填好的完整句子）只有 agent 侧能读 → 一边读 HTML、一边读这个 probe 文件，就能把
// 「PO 的文本」与「我们的原始参数 + 渲染结果」逐行对齐，**不需要人工贴任何东西**。
var PKLM_PROBE_FILE = '';
function pklmProbeFilePath() {
    if (PKLM_PROBE_FILE) return PKLM_PROBE_FILE;
    var dir = '';
    try { dir = sys.scriptsFolder; } catch (e) {}
    if (!dir) { try { dir = sys.getCurrentDir(); } catch (e2) {} }
    if (!dir) return '';
    if (dir.charAt(dir.length - 1) !== '/') dir += '/';
    PKLM_PROBE_FILE = dir + 'pklm-msg-probe.log';
    return PKLM_PROBE_FILE;
}
function pklmProbeReset() {
    var p = pklmProbeFilePath();
    if (!p) return;
    try { sys.writeToFile(p, "# PKLM msg probe  script=" + PKLM_VERSION + "  battle=" + battle.id + "\n"); } catch (e) {}
}

// 把一个数字按键位去猜它可能是道具/招式/特性哪个（只用于探针展示，帮助判断 other 的语义）
function pklmDecodeNum(n) {
    if (!n) return '';
    var out = [];
    try { var it = pklmItemName(n); if (it && it !== '(No Item)') out.push('item:' + it); } catch (e1) {}
    try { var mv = pklmMoveName(n); if (mv && mv !== '?') out.push('move:' + mv); } catch (e2) {}
    try { var ab = pklmAbilityName(n); if (ab && ab !== '?') out.push('abil:' + ab); } catch (e3) {}
    return out.join(',');
}

function pklmMsgProbeLine(kind, fileName, num, part, spot, foe, other, q, type, txt) {
    if (!pklmMsgProbe) return;
    try {
        var tmpl = pklmMsgTemplate(kind, fileName, num, part);
        var side = function (s) { return (s === battle.me) ? 'ME' : (s === battle.opp ? 'OPP' : String(s)); };
        var dec = pklmDecodeNum(other);
        var line = "[PKLMP] turn=" + pklmCurrentTurn + " " + kind + "=" + num + "/" + part
            + " spot=" + side(spot) + " foe=" + side(foe)
            + " type=" + type + " other=" + other + (dec ? '(' + dec + ')' : '')
            + " q=" + q + " m=" + (pklmLastMove[spot] || '-')
            + " | T=" + (tmpl === null ? '(NO TEMPLATE)' : tmpl)
            + " | R=" + (txt === null ? '(null)' : txt);
        pklmPrint(line);
        var p = pklmProbeFilePath();
        if (p) { try { sys.appendToFile(p, line + "\n"); } catch (e2) {} }
    } catch (e) {}
}

// 构建消息替换上下文（%i/%a 用当前宝可梦持有的道具/特性，未知时为空——尽力而为）
// 从消息文本里认对手道具（认不到返回 null）
function pklmInferItem(txt) {
    if (!txt) return null;
    for (var i = 0; i < PKLM_ITEM_HINTS.length; i++) {
        if (txt.indexOf(PKLM_ITEM_HINTS[i]) >= 0) return PKLM_ITEM_HINTS[i];
    }
    return null;
}

// 消息里的 %i（道具名）：对手道具 PO 不给脚本读（恒 "(No Item)"），直接写 "(No Item)" 会误导
// （LLM 会读成「对手没道具」）→ 明确标成「PO 隐藏」。
function pklmItemLabel(spot) {
    var n = pklmItemName(pklmPoke(spot).item);
    if ((n === "(No Item)" || n === "") && spot === battle.opp) return "[item hidden by PO]";
    return n;
}

// ==== 我方道具的「消息证实值」(itemProved) ====
// 实测（battle99 T16 / battle104 T11-T12）两条直读路都不能用：
//   ① team(me).poke(0).item：**失去**道具时会正确变 0，但**换进来的**道具读不到（读成 0）；
//   ② field.poke(me).pokemon.item：在「失去/消耗」时**不回退**（停在旧值），完全不可信。
// 所以只能靠**消息**：换道具是 move 消息 **132**（`%s switched items with %f!` / `%s obtained one %i!`），
// 其中 part 1 的回调参数 `other` 就是该侧**获得的道具编号** —— 主脚本 case 132 用的正是它。
// （同族的还有打落 70 / 偷取 23 / 虫咬啄食 16 / 烧尽 160 / 回收 105 / 传递 162，以及特性侧的
//  察觉 23 / 顺手牵羊 78 / 收获 88 / 捡拾 93 / 黏着 122 / 熟成 156 —— 统一走下面的「得到/失去」入口。）
// 原则：只有消息能写这份旁证；直读为空且没有旁证时，如实回「读不到」，绝不猜。
var pklmMyItemProved = {};   // numRef -> { raw, name, src }
function pklmMyItemNumRef() {
    try { return pklmTpoke(0).numRef; } catch (e) { return null; }
}
function pklmMyItemProve(raw, src) {
    var k = pklmMyItemNumRef();
    if (k === null || k === undefined) return;
    pklmMyItemProved[k] = { raw: raw, name: pklmItemName(raw), src: src };
    pklmPrint("my item PROVED: " + (pklmItemName(raw) || '(none)') + "  [" + src + "]");
}

// ==== 道具「得到 / 失去」事件（统一入口）====
// 消息表里凡是模板带 `%i` 的，`%i` 就是回调的 `other`（与 %m / %st / %a 同一机制：other = 该消息的数字参数）。
// 方向（谁得到、谁失去）逐条写死在下表，依据 = 主脚本 20201227.js `analyseCurrentMoveMess` 的
//   case 23 stole → spot 得到 other / case 70 knocked off → foe 失去 / case 105 recycled → spot 得到 /
//   case 132 part1 obtained one → spot 得到 / case 160 burned → foe 失去 / case 162 gave → foe 得到。
// 注意：**招式表与特性表的编号是两套**（都叫 23，招式是「偷取」、特性是「察觉」），所以别共用同一张表。
//
// 「失去」必须显式登记：否则 itemProved 会在道具被打落/被偷/烧尽之后**复活**
// （直读正确地变 0，但旧旁证还在 → 输出层 `!item && itemProved.raw` 成立 → 把早就不在的道具当权威值写进 prompt）。
var PKLM_MOVE_MSG_STEAL = { 23: 1 };              // 小偷 / 索取：spot 得到 + foe 失去
var PKLM_MOVE_MSG_REGAIN = { 105: 1 };            // 回收：spot 单方得到
var PKLM_MOVE_MSG_GIVE_FOE = { 162: 1 };          // 传递类：foe 得到
var PKLM_MOVE_MSG_LOSE_FOE = { 16: 1, 70: 1, 160: 1 };  // 虫咬·啄食（吃掉）/ 打落 / 烧尽：foe 失去
var PKLM_MOVE_MSG_SWAP = { 132: 1 };              // 戏法 / 掉包：part1 spot 得到
// 这几条是「道具被销毁」，文本里出现的那个名字恰恰说明它**已经没了** → 不能用文本回填对手道具
var PKLM_MOVE_MSG_ITEM_GONE = { 16: 1, 70: 1, 160: 1 };
// 招式消息里「白送对方特性」的几条（用户指出：吸盘这种特性 **没有专属特性消息**，只有对应的招式消息能暴露它）。
// 主脚本 analyseCurrentMoveMess 的 case 1/43/114/144 挖了一部分，**case 107 part0 没挖**（它只处理 part1）。
// owner 按**模板语义**写死，不依赖 PO 的 spot 约定 —— 这几条消息的 spot 到底是谁并不统一：
//   `%s's Sturdy …!` 明显是 %s 的；`%s sucked up the Liquid Ooze!` 里的污泥浆却属于**目标** `%f`。
// 实测依据：64=Liquid Ooze 污泥浆 / 5=Sturdy 结实 / 6=Damp 湿气 / 21=Suction Cups 吸盘（po-data/abilities）。
var PKLM_MOVE_ABILITY_REVEAL = {
    1: { part: 2, owner: 'f', ab: 64 },            // %s sucked up the Liquid Ooze!  → 污泥浆在目标身上
    43: { part: 0, owner: 's', ab: 5 },            // %s's Sturdy made the attack fail!
    107: { part: 0, owner: 'f', ab: 21 },          // %f held on to the ground using its Suction Cups!
    114: { part: null, owner: 's', ab: 6 },        // %s's Damp prevents it from working!
    144: { part: 2, owner: 's', ab: 0, fromOther: true }  // %s's %a made it ineffective! → other 即特性编号
};
var PKLM_ABIL_MSG_STEAL = { 78: 1 };              // 顺手牵羊：spot 得到 + foe 失去
var PKLM_ABIL_MSG_REGAIN = { 88: 1, 93: 1 };      // 收获 / 捡拾：spot 单方得到
var PKLM_ABIL_MSG_FRISK = { 23: 1 };              // 察觉：**只是暴露** foe 的道具，不改变归属
var PKLM_ABIL_MSG_STICKY = { 122: 1 };            // 黏着：打落/戏法/偷取一律失败
var PKLM_ABIL_MSG_LOSE_SPOT = { 156: 1 };         // 熟成：吃掉自己的果子
// 一次性消耗类**道具消息**（onItemMessage 的 `item`；触发即用完 → 该侧道具归零）。
// 依据 po-data/items/item_messages.txt 逐条核对。**不消耗的那些绝不能进来**：
//   4 气息头巾 / 12 剩饭 / 16 黑泥 / 17 快爪 / 19 火珠·毒珠 / 21 命玉 / 24 贝壳铃 / 29 附着针 /
//   34 粗糙头盔 / 41 宿命绳 / 42 安全护目镜 / 78 万能伞 / 79 厚底靴（都是常驻或每次触发都还在）。
var PKLM_ITEM_MSG_CONSUME = {
    3: 1,    // 白药草 White Herb
    5: 1,    // 气息腰带 Focus Sash
    7: 1,    // 精神药草 Mental Herb
    11: 1,   // 力量药草 Power Herb
    18: 1,   // 果汁 Berry Juice
    38: 1,   // 红牌 Red Card
    39: 1,   // 逃脱按钮 Eject Button
    40: 1,   // 狂暴基因 Berserk Gene
    43: 1,   // 弱点保险 Weakness Policy
    71: 1,   // 胆怯球 Adrenaline Orb
    74: 1,   // 喉咙喷雾 Throat Spray
    75: 1,   // 逃脱包 Eject Pack
    76: 1,   // 大失误保险 Blunder Policy
    77: 1    // 客房服务 Room Service
};
// 分 part 判断的：35 = 气球，只有 part0「popped!」才消耗（part1 是「is floating on a balloon」还带着）
var PKLM_ITEM_MSG_CONSUME_PART = { 35: 0 };
// 「道具消息号 → 道具编号」硬表，来源 = 主脚本 `analyseCurrentItem`（它按消息号硬映射，**不依赖文本**，
// 所以「道具名不在文本里」时也准）。实测佐证：12→15(Leftovers)、21→91(Life Orb) 与 battle104 的
// `poke.item` 快照完全一致。只收「真的携带物」；66 超级石/67 原始回归/68 Z 纯晶/73 究极爆发 跳过。
// 数组 = 按 part 取值（19 火珠/毒珠、35 气球 popped→0 即已消耗）。
var PKLM_ITEM_MSG_TO_ITEM = {
    3: 37,            // White Herb（一次性，会被下面的 consume 分支立刻清掉）
    4: 9,             // Focus Band
    12: 15,           // Leftovers
    16: 50,           // Black Sludge
    17: 180,          // Quick Claw
    19: [71, 141],    // Flame Orb / Toxic Orb
    21: 91,           // Life Orb
    24: 126,          // Shell Bell
    29: 183,          // Sticky Barb
    34: 235,          // Rocky Helmet
    35: [0, 236],     // Air Balloon：part0 popped（→0，已消耗）/ part1 还带着
    41: 7,            // Destiny Knot
    42: 332           // Safety Goggles
};

var pklmStickyHold = {};   // 'me:<numRef>' / 'opp:<slot>' -> true

// 消息里的 `%i` 取值：道具编号就是 `other`；读不出（0 / "(No Item)"）时返回空串，让上层保留原渲染
function pklmItemArgName(other) {
    if (!other) return '';
    var n = pklmItemName(other);
    if (!n || n === '(No Item)') return '';
    return n;
}

// spot 这一侧**得到** raw 这个道具
function pklmItemGain(spot, raw, src) {
    if (!raw) return;
    if (spot === battle.me) { pklmMyItemProve(raw, src); return; }
    var nm = pklmItemName(raw);
    if (nm) pklmOppItem[pklmCurrentOppSlot] = nm;
}

// side 这一侧**失去**道具（raw 未知，只知道没了）。黏着特性会让所有失去事件不成立 → 直接跳过。
function pklmItemLose(side, src) {
    var key = (side === battle.me) ? ('me:' + pklmMyItemNumRef()) : ('opp:' + pklmCurrentOppSlot);
    if (pklmStickyHold[key]) return;
    if (side === battle.me) { pklmMyItemProve(0, src); return; }
    pklmOppItem[pklmCurrentOppSlot] = null;
}


function pklmMsgCtx(spot, type, other, q, abilityId) {
    return {
        s: pklmActiveName(spot),                            // %s = 这一侧（消息主体）；证据：主脚本逐条 case 的方向（25/28/33/93/104/151/174/175/233…）
        f: pklmActiveName(pklmOtherSpot(spot)),             // %f = 对侧；证据：主脚本用 `foe === battle.opp` 判「谁被作用」，且从不检查 foe 为同侧
        m: pklmLastMove[spot] || '',                        // %m = 招式名（方向按消息族不同，特性侧在 onAbilityMessage 里换成对侧）
        i: pklmItemLabel(spot),                             // %i = 道具名（多数消息里是回调 other / 树果是 berry，见各回调）
        t: pklmTypeName(type) || '',                        // %t = 属性；证据：主脚本 case 9 / 14 / 19 / 20 / 157 的 `temptype = type`
        a: pklmAbilityName((abilityId !== undefined && abilityId !== null && abilityId !== 0) ? abilityId : pklmPoke(spot).ability),
        // ↑ %a = 特性名；证据：主脚本 `ability = other` 的正好是 18/30/31/32/33/38/40/50/68/70/80/89，而这 12 条模板全都含 %a
        q: (q !== undefined && q !== null && q !== 0) ? String(q) : '',   // %q = 数量/回合号（连击数、减 PP 数、许愿回合），原样贴数字
        // %d = 数字；证据：主脚本 case 95 `other < 2` ↔ 模板 `95 %s's perish count fell to %d!` → `%d` 就是 `other`。
        // 其余两条（78 Magnitude 威力档 / 125 stockpiled 层数）同机制但**未实测** → 读不出正数时保留字面 `%d`，不做猜测。
        d: (other > 0) ? String(other) : '%d',
        st: PKLM_STAT_NAMES[other] || '',
        p: pklmActiveName(spot),
        ts: pklmActiveName(spot),
        tf: pklmActiveName(pklmOtherSpot(spot)),
        // %e 只在 `107 part2 %e was dragged out!`（吼叫/吹飞/龙尾/巴投）出现。用户判定：part0/part1 是
        // 「吹不走的两种 case」（吸盘 / 扎根）单独写了，part2 就是**吹走成功、把场下那只拉上场**的 case
        // → %e = 被拖**上场**的那只 = 对侧的新上场者。**待 probe 实战验证**（要看 PO 原文写的是哪只，
        // 以及消息触发时对侧的 numRef 是否已经换成新的那只）。
        e: pklmActiveName(pklmOtherSpot(spot))
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

// 采集一个宝可梦的招式列表（我方含 num/pp/slot/locked，对手只含 name/type）
// isActive：仅我方场上生效 —— 过滤被 PO 拒绝过的槽位，并对专爱锁招打 locked 标记
function pklmCollectMoves(tp, withNum, isActive) {
    var arr = [];
    for (var m = 0; m < 4; m++) {
        try {
            if (isActive && pklmIsMoveDisabled(m)) continue;
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
                // 专爱锁招标记：锁招生效时只有 locked=true 那一招能点（由 prompt 明示，避免 LLM 点非法招）
                if (isActive && pklmLockedSlot >= 0) o.locked = (m === pklmLockedSlot);
                arr.push(o);
            }
        } catch (e) {}
    }
    return arr;
}

// 采集场上宝可梦的能力等级变化（statBoost，非 0 才记录）
// 索引：1=Atk 2=Def 3=SpA 4=SpD 5=Spe 6=Acc 7=Eva
// 坑（battle92 T11 实测）：换人当回合 PO 的 `field.poke(spot).statBoost()` 会**残留换下那只的能力等级**
// —— 对手 Silvally-Fairy 剑舞到 Atk+2 后被换下，换上来的 Duraludon 读到 `Boosts:[Atk+2]`（假的），
// 而我们把这个值同时喂给 prompt 和 `calc_damage` 的 from_state（会把对手伤害高估 ~1.5 倍）。
// 对策：`pklmBoostsReset[侧]` 在本侧 onSendOut 时置位、下一回合 onBeginTurn 清除，置位期间一律报 0。
// 已知例外：接力棒（Baton Pass）**合法传递**能力等级，这一回合会被我们误报成 0（罕见，暂不建模）。
function pklmCollectBoosts(spot) {
    if (pklmBoostsReset[spot === battle.opp ? 'opp' : 'me']) return [];
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
        o.fainted = (tp.status === 31);   // 我方场上是否濒死（供 prompt 提示「需换人」）
        o.moves = pklmCollectMoves(tp, true, true);
        o.boosts = pklmCollectBoosts(battle.me);
        o.ability = pklmAbilityName(tp.ability);
        o.item = pklmItemName(tp.item);
        // 直读拿不到（典型：道具被 Trick/Switcheroo 换走后又换进来一个）时，用「消息证实值」补上，
        // 并如实标注来源，让 LLM 知道这不是直读、以及它是什么时候被证实的。
        var ipv = pklmMyItemProved[tp.numRef];
        if (!o.item && ipv && ipv.raw) { o.itemProved = ipv.name; o.itemProvedSrc = ipv.src; }
        o.itemRaw = tp.item;                                  // 临时探针：team(me).poke(0).item 原始编号（结案后删）
        o.itemField = pklmFpoke(battle.me).pokemon.item;       // 临时探针：field.poke(me).pokemon.item 原始编号（另一个来源，结案后删）
    } catch (e) {}
    return o;
}

// 某只（记录 slot）已暴露招式列表，带使用次数：[{name,type,num,used}]
function pklmOppMoveList(recSlot) {
    var raw = pklmOppMoves[recSlot] || [];
    var useMap = pklmOppMoveUse[recSlot] || {};
    var out = [];
    for (var i = 0; i < raw.length; i++) {
        var e = { name: raw[i].name, type: raw[i].type };
        if (raw[i].num) e.num = raw[i].num;
        e.used = useMap[raw[i].num] || 0;
        out.push(e);
    }
    return out;
}

// 采集对手场上
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
        o.moves = pklmOppMoveList(pklmCurrentOppSlot);   // 只取当前场上这只（记录 slot）已暴露的招式（含使用次数）
        // 特性解析结果（从战报正向解析 + possible 反向排除）
        var abId = pklmOppAbility[pklmCurrentOppSlot];
        o.abilityInferred = (abId > 0) ? pklmAbilityName(abId) : null;
        o.itemInferred = pklmOppItem[pklmCurrentOppSlot] || null;   // 已被道具消息暴露的道具（如剩饭/树果）
        o.possibleAbilities = pklmAbilityNames(pklmOppPossible[pklmCurrentOppSlot]);
        o.boosts = pklmCollectBoosts(battle.opp);
    } catch (e) {}
    return o;
}

// 采集我方后备（可换）宝可梦
function pklmCollectBench() {
    var arr = [];
    for (var i = 1; i < 6; i++) {
        try {
            if (pklmBannedSwitch.indexOf(i) !== -1) continue;   // 被 PO 拒绝过的换人槽位不再提供给 LLM
            var tp = pklmTpoke(i);
            if (tp.isKoed()) continue;
            var o = {
                slot: i,
                name: sys.pokemon(tp.numRef),
                numRef: tp.numRef,
                unrevealed: (pklmMyRevealed.indexOf(tp.numRef) === -1),  // 非 team preview 时对方还不知道这只
                types: [],
                hpPct: (tp.totalLife > 0) ? Math.floor(tp.life / tp.totalLife * 100) : 0,
                status: pklmStatusName(tp.status),
                moves: pklmCollectMoves(tp, true, false),   // 带 num/pp（剩余 PP，供耗 PP / 残局判断）
                ability: pklmAbilityName(tp.ability),
                item: pklmItemName(tp.item),
                itemRaw: tp.item   // 临时探针：道具原始编号（结案后删）
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
        var o = { name: null, revealed: false, ko: false, hpPct: null, status: null, abilityInferred: null, possibleAbilities: [] };
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
            // 特性解析（按记录 slot 关联）
            var recSlot = pklmOppSlotOf(i);
            var abId = pklmOppAbility[recSlot];
            o.abilityInferred = (abId > 0) ? pklmAbilityName(abId) : null;
            o.possibleAbilities = pklmAbilityNames(pklmOppPossible[recSlot]);
            o.moves = pklmOppMoveList(recSlot);   // 该只已暴露招式 + 使用次数（供 tool/run_js 查询，prompt 不直接展示）
            o.itemInferred = pklmOppItem[recSlot] || null;   // 已被道具消息暴露的道具（后备也要，供 from_state opp:<slot>）
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

// 双墙名称表（key 与 pklmScreens 内部字段一致）
var PKLM_SCREEN_LABEL = { reflect: 'Reflect', lightScreen: 'Light Screen', auroraVeil: 'Aurora Veil' };

// 取某方当前生效的双墙（文本数组）。超过 8 回合没收到「wore off」消息就自动过期（光之黏土上限）。
function pklmScreensOf(spot) {
    var side = (spot === battle.opp) ? 'opp' : 'me';
    var s = pklmScreens[side] || {};
    var out = [];
    for (var k in PKLM_SCREEN_LABEL) {
        var setTurn = s[k];
        if (setTurn === undefined || setTurn === null) continue;
        if (pklmCurrentTurn - setTurn > 8) { delete s[k]; continue; }
        out.push(PKLM_SCREEN_LABEL[k]);
    }
    return out;
}

// 检测是否 team preview（首次决策时缓存）。
// 判定：对战开始时对手已亮相（numRef>0）的宝可梦数量 >1 则是 team preview；只有 1 只（当前场上）则不是。
function pklmDetectTeamPreview() {
    if (pklmTeamPreview !== null) return;
    var revealed = 0;
    try {
        for (var i = 0; i < 6; i++) {
            var ep = battle.data.team(battle.opp).poke(i);
            if (ep.numRef && ep.numRef > 0) revealed++;
        }
    } catch (e) {}
    pklmTeamPreview = (revealed > 1);
}

function pklmCollectState() {
    pklmDetectTeamPreview();
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

    // 被 PO 拒绝过的招式/换人（反馈给 LLM：这些已尝试但被 PO 禁止）
    var bannedMoves = [];
    for (var bi = 0; bi < pklmBannedSlots.length; bi++) {
        try {
            var bmv = pklmTpoke(0).move(pklmBannedSlots[bi]);
            if (bmv && bmv.num > 0) bannedMoves.push(sys.move(bmv.num));
        } catch (e) {}
    }
    var bannedSwitches = [];
    for (var bj = 0; bj < pklmBannedSwitch.length; bj++) {
        try {
            bannedSwitches.push(sys.pokemon(pklmTpoke(pklmBannedSwitch[bj]).numRef));
        } catch (e) {}
    }

    return {
        account: pklmAccount,
        log: pklmLogEnabled,
        battleId: battle.id,
        scriptVersion: PKLM_VERSION,
        // turn = **这个决策是为了第几回合**（= PO 战报/窗口里的回合号）。
        // 坑：PO 在回合**开始之前**就收指令（`onBeginTurn(N)` 是在指令收集之后、回合结算开始时才触发），
        // 所以决策时 `pklmCurrentTurn` 还是「最后一个已开始的回合」= PO 回合号 − 1（首回合时是 0）。
        // 直接报它会让日志/看板/复盘比 PO 少一回合（每次都要手动 +1），故这里 +1。
        // 注意：回合内的事件文本（pklmTurnLog / pklmFullHistory 前缀、pklmMessages）用的是 pklmCurrentTurn，
        // 那时 onBeginTurn 已经触发、值就是 PO 回合号，本来就对，不动。
        // 已知代价：回合中段的强制替补（已倒后选人）发生在本回合结算中，会被标成 N+1，与紧随其后的「下一回合指令」
        // 同号；两种记录靠 `me.fainted` 与 history 尾部可区分（暂不为此单独加字段）。
        turn: pklmCurrentTurn + 1,
        // firstDecision = 本局第一个决策（此时 onBeginTurn(1) 还没触发 → pklmCurrentTurn 仍是 0）。
        // 用途：tool 侧「首回合」的特例（放宽超时 / 开思考）不该靠 `turn === 0` 判 —— 对齐 PO 回合号后线上首回合是 1，
        // 而同样的 1 也可能是 battle96 那种测试 fixture（它本来就该按老行为走），所以给一个显式标志，fixture 不吃这个特例。
        firstDecision: (pklmCurrentTurn === 0),
        shadow: pklmShadowMode,
        teamPreview: pklmTeamPreview,
        bannedMoves: bannedMoves,
        bannedSwitches: bannedSwitches,
        history: hist,
        fullHistory: fullHist,
        messages: pklmMessages.slice(),
        oppRemaining: oppRemaining,
        weather: pklmWeatherName(battle.data.field.weather) || null,
        terrain: pklmTerrainName(battle.data.field.terrain) || null,
        myHazards: pklmCollectHazards(battle.me),
        oppHazards: pklmCollectHazards(battle.opp),
        screens: { me: pklmScreensOf(battle.me), opp: pklmScreensOf(battle.opp) },
        opp: pklmCollectOppActive(),
        oppTeam: pklmCollectOppTeam(),
        oppSeen: pklmOppSeen.slice(),
        me: pklmCollectMyActive(),
        myTeam: pklmCollectMyTeam(),
        myStats: pklmCollectMyStats(),
        bench: pklmCollectBench(),
        itemProbe: pklmItemProbe.slice()   // 临时探针（判 poke.item 在 Trick/Switcheroo 后是否可读）；结案后删
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

// ==== 探针：开战时尝试"热更"（0.6.29，临时，验证完就删）====
// 待验证的问题：`sys.changeBattleScript()` 在**对局进行中**能否热更（立刻重新求值）？
//   · 已知（实测）：在 `onBattleEnd` 里调用**不会**立刻生效 —— 20:13 调用，直到 22:28 下局开战才出现 0.6.27 的装载标记。
//   · 用户的一手经验来自 **poserver（聊天大厅服务器，没有对局概念）**，所以"对战脚本"这条仍未验证。
// 做法：开战回调末尾，把**服务端最新脚本文本**写成 `pklm-probe.js` 并 `changeBattleScript` 切过去（同版本也切，就是为了触发一次求值）：
//   判据① 若 `pklm-load.log` 在开战时刻出现**两条紧邻的 loaded 行** ⇒ 热更成立（新实例被立刻求值）。
//   判据② 若本局后续仍正常决策 ⇒ 热更后回调绑在新实例上（`onBeginTurn` 里的 `pklmAutoEnable()` 兜住 useLLM）。
//   判据③ 若服务端版本更高，本局后续决策的 `scriptVersion` 会变成新版本 ⇒ "开战即更新"成立（跨版本第一局不必再赔）。
var PKLM_STARTUPDATE_PROBE = true;
var PKLM_PROBE_FILE = "pklm-probe.js";

function pklmStartUpdateProbe() {
    if (!PKLM_STARTUPDATE_PROBE) return;
    var dir = sys.scriptsFolder;
    if (dir && dir.charAt(dir.length - 1) !== '/') dir += '/';
    var log = function (t) {
        try { sys.appendToFile(dir + 'pklm-load.log', new Date().toString() + '  probe: ' + t + '  (battle=' + battle.id + ')\n'); } catch (e) {}
        pklmPrint('probe: ' + t);
    };
    try {
        var v = sys.synchronousWebCall(PKLM_UPDATE_BASE + '/pklm/version');
        var body = sys.synchronousWebCall(PKLM_UPDATE_BASE + '/pklm/po-script.js');
        if (!body || String(body).length < 20000 || String(body).indexOf('PKLM_VERSION') < 0) { log('服务端脚本文本不可用/过短，跳过（本实例 ' + PKLM_VERSION + '）'); return; }
        sys.writeToFile(dir + PKLM_PROBE_FILE, body);
        log('已写 ' + PKLM_PROBE_FILE + '（服务端 ' + v + ' / 本实例 ' + PKLM_VERSION + '），调用 changeBattleScript');
        sys.changeBattleScript(PKLM_PROBE_FILE);
        log('changeBattleScript 已返回（无异常）。若本行之后又出现一条 loaded 行 ⇒ 热更成立');
    } catch (e) {
        log('异常：' + e);
    }
}

// ======================================================================
// 主决策：采集状态 -> 调 /choice -> server.js 返回 slot 模式 -> 直接执行
function pklmDecideAndAct() {
    pklmCheckLock();   // 先检测锁招（Choice 道具）
    pklmPrevAttackSlot = pklmLastAttackSlot;   // 记录发送前的值：若本次指令被 PO 拒绝，回滚（否则锁招槽会漂移到被拒的那一招）

    // 断线节流：上次 webCall 失败后 2 秒内不再重发（避免断线时 onChoiceCancellation 快速循环刷屏 / 触发 antidos）
    var now = new Date().getTime();
    if (pklmLastWebFailTime > 0 && (now - pklmLastWebFailTime) < 2000) {
        return;
    }

    var state = pklmCollectState();

    // 可选动作只剩 1 个时（招式/换人已全部被锁或 ban），直接执行，不再路由 LLM
    var movesCount = (state.me && state.me.moves) ? state.me.moves.length : 0;
    var benchCount = (state.bench) ? state.bench.length : 0;
    if (movesCount + benchCount === 1) {
        if (movesCount === 1) {
            pklmSendCommand({ slot: battle.me, type: "attack", attackSlot: state.me.moves[0].slot });
            pklmLastAttackSlot = state.me.moves[0].slot;
            pklmLastSwitchSlot = -1;
        } else {
            pklmSendCommand({ slot: battle.me, type: "switch", pokeSlot: state.bench[0].slot });
            pklmLastAttackSlot = -1;
            pklmLastSwitchSlot = state.bench[0].slot;
        }
        return;
    }

    var u = PKLM_URL + "/choice?state=" + encodeURIComponent(JSON.stringify(state));
    try {
        var resp = sys.synchronousWebCall(u);
        resp = String(resp).replace(/^\s+|\s+$/g, "");
        pklmPrint("raw => " + resp);
        var d = JSON.parse(resp);
        pklmLastWebFailTime = 0;   // 成功，重置失败时间戳
        pklmFailCount = 0;         // 成功，重置连续失败计数
        pklmFirstFailTime = 0;
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
                pklmLastSwitchSlot = ps;   // 记录本次换人槽位（若被 PO 拒绝则 ban 掉）
            } else {
                pklmPrint("invalid pokeSlot, fallback attack");
                pklmFallbackAttack();
            }
        } else {
            var ms = parseInt(d.attackSlot, 10);
            if (isNaN(ms) || ms < 0 || ms > 3) ms = 0;
            pklmSendCommand({ slot: battle.me, type: "attack", attackSlot: ms });
            pklmLastAttackSlot = ms;   // 记录上一回合攻击槽位（用于下回合锁招检测）
            pklmLastSwitchSlot = -1;
        }
    } catch (e) {
        pklmLastWebFailTime = new Date().getTime();   // 记录失败时间戳，供节流
        pklmPrint("decide error: " + e.message);
        // 连续失败兜底：累计失败次数，首次失败记时间戳
        if (pklmFailCount === 0) pklmFirstFailTime = pklmLastWebFailTime;
        pklmFailCount++;
        // 连续 3 次失败且跨度 > 15 秒（排除快速循环），判定 server 不可用 -> 认输（对齐主脚本 onChoiceSelection 兜底）
        if (pklmFailCount >= 3 && (pklmLastWebFailTime - pklmFirstFailTime) > 15000) {
            pklmPrint("连续 " + pklmFailCount + " 次失败且持续 " + Math.floor((pklmLastWebFailTime - pklmFirstFailTime) / 1000) + "s，判定 server 不可用，认输");
            battleEnd = true;
            sys.setTimer(function () {
                try { battle.forfeit(); } catch (e2) {}
            }, 30000, 0);
            return;
        }
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

// 第二人称所有格（战报文本是给 LLM 读的，避免 "You's attack missed." 这种语法错）
function pklmPossessive(spot) {
    return spot === battle.me ? "Your" : "The foe's";
}

// 追加一条战报：模板自带 `!` / `?` / `.` 时不再补句号（原来会出现 "was seeded!." 这种双标点）
function pklmLogLine(txt) {
    if (!txt) return;
    var last = txt.charAt(txt.length - 1);
    pklmTurnLog += (last === '!' || last === '?' || last === '.') ? (txt + " ") : (txt + ". ");
}

// ==== 自更新（可选：`/llm update` 开关，默认 OFF）====
// 背景：PO 有**运行期切换脚本**的官方 API `sys.changeBattleScript`（docs/reference/sys-object.md），
// 脚本自己又能 `sys.synchronousWebCall` 下载 + `sys.writeToFile` 落盘 → 于是部署可以做成
// 「PO 自己去 8092 拉仓库里的 po-script.js 并切过去」，**不用剪贴板、不用重启 PO**。
// 这样每次改完脚本只要新开一局（或手动 `/llm update now`）就会自动生效。
//
// 护栏（自我替换属敏感操作，所以做了几道护栏）：
//   ① 只认 `127.0.0.1:8092`（我们的本地服务，且服务本身只绑 loopback）；
//   ② 下载内容必须**含 `PKLM_VERSION` 且长度 > 20KB**，否则不落盘（避免把错误页/半截响应写成脚本）；
//   ③ **只升不降**：服务端版本必须**大于**当前版本才切（避免仓库忘了 bump 时被反向降级）；
//   ④ **默认 ON**（贴一次就永久自动）；关掉：`/llm update`；立刻检查一次：`/llm update now`；
//   ⑤ 触发点 = **对局结束时**（onBattleEnd），不在局中打断。
var PKLM_AUTOUPDATE = true;
var PKLM_UPDATE_BASE = 'http://127.0.0.1:8092';

// 版本比较：a>b 返回 1；按 `.` 分段数值比（0.6.26 > 0.6.9）
function pklmVerCmp(a, b) {
    var A = String(a).split('.'), B = String(b).split('.');
    var n = Math.max(A.length, B.length);
    for (var i = 0; i < n; i++) {
        var x = Number(A[i] || 0), y = Number(B[i] || 0);
        if (isNaN(x)) x = 0;
        if (isNaN(y)) y = 0;
        if (x > y) return 1;
        if (x < y) return -1;
    }
    return 0;
}

function pklmAutoUpdate(force) {
    if (!PKLM_AUTOUPDATE && !force) return;
    try {
        var v = sys.synchronousWebCall(PKLM_UPDATE_BASE + '/pklm/version');
        if (v === undefined || v === null) { pklmPrint("autoupdate: /pklm/version 无响应（8092 在跑吗？）"); return; }
        v = String(v).replace(/[\s\r\n]/g, '');
        if (!v) { pklmPrint("autoupdate: 服务端读不到 PKLM_VERSION"); return; }
        if (pklmVerCmp(v, PKLM_VERSION) <= 0) { pklmPrint("autoupdate: 无需更新（当前 " + PKLM_VERSION + "，服务端 " + v + "）"); return; }
        var body = sys.synchronousWebCall(PKLM_UPDATE_BASE + '/pklm/po-script.js');
        if (!body || String(body).length < 20000 || String(body).indexOf('PKLM_VERSION') < 0) {
            pklmPrint("autoupdate: 拉到的内容可疑（长度/内容不对），放弃"); return;
        }
        var dir = sys.scriptsFolder;
        if (!dir) { pklmPrint("autoupdate: 拿不到 scriptsFolder"); return; }
        if (dir.charAt(dir.length - 1) !== '/') dir += '/';
        var f = dir + 'pklm-live.js';
        sys.writeToFile(f, body);
        pklmPrint("autoupdate: " + PKLM_VERSION + " -> " + v + "，已写入 " + f + "，正在切换");
        sys.changeBattleScript('pklm-live.js');
    } catch (e) { pklmPrint("autoupdate error: " + e); }
}

// ==== 装载标记（部署验证用）====
// PO **启动时**会加载本文件（`Scripts/battlescripts.js`，见 po-client-ops skill §1.5）。
// 这里在顶层往 `Scripts/pklm-load.log` 追加一行 → **不看界面**就能确认「PO 到底加载了哪个版本、何时加载」，
// 用来验证「写文件 + 重启 PO」这条替代剪贴板粘贴的部署路径（2026-09-21 加）。
// ⚠ 必须 try/catch：装载期若 `sys.scriptsFolder` 之类不可用，抛异常会让整个脚本求值失败 → PO 绑不上任何回调。
try {
    var pklmLoadDir = sys.scriptsFolder;
    if (pklmLoadDir && pklmLoadDir.charAt(pklmLoadDir.length - 1) !== '/') pklmLoadDir += '/';
    if (pklmLoadDir) {
        sys.appendToFile(pklmLoadDir + 'pklm-load.log',
            new Date().toString() + '  loaded  PKLM_VERSION=' + PKLM_VERSION + '\n');
    }
} catch (pklmLoadErr) {}

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
        if (message.indexOf("/llm probe") === 0) {
            pklmMsgProbe = !pklmMsgProbe;
            pklmPrint("message-render PROBE " + (pklmMsgProbe ? "ON" : "OFF"));
            return;
        }
        if (message.indexOf("/llm update now") === 0) {
            pklmPrint("autoupdate: 强制检查一次");
            pklmAutoUpdate(true);
            return;
        }
        if (message.indexOf("/llm update") === 0) {
            PKLM_AUTOUPDATE = !PKLM_AUTOUPDATE;
            pklmPrint("autoupdate " + (PKLM_AUTOUPDATE ? "ON" : "OFF") + "（开战时检查一次；想立刻检查用 /llm update now）");
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
        pklmAutoEnable();            // 兜底（0.6.29）：万一脚本在"开战之后"被重新求值（热更），新实例的 useLLM 是默认 false，
                                     // 而 onTierNotification 不会再触发一次 → 靠这里把执行账号重新启用，否则本局会卡住不决策。
        pklmCurrentTurn = turn;
        pklmBannedSlots = [];        // 新回合清空 ban 列表
        pklmBannedSwitch = [];       // 新回合清空换人 ban 列表（踩影可能下回合解除）
        pklmFinalAttack = false;     // 新回合重置保底标志
        pklmBoostsReset = { me: false, opp: false };   // 新回合能力等级数据可信（换人残留只影响换人当回合）
        // 反向排除：上一回合换入后若没触发任何入场特性消息，排除入场必触发特性
        if (pklmOppJustSwitched && !pklmOppAbilityTriggered) {
            pklmExcludeEntryAbilities();
        }
        pklmOppJustSwitched = false;
        pklmOppAbilityTriggered = false;
        pklmPushTurn();
        pklmTurnLog = "Turn " + turn + ": ";
    },
    onUseAttack: function (spot, attack) {
        try {
            pklmTurnLog += pklmSpotLabel(spot) + " used " + sys.move(attack) + ". ";
            pklmLastMove[spot] = sys.move(attack);   // 记录最后招式名（供 %m 占位符）
            if (spot === battle.opp) {
                var mv = { name: sys.move(attack), type: pklmTypeName(sys.moveType(attack)), num: attack };
                // 记到「当前场上这只」名下（按记录 slot 区分），换人后招式不串
                var list = pklmOppMoves[pklmCurrentOppSlot] || [];
                var dup = false;
                for (var i = 0; i < list.length; i++) {
                    if (list[i].name === mv.name) { dup = true; break; }
                }
                if (!dup) list.push(mv);
                pklmOppMoves[pklmCurrentOppSlot] = list;
                // 使用次数计数（PO 不给对手招式数据 —— 实测 .move(j) 返回 num=0/PP=0，只能自己记）
                var useMap = pklmOppMoveUse[pklmCurrentOppSlot] || {};
                useMap[attack] = (useMap[attack] || 0) + 1;
                pklmOppMoveUse[pklmCurrentOppSlot] = useMap;
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
            // 我方倒下 → 接下来的「补位」决策是新宝可梦，要清掉上一只留下的被拒槽位（同上，按槽位记会串味）
            if (spot === battle.me) { pklmBannedSlots = []; pklmBannedSwitch = []; }
        } catch (e) {}
    },
    onSendOut: function (spot, prevIndex) {
        try {
            var nm = sys.pokemon(pklmFpoke(spot).pokemon.numRef);
            pklmTurnLog += pklmSpotLabel(spot) + " sent out " + nm + ". ";
            // 换人当回合 PO 的 statBoost() 会残留换下那只的等级 → 本回合该侧一律报 0（见 pklmCollectBoosts）
            pklmBoostsReset[spot === battle.opp ? 'opp' : 'me'] = true;
            if (spot === battle.opp) {
                pklmOppSwap(prevIndex);        // 更新当前场上记录 slot（prevIndex=上场前所在槽位）
                pklmLoadOppPossible();         // 加载可能特性列表（首次出场）
                pklmOppJustSwitched = true;    // 标记待反向排除入场特性
                pklmOppAbilityTriggered = false;
                var seen = false;
                for (var i = 0; i < pklmOppSeen.length; i++) {
                    if (pklmOppSeen[i] === nm) { seen = true; break; }
                }
                if (!seen) pklmOppSeen.push(nm);
            } else {
                // 记录我方已出场宝可梦 numRef（非 team preview 时用于标记对方未知的后备）
                var myNum = pklmFpoke(spot).pokemon.numRef;
                if (myNum > 0 && pklmMyRevealed.indexOf(myNum) === -1) {
                    pklmMyRevealed.push(myNum);
                }
                // 被拒记录是「**这只宝可梦**的某个槽位不可用」→ 换人后不再适用，必须清空。
                // 不清的后果（battle94 T20 实测）：Rotom 的 Volt Switch(slot 0) 被拒 → ban 槽位 0 →
                // 同一回合换上 Oranguru 后，它的 Psychic **也是 slot 0** 被误过滤，prompt 里只剩
                // Focus Blast/Trick/Shadow Ball → LLM 只能打 Shadow Ball(14%)，而正解 Psychic 有 23-28%。
                pklmBannedSlots = [];
                pklmBannedSwitch = [];
            }
        } catch (e) {}
    },
    onChoiceSelection: function (player) {
        if (player !== battle.me) return;
        pklmAutoEnable();   // 幂等兜底：**对战中途**才贴/换脚本时也能自动开启（原本只在 onTierNotification 调用 → 中途贴会整局没 AI）
        if (!useAI || battleEnd || !useLLM) return;
        pklmDecideAndAct();
    },
    onBattleEnd: function (result, winner) {
        pklmAutoUpdate();   // 自更新：对局结束是干净的时机（默认 ON，只升不降；`/llm update` 可关）
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
        try { pklmLogLine(pklmPossessive(spot) + " attack missed."); } catch (e) {}
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
        try { pklmLogLine(pklmPossessive(spot) + " pokemon was called back."); } catch (e) {}
    },
    onItemMessage: function (spot, item, part, foe, berry, other) {
        try {
            pklmCb("onItemMessage", "item=" + item + " part=" + part + " foe=" + foe + " berry=" + berry + " other=" + other);
            // 树果事件判据（实测 battle104 itemProbe）：`berry` = 树果的**道具编号**（8015 = Iapapa Berry），
            // `item` = 「树果消息号 + 8000」（8000 → berry_messages[0] `%s ate its %i!`；
            // 8006 → [6] `%s restored some HP!` —— 两条都与战报原文吻合）。
            // 旧代码拿 `berry` 当消息号查表 → 永远 txt:null；而且 berry=0 的那条（8006）会被误判成道具消息。
            // 旁证：主脚本 onItemMessage 也是「berry!==0 → 走 berry 分支」，只是它把 berry 直接当消息号用，
            // 于是落到 analyseCurrentItem 的 default → `info.item = 0`（歪打正着地做对了「树果一响就清道具」）。
            var isBerry = (berry && berry !== 0) || item >= 8000;
            var kind = isBerry ? 'berry' : 'item';
            var file = isBerry ? 'berry_messages.txt' : 'item_messages.txt';
            var msgNum = isBerry ? ((item >= 8000) ? (item - 8000) : berry) : item;
            var ictx = pklmMsgCtx(spot, undefined, other, undefined);
            if (isBerry && berry) {
                var bn = pklmItemName(berry);            // 树果名直接可读（不必靠文本清单）
                if (bn) ictx.i = bn;
            }
            // 道具消息：优先用主脚本那张「消息号 → 道具编号」硬表定位道具（不依赖文本）。
            // 它的用处有两处：① `%i` 兜底（`other` 读不到时）；② 对手道具命名（比文本清单可靠）。
            if (!isBerry && PKLM_ITEM_MSG_TO_ITEM[item] !== undefined) {
                var mm = PKLM_ITEM_MSG_TO_ITEM[item];
                // 数组 = 按 part 取值；数字直接就是道具编号（用 .length 判断，避免依赖 instanceof 在 QScript 的可用性）
                var mtRaw = (mm && mm.length) ? mm[(part === undefined || part === null || part < 0 || part >= mm.length) ? 0 : part] : mm;
                var mtName = pklmItemName(mtRaw);
                if (mtName && spot === battle.opp) pklmOppItem[pklmCurrentOppSlot] = mtName;
                if (mtName && !ictx.i) ictx.i = mtName;
            }
            // 注意：**非树果的道具消息不要**用 `other` 覆盖 `%i`。带 `%i` 的只有 36/37
            // （`%s's %i raised its %st!` / `%s's %i raised %m's power!`），那里的 `%i` 是**持有者自己的道具**
            // （同一个模板里 `%st` 才吃 `other` —— 与 berry msg 7 `The %i raised %s's %st!` 同构：一个 `other` 不能同时
            // 表示两个东西）。所以这里保留 `pklmItemLabel(spot)` 的原渲染。
            var txt = pklmRenderMsg(kind, file, msgNum, part, ictx);
            // 兜底：树果事件没查到模板时（消息编号不是 item-8000 而是别的编法），至少把「哪只吃掉了哪个果子」如实写出来，
            // 别再静默吞掉（旧代码这里永远 txt:null，整条树果事件在战报里是空白）。
            if (!txt && isBerry && berry) {
                var bnm = pklmItemName(berry);
                if (bnm) txt = pklmActiveName(spot) + " consumed its " + bnm + " (berry msg " + item + ", no template)";
            }
            pklmLogLine(txt);
            pklmMsgProbeLine(kind, file, msgNum, part, spot, foe, other, undefined, undefined, txt);
            // 对手道具：道具消息一旦触发，说明该道具已被「公开暴露」→ 记下来供 use_state 用。
            // 注意：**不能**用 pklmPoke(battle.opp).item —— 实测 PO 对对手恒返回 0（sys.item(0)="(No Item)"），
            // 会把 "(No Item)" 当成推断结果喂给 LLM/计算器。改为从消息文本里认道具名（受控清单）。
            if (spot === battle.opp) {
                var infItem = pklmInferItem(txt);
                if (infItem) pklmOppItem[pklmCurrentOppSlot] = infItem;
            }
            // 一次性消耗（白药草/气息腰带/精神药草/力量药草/果汁/红牌/逃脱按钮/狂暴基因/弱点保险/
            // 胆怯球/喉咙喷雾/逃脱包/大失误保险/客房服务 + 气球 part0 + 全部树果）：触发即用完 → 登记失去。
            // **不看直读**：实测「吃掉」那一刻直读还是旧值（itemProbe: team=8015），真正变 0 要等紧随的
            // 第二条消息 —— 靠直读会漏；而只发一条消息的道具（逃脱按钮/红牌）更是必然漏。
            // 放在 inferItem **之后**：被消耗掉的道具不能留在「对手已暴露道具」里。
            if (isBerry || PKLM_ITEM_MSG_CONSUME[item] || PKLM_ITEM_MSG_CONSUME_PART[item] === part) {
                pklmItemLose(spot, isBerry ? ('berry msg ' + msgNum + ' (eaten)')
                                           : ('item msg ' + item + ' (consumed)'));
            }
            // 临时探针（结案后删）：记录道具消息的原始参数 + 我方 6 只当时的 poke.item 原始编号，
            // 用来判 `team(me).poke(0).item` 在 Trick / Switcheroo / 打落 之后到底能不能读（battle99 T16 的疑点）。
            try {
                var snap = [];
                for (var pi = 0; pi < 6; pi++) {
                    try {
                        var ptp = pklmTpoke(pi);
                        snap.push(pi + ':' + ptp.numRef + '@' + ptp.item + '=' + pklmItemName(ptp.item));
                    } catch (pe) { snap.push(pi + ':err'); }
                }
                pklmItemProbe.push({
                    seq: pklmItemProbe.length + 1, spot: (spot === battle.me ? 'me' : 'opp'),
                    msg: item, part: part, foe: foe, berry: berry, other: other,
                    otherName: pklmItemName(other), txt: txt, mine: snap.join(' '),
                    // 两个来源各读一次：team(me).poke(0).item vs field.poke(me).pokemon.item
                    // （若两者不一致，修法就是改用 field 那一侧 —— battle99 T16 我方实际拿到 Choice Specs 却两处都读成空/围巾）
                    myself: (function () {
                        try {
                            var t0 = pklmTpoke(0).item, f0 = pklmFpoke(battle.me).pokemon.item;
                            return 'team=' + t0 + '(' + pklmItemName(t0) + ') field=' + f0 + '(' + pklmItemName(f0) + ')';
                        } catch (me2) { return 'err'; }
                    })()
                });
                if (pklmItemProbe.length > 20) pklmItemProbe.shift();
            } catch (e2) {}
        } catch (e) {}
    },
    onMoveMessage: function (spot, move, part, type, foe, other, q) {
        try {
            pklmCb("onMoveMessage", "move=" + move + " part=" + part + " type=" + type + " foe=" + foe + " other=" + other + " q=" + q);
            // 消息里的 `%i`（道具名）= 回调的 `other`，**不是**当前持有者的道具：
            // 用 pklmItemLabel(spot) 会在对手侧渲染成 "[item hidden by PO]"（名字直接丢掉），
            // 在我方侧渲染成我方的道具（方向可能正好相反）。battle104 T11 就是被这个坑写成
            // 「Indeedee obtained one Choice Scarf!」（它当场其实拿到的是 Choice Specs）。
            var mctx = pklmMsgCtx(spot, type, other, q);
            if (pklmMsgHas('move', 'move_message.txt', move, part, '%i')) {
                var inm = pklmItemArgName(other);
                if (inm) mctx.i = inm;
            }
            // `%p`（形态名）**按消息族不同**（实测 3 局 4 处）：
            //   137 变身 `%s transformed into %p!` → PO 写的是「百变怪 transformed into **Aegislash**」
            //        （= 被复制的那只 = **对侧**）→ 用自己会写成 "Ditto transformed into Ditto!"
            //   item 66 超进化 `%s has Mega Evolved into %p!` → 是**自己的新形态**，保持默认（自己）
            if (move === 137) mctx.p = pklmActiveName(pklmOtherSpot(spot));
            var txt = pklmRenderMsg('move', 'move_message.txt', move, part, mctx);
            pklmMsgProbeLine('move', 'move_message.txt', move, part, spot, foe, other, q, type, txt);
            pklmLogLine(txt);
            // 道具流向（依据 = 主脚本 analyseCurrentMoveMess 的 case 16/23/70/105/132/160/162）。
            // 顺序要紧：**先登记失去、再登记得到** —— 戏法/偷取是同一事件里「一进一出」，
            // 反过来的话 gain 会被紧随其后的 lose 抹掉。
            if (PKLM_MOVE_MSG_SWAP[move] && part === 1) {
                // 戏法 / 掉包：part1 `%s obtained one %i!` → spot 得到 other，对侧失去（对侧拿到的是我们换出去的）
                pklmItemLose(spot === battle.me ? battle.opp : battle.me, 'msg' + move + ' part1 (swapped away)');
                pklmItemGain(spot, other, 'msg' + move + ' part1 (obtained by swap)');
            } else if (PKLM_MOVE_MSG_STEAL[move]) {
                // 小偷 / 索取：spot 得到 other，foe 失去
                pklmItemLose(foe, 'msg' + move + ' (stolen from)');
                pklmItemGain(spot, other, 'msg' + move + ' (stole)');
            } else if (PKLM_MOVE_MSG_LOSE_FOE[move]) {
                // 虫咬·啄食 / 打落 / 烧尽：foe 的道具被吃掉或销毁，other 是那个（已不在的）道具
                pklmItemLose(foe, 'msg' + move + ' (destroyed/consumed)');
            } else if (PKLM_MOVE_MSG_REGAIN[move]) {
                pklmItemGain(spot, other, 'msg' + move + ' (recycled)');
            } else if (PKLM_MOVE_MSG_GIVE_FOE[move]) {
                pklmItemGain(foe, other, 'msg' + move + ' (given)');
            }
            // 招式消息里「白送对方特性」的几条（吸盘/结实/湿气/污泥浆…）：归属按上表 owner 决定，
            // 属于对手就记进 pklmOppAbility（= state.abilityInferred，喂给 prompt 与 from_state）。
            var rev = PKLM_MOVE_ABILITY_REVEAL[move];
            if (rev && (rev.part === null || rev.part === part)) {
                var ownerSide = (rev.owner === 'f') ? foe : spot;
                if (ownerSide === battle.opp) {
                    var revAb = rev.fromOther ? other : rev.ab;
                    if (revAb > 0) pklmOppAbility[pklmCurrentOppSlot] = revAb;
                }
            }
            // 招式消息里也可能暴露对手道具（如察觉类/道具被点名的那些）。
            // **销毁类消息要排除**：文本里出现那个名字恰恰说明它已经没了，回填等于把错数据喂给 LLM。
            if (!PKLM_MOVE_MSG_ITEM_GONE[move] && (foe || spot === battle.opp) && txt) {
                var infItem2 = pklmInferItem(txt);
                if (infItem2) pklmOppItem[pklmCurrentOppSlot] = infItem2;
            }
            // 双墙/极光幕：PO 用消息编号 73（反射壁/光墙）与 236（极光幕）通知开关，受益方 = 使用者这一侧
            if (move === 73 || move === 236) {
                var side = (spot === battle.opp) ? 'opp' : 'me';
                if (!pklmScreens[side]) pklmScreens[side] = {};
                if (move === 73) {
                    if (part === 0 || part === 2) pklmScreens[side].reflect = pklmCurrentTurn;
                    if (part === 1 || part === 3) pklmScreens[side].lightScreen = pklmCurrentTurn;
                    if (part === 4) delete pklmScreens[side].reflect;
                    if (part === 5) delete pklmScreens[side].lightScreen;
                } else {
                    if (part === 0) pklmScreens[side].auroraVeil = pklmCurrentTurn;
                    if (part === 1) delete pklmScreens[side].auroraVeil;
                }
            }
        } catch (e) {}
    },
    onAbilityMessage: function (spot, ab, part, type, foe, other) {
        try {
            pklmCb("onAbilityMessage", "ab=" + ab + " part=" + part + " type=" + type + " foe=" + foe + " other=" + other);
            // `%i` 取回调 `other`（察觉 23「frisked %f and found its %i」、顺手牵羊 78、收获 88、捡拾 93）
            var actx = pklmMsgCtx(spot, type, other, undefined, other);
            if (pklmMsgHas('ability', 'ability_messages.txt', ab, part, '%i')) {
                var ainm = pklmItemArgName(other);
                if (ainm) actx.i = ainm;
            }
            // `%m`（招式名）在**特性消息**里指的是「**对方**打过来的那一招」，不是持有者自己的招：
            //   19 Flash Fire `%s's Flash Fire made %m ineffective!`（挡住的是对方那招）
            //   22 Forewarn  `%s's Forewarn makes it wary of %m!`（对方最强的招）
            //   129          `%f cannot use %m!`（`%f` = 对方，`%m` = 它的招）
            // 默认 ctx.m = pklmLastMove[spot] 在这里会写出「持有者自己的招」，是假话 → 换成对侧。
            // （招式/道具/树果消息里的 `%m` 反过来是**持有者自己**的招，例如 128 `%f's substitute blocked %m!`、
            //   37 `%s's %i raised %m's power!`、berry 4/5 `%s's %i weakened %m's power!` → 那边保持默认。）
            if (pklmMsgHas('ability', 'ability_messages.txt', ab, part, '%m')) {
                actx.m = pklmLastMove[pklmOtherSpot(spot)] || '';
            }
            // ability 81 = 变身者/Imposter 的 `%s transformed into %p!` → `%p` 同 move 137，是**对侧**那只的名字
            if (ab === 81) actx.p = pklmActiveName(pklmOtherSpot(spot));
            var txt = pklmRenderMsg('ability', 'ability_messages.txt', ab, part, actx);
            pklmMsgProbeLine('ability', 'ability_messages.txt', ab, part, spot, foe, other, undefined, type, txt);
            pklmLogLine(txt);
            if (spot === battle.opp) {
                pklmOppAbilityTriggered = true;  // 本回合触发过特性消息（供反向排除）
                var ability = pklmAnalyseAbility(ab, part, other, type);
                if (ability > 0) {
                    pklmOppAbility[pklmCurrentOppSlot] = ability;
                }
            }
            // 黏着（122）：这只的道具**永远不会**被拿走（打落/戏法/偷取全都失败）→ 记下来，
            // 之后所有「失去」事件一律跳过。不记的话会把「黏着挡住了打落」误当成「道具被销毁」。
            if (PKLM_ABIL_MSG_STICKY[ab]) {
                var skey = (spot === battle.me) ? ('me:' + pklmMyItemNumRef()) : ('opp:' + pklmCurrentOppSlot);
                pklmStickyHold[skey] = true;
            }
            // 察觉（23）：`%s frisked %f and found its %i!` —— 只是**暴露** foe 的道具，不改归属。
            // 这是少数几个能直接读到对手道具的来源（PO 对对手 poke.item 恒返回 0），别浪费。
            if (PKLM_ABIL_MSG_FRISK[ab] && foe === battle.opp) {
                var fnm = pklmItemArgName(other);
                if (fnm) pklmOppItem[pklmCurrentOppSlot] = fnm;
            }
            // 顺手牵羊（78）：spot 得到 + foe 失去（同「小偷」，先失去后得到）
            if (PKLM_ABIL_MSG_STEAL[ab]) {
                pklmItemLose(foe, 'ability msg ' + ab + ' (stolen from)');
                pklmItemGain(spot, other, 'ability msg ' + ab + ' (stole)');
            } else if (PKLM_ABIL_MSG_REGAIN[ab]) {
                // 收获（88）/ 捡拾（93）：spot 单方面重新拿到道具，没有对侧失去
                pklmItemGain(spot, other, 'ability msg ' + ab + ' (regained)');
            } else if (PKLM_ABIL_MSG_LOSE_SPOT[ab]) {
                // 熟成（156）：吃掉自己的果子 → spot 失去
                pklmItemLose(spot, 'ability msg ' + ab + ' (berry eaten)');
            }
        } catch (e) {}
    },
    onTierNotification: function (tier) {
        pklmAutoEnable();
        pklmCheckMsgFiles();   // 对战启动扫描消息表文件依赖，缺失则提示
        pklmProbeReset();      // 每局清空 probe 落盘文件（写一行带版本/局号的表头）
        // 重置对手记录（slot 追踪 + 特性解析）
        pklmOppMoves = [[], [], [], [], [], []];
        pklmOppMoveUse = [{}, {}, {}, {}, {}, {}];
        pklmOppSlots = [0, 1, 2, 3, 4, 5];
        pklmCurrentOppSlot = 0;
        pklmOppAbility = [-1, -1, -1, -1, -1, -1];
        pklmOppItem = [null, null, null, null, null, null];
        pklmMyItemProved = {};      // 我方道具旁证按 numRef 存 → **必须**每局重置，否则上一局换到的道具会漏到下一局
        pklmStickyHold = {};        // 黏着记录同理
        pklmScreens = { me: {}, opp: {} };
        pklmOppPossible = [[], [], [], [], [], []];
        pklmOppJustSwitched = false;
        pklmOppAbilityTriggered = false;
        pklmOppSeen = [];
        pklmMyRevealed = [];
        // 探针（0.6.29，临时）：开战末尾尝试热更，见 pklmStartUpdateProbe 注释
        pklmStartUpdateProbe();
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
        // 指令被 PO 拒绝：区分「换人被拒」（踩影等）与「招式被拒」（专爱锁招/挑衅/倒下等），分别 ban 掉并重新决策
        if (pklmLastSwitchSlot >= 1 && pklmBannedSwitch.indexOf(pklmLastSwitchSlot) === -1) {
            pklmBannedSwitch.push(pklmLastSwitchSlot);
            pklmPrint("switch slot " + pklmLastSwitchSlot + " rejected, banned, re-decide");
            pklmLastSwitchSlot = -1;
        } else if (pklmLastAttackSlot >= 0 && pklmBannedSlots.indexOf(pklmLastAttackSlot) === -1) {
            pklmBannedSlots.push(pklmLastAttackSlot);
            pklmPrint("slot " + pklmLastAttackSlot + " rejected, banned, re-decide");
            // 回滚：本次发送时乐观写入的 pklmLastAttackSlot 要还原，否则 pklmCheckLock 会把「被拒的那一招」误当成锁招
            pklmLastAttackSlot = pklmPrevAttackSlot;
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
    onReconnect: function (player) {
        try {
            if (player !== client.ownId()) return;   // 只有我方重连才处理
            // 断线重连后战场状态可能损坏，停止 LLM 决策并延迟认输（对齐主脚本 onReconnect 兜底）
            pklmPrint("onReconnect: me, forfeit in 30s");
            battleEnd = true;
            sys.setTimer(function () {
                try { battle.forfeit(); } catch (e) {}
            }, 30000, 0);
        } catch (e) {}
    }
});
