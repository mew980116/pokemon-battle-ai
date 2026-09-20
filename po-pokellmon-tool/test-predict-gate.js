// po-pokellmon-tool/test-predict-gate.js — 幻觉门禁（Rule 1 + Rule 4）单测
// 不调 LLM：直接打 tools.js 的账本逻辑，用 battle96 T1 的真实 state。
// 覆盖：未登记 / 未验算 / 已冲突 → save_strategy 拒绝；预测与计算一致 → 放行；
//       类型幻觉（Hurricane 说成 2x vs Fairy）与存活幻觉（说 survives 实为必杀）→ MISMATCH。
var tools = require('./tools.js');
var fs = require('fs');

var fixture = JSON.parse(fs.readFileSync(__dirname + '/eval/fixtures/battle96-t1.json', 'utf8')).state;
var notes = { pokemon: {}, turns: {} };
var pass = 0, fail = 0;
function chk(name, cond, extra) {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (extra ? ('   <- ' + extra) : '')); }
}
function ctx() { return { state: fixture, notes: notes, turn: 1, ledger: tools.newLedger() }; }
var SAVE = { text: 't', scene: 's', checks: 'c' };
var HP_ON_ROTOM = { claim_id: 'c1', attacker: { from_state: 'opp' }, defender: { from_state: 'me:4' }, move: { name: 'Hydro Pump' } };

console.log('gate: 未登记 / 未验算 / 已冲突 三种拒绝路径');
var c1 = ctx();
var r1 = tools.runTool('save_strategy', SAVE, c1);
chk('完全没登记预测 → 拒绝', !!(r1.error && /registered no predictions/.test(r1.error)), JSON.stringify(r1).slice(0, 130));

var c2 = ctx();
tools.runTool('predict', { claims: [{ id: 'c1', kind: 'survive', on_slot: 4, move: 'Hydro Pump', expects: '22-26%' }] }, c2);
var r2 = tools.runTool('save_strategy', SAVE, c2);
chk('登记了但没验算 → 拒绝并点名 c1', !!(r2.error && /never verified/.test(r2.error) && /c1/.test(r2.error)), JSON.stringify(r2).slice(0, 170));

console.log('gate: E001 的核心幻觉（Rotom-Heat 说成只吃 22-26%）');
var r3 = tools.runTool('calc_damage', { legs: [HP_ON_ROTOM] }, c2);
var cv3 = r3.legs[0].claim_verdict;
chk('实测 137-162% 必杀 vs 预测 22-26% → MISMATCH', !!(cv3 && cv3.status === 'MISMATCH'), JSON.stringify(cv3));
var r3b = tools.runTool('save_strategy', SAVE, c2);
chk('MISMATCH 未修正 → 拒绝', !!(r3b.error && /contradict/.test(r3b.error)), JSON.stringify(r3b).slice(0, 170));

var r3c = tools.runTool('predict', { claims: [{ id: 'c1', kind: 'survive', on_slot: 4, move: 'Hydro Pump', expects: '137-162%' }] }, c2);
void r3c;
tools.runTool('calc_damage', { legs: [HP_ON_ROTOM] }, c2);
var r3d = tools.runTool('save_strategy', SAVE, c2);
chk('改正预测后重验 → 放行', r3d.ok === true, JSON.stringify(r3d).slice(0, 170));

console.log('gate: 动作层（选中的动作必须挂着 MATCH 的 claim）');
chk('actionGateCheck(换 slot4，有 claim) → 通过', tools.actionGateCheck(c2.ledger, { type: 'switch', pokeSlot: 4 }) === null);
var g2 = tools.actionGateCheck(c2.ledger, { type: 'switch', pokeSlot: 2 });
chk('actionGateCheck(换 slot2，无 claim) → 拒绝', !!(g2 && /no verified prediction/.test(g2)), String(g2).slice(0, 150));

console.log('gate: 类型幻觉（B R10 说 Hurricane 对 Fairy 是 2x，实际 1x）');
var c4 = ctx();
tools.runTool('predict', { claims: [{ id: 't1', kind: 'type', on_slot: 0, about: 'Hurricane on Weezing-Galar', expects: '2x' }] }, c4);
var rt = tools.runTool('get_type_matchup', { claim_id: 't1', attack_type: 'Flying', defend_types: ['Poison', 'Fairy'] }, c4);
chk('Flying vs 毒/妖 说成 2x → MISMATCH', !!(rt.claim_verdict && rt.claim_verdict.status === 'MISMATCH'), JSON.stringify(rt));
var c5 = ctx();
tools.runTool('predict', { claims: [{ id: 't2', kind: 'type', on_slot: 4, about: 'Water on Rotom-Heat', expects: '2x' }] }, c5);
var rt2 = tools.runTool('get_type_matchup', { claim_id: 't2', attack_type: 'Water', defend_types: ['Electric', 'Fire'] }, c5);
chk('Water vs 电/火 = 2x → MATCH', !!(rt2.claim_verdict && rt2.claim_verdict.status === 'MATCH'), JSON.stringify(rt2));

console.log('gate: 存活幻觉 + 模糊措辞不误伤');
var c6 = ctx();
tools.runTool('predict', { claims: [{ id: 's1', kind: 'survive', on_slot: 4, move: 'Hydro Pump', expects: 'survives' }] }, c6);
var r6 = tools.runTool('calc_damage', { legs: [{ claim_id: 's1', attacker: { from_state: 'opp' }, defender: { from_state: 'me:4' }, move: { name: 'Hydro Pump' } }] }, c6);
chk('说 survives 但实为 OHKO → MISMATCH', !!(r6.legs[0].claim_verdict && r6.legs[0].claim_verdict.status === 'MISMATCH'), JSON.stringify(r6.legs[0].claim_verdict));

var c7 = ctx();
tools.runTool('predict', { claims: [{ id: 'v1', kind: 'survive', on_slot: 3, move: 'Hydro Pump', expects: 'manageable' }] }, c7);
var r7 = tools.runTool('calc_damage', { legs: [{ claim_id: 'v1', attacker: { from_state: 'opp' }, defender: { from_state: 'me:3' }, move: { name: 'Hydro Pump' } }] }, c7);
chk('无法解析的预测 → 放行（不误伤）', !!(r7.legs[0].claim_verdict && r7.legs[0].claim_verdict.status === 'MATCH'), JSON.stringify(r7.legs[0].claim_verdict));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
