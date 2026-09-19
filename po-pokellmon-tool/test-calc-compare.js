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

    // ===== (g) 特殊属性克制招式 =====
    { name: 'g Freeze-Dry vs 纯水(2x)', attacker: { poke: 'Ninetales-Alola', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Vaporeon', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Freeze-Dry' },
    { name: 'g Freeze-Dry vs 水/地(4x)', attacker: { poke: 'Ninetales-Alola', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Swampert', ev: [252, 0, 252, 0, 0, 0], nature: 'Relaxed' }, move: 'Freeze-Dry' },
    { name: 'g Freeze-Dry vs 非水(照常)', attacker: { poke: 'Ninetales-Alola', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, defender: { poke: 'Flygon', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, move: 'Freeze-Dry' },
    { name: 'g Flying Press vs 草/毒(1x)', attacker: { poke: 'Hawlucha', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Venusaur', ev: [252, 0, 0, 0, 0, 0], nature: 'Bold' }, move: 'Flying Press' },
    { name: 'g Flying Press vs 岩/恶(2x)', attacker: { poke: 'Hawlucha', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Tyranitar', ev: [252, 0, 0, 0, 0, 0], nature: 'Adamant' }, move: 'Flying Press' },
    { name: 'g Thousand Arrows vs 飞行(0->1x)', attacker: { poke: 'Zygarde', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Tornadus', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, move: 'Thousand Arrows' },
    { name: 'g Thousand Arrows vs 钢/飞(0->1x)', attacker: { poke: 'Zygarde', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, defender: { poke: 'Skarmory', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Thousand Arrows' },
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

// ===== 修正项差分（特性/道具/天气/场地/光墙/状态）=====
// 同样的输入分别交给我们的 calc_damage（内部是内嵌的 @smogon/calc）与直接调用 @smogon/calc，比较伤害区间。
// 这里主要验证「我们的入参 -> 计算器」的映射（名字解析 / EV / 性格 / 特性 / 道具 / 场地）是否正确。
console.log('\n--- 修正项差分（特性/道具/天气/场地/光墙/状态）---');

function smogonOptsFromSpec(spec) {
    const o = { evs: evObj(spec.ev), nature: spec.nature, boosts: spec.boosts || {} };
    if (spec.ability) o.ability = spec.ability;
    if (spec.item) o.item = spec.item;
    if (spec.status) o.status = spec.status;
    if (spec.curHp) o.curHP = spec.curHp;
    return o;
}
function ourFieldFromSpec(f) {
    if (!f) return undefined;
    const o = {};
    if (f.weather) o.weather = f.weather;
    if (f.terrain) o.terrain = f.terrain;
    if (f.reflect) o.defenderSide = Object.assign(o.defenderSide || {}, { isReflect: true });
    if (f.lightScreen) o.defenderSide = Object.assign(o.defenderSide || {}, { isLightScreen: true });
    if (f.auroraVeil) o.defenderSide = Object.assign(o.defenderSide || {}, { isAuroraVeil: true });
    if (f.helpingHand) o.attackerSide = Object.assign(o.attackerSide || {}, { isHelpingHand: true });
    return o;
}

const modCases = [
    // 攻击方特性 / 道具
    { name: 'm 大力士 Huge Power', atk: { poke: 'Azumarill', ev: [252, 252, 0, 0, 0, 0], nature: 'Adamant', ability: 'Huge Power' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Aqua Jet' },
    { name: 'm 适应力 Adaptability', atk: { poke: 'Crawdaunt', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant', ability: 'Adaptability' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Knock Off' },
    { name: 'm 专爱头巾 Choice Band', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', item: 'Choice Band' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: 'm 专爱眼镜 Choice Specs', atk: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid', item: 'Choice Specs' }, def: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball' },
    { name: 'm 生命宝珠 Life Orb', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', item: 'Life Orb' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: 'm 达人带 Expert Belt(克制)', atk: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid', item: 'Expert Belt' }, def: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball' },
    { name: 'm 达人带 Expert Belt(非克制)', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', item: 'Expert Belt' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: 'm 讲究围巾无伤害影响', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', item: 'Choice Scarf' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake' },
    { name: 'm 毅力 Guts + 灼伤', atk: { poke: 'Conkeldurr', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant', ability: 'Guts', status: 'brn' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Drain Punch' },
    { name: 'm 灼伤 status=brn(无毅力)', atk: { poke: 'Conkeldurr', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant', ability: 'Iron Fist', status: 'brn' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Drain Punch' },
    { name: 'm 电场 Transistor', atk: { poke: 'Regieleki', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid', ability: 'Transistor' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Thunderbolt' },
    { name: 'm 技术高手 Technician', atk: { poke: 'Scizor', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant', ability: 'Technician' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Bullet Punch' },
    // 防守方特性 / 道具
    { name: 'm 厚脂肪 Thick Fat(火)', atk: { poke: 'Charizard', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, def: { poke: 'Snorlax', ev: [252, 0, 0, 0, 252, 0], nature: 'Careful', ability: 'Thick Fat' }, move: 'Flamethrower' },
    { name: 'm 多重鳞片 Multiscale(满血)', atk: { poke: 'Blastoise', ev: [0, 0, 0, 252, 0, 252], nature: 'Modest' }, def: { poke: 'Dragonite', ev: [252, 0, 0, 0, 0, 0], nature: 'Adamant', ability: 'Multiscale' }, move: 'Ice Beam' },
    { name: 'm 过滤 Filter(克制)', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Aggron', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish', ability: 'Filter' }, move: 'Earthquake' },
    { name: 'm 毛皮大衣 Fur Coat', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Furfrou', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish', ability: 'Fur Coat' }, move: 'Earthquake' },
    { name: 'm 神秘鳞片 Marvel Scale(异常)', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Milotic', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold', ability: 'Marvel Scale', status: 'tox' }, move: 'Earthquake' },
    { name: 'm 突击背心 Assault Vest', atk: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, def: { poke: 'Slowbro', ev: [252, 0, 252, 0, 252, 0], nature: 'Calm', item: 'Assault Vest' }, move: 'Shadow Ball' },
    { name: 'm 进化奇石 Eviolite', atk: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, def: { poke: 'Porygon2', ev: [252, 0, 252, 0, 252, 0], nature: 'Calm', item: 'Eviolite' }, move: 'Sludge Bomb' },
    { name: 'm 抗地面果 Shuca Berry', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Heatran', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm', item: 'Shuca Berry' }, move: 'Earthquake' },
    // 天气 / 场地 / 光墙
    { name: 'm 晴天 火招×1.5', atk: { poke: 'Charizard', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Flamethrower', field: { weather: 'Sun' } },
    { name: 'm 雨天 水招×1.5', atk: { poke: 'Blastoise', ev: [0, 0, 0, 252, 0, 252], nature: 'Modest' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Hydro Pump', field: { weather: 'Rain' } },
    { name: 'm 晴天 水招×0.5', atk: { poke: 'Blastoise', ev: [0, 0, 0, 252, 0, 252], nature: 'Modest' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Hydro Pump', field: { weather: 'Sun' } },
    { name: 'm 电气场地(接地攻方)', atk: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Thunderbolt', field: { terrain: 'Electric' } },
    { name: 'm 青草场地(接地守方)减地震', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake', field: { terrain: 'Grassy' } },
    { name: 'm 薄雾场地 减龙招', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Outrage', field: { terrain: 'Misty' } },
    { name: 'm 反射壁(物理减半)', atk: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, def: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: 'Earthquake', field: { reflect: true } },
    { name: 'm 光墙(特殊减半)', atk: { poke: 'Gengar', ev: [0, 0, 0, 252, 0, 252], nature: 'Timid' }, def: { poke: 'Slowbro', ev: [252, 0, 0, 0, 252, 0], nature: 'Calm' }, move: 'Shadow Ball', field: { lightScreen: true } },
    { name: 'm 反射壁 + 暴击(不被减半)', atk: { poke: 'Urshifu', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' }, def: { poke: 'Corviknight', ev: [252, 0, 252, 0, 0, 0], nature: 'Impish' }, move: 'Wicked Blow', field: { reflect: true } },
];

let mdiff = 0;
for (const c of modCases) {
    const ol = tools.runTool('calc_damage', { legs: [{ attacker: c.atk, defender: c.def, move: { name: c.move }, field: c.field }] }, {}).legs[0];
    if (ol.error) { console.log('[ERR ] ' + c.name + ': ' + ol.error); mdiff++; continue; }
    const atk = new smogon.Pokemon(8, c.atk.poke, smogonOptsFromSpec(c.atk));
    const def = new smogon.Pokemon(8, c.def.poke, smogonOptsFromSpec(c.def));
    const res = smogon.calculate(8, atk, def, new smogon.Move(8, c.move), new smogon.Field(ourFieldFromSpec(c.field)));
    const sm = res.range();
    const same = (ol.min === sm[0] && ol.max === sm[1]);
    if (!same) mdiff++;
    console.log('[' + (same ? 'OK  ' : 'DIFF') + '] ' + c.name + '  ' + ol.min + '-' + ol.max + (same ? '' : '  vs smogon ' + sm[0] + '-' + sm[1]));
    if (same) console.log('    ' + ol.desc + '   applied=' + JSON.stringify(ol.detail.applied));
}
console.log('修正项差分：' + (modCases.length - mdiff) + '/' + modCases.length + ' 一致');

// ===== extra 与修正项互斥 =====
console.log('\n--- extra 互斥检查 ---');
const both = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly', item: 'Life Orb' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: { name: 'Earthquake' }, extra: 1.3 }] }, {}).legs[0];
console.log('extra+item -> ' + (both.error ? 'ERROR (expected): ' + both.error : 'NOT REJECTED (bug!)'));
const both2 = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: { name: 'Earthquake' }, extra: 0.5, field: { reflect: true } }] }, {}).legs[0];
console.log('extra+reflect -> ' + (both2.error ? 'ERROR (expected): ' + both2.error : 'NOT REJECTED (bug!)'));

// 默认特性提醒：不传 ability 时计算器会用种族默认特性（这里 Conkeldurr 默认 Guts），必须提示
const defLeg = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Conkeldurr', ev: [0, 252, 0, 0, 0, 0], nature: 'Adamant', status: 'brn' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: { name: 'Drain Punch' } }] }, {}).legs[0];
console.log('默认特性提醒 -> ' + JSON.stringify(defLeg.notes) + ' applied=' + JSON.stringify(defLeg.detail.applied));
// 拼错特性名 -> 必须提醒
const typoLeg = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Azumarill', ev: [252, 252, 0, 0, 0, 0], nature: 'Adamant', ability: 'Huge Powr' }, defender: { poke: 'Blissey', ev: [252, 0, 252, 0, 0, 0], nature: 'Bold' }, move: { name: 'Aqua Jet' } }] }, {}).legs[0];
console.log('拼错特性名 -> ' + JSON.stringify(typoLeg.notes));

// ===== 直接能力值路径（get_my_stats 读数 + boosts）=====
// 用 ev/nature 推导的真实数值，与「把该数值直传 + 同样的 boosts」必须一致。
// 回归背景：0.4.0 的 @smogon/calc 引擎里 calculate() 会 clone() 两侧，而 Pokemon.clone() 会按
// 种族值/EV/IV/性格重算 rawStats —— 直传的能力值被静默丢弃（实测 attacker.def=580 被当成 232）。
console.log('\n--- 直接能力值路径（回归）---');
const mewStats = tools.runTool('calc_stats', { legs: [{ poke: 'Mew', ev: [252, 0, 4, 0, 252, 0], nature: 'Calm', stats: ['def', 'spd', 'atk'] }] }, {}).legs[0].stats;
console.log('Mew 未加成数值: ' + JSON.stringify(mewStats));
const directCases = [
  ['Body Press: def 直传(+3) vs 同 EV/性格(boosts def+3)', 'Body Press', { poke: 'Mew', def: mewStats.def, boosts: { def: 3 } }, { poke: 'Mew', ev: [252, 0, 4, 0, 252, 0], nature: 'Calm', boosts: { def: 3 } }],
  ['Body Press: def 直传(无 boost) vs 同 EV/性格', 'Body Press', { poke: 'Mew', def: mewStats.def }, { poke: 'Mew', ev: [252, 0, 4, 0, 252, 0], nature: 'Calm' }],
  ['普通物攻: atk 直传(+1) vs 同 EV/性格(atk+1)', 'Double-Edge', { poke: 'Mew', atk: mewStats.atk, boosts: { atk: 1 } }, { poke: 'Mew', ev: [252, 0, 4, 0, 252, 0], nature: 'Calm', boosts: { atk: 1 } }],
  ['Foul Play: 目标 atk 直传 vs 同 EV/性格', 'Foul Play', { poke: 'Mew', atk: mewStats.atk }, { poke: 'Mew', ev: [252, 0, 4, 0, 252, 0], nature: 'Calm' }],
];
let ddiff = 0;
for (const [name, moveName, directSpec, derivedSpec] of directCases) {
  const defSpec = { poke: 'Cinccino', ev: [4, 0, 0, 0, 0, 252], nature: 'Jolly' };
  const mk = (att) => ({ attacker: att, defender: defSpec, move: { name: moveName } });
  const a = tools.runTool('calc_damage', { legs: [mk(directSpec)] }, {}).legs[0];
  const b = tools.runTool('calc_damage', { legs: [mk(derivedSpec)] }, {}).legs[0];
  const ok = !a.error && !b.error && a.min === b.min && a.max === b.max;
  if (!ok) ddiff++;
  console.log('[' + (ok ? 'OK  ' : 'DIFF') + '] ' + name + ' -> 直传 ' + a.min + '-' + a.max + ' / 推导 ' + b.min + '-' + b.max + ' (attack_stat 直传=' + a.detail.attack_stat + ' 推导=' + b.detail.attack_stat + ')');
}
// defender.hp 直传（最大 HP 覆盖）
const hpLeg = tools.runTool('calc_damage', { legs: [{ attacker: { poke: 'Garchomp', ev: [0, 252, 0, 0, 0, 252], nature: 'Jolly' }, defender: { poke: 'Blissey', hp: 400 }, move: { name: 'Earthquake' } }] }, {}).legs[0];
const hpOk = hpLeg.detail.defender_max_hp === 400;
if (!hpOk) ddiff++;
console.log('[' + (hpOk ? 'OK  ' : 'DIFF') + '] defender.hp 直传=400 -> defender_max_hp=' + hpLeg.detail.defender_max_hp + ' percent=' + hpLeg.percent_min + '-' + hpLeg.percent_max);
console.log('直接能力值路径：' + (directCases.length + 1 - ddiff) + '/' + (directCases.length + 1) + ' 一致');
