// build-knowledge.js — 从 movedata.json + data/moves_effect.json 构建 knowledge/*.json
// 运行：node po-pokellmon/build-knowledge.js
// 产物：knowledge/moves.json（num -> {name,power,accuracy,category,effect}）、knowledge/typechart.json

const fs = require('fs');
const path = require('path');

const ROOT = __dirname; // po-pokellmon/
const DATA = path.join(ROOT, 'data');
const KNOWLEDGE = path.join(ROOT, 'knowledge');

// 类型名称（PO 编号 0-17，与 sys.type(num) 对齐）
const TYPE_NAMES = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy'];

// 18x18 克制表（行=攻击属性，列=防御属性），取自 20201227.js 的 typechart()，去掉"无"列
const TYPECHART = [
  [1, 1, 1, 1, 1, 0.5, 1, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [2, 1, 0.5, 0.5, 1, 2, 0.5, 0, 2, 1, 1, 1, 1, 0.5, 2, 1, 2, 0.5],
  [1, 2, 1, 1, 1, 0.5, 2, 1, 0.5, 1, 1, 2, 0.5, 1, 1, 1, 1, 1],
  [1, 1, 1, 0.5, 0.5, 0.5, 1, 0.5, 0, 1, 1, 2, 1, 1, 1, 1, 1, 2],
  [1, 1, 0, 2, 1, 2, 0.5, 1, 2, 2, 1, 0.5, 2, 1, 1, 1, 1, 1],
  [1, 0.5, 2, 1, 0.5, 1, 2, 1, 0.5, 2, 1, 1, 1, 1, 2, 1, 1, 1],
  [1, 0.5, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 0.5, 1, 2, 1, 2, 1, 1, 2, 0.5],
  [0, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0.5, 1],
  [1, 1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 0.5, 1, 0.5, 1, 2, 1, 1, 2],
  [1, 1, 1, 1, 1, 0.5, 2, 1, 2, 0.5, 0.5, 2, 1, 1, 2, 0.5, 1, 1],
  [1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0.5, 0.5, 1, 1, 1, 0.5, 1, 1],
  [1, 1, 0.5, 0.5, 2, 2, 0.5, 1, 0.5, 0.5, 2, 0.5, 1, 1, 1, 0.5, 1, 1],
  [1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 2, 0.5, 0.5, 1, 1, 0.5, 1, 1],
  [1, 2, 1, 2, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 0.5, 1, 1, 0, 1],
  [1, 1, 2, 1, 2, 1, 1, 1, 0.5, 0.5, 0.5, 2, 1, 1, 0.5, 2, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 1, 1, 2, 1, 0],
  [1, 0.5, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0.5, 0.5],
  [1, 2, 1, 0.5, 1, 1, 1, 1, 0.5, 0.5, 1, 1, 1, 1, 1, 2, 2, 1]
];

// 招式分类映射（PO 编号 -> 名称）
const CATEGORY = { 0: 'Status', 1: 'Physical', 2: 'Special' };

// 读取 JSON 并剥离可能的 UTF-8 BOM
function readJSON(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

// 招式名归一化：小写 + 去非字母数字（匹配 PokeLLMon moves_effect.json 的 key 规则）
function normalize(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 构建 moves.json：num -> {name, power, accuracy, category, effect}
function buildMoves() {
  const movedata = readJSON(path.join(ROOT, '..', 'movedata.json'));
  const movesEffect = readJSON(path.join(DATA, 'moves_effect.json'));
  const result = {};
  let effectHit = 0;
  for (const m of movedata) {
    const norm = normalize(m.name);
    const effect = movesEffect[norm] || '';
    if (effect) effectHit++;
    result[m.num] = {
      name: m.name,
      power: m.power || 0,
      accuracy: m.accurcy || 0,
      category: CATEGORY[m.category] || 'Status',
      effect: effect
    };
  }
  return { result, effectHit, total: movedata.length };
}

function buildTypechart() {
  return { types: TYPE_NAMES, chart: TYPECHART };
}

function main() {
  fs.mkdirSync(KNOWLEDGE, { recursive: true });

  const { result: moves, effectHit, total } = buildMoves();
  fs.writeFileSync(path.join(KNOWLEDGE, 'moves.json'), JSON.stringify(moves, null, 2));

  fs.writeFileSync(path.join(KNOWLEDGE, 'typechart.json'), JSON.stringify(buildTypechart(), null, 2));

  console.log('moves.json: ' + Object.keys(moves).length + ' moves (' + effectHit + '/' + total + ' 有 effect 描述)');
  console.log('typechart.json: ' + TYPE_NAMES.length + ' types');
}

main();
