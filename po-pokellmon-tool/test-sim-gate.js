// po-pokellmon-tool/test-sim-gate.js — simulate_turn + 仿真门禁 单测（不调 LLM）
// 用 battle96 T1 的真实 state：Weezing-Galar(场上,0) vs Pelipper（雨天）。
// 覆盖：分支合法性（含「学习面外 → 疑似伪装」的 soft check）、出手顺序（换人阶段先于出招）、
//       伤害与 faints、unknown 显式列出；以及 save_strategy / 最终答案两道闸门的拒绝与放行。
var tools = require('./tools.js');
var fs = require('fs');

var fixture = JSON.parse(fs.readFileSync(__dirname + '/eval/fixtures/battle96-t1.json', 'utf8'));
var state = fixture.state;
var notes = { pokemon: {}, turns: {} };
var pass = 0, fail = 0;
function chk(name, cond, extra) {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (extra ? ('   <- ' + extra) : '')); }
}
function ctx() { return { state: state, notes: notes, turn: 1, ledger: tools.newLedger(), simGateOn: true }; }
function sim(c, i_do, opp_does, assume) { return tools.runTool('simulate_turn', { i_do: i_do, opp_does: opp_does, assume: assume }, c); }
function save(c, extra) {
    var a = { text: 't', scene: 's', checks: 'c' };
    for (var k in (extra || {})) a[k] = extra[k];
    return tools.runTool('save_strategy', a, c);
}

console.log('simulate_turn: 换 Rotom-Heat（slot4）对 4 个分支');
var c1 = ctx();
var r1 = sim(c1, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Scald' }, { move: 'Hurricane' }, { switch: 2 }], { opp_spread: '252 HP / 0 SpD' });
chk('返回 4 行', r1.rows && r1.rows.length === 4, JSON.stringify(r1).slice(0, 200));
var byKey = {};
(r1.rows || []).forEach(function (r) { byKey[r.branchKey] = r; });
chk('Hydro Pump 行 → 必杀（faints=true）', byKey['Hydro Pump'] && byKey['Hydro Pump'].mine.faints === true, byKey['Hydro Pump'] && byKey['Hydro Pump'].mine.summary);
chk('Hurricane 行 → 活得下来（faints=false）', byKey['Hurricane'] && byKey['Hurricane'].mine.faints === false, byKey['Hurricane'] && byKey['Hurricane'].mine.summary);
chk('换人分支顺序写明「换人阶段先于出招」', /switch phase/.test(byKey['Hydro Pump'].order), byKey['Hydro Pump'].order);
chk('未暴露分支（switch 2）被标 NOT possible', /NOT possible/.test(byKey['switch 2'].legal), byKey['switch 2'].legal);
chk('每行都显式列出 unknown', byKey['Hydro Pump'].unknown.length >= 2, JSON.stringify(byKey['Hydro Pump'].unknown));

console.log('simulate_turn: soft legality（学习面外 → 提示可能是伪装，不硬拒）');
var c2 = ctx();
var r2 = sim(c2, { switch: 3 }, [{ move: 'Thunderbolt' }]);   // Pelipper 学不到 Thunderbolt
var row2 = (r2.rows || [])[0] || {};
chk('Pelipper 用 Thunderbolt → 标 NOT in movepool', /NOT in .*movepool/.test(row2.legal), row2.legal);
chk('并给出 Illusion/Ditto 的提示（不是硬拒）', /Illusion/.test(row2.note || ''), String(row2.note).slice(0, 80));

console.log('simulate_turn: 留场出招（两边都算）');
var c3 = ctx();
var r3 = sim(c3, { move: 'Sludge Bomb' }, [{ move: 'Hydro Pump' }, { move: 'Hurricane' }]);
chk('留场：对手也出招 → 同时给出我打它/它打我', !!(r3.rows[0].theirs && r3.rows[0].mine), JSON.stringify(r3.rows[0]).slice(0, 240));
chk('我方承伤与 Hydro Pump 一致（87-103% 必杀风险）', /8[0-9]|9[0-9]|10[0-9]/.test(r3.rows[0].mine.takes), r3.rows[0].mine.takes);

console.log('save_strategy 闸门');
var c4 = ctx();
chk('没跑仿真 → 拒绝', /not run simulate_turn/.test((save(c4).error || '')));

sim(c4, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Hurricane' }]);
chk('跑了仿真但没写 action → 拒绝', /needs `action`/.test((save(c4).error || '')));
chk('action 没仿真过 → 拒绝', /was never simulated/.test((save(c4, { action: 'switch 2' }).error || '')));
chk('branch 缺失 → 拒绝', /needs `branch`/.test((save(c4, { action: 'switch 4' }).error || '')));
chk('branch 不在仿真里 → 拒绝', /is not among the simulated branches/.test((save(c4, { action: 'switch 4', branch: 'Scald' }).error || '')));

// ★ E001 的核心：如实写 faints 应当放行（炮灰打法要能过）
var okFaint = save(c4, { action: 'switch 4', branch: 'Hydro Pump', outcome: 'faints' });
chk('如实写 faints → 放行（允许炮灰/允许赌）', okFaint.ok === true, JSON.stringify(okFaint).slice(0, 200));

// ★ 幻觉：把必杀说成活得下来 → 拒绝
var badSurv = save(c4, { action: 'switch 4', branch: 'Hydro Pump', outcome: 'survives (60-70% left)' });
chk('把必杀写成 survives → 拒绝', /contradicts the simulation/.test(badSurv.error || ''), String(badSurv.error).slice(0, 200));

// Hurricane 分支如实写 survives 应放行
var okSurv = save(c4, { action: 'switch 4', branch: 'Hurricane', outcome: 'survives' });
chk('Hurricane 分支写 survives → 放行', okSurv.ok === true, JSON.stringify(okSurv).slice(0, 160));

console.log('最终答案闸门（选中的动作必须仿真过）');
var c5 = ctx();                                    // 全新账本，避免受上面用例影响
sim(c5, { switch: 3 }, [{ move: 'Hydro Pump' }]);
chk('选了没仿真过的 switch 4 → 拒绝', /never simulated/.test(tools.actionGateCheck(c5.ledger, { type: 'switch', pokeSlot: 4 }, state) || ''));
chk('选了已仿真过的 switch 3 → 放行', tools.actionGateCheck(c5.ledger, { type: 'switch', pokeSlot: 3 }, state) === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
