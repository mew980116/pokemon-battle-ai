// po-pokellmon-tool/test-calc-compare.js
// 对比我们的 calc_damage 与 @smogon/calc（PS 官方计算器）的结果，验证基础伤害公式 + 能力等级修正。
// 用法：node test-calc-compare.js
// 注意：@smogon/calc 装在 C:\temp-calc\node_modules（npm 在 UNC 路径有 realpath 递归 bug，需在本地盘装）。

const smogon = require('C:/temp-calc/node_modules/@smogon/calc');
const tools = require('./tools.js');

function evObj(arr) {
    return { hp: arr[0], atk: arr[1], def: arr[2], spa: arr[3], spd: arr[4], spe: arr[5] };
}

const IV31 = [31, 31, 31, 31, 31, 31];

const cases = [
    // ===== 基础（属性克制/STAB/免疫）=====
    { name: '物理 1x', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '特殊 2x', attacker: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball' },
    { name: '本系+克制 4x', attacker: { poke: 'Dragonite', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Dragonite', ev: [0, 0, 0, 0, 0, 252], nature: 'Jolly' }, move: 'Outrage' },
    { name: '免疫 0x', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Tornadus', ev: [252, 0, 0, 0, 0, 252], nature: 'Timid' }, move: 'Earthquake' },

    // ===== 能力等级（boosts）=====
    { name: '物攻+1', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 1 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '物攻+2', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 2 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '物攻+3', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 3 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '物攻+6', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 6 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '物攻-1', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: -1 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '物攻-2', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: -2 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: '特攻+2', attacker: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid', boosts: { spa: 2 } }, defender: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball' },
    { name: '特攻+1', attacker: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid', boosts: { spa: 1 } }, defender: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball' },
    { name: '防守方防御+1', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold', boosts: { def: 1 } }, move: 'Earthquake' },
    { name: '防守方防御+2', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold', boosts: { def: 2 } }, move: 'Earthquake' },
    { name: '防守方特防+1', attacker: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm', boosts: { spd: 1 } }, move: 'Shadow Ball' },
    { name: '物攻+2 vs 防御+1', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 2 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold', boosts: { def: 1 } }, move: 'Earthquake' },
    { name: '物攻+1 vs 特防+2(非对应)', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', boosts: { atk: 1 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold', boosts: { spd: 2 } }, move: 'Earthquake' },

    // ===== extra 系数（我们手动补修正 vs @smogon 自动算）=====
    { name: '灼伤 extra0.5', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake', extra: 0.5, smogonAttackerExtra: { status: 'brn' } },
    { name: '达人带 extra1.2(克制2x)', attacker: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball', extra: 1.2, smogonAttackerExtra: { item: 'Expert Belt' } },
    { name: '生命宝珠 extra1.3', attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake', extra: 1.3, smogonAttackerExtra: { item: 'Life Orb' } },
];

let diff = 0;
for (const c of cases) {
    const leg = { attacker: c.attacker, defender: c.defender, move: { name: c.move } };
    if (c.extra !== undefined && c.extra !== null) leg.extra = c.extra;
    const ours = tools.runTool('calc_damage', { legs: [leg] }, {});
    const ol = ours.legs[0];
    if (ol.error) {
        console.log('[ERR ] ' + c.name + ': ours error ' + ol.error);
        diff++;
        continue;
    }
    const atk = new smogon.Pokemon(8, c.attacker.poke, Object.assign({ evs: evObj(c.attacker.ev), nature: c.attacker.nature, boosts: c.attacker.boosts || {} }, c.smogonAttackerExtra || {}));
    const def = new smogon.Pokemon(8, c.defender.poke, Object.assign({ evs: evObj(c.defender.ev), nature: c.defender.nature, boosts: c.defender.boosts || {} }, c.smogonDefenderExtra || {}));
    const mv = new smogon.Move(8, c.move);
    const res = smogon.calculate(8, atk, def, mv);
    const sm = res.range();
    const same = (ol.min === sm[0] && ol.max === sm[1]);
    if (!same) diff++;
    console.log('[' + (same ? 'OK  ' : 'DIFF') + '] ' + c.name + ': ' + c.attacker.poke + ' ' + c.move + ' vs ' + c.defender.poke);
    if (!same) {
        console.log('  ours:   ' + ol.min + '-' + ol.max + ' (' + ol.percent_min + '%-' + ol.percent_max + '%)');
        console.log('  smogon: ' + sm[0] + '-' + sm[1]);
    }
}
console.log('\n结果：' + (cases.length - diff) + '/' + cases.length + ' 一致');
