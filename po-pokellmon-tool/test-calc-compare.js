// po-pokellmon-tool/test-calc-compare.js
// 对比我们的 calc_damage 与 @smogon/calc（PS 官方计算器）的结果，验证基础伤害公式。
// 用法：node test-calc-compare.js
// 注意：@smogon/calc 装在 C:\temp-calc\node_modules（npm 在 UNC 路径有 realpath 递归 bug，需在本地盘装）。

const smogon = require('C:/temp-calc/node_modules/@smogon/calc');
const tools = require('./tools.js');

function evObj(arr) {
    return { hp: arr[0], atk: arr[1], def: arr[2], spa: arr[3], spd: arr[4], spe: arr[5] };
}

const cases = [
    { name: '物理 1x', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '特殊 2x', attacker: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball' },
    { name: '本系+克制 4x', attacker: { poke: 'Dragonite', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Dragonite', ev: [0, 0, 0, 0, 0, 252], nature: 'Jolly' }, move: 'Outrage' },
    { name: '抵抗 0.5x', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Togekiss', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '免疫 0x', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Tornadus', ev: [252, 0, 0, 0, 0, 252], nature: 'Timid' }, move: 'Earthquake' },
    { name: '物攻提升1级', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 1 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
];

let diff = 0;
for (const c of cases) {
    const ours = tools.runTool('calc_damage', { legs: [{ attacker: c.attacker, defender: c.defender, move: { name: c.move } }] }, {});
    const ol = ours.legs[0];
    const atk = new smogon.Pokemon(8, c.attacker.poke, { evs: evObj(c.attacker.ev), nature: c.attacker.nature, boosts: c.attacker.boosts || {} });
    const def = new smogon.Pokemon(8, c.defender.poke, { evs: evObj(c.defender.ev), nature: c.defender.nature });
    const mv = new smogon.Move(8, c.move);
    const res = smogon.calculate(8, atk, def, mv);
    const sm = res.range();
    const same = (ol.min === sm[0] && ol.max === sm[1]);
    if (!same) diff++;
    console.log('[' + (same ? 'OK ' : 'DIFF') + '] ' + c.name + ': ' + c.attacker.poke + ' ' + c.move + ' vs ' + c.defender.poke);
    console.log('  ours:   ' + ol.min + '-' + ol.max + ' (' + ol.percent_min + '%-' + ol.percent_max + '%)');
    console.log('  smogon: ' + sm[0] + '-' + sm[1]);
}
console.log('\n结果：' + (cases.length - diff) + '/' + cases.length + ' 一致');
