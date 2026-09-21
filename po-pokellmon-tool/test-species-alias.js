// po-pokellmon-tool/test-species-alias.js — PO 物种名 → PS/计算器名 解析 单测（不调 LLM）
//
// 背景（battle111 T2 实测）：`simulate_turn { switch: 5 }` 换入 `Magearna-Original` 时整行 `mine: null`
// —— 计算器认不出 PO 的形态名，候补的承伤数直接缺失（模型少一个候选的成本）。此前 battle108 的
// `Zarude-Aba` 同源。本测覆盖：① 全库审计（除 `Missingno` 外都能解析）；② 具体映射（含「认得出但算错」
// 的 Minior 形态反转）；③ calc_damage 用 PO 名能出数并说明替换；④ simulate_turn 换入形态名不再整行空。
var tools = require('./tools.js');
var POKEMON = require('./knowledge/pokemon.json');
var SM = require('./vendor/smogon-calc/index.js');
var fs = require('fs');

var dex = SM.Generations.get(8);
var pass = 0, fail = 0;
function chk(name, cond, extra) {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (extra ? ('   <- ' + extra) : '')); }
}
function known(n) {
    try {
        var s = dex.species.get(SM.toID(String(n)));
        return !!(s && s.baseStats && s.baseStats.hp !== undefined);
    } catch (e) { return false; }
}

console.log('1) 全库审计：knowledge/pokemon.json 每条 name_en 都要能解析成计算器认识的物种');
var unresolved = [];
for (var k in POKEMON.byNum) {
    var n = POKEMON.byNum[k].name_en;
    if (!n) continue;
    var r = tools.resolveSpeciesName(n);
    if (!known(r.name)) unresolved.push(n);
}
chk('除 Missingno（非真实物种）外全部可解析', unresolved.length === 1 && unresolved[0] === 'Missingno',
    'unresolved=' + JSON.stringify(unresolved));

console.log('2) 具体映射');
var cases = [
    ['Aegislash', 'Aegislash-Shield', 'PS 没有裸 Aegislash'],
    ['Blacephelon', 'Blacephalon', 'PO 拼写'],
    ['Greninja-Unbonded', 'Greninja', 'PO 的未羁绊 = 普通忍蛙'],
    ['Zarude-Aba', 'Zarude', 'PO 的 Aba = 普通萨戮德'],
    ['Minior', 'Minior-Meteor', '★ PO 裸 Minior = 彗星形态（PS 裸名是核心形态）'],
    ['Minior-Blue', 'Minior', 'PO 颜色形态 → PS 裸 Minior（核心）'],
    ['Meowstic-M', 'Meowstic', 'PO -M = PS 裸名'],
    ['Alcremie-CaramelSwirl', 'Alcremie', '奶油装饰不改变种族值'],
    // 以下三条必须**原样不动**（认得出就不能改）
    ['Pikachu', 'Pikachu', '普通名'],
    ['Rotom-Wash', 'Rotom-Wash', 'PS 真形态不能砍'],
    ['Darmanitan-Galar', 'Darmanitan-Galar', 'PS 真形态不能砍']
];
for (var i = 0; i < cases.length; i++) {
    var got = tools.resolveSpeciesName(cases[i][0]).name;
    chk(cases[i][0] + ' → ' + cases[i][1] + '（' + cases[i][2] + '）', got === cases[i][1], 'got=' + got);
}

console.log('3) calc_damage 用 PO 名能出数（不再整腿报废）+ 说明替换');
var fixture = JSON.parse(fs.readFileSync(__dirname + '/eval/fixtures/battle96-t1.json', 'utf8'));
var ctx = { state: fixture.state, notes: { pokemon: {}, turns: {} }, turn: 1, ledger: tools.newLedger(), simGateOn: true };
var cd = tools.runTool('calc_damage', {
    legs: [{
        attacker: { poke: 'Zarude-Aba', ev: [0, 252, 0, 0, 0, 252], nature: 'Adamant' },
        defender: { poke: 'Rotom-Wash', ev: [252, 0, 0, 0, 252, 0], nature: 'Bold' },
        move: { name: 'Crunch' }
    }]
}, ctx);
var leg0 = (cd.legs || [])[0] || {};
chk('leg 无 error', !leg0.error, JSON.stringify(leg0).slice(0, 200));
chk('给出了伤害区间', leg0.range_min !== undefined || leg0.min !== undefined, JSON.stringify(Object.keys(leg0)));
chk('notes 里写明 PO 名被替换', JSON.stringify(cd).indexOf('PO species name') >= 0, JSON.stringify(cd.notes || cd).slice(0, 240));

console.log('4) simulate_turn：换入 PO 形态名（Magearna-Original）不整行空');
var st2 = JSON.parse(JSON.stringify(fixture.state));
st2.bench[4].name = 'Magearna-Original';       // slot 5
st2.myStats[5].name = 'Magearna-Original';
if (st2.myTeam && st2.myTeam[5]) st2.myTeam[5].name = 'Magearna-Original';
var ctx2 = { state: st2, notes: { pokemon: {}, turns: {} }, turn: 1, ledger: tools.newLedger(), simGateOn: true };
var r2 = tools.runTool('simulate_turn', { i_do: { switch: 5 }, opp_does: [{ move: 'Hydro Pump' }, { move: 'Hurricane' }] }, ctx2);
var row2 = (r2.rows || [])[0] || {};
chk('换入行有承伤数字（此前是 null）', !!(row2.mine && row2.mine.takes), JSON.stringify(row2).slice(0, 260));
chk('行里说明「退到了基础物种」', String(row2.species_note || '').indexOf('not in our dex') >= 0, String(row2.species_note));
chk('行里不再出现 unknown pokemon', JSON.stringify(row2).indexOf('unknown pokemon') < 0, JSON.stringify(row2).slice(0, 260));

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
