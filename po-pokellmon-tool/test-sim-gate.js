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

console.log('速度重叠 → 正反两种情况都仿（不猜）');
var c6 = ctx();
var r6 = sim(c6, { move: 'Sludge Bomb' }, [{ move: 'Hydro Pump' }]);
chk('order 明说 BOTH orders', /BOTH orders/.test(r6.rows[0].order), r6.rows[0].order);
chk('cases 给了两种顺序', (r6.rows[0].cases || []).length === 2, JSON.stringify(r6.rows[0].cases));
chk('cases 里两种 order 都出现', (r6.rows[0].cases || []).map(function (x) { return x.order; }).join('|') === 'you first|they first', JSON.stringify((r6.rows[0].cases || []).map(function (x) { return x.order; })));
chk('两种顺序结果相同时不加冗余后缀', !/worst of/.test(r6.rows[0].mine.summary), r6.rows[0].mine.summary);
chk('cases 里不泄漏内部打分字段 _lo', JSON.stringify(r6.rows[0].cases).indexOf('_lo') < 0, JSON.stringify(r6.rows[0].cases).slice(0, 120));

console.log('先手方打死对手 → 对手不还手（顺序真正影响结果之处）');
// 用一份最小合成 state，让「我方明显更快 + 招能杀」成立（CTRL93 里 Melmetal 比 Blissey 慢，构造不出 you-first）
var mini = {
    weather: 'None', terrain: 'None', myHazards: [], oppHazards: [],
    myTeam: [{ slot: 0, name: 'Weavile', hpPct: 100, ko: false }],
    myStats: [{ slot: 0, name: 'Weavile', level: 100, ev: [0, 0, 0, 0, 0, 252], iv: [31, 31, 31, 31, 31, 31], nature: 0 }],
    bench: [],
    me: { name: 'Weavile', item: '', moves: [{ name: 'Icicle Crash' }] },
    opp: { name: 'Pelipper', hpPct: 30 },
    oppTeam: [{ slot: 0, name: 'Pelipper', hpPct: 30, ko: false, revealed: true }]
};
var c7 = { state: mini, notes: notes, turn: 1, ledger: tools.newLedger(), simGateOn: true };
var r7 = tools.runTool('simulate_turn', { i_do: { move: 'Icicle Crash' }, opp_does: [{ move: 'Hurricane' }] }, c7);
chk('更快的我方 → 单一 you-first 顺序', /you move first/.test(r7.rows[0].order || ''), r7.rows[0].order);
var youCase7 = (r7.rows[0].cases || []).filter(function (x) { return x.order === 'you first'; })[0];
chk('对手残血被先手杀掉 → 它不还手（你吃 0%）', !!youCase7 && /faints before it can act/.test(youCase7.note || ''), JSON.stringify(youCase7));

console.log('i_do 的招式必须是场上这只会的');
var c7b = { state: mini, notes: notes, turn: 1, ledger: tools.newLedger(), simGateOn: true };
var r7b = tools.runTool('simulate_turn', { i_do: { move: 'Thunderbolt' }, opp_does: [{ move: 'Hurricane' }] }, c7b);
chk('用了自己没有的招 → 报错并列出可用招', !!(r7b.error && /not a move your active pokemon/.test(r7b.error)), JSON.stringify(r7b).slice(0, 200));

console.log('最坏分支强提醒（不拦，只提醒）');
var c8 = ctx();
sim(c8, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Hurricane' }]);
var s8 = save(c8, { action: 'switch 4', branch: 'Hurricane', outcome: 'survives' });
chk('声明无害分支 → 通过但仍返回提醒', s8.ok === true && /NOT the worst branch/.test(s8.warning || ''), JSON.stringify(s8).slice(0, 220));
var c8b = ctx();
sim(c8b, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Hurricane' }]);
var s8b = save(c8b, { action: 'switch 4', branch: 'Hydro Pump', outcome: 'faints' });
chk('声明最坏分支 → 无该提醒', s8b.ok === true && !/NOT the worst branch/.test(s8b.warning || ''), JSON.stringify(s8b).slice(0, 160));

console.log('倍率词警告（未查表时提醒；查过则不提）');
var c9 = ctx();
sim(c9, { switch: 2 }, [{ move: 'Scald' }]);
var s9 = save(c9, { text: 'Rotom-Heat is a trap: Water is neutral to Fire/Electric, so Scald KOs it.', action: 'switch 2', branch: 'Scald', outcome: '30-41%' });
chk('散文写了倍率但没查表 → 警告（不拦）', s9.ok === true && /never called get_type_matchup/.test(s9.warning || ''), JSON.stringify(s9).slice(0, 240));
chk('并回报倍率提及数', s9.multiplierMentions >= 1, JSON.stringify(s9.multiplierMentions));
var c10 = ctx();
tools.runTool('get_type_matchup', { attack_type: 'Water', defend_types: ['Electric', 'Fire'] }, c10);
sim(c10, { switch: 2 }, [{ move: 'Scald' }]);
var s10 = save(c10, { text: 'Water is neutral to Fire/Electric, so Scald KOs it.', action: 'switch 2', branch: 'Scald', outcome: '30-41%' });
chk('本回合查过表 → 不再提该警告', !/never called get_type_matchup/.test(s10.warning || ''), JSON.stringify(s10).slice(0, 200));

console.log('对手假设不一致 → 结构化检出（不碰文本）');
var c11 = ctx();
tools.runTool('simulate_turn', { i_do: { switch: 2 }, opp_does: [{ move: 'Scald' }], assume: { opp_spread: '252 HP / 0 SpD' } }, c11);
var r11 = tools.runTool('simulate_turn', { i_do: { switch: 4 }, opp_does: [{ move: 'Scald' }], assume: { opp_spread: '0 HP / 252 Def' } }, c11);
chk('同一对手用了两套假设 → 该次 sim 带 assumption_conflict', /inconsistent assumptions/.test(r11.assumption_conflict || ''), JSON.stringify(r11.assumption_conflict).slice(0, 200));
var s11 = save(c11, { action: 'switch 4', branch: 'Scald', outcome: 'faints' });
chk('save_strategy 也把它作为提醒带出', /inconsistent assumptions/.test(s11.warning || ''), JSON.stringify(s11).slice(0, 240));

console.log('命中率（含天气修正）');
chk('Hydro Pump 80%', tools.moveAccuracy('Hydro Pump', 'Rain') === 80, String(tools.moveAccuracy('Hydro Pump', 'Rain')));
chk('Scald 100%', tools.moveAccuracy('Scald', 'Rain') === 100, String(tools.moveAccuracy('Scald', 'Rain')));
chk('Hurricane 平时 70%', tools.moveAccuracy('Hurricane', 'None') === 70, String(tools.moveAccuracy('Hurricane', 'None')));
chk('Hurricane 雨天必中 100%', tools.moveAccuracy('Hurricane', 'Rain') === 100, String(tools.moveAccuracy('Hurricane', 'Rain')));
chk('Thunder 晴天 50%', tools.moveAccuracy('Thunder', 'Sun') === 50, String(tools.moveAccuracy('Thunder', 'Sun')));
chk('Blizzard 冰雹必中 100%', tools.moveAccuracy('Blizzard', 'Hail') === 100, String(tools.moveAccuracy('Blizzard', 'Hail')));
var c12 = ctx();   // battle96 T1 = 雨天
var r12 = sim(c12, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Scald' }]);
var hp12 = r12.rows[0], sc12 = r12.rows[1];
chk('Hydro Pump 行标出 80% 命中 + 落空分支', /connects 80% of the time/.test(hp12.accuracy_note || '') && /MISSES and you take 0%/.test(hp12.accuracy_note || ''), String(hp12.accuracy_note));
chk('Scald 行（100%）不出命中率提醒', !sc12.accuracy_note, String(sc12.accuracy_note));
chk('unknown 里声明不建模命中类特性', (hp12.unknown || []).some(function (x) { return /accuracy-changing abilities/.test(x); }), JSON.stringify(hp12.unknown));

console.log('crit 不建分支但必须声明（含会心率）');
chk('普通招 crit 1/24', /1\/24/.test(tools.moveCritStage('Draco Meteor') || ''), String(tools.moveCritStage('Draco Meteor')));
chk('高会心招 crit 1/8', /1\/8/.test(tools.moveCritStage('Stone Edge') || ''), String(tools.moveCritStage('Stone Edge')));
var c13 = ctx();
var r13 = sim(c13, { move: 'Sludge Bomb' }, [{ move: 'Hydro Pump' }]);
chk('行里带 crit_note（声明未计入）', /critical hits are NOT included/.test(r13.rows[0].crit_note || ''), String(r13.rows[0].crit_note).slice(0, 160));
chk('unknown 也声明 crit/附加效果未建模', (r13.rows[0].unknown || []).some(function (x) { return /critical hits and secondary effects/.test(x); }), JSON.stringify(r13.rows[0].unknown));

console.log('变化招 / 异常状态：只标注不建模（防"工具制造的安全感"）');
var c14 = ctx();
var r14 = sim(c14, { move: 'Sludge Bomb' }, [{ move: 'Toxic' }, { move: 'Recover' }]);
chk('对手变化招 → 标 status_move + note 说明效果未建模', r14.rows[0].status_move === true && /STATUS move/.test(r14.rows[0].status_move_note || ''), String(r14.rows[0].status_move_note).slice(0, 160));
chk('note 明确说 0% 不等于安全、不能据以声明 survives', /does NOT mean the branch is harmless/.test(r14.rows[0].status_move_note || '') && /NOT a valid basis for declaring/.test(r14.rows[0].status_move_note || ''), String(r14.rows[0].status_move_note).slice(0, 200));
var r14b = sim(c14, { move: 'Sludge Bomb' }, [{ move: 'Hurricane' }]);
chk('伤害招分支不触发 status_move', !r14b.rows[0].status_move, String(r14b.rows[0].status_move_note));
chk('顶层带 model_scope 声明', /DAMAGE & SURVIVAL ONLY/.test(r14.model_scope || '') && /NOT MODELLED/.test(r14.model_scope || ''), String(r14.model_scope).slice(0, 120));
var stPar = JSON.parse(JSON.stringify(state));
stPar.me.status = 'par';
var c15 = { state: stPar, notes: notes, turn: 1, ledger: tools.newLedger(), simGateOn: true };
var r15 = tools.runTool('simulate_turn', { i_do: { move: 'Sludge Bomb' }, opp_does: [{ move: 'Hurricane' }] }, c15);
chk('我方麻痹 → 标 status_condition_note（速度未减半）', /paralysed/.test(r15.rows[0].status_condition_note || '') && /NOT applied/.test(r15.rows[0].status_condition_note || ''), String(r15.rows[0].status_condition_note));
chk('unknown 声明状态/能力等级/残余均未算', ['status conditions are NOT applied', 'stat stages', 'end-of-turn residuals'].every(function (k) { return (r15.rows[0].unknown || []).some(function (x) { return x.indexOf(k) >= 0; }); }), JSON.stringify(r15.rows[0].unknown));

console.log('可能性空间补全（「它没想到的」，按属性聚合）');
var c16 = ctx();
var r16 = sim(c16, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Hurricane' }]);
var ps = r16.possibility_space || {};
chk('扫了对手学得到的一批攻击招', ps.attack_moves_checked > 20, String(ps.attack_moves_checked));
var waterG = (ps.uncovered_threat_types || []).filter(function (g) { return g.move_type === 'Water'; })[0];
chk('聚合成「Water 这一类未覆盖」且带 how_many', !!waterG && waterG.how_many >= 3, JSON.stringify(ps.uncovered_threat_types));
chk('该类里最轻的也 ≥50%（与它带哪个水招无关）', !!waterG && parseInt(waterG.weakest_dmg, 10) >= 50, waterG && waterG.weakest_dmg);
chk('worst_move 只作参考、不是"它会带这招"', !!waterG && /NOT "it carries /.test(ps.note || ''), String(ps.note).slice(0, 140));
chk('已列过的招不参与（worst_move 不是已列的三招）', !!waterG && ['Hydro Pump', 'Scald', 'Hurricane'].indexOf(waterG.worst_move) < 0, waterG && waterG.worst_move);
chk('运行时变属性的招归到实际属性桶（雨天 Weather Ball → Water）', !!waterG && waterG.worst_move === 'Weather Ball', waterG && waterG.worst_move);
var c17 = ctx();
var r17 = sim(c17, { switch: 4 }, [{ move: 'Hydro Pump' }, { move: 'Scald' }, { move: 'Hurricane' }, { move: 'Surf' }, { move: 'Brine' }, { move: 'Water Pulse' }, { move: 'Weather Ball' }]);
var w17 = (r17.possibility_space.uncovered_threat_types || []).filter(function (g) { return g.move_type === 'Water'; })[0];
chk('把水招都列进分支后，Water 这一类消失（或 how_many 变小）', !w17 || w17.how_many < (waterG ? waterG.how_many : 99), JSON.stringify(r17.possibility_space.uncovered_threat_types));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
