// po-pokellmon-tool/build-knowledge.js — 从 po-data + movedata.json 构建 tool 专用知识库
// 运行：node po-pokellmon-tool/build-knowledge.js
// 产物（knowledge/）：
//   pokemon.json   num -> {name_en, name_zh, baseStats[6], types[..]} + byName 反向索引
//   natures.json   num -> {name_en, name_zh, buff, debuff} + byName 反向索引
//   moves.json     num -> {name, power, accuracy, category, type}（含 type，供 calc_damage 查招式属性）
//
// 说明：只收录 forme=0（基础形态）——当前环境为 Gen8 单打，无 Mega/Z/极巨化（见 server.js system prompt）。

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;                          // po-pokellmon-tool/
const DATA = path.join(ROOT, '..', 'po-data');   // po-data/
const MOVEDATA = path.join(ROOT, '..', 'movedata.json');
const KNOWLEDGE = path.join(ROOT, 'knowledge');

// 类型名称（PO 编号 0-17，与 sys.type(num) 对齐；18=无类型）
const TYPE_NAMES = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy'];

// 性格英文名（标准 25 个，编号 0-24，与 zh-cn/db/natures/nature.txt 顺序一致）
const NATURE_NAMES = [
    'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
    'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
    'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
    'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
    'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
];
// 性格加成：buff/debuff 值为能力编号（1=Atk 2=Def 3=SpA 4=SpD 5=Spe；0=无），
// 硬编码自 20201227.js calcBaseStats（L99-100）。
const NATURE_BUFF = [0, 1, 1, 1, 1, 2, 0, 2, 2, 2, 5, 5, 0, 5, 5, 3, 3, 3, 0, 3, 4, 4, 4, 4, 0];
const NATURE_DEBUFF = [0, 2, 5, 3, 4, 1, 0, 5, 3, 4, 1, 2, 0, 3, 4, 1, 2, 5, 0, 4, 1, 2, 5, 3, 0];

// 招式分类映射（movedata.json category -> 名称）
const CATEGORY = { 0: 'Status', 1: 'Physical', 2: 'Special' };

// 读取文件并剥离 UTF-8 BOM
function readText(file) {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

// 解析 "num:forme" 或 "num:forme:M" / "num:forme:G" -> {num, forme, tag}
function parsePokeId(token) {
    const parts = String(token).split(':');
    return {
        num: parseInt(parts[0], 10),
        forme: parts[1] ? parseInt(parts[1], 10) : 0,
        tag: parts[2] || null
    };
}

// 构建 pokemon.json（收录基础形态 + 合法形态，排除 Mega 'M' / 极巨化 'G'）
function buildPokemon() {
    const byNum = {};
    const byName = {};

    function keyOf(num, forme) {
        return forme === 0 ? String(num) : (num + ':' + forme);
    }

    // 1) 英文名 + tag（pokemons.txt 决定收录范围：跳过 Mega 'M' / 极巨化 'G'）
    const nameEn = {};
    const enLines = readText(path.join(DATA, 'pokes', 'pokemons.txt')).split('\n');
    for (const line of enLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const id = parsePokeId(t.substring(0, idx));
        if (id.tag === 'M' || id.tag === 'G') continue;   // Mega / Gigantamax 不收
        nameEn[keyOf(id.num, id.forme)] = t.substring(idx + 1).trim();
    }

    // 2) 种族值（num:forme hp atk def spa spd spe）
    const stats = readText(path.join(DATA, 'pokes', 'stats.txt')).split('\n');
    for (const line of stats) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        const id = parsePokeId(parts[0]);
        const key = keyOf(id.num, id.forme);
        if (nameEn[key] === undefined) continue;   // 没名字（或已排除 Mega/Gmax）跳过
        byNum[key] = byNum[key] || { num: id.num, forme: id.forme };
        byNum[key].baseStats = parts.slice(1, 7).map(Number);
    }

    // 3) 属性 type1（18 属性名；形态缺条目时继承基础形态）
    const type1 = readText(path.join(DATA, 'pokes', 'type1.txt')).split('\n');
    for (const line of type1) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        const id = parsePokeId(parts[0]);
        const key = keyOf(id.num, id.forme);
        if (!byNum[key]) continue;
        const tn = parseInt(parts[1], 10);
        byNum[key].types = [TYPE_NAMES[tn] || 'Normal'];
    }
    // 形态继承基础形态的 type1（type1.txt 通常只有 forme=0 条目）
    for (const key in byNum) {
        const p = byNum[key];
        if (p.forme !== 0 && !p.types) {
            const base = byNum[String(p.num)];
            p.types = (base && base.types) ? [base.types[0]] : [];
        }
    }

    // 4) 属性 type2（18=无第二属性；各形态有各自条目）
    const type2 = readText(path.join(DATA, 'pokes', 'type2.txt')).split('\n');
    for (const line of type2) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        const id = parsePokeId(parts[0]);
        const key = keyOf(id.num, id.forme);
        if (!byNum[key]) continue;
        const tn = parseInt(parts[1], 10);
        if (tn !== 18) {
            if (!byNum[key].types) byNum[key].types = [];
            byNum[key].types.push(TYPE_NAMES[tn]);
        }
    }

    // 5) 英文名写入 + byName
    for (const key in nameEn) {
        if (!byNum[key]) continue;
        byNum[key].name_en = nameEn[key];
        byName[nameEn[key].toLowerCase()] = key;
    }

    // 6) 中文名（zh-cn，同样跳过 Mega/Gmax）
    const zhLines = readText(path.join(DATA, 'zh-cn', 'db', 'pokes', 'pokemons.txt')).split('\n');
    for (const line of zhLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const id = parsePokeId(t.substring(0, idx));
        if (id.tag === 'M' || id.tag === 'G') continue;
        const key = keyOf(id.num, id.forme);
        if (!byNum[key]) continue;
        byNum[key].name_zh = t.substring(idx + 1).trim();
        byName[byNum[key].name_zh] = key;
    }

    return { byNum, byName };
}

// 构建 natures.json
function buildNatures() {
    const byNum = {};
    const byName = {};

    // 中文名（zh-cn/db/natures/nature.txt：num 中文名）
    const zh = readText(path.join(DATA, 'zh-cn', 'db', 'natures', 'nature.txt')).split('\n');
    for (const line of zh) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        const num = parseInt(t.substring(0, idx), 10);
        byNum[num] = byNum[num] || {};
        byNum[num].name_zh = t.substring(idx + 1).trim();
    }

    for (let i = 0; i < 25; i++) {
        byNum[i] = byNum[i] || {};
        byNum[i].name_en = NATURE_NAMES[i];
        byNum[i].buff = NATURE_BUFF[i];
        byNum[i].debuff = NATURE_DEBUFF[i];
        byName[NATURE_NAMES[i].toLowerCase()] = i;
        if (byNum[i].name_zh) byName[byNum[i].name_zh] = i;
    }

    return { byNum, byName };
}

// 构建 moves.json（num -> {name, name_zh, power, accuracy, category, type, priority, tags}）
// 数据源：movedata.json（name/power/accurcy/category/priority/voice/ironFist/reckless/strongJaw/megaLauncher）
//        + po-data/moves/8G/type.txt（type）+ zh-cn/db/moves/moves.txt（中文名）
//        + po-data/moves/8G/flags.txt（位掩码 bit0=contact，补 touch——movedata.json 的 touch 字段大量为 null）
function buildMoves() {
    const movedata = JSON.parse(readText(MOVEDATA));

    // 招式属性：movenum type编号（稀疏文件，缺省=Normal 0）
    const typeMap = {};
    const typeLines = readText(path.join(DATA, 'moves', '8G', 'type.txt')).split('\n');
    for (const line of typeLines) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        typeMap[parseInt(parts[0], 10)] = parseInt(parts[1], 10);
    }

    // 中文招式名：movenum 中文名
    const zhMap = {};
    const zhLines = readText(path.join(DATA, 'zh-cn', 'db', 'moves', 'moves.txt')).split('\n');
    for (const line of zhLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const name = t.substring(idx + 1).trim();
        if (name) zhMap[num] = name;
    }

    // 接触类：8G/flags.txt 位掩码 bit0=contact
    const touchMap = {};
    const flagLines = readText(path.join(DATA, 'moves', '8G', 'flags.txt')).split('\n');
    for (const line of flagLines) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        if ((parseInt(parts[1], 10) & 1) === 1) touchMap[parseInt(parts[0], 10)] = true;
    }

    // 对战效果描述：po-data/moves/8G/effect.txt（英文，num -> 精简对战效果，含数值）
    // 例：403 "Has a 30% chance to cause the target to flinch." / 14 "Raises the user's Attack by 2 stages."
    // 覆盖到 Gen8（763 条），描述对战实际效果且带数值，适合 LLM 决策。
    // 注：zh-cn/db/moves/8G/effect.txt 是游戏内展示文本（图鉴口吻，如「用连天空也能劈开的空气之刃进行攻击。有时会使对手畏缩。」），
    //     不含数值、偏图鉴，故不采用；po-data/moves/move_description.txt 同理（纯风味文本）。
    const effectMap = {};
    const effRaw = readText(path.join(DATA, 'moves', '8G', 'effect.txt'));
    for (const line of effRaw.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const d = t.substring(idx + 1).trim();
        if (d) effectMap[num] = d;
    }

    // 数值表（8G，格式 "num value"；0 表示无，跳过）
    function readNumTable(file) {
        const map = {};
        const raw = readText(path.join(DATA, 'moves', '8G', file));
        for (const line of raw.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            const parts = t.split(/\s+/);
            const k = parseInt(parts[0], 10);
            const v = parseInt(parts[1], 10);
            if (!isNaN(k) && !isNaN(v) && v !== 0) map[k] = v;
        }
        return map;
    }
    const effectChanceMap = readNumTable('effect_chance.txt');   // 附加效果触发概率 %
    const flinchMap = readNumTable('flinch_chance.txt');         // 畏缩概率 %
    const healingMap = readNumTable('healing.txt');              // 回复/自损 %（负值=自损）
    const critMap = readNumTable('crit_rate.txt');               // 暴击等级（>=1 为高暴击）

    // movedata.json 里已解析好的 5 个 tag 字段 -> tag 名
    const TAG_FIELDS = [['voice', 'voice'], ['ironFist', 'ironFist'], ['reckless', 'reckless'], ['strongJaw', 'strongJaw'], ['megaLauncher', 'megaLauncher']];

    const result = {};
    for (const m of movedata) {
        const tn = (typeMap[m.num] !== undefined) ? typeMap[m.num] : 0;
        const tags = [];
        for (let i = 0; i < TAG_FIELDS.length; i++) {
            if (m[TAG_FIELDS[i][0]]) tags.push(TAG_FIELDS[i][1]);
        }
        if (touchMap[m.num]) tags.push('touch');
        result[m.num] = {
            name: m.name,
            name_zh: zhMap[m.num] || '',
            power: m.power || 0,
            accuracy: m.accurcy || 0,
            category: CATEGORY[m.category] || 'Status',
            type: (tn === 18) ? null : (TYPE_NAMES[tn] || 'Normal'),
            priority: m.priority || 0,
            tags: tags,
            desc: effectMap[m.num] || '',
            effect_chance: effectChanceMap[m.num] || 0,
            flinch_chance: flinchMap[m.num] || 0,
            healing: healingMap[m.num] || 0,
            crit_rate: critMap[m.num] || 0
        };
    }
    return result;
}

// 构建 abilities.json（num -> {name, name_zh, desc_zh, desc_en, has_msg, merged}）
// 数据源：abilities.txt（英文名，含 A/B 合并）+ zh-cn abilities.txt（中文名）
//        + ability_desc.txt（中文描述）+ ability_battledesc.txt（英文描述）
//        + ability_messages.txt（判断是否有专门触发消息）
function buildAbilities() {
    const byNum = {};
    const byName = {};

    // 英文名（abilities.txt）：num name（可能含 A/B 合并标记）
    const enLines = readText(path.join(DATA, 'abilities', 'abilities.txt')).split('\n');
    for (const line of enLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const name = t.substring(idx + 1).trim();
        byNum[num] = byNum[num] || {};
        byNum[num].name = name;
        if (name.indexOf('/') >= 0) {
            byNum[num].merged = name.split('/').map(s => s.trim());
        }
    }

    // 完全合并（英文名无斜杠，但 PO 实际并入另一个特性，仅中文名暴露斜杠）
    const EXTRA_MERGED = { 164: ['Teravolt', 'Turboblaze'] };
    for (const num in EXTRA_MERGED) {
        if (byNum[num]) byNum[num].merged = EXTRA_MERGED[num];
    }

    // 中文名（zh-cn abilities.txt）：num 中文名
    const zhLines = readText(path.join(DATA, 'zh-cn', 'db', 'abilities', 'abilities.txt')).split('\n');
    for (const line of zhLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const name = t.substring(idx + 1).trim();
        if (byNum[num]) byNum[num].name_zh = name;
    }

    // 中文描述（ability_desc.txt）：num 描述（该文件为 UTF-16 LE 编码）
    const descZhRaw = fs.readFileSync(path.join(DATA, 'abilities', 'ability_desc.txt'), 'utf16le').replace(/^\uFEFF/, '');
    const descZhLines = descZhRaw.split('\n');
    // 覆盖 PO desc 错位（Gen8 删特性导致编号错位，历史遗留没改；按官方/PS/神奇宝贝百科修正）
    const DESC_OVERRIDE = {
        35: '有时能比对手先出手（30% 概率先制）。',
        50: '接触类招式能无视守住/看穿。',
        118: '出场时，我方的能力变化会复原。',
        131: '电属性招式威力提高 30%。',
        132: '龙属性招式威力提高 30%。',
        163: '对手不能吃树果；击倒对手后攻击或特攻升（视合体形态）。'
    };
    // 手工补充的机制 tips（PO 数据缺失的机制细节）
    const DESC_TIPS = {
        26: '（提示：该特性使宝可梦被视为不接触地面 grounded=false——不吃青草场地回复、不受电气场地影响、免疫撒菱/毒菱/黏黏网）'
    };
    for (const line of descZhLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const desc = t.substring(idx + 1).trim();
        if (byNum[num]) byNum[num].desc_zh = DESC_OVERRIDE[num] || (desc + (DESC_TIPS[num] || ''));
    }

    // 英文描述（ability_battledesc.txt）：num 描述
    const descEnLines = readText(path.join(DATA, 'abilities', 'ability_battledesc.txt')).split('\n');
    for (const line of descEnLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const desc = t.substring(idx + 1).trim();
        if (byNum[num]) byNum[num].desc_en = desc;
    }

    // 触发消息（ability_messages.txt）：特性英文名出现在消息文本里 → has_msg=true
    const msgLower = readText(path.join(DATA, 'abilities', 'ability_messages.txt')).toLowerCase();
    for (const num in byNum) {
        const a = byNum[num];
        const names = a.merged || [a.name];
        let hasMsg = false;
        for (const n of names) {
            if (n && n !== '(No Ability)' && msgLower.indexOf(n.toLowerCase()) >= 0) { hasMsg = true; break; }
        }
        a.has_msg = hasMsg;
        byName[a.name.toLowerCase()] = parseInt(num, 10);
        if (a.name_zh) {
            byName[a.name_zh] = parseInt(num, 10);
            if (a.name_zh.indexOf('/') >= 0) {
                for (const z of a.name_zh.split('/')) byName[z.trim()] = parseInt(num, 10);
            }
        }
        if (a.merged) {
            for (const n of a.merged) byName[n.toLowerCase()] = parseInt(num, 10);
        }
    }

    // 被 PO 删除的特性（Gen8 单打无效果，历史遗留；按官方/PS 补回，供 get_ability_info 查到）
    const DELETED = {
        'illuminate': { name: 'Illuminate', name_zh: '发光', desc: '野生遇敌率翻倍（对战无效果）。', note: 'PO 已删（单打无效果）' },
        'run away': { name: 'Run Away', name_zh: '逃足', desc: '能从野生战斗逃跑（对战无效果）。', note: 'PO 已删（单打无效果）' },
        'honey gather': { name: 'Honey Gather', name_zh: '集蜜', desc: '战斗后可能拾取蜂蜜（对战无效果）。', note: 'PO 已删（单打无效果）' },
        'healer': { name: 'Healer', name_zh: '治愈之心', desc: '双打中 30% 几率治愈队友异常状态。', note: 'PO 已删（单打无效果）' },
        'friend guard': { name: 'Friend Guard', name_zh: '友情守护', desc: '双打中队友受到的伤害减少 1/4。', note: 'PO 已删（单打无效果）' }
    };

    return { byNum, byName, deleted: DELETED };
}

// 构建 items.json（num -> {name, name_zh, desc_zh, desc_en, has_msg}）
// 数据源：items.txt（英文名）+ zh-cn items.txt（中文名）
//        + items_description.txt（英文描述）+ zh-cn items_description.txt（中文描述）
//        + item_messages.txt（判断是否有触发消息）
function buildItems() {
    const byNum = {};
    const byName = {};

    // 英文名（items.txt）：num name
    const enLines = readText(path.join(DATA, 'items', 'items.txt')).split('\n');
    for (const line of enLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const name = t.substring(idx + 1).trim();
        byNum[num] = byNum[num] || {};
        byNum[num].name = name;
    }

    // 中文名（zh-cn items.txt）：num 中文名
    const zhLines = readText(path.join(DATA, 'zh-cn', 'db', 'items', 'items.txt')).split('\n');
    for (const line of zhLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const name = t.substring(idx + 1).trim();
        if (byNum[num]) byNum[num].name_zh = name;
    }

    // 英文描述（items_description.txt）：num 描述
    const descEnLines = readText(path.join(DATA, 'items', 'items_description.txt')).split('\n');
    for (const line of descEnLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const desc = t.substring(idx + 1).trim();
        if (byNum[num]) byNum[num].desc_en = desc;
    }

    // 中文描述（zh-cn items_description.txt）：num 描述
    const descZhLines = readText(path.join(DATA, 'zh-cn', 'db', 'items', 'items_description.txt')).split('\n');
    for (const line of descZhLines) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        if (idx < 0) continue;
        const num = parseInt(t.substring(0, idx), 10);
        const desc = t.substring(idx + 1).trim();
        if (byNum[num]) byNum[num].desc_zh = desc;
    }

    // 触发消息（item_messages.txt）：道具英文名出现在消息文本里 → has_msg=true
    const msgLower = readText(path.join(DATA, 'items', 'item_messages.txt')).toLowerCase();
    for (const num in byNum) {
        const a = byNum[num];
        a.has_msg = (a.name && a.name !== '(No Item)' && msgLower.indexOf(a.name.toLowerCase()) >= 0);
        byName[a.name.toLowerCase()] = parseInt(num, 10);
        if (a.name_zh) byName[a.name_zh] = parseInt(num, 10);
    }

    return { byNum, byName };
}

// 构建 learnsets.json：招式学习面（数据源 = pokemon-showdown，比 PO 的更准确）
// 输出：{ source, byKey: { "244": [招式num...], "26:1": [...] } }，key 与 pokemon.json 的 byNum 一致
function buildLearnsets(pokemon) {
    const PS_DIST = process.env.PS_DIST || 'C:/temp-calc/node_modules/pokemon-showdown/dist/data';
    const psLearn = require(path.join(PS_DIST, 'learnsets.js')).Learnsets;
    const psMoves = require(path.join(PS_DIST, 'moves.js')).Moves;

    const moveNumById = {};
    for (const id in psMoves) {
        const m = psMoves[id];
        if (m && m.num > 0) moveNumById[id] = m.num;
    }

    // PS 的 id 规则：转小写、去重音（é->e）、去掉所有非字母数字（"Raichu-Alola" -> "raichualola"）
    function toId(s) {
        return String(s)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    // PO 与 PS 的拼写差异
    const ALIAS = { blacephelon: 'blacephalon' };
    const numOf = function (k) { const i = k.indexOf(':'); return i < 0 ? k : k.substring(0, i); };
    // 取有效学习面：PS 里部分形态条目存在但无 learnset（靠 baseSpecies 继承），这类要往下回退
    const tryLs = function (id) { const e = psLearn[id]; return (e && e.learnset) ? e : null; };

    // 先建立「基础形态 num -> 学习面」，供战斗中临时形态（Deoxys-Attack / Aegislash-Blade 等）回退
    const baseLs = {};
    for (const key in pokemon.byNum) {
        if (key.indexOf(':') >= 0) continue;
        const ls = tryLs(toId(pokemon.byNum[key].name_en));
        if (ls) baseLs[numOf(key)] = ls;
    }

    const byKey = {};
    const missed = [];
    for (const key in pokemon.byNum) {
        const p = pokemon.byNum[key];
        const nm = String(p.name_en);
        const ls = tryLs(toId(nm))
            || tryLs(ALIAS[toId(nm)])          // PO 拼写差异
            || tryLs(toId(nm.split('-')[0]))   // 去掉形态后缀
            || baseLs[numOf(key)]              // 回退到同编号基础形态
            || null;
        if (!ls) { missed.push(key + ' ' + nm); continue; }
        const nums = [];
        for (const mid in ls.learnset) {
            const n = moveNumById[mid];
            if (n) nums.push(n);
        }
        if (nums.length) byKey[key] = nums.sort(function (a, b) { return a - b; });
    }
    return { byKey: byKey, missed: missed };
}

function main() {
    fs.mkdirSync(KNOWLEDGE, { recursive: true });

    const pokemon = buildPokemon();
    fs.writeFileSync(path.join(KNOWLEDGE, 'pokemon.json'), JSON.stringify(pokemon, null, 2));
    const pn = Object.keys(pokemon.byNum).length;
    const pnn = Object.keys(pokemon.byName).length;

    const natures = buildNatures();
    fs.writeFileSync(path.join(KNOWLEDGE, 'natures.json'), JSON.stringify(natures, null, 2));

    const moves = buildMoves();
    fs.writeFileSync(path.join(KNOWLEDGE, 'moves.json'), JSON.stringify(moves, null, 2));

    const abilities = buildAbilities();
    fs.writeFileSync(path.join(KNOWLEDGE, 'abilities.json'), JSON.stringify(abilities, null, 2));

    const items = buildItems();
    fs.writeFileSync(path.join(KNOWLEDGE, 'items.json'), JSON.stringify(items, null, 2));

    const learnsets = buildLearnsets(pokemon);
    fs.writeFileSync(path.join(KNOWLEDGE, 'learnsets.json'), JSON.stringify({ source: 'pokemon-showdown', byKey: learnsets.byKey }));
    if (learnsets.missed.length) {
        fs.writeFileSync(path.join(KNOWLEDGE, 'learnsets.missed.txt'), learnsets.missed.join('\n'));
    }

    console.log('pokemon.json: ' + pn + ' pokemon, ' + pnn + ' name index entries');
    console.log('natures.json: ' + Object.keys(natures.byNum).length + ' natures');
    console.log('moves.json: ' + Object.keys(moves).length + ' moves (with type)');
    console.log('abilities.json: ' + Object.keys(abilities.byNum).length + ' abilities');
    console.log('items.json: ' + Object.keys(items.byNum).length + ' items');
    console.log('learnsets.json: ' + Object.keys(learnsets.byKey).length + ' pokemon (missed ' + learnsets.missed.length + ')');
}

main();
