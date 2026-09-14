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

// 构建 pokemon.json（只取 forme=0）
function buildPokemon() {
    const byNum = {};
    const byName = {};

    // 种族值：num:forme hp atk def spa spd spe
    const stats = readText(path.join(DATA, 'pokes', 'stats.txt')).split('\n');
    for (const line of stats) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        const id = parsePokeId(parts[0]);
        if (id.forme !== 0) continue;
        byNum[id.num] = byNum[id.num] || {};
        byNum[id.num].baseStats = parts.slice(1, 7).map(Number);
    }

    // 属性 type1 / type2（18=无第二属性）
    const type1 = readText(path.join(DATA, 'pokes', 'type1.txt')).split('\n');
    for (const line of type1) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        const id = parsePokeId(parts[0]);
        if (id.forme !== 0 || !byNum[id.num]) continue;
        const tn = parseInt(parts[1], 10);
        byNum[id.num].types = [TYPE_NAMES[tn] || 'Normal'];
    }
    const type2 = readText(path.join(DATA, 'pokes', 'type2.txt')).split('\n');
    for (const line of type2) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        const id = parsePokeId(parts[0]);
        if (id.forme !== 0 || !byNum[id.num]) continue;
        const tn = parseInt(parts[1], 10);
        if (tn !== 18) byNum[id.num].types.push(TYPE_NAMES[tn]);
    }

    // 英文名（pokes/pokemons.txt）——优先
    const enNames = readText(path.join(DATA, 'pokes', 'pokemons.txt')).split('\n');
    for (const line of enNames) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        const id = parsePokeId(t.substring(0, idx));
        if (id.forme !== 0 || !byNum[id.num]) continue;
        byNum[id.num].name_en = t.substring(idx + 1).trim();
        byName[byNum[id.num].name_en.toLowerCase()] = id.num;
    }

    // 中文名（zh-cn/db/pokes/pokemons.txt）——兜底
    const zhNames = readText(path.join(DATA, 'zh-cn', 'db', 'pokes', 'pokemons.txt')).split('\n');
    for (const line of zhNames) {
        const t = line.trim();
        if (!t) continue;
        const idx = t.indexOf(' ');
        const id = parsePokeId(t.substring(0, idx));
        if (id.forme !== 0 || !byNum[id.num]) continue;
        byNum[id.num].name_zh = t.substring(idx + 1).trim();
        byName[byNum[id.num].name_zh] = id.num;
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
            tags: tags
        };
    }
    return result;
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

    console.log('pokemon.json: ' + pn + ' pokemon, ' + pnn + ' name index entries');
    console.log('natures.json: ' + Object.keys(natures.byNum).length + ' natures');
    console.log('moves.json: ' + Object.keys(moves).length + ' moves (with type)');
}

main();
