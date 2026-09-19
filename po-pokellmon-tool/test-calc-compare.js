// po-pokellmon-tool/test-calc-compare.js
// 对比我们的 calc_damage 与 @smogon/calc（PS 官方计算器）的结果，验证基础伤害公式 + 能力等级修正
//  + 属性替换类招式（Body Press/Foul Play/Psyshock…）+ 必定暴击招式 + 连击 + 鳃咬/电喙翻倍。
// 用法：node test-calc-compare.js
// 注意：@smogon/calc 装在 C:\temp-calc\node_modules（npm 在 UNC 路径有 realpath 递归 bug，需在本地盘装）。

const smogon = require('C:/temp-calc/node_modules/@smogon/calc');
const tools = require('./tools.js');

function evObj(arr) {
    return { hp: arr[0], atk: arr[1], def: arr[2], spa: arr[3], spd: arr[4], spe: arr[5] };
}

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

    // ===== (a) 属性替换类招式 =====
    { name: 'a Body Press(用使用者Def)', attacker: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Body Press' },
    { name: 'a Foul Play(用目标Atk)', attacker: { poke: 'Klefki', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, defender: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, move: 'Foul Play' },
    { name: 'a Psyshock(用目标Def)', attacker: { poke: 'Latios', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Psyshock' },
    { name: 'a Psystrike(用目标Def)', attacker: { poke: 'Mewtwo', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Chansey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Psystrike' },
    { name: 'a Secret Sword(用目标Def)', attacker: { poke: 'Keldeo', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Secret Sword' },
    { name: 'a Body Press vs 防御+2', attacker: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish', boosts: { def: 2 } }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Body Press' },

    // ===== (c) 必定暴击招式 =====
    { name: 'c Wicked Blow(必定CT)', attacker: { poke: 'Urshifu', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Wicked Blow' },
    { name: 'c Storm Throw(必定CT)', attacker: { poke: 'Conkeldurr', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Storm Throw' },
    { name: 'c Frost Breath(必定CT,特殊)', attacker: { poke: 'Ninetales-Alola', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, move: 'Frost Breath' },
    { name: 'c Surging Strikes(必定CT×3连击)', attacker: { poke: 'Urshifu-Rapid-Strike', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Surging Strikes' },
    { name: 'c Wicked Blow + 物攻-2(CT无视)', attacker: { poke: 'Urshifu', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant', boosts: { atk: -2 } }, defender: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Wicked Blow' },
    { name: 'c Wicked Blow vs 防御+2(CT无视)', attacker: { poke: 'Urshifu', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish', boosts: { def: 2 } }, move: 'Wicked Blow' },
    { name: 'c Wicked Blow + 灼伤(CT不免烧伤)', attacker: { poke: 'Urshifu', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Wicked Blow', burn: true, smogonAttackerExtra: { status: 'brn' } },
    { name: 'c 非必定CT不自动暴击(Night Slash)', attacker: { poke: 'Weavile', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Night Slash' },

    // ===== (d) 鳃咬/电喙 先手翻倍 =====
    { name: 'd Fishious Rend(先手翻倍)', attacker: { poke: 'Dracovish', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Snorlax', ev: [252, 0, 0, 0, 0, 0], nature: 'Adamant' }, move: 'Fishious Rend' },
    { name: 'd Fishious Rend(后手不翻倍)', attacker: { poke: 'Dracovish', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant' }, defender: { poke: 'Regieleki', ev: [0, 0, 0, 0, 0, 252], nature: 'Timid' }, move: 'Fishious Rend' },
    { name: 'd Bolt Beak(先手翻倍)', attacker: { poke: 'Dracozolt', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Bolt Beak' },
];

let diff = 0;
let descDiff = 0;
for (const c of cases) {
    const leg = { attacker: c.attacker, defender: c.defender, move: { name: c.move } };
    for (const k of ['extra', 'burn', 'hits', 'isCrit', 'attackerMovesFirst', 'targetSwitchedIn', 'power_multiplier']) {
        if (c[k] !== undefined) leg[k] = c[k];
    }
    const ours = tools.runTool('calc_damage', { legs: [leg] }, {});
    const ol = ours.legs[0];
    if (ol.error) {
        console.log('[ERR ] ' + c.name + ': ours error ' + ol.error);
        diff++;
        continue;
    }
    const atkOpts = Object.assign({ evs: evObj(c.attacker.ev), nature: c.attacker.nature, boosts: c.attacker.boosts || {} }, c.smogonAttackerExtra || {});
    const defOpts = Object.assign({ evs: evObj(c.defender.ev), nature: c.defender.nature, boosts: c.defender.boosts || {} }, c.smogonDefenderExtra || {});
    const atk = new smogon.Pokemon(8, c.attacker.poke, atkOpts);
    const def = new smogon.Pokemon(8, c.defender.poke, defOpts);
    const mv = new smogon.Move(8, c.move);
    const res = smogon.calculate(8, atk, def, mv);
    const sm = res.range();
    const same = (ol.min === sm[0] && ol.max === sm[1]);
    if (!same) diff++;
    // 描述串尾部（伤害区间 + % + KO 结论）与 PS 对比
    let psTail = null;
    try {
        const psDesc = res.fullDesc();
        psTail = psDesc.substring(psDesc.indexOf(': ') + 2);
    } catch (e) { psTail = '(PS desc n/a)'; }
    const ourTail = ol.desc.substring(ol.desc.indexOf(': ') + 2);
    const tailSame = (psTail === ourTail);
    if (!tailSame) descDiff++;
    console.log('[' + (same ? 'OK  ' : 'DIFF') + '] ' + c.name + ': ' + c.attacker.poke + ' ' + c.move + ' vs ' + c.defender.poke);
    if (!same) {
        console.log('  ours:   ' + ol.min + '-' + ol.max + ' (' + ol.percent_min + '%-' + ol.percent_max + '%)');
        console.log('  smogon: ' + sm[0] + '-' + sm[1]);
    } else {
        console.log('  desc:   ' + ol.desc);
    }
    if (!tailSame) console.log('  tail DIFF ours="' + ourTail + '" ps="' + psTail + '"');
}
console.log('\n结果：' + (cases.length - diff) + '/' + cases.length + ' 伤害一致；描述尾部 ' + (cases.length - descDiff) + '/' + cases.length + ' 完全一致');

// ===== (e) 默认词条警示 + (f) variable_power 提示：非对账项，单独检查标记 =====
console.log('\n--- 附加标记检查 ---');
const eLeg = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Arctozolt' }, defender: { poke: 'Snorlax' }, move: { name: 'Bolt Beak' } }] }, {}).legs[0];
console.log('(e) 漏传 ev/nature -> assumed=' + eLeg.assumed + ' notes=' + JSON.stringify(eLeg.notes));
const fLeg = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Snorlax', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: { name: 'Flail' } }] }, {}).legs[0];
console.log('(f) Flail -> variable_power=' + fLeg.detail.variable_power + ' notes=' + JSON.stringify(fLeg.notes));
const bLeg = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold', hpPct: 60 }, move: { name: 'Earthquake' } }] }, {}).legs[0];
console.log('(b) 对 60% 剩余 HP -> ko=' + bLeg.ko);
console.log('    desc=' + bLeg.desc);
