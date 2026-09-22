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
chk('只仿真过换人、选已仿真过的 switch 3 → 放行（0.7.8 撤掉了「换人必须先仿留场」）', tools.actionGateCheck(c5.ledger, { type: 'switch', pokeSlot: 3 }, state) === null);
chk('save_strategy 侧同样不要求留场线', save(c5, { action: 'switch 3', branch: 'Hydro Pump', outcome: 'not applicable' }).ok === true);

console.log('回合走势：留场必倒时，工具确定性给出「死亡 = 免费替补」（battle106 T13/T14 的坑）');
var r5stay = sim(c5, { move: 'Sludge Bomb' }, [{ move: 'Hydro Pump' }, { switch: 2 }]);
var stayRows = {};
(r5stay.rows || []).forEach(function (r) { stayRows[r.branchKey] = r; });
chk('留场且我方会倒的行 → 带 trajectory，写明 FREE replacement / 换人当回合就吃招',
    /FREE replacement/.test(String(stayRows['Hydro Pump'].trajectory)) && /NO hit/.test(String(stayRows['Hydro Pump'].trajectory)) && /THIS turn/.test(String(stayRows['Hydro Pump'].trajectory)),
    String(stayRows['Hydro Pump'] && stayRows['Hydro Pump'].trajectory).slice(0, 200));
chk('留场但打不到我（对手换人）→ 不给 trajectory（不误导）', stayRows['switch 2'].trajectory === undefined, String(stayRows['switch 2'].trajectory).slice(0, 120));
// 0.8.5：删掉「STAYING is normally better」这类**倾向性建议**（它的触发条件只看"留场会倒"，没检查换人能不能救 =>
// battle111 T2 说反了）；改成要求先去看换入行的存活情况。
chk('会倒的留场行不再出现 "normally better" 这类建议', !/normally better/i.test(String(stayRows['Hydro Pump'].trajectory)), String(stayRows['Hydro Pump'].trajectory).slice(-160));
chk('改为要求先看换入行是否活得下来', /check your switch rows/.test(String(stayRows['Hydro Pump'].trajectory)), String(stayRows['Hydro Pump'].trajectory).slice(-160));
chk('换人分支本身不给 trajectory（不是"你被免费换下去"）', (function () { var rr = sim(ctx(), { switch: 3 }, [{ move: 'Hydro Pump' }]); return rr.rows[0].trajectory === undefined; })());

console.log('同先制度 → 一律正反手都算（不判谁快；0.8.0 起）');
var c6 = ctx();
var r6 = sim(c6, { move: 'Sludge Bomb' }, [{ move: 'Hydro Pump' }]);
chk('order 明说 BOTH orders + 速度不可信', /BOTH orders/.test(r6.rows[0].order) && /speed comparison is NOT trusted/.test(r6.rows[0].order), r6.rows[0].order);
chk('order 里保留速度区间但只作参考', /reference only: your spe/.test(r6.rows[0].order), r6.rows[0].order);
chk('cases 给了两种顺序', (r6.rows[0].cases || []).length === 2, JSON.stringify(r6.rows[0].cases));
chk('cases 里两种 order 都出现', (r6.rows[0].cases || []).map(function (x) { return x.order; }).join('|') === 'you first|they first', JSON.stringify((r6.rows[0].cases || []).map(function (x) { return x.order; })));
chk('【正反手】summary 必须显式写明，不能只显示 you first', /BOTH ORDERS SIMULATED/.test(r6.rows[0].mine.summary) && /do NOT assume you move first/.test(r6.rows[0].mine.summary), r6.rows[0].mine.summary.slice(0, 160));
chk('【正反手】逐顺序都列出来', /by order:/.test(r6.rows[0].mine.summary) && /they first/.test(r6.rows[0].mine.summary), r6.rows[0].mine.summary.slice(0, 200));
chk('cases 里不泄漏内部打分字段 _lo', JSON.stringify(r6.rows[0].cases).indexOf('_lo') < 0, JSON.stringify(r6.rows[0].cases).slice(0, 120));
chk('unknown 里声明速度区间不能用来定顺序（围巾不在区间内）', (r6.rows[0].unknown || []).some(function (x) { return /cannot be used to decide move order/.test(x); }), JSON.stringify(r6.rows[0].unknown));

console.log('先手度数不同 → 顺序是硬事实，仍只算一种');
var stPrio = JSON.parse(JSON.stringify(state));
stPrio.me.moves = [{ name: 'Aqua Jet', slot: 0, used: 0 }];
var cPrio = { state: stPrio, notes: notes, turn: 1, ledger: tools.newLedger(), simGateOn: true };
var rPrio = tools.runTool('simulate_turn', { i_do: { move: 'Aqua Jet' }, opp_does: [{ move: 'Hydro Pump' }] }, cPrio);
chk('先制 vs 非先制 → 单一时序，且明写 priority 1 vs 0', /priority 1 vs 0/.test(rPrio.rows[0].order || '') && (rPrio.rows[0].cases || []).length === 1, rPrio.rows[0].order);
chk('先制那一侧不出现 BOTH ORDERS', !/BOTH ORDERS SIMULATED/.test((rPrio.rows[0].mine || {}).summary || ''), String((rPrio.rows[0].mine || {}).summary).slice(0, 160));

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
chk('我方明显更快也照样给两种顺序（0.8.0 起不判谁快）', /BOTH orders/.test(r7.rows[0].order || '') && (r7.rows[0].cases || []).length === 2, r7.rows[0].order);
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

console.log('图鉴层的「隐性威胁」提示（变化招不在伤害表里）');
var giD = tools.runTool('get_pokemon_info', { pokemon: 'Diggersby' }, { state: {} });
chk('Diggersby 列出 self_setup（含 Swords Dance）', !!(giD.notable_status_moves && giD.notable_status_moves.self_setup && giD.notable_status_moves.self_setup.indexOf('Swords Dance') >= 0), JSON.stringify(giD.notable_status_moves));
var giA = tools.runTool('get_pokemon_info', { pokemon: 'Aromatisse' }, { state: {} });
chk('Aromatisse 列出 Calm Mind（对手冥想）', !!(giA.notable_status_moves && giA.notable_status_moves.self_setup && giA.notable_status_moves.self_setup.indexOf('Calm Mind') >= 0), JSON.stringify(giA.notable_status_moves));
chk('带解释 note（说明变化招在 sim 里看不见）', /invisible in simulate_turn/.test(giD.notable_status_moves_note || ''), String(giD.notable_status_moves_note).slice(0, 120));
var giC = tools.runTool('get_pokemon_info', { pokemon: 'Claydol' }, { state: {} });
chk('Claydol 列出 Cosmic Power / Iron Defense', !!(giC.notable_status_moves && giC.notable_status_moves.self_setup && giC.notable_status_moves.self_setup.indexOf('Cosmic Power') >= 0), JSON.stringify(giC.notable_status_moves));
chk('只含 Status 招（不含伤害招）', !JSON.stringify(giD.notable_status_moves).match(/(Hydro Pump|Body Slam|Earthquake)/), JSON.stringify(giD.notable_status_moves));

console.log('默认值的偏向必须显式给出（打落 ×1.5 / 对手 EV 锚点）');
// 打落需要「当前场上这只真的会这招」，用一份浅拷贝把 Weezing 的招式表换掉
function ctxMoves(mv) {
    var s = JSON.parse(JSON.stringify(state));
    s.me.moves = [{ name: mv, used: 0 }];
    return { state: s, notes: notes, turn: 1, ledger: tools.newLedger(), simGateOn: true };
}
var r18 = sim(ctxMoves('Knock Off'), { move: 'Knock Off' }, [{ move: 'Dragon Dance' }]);
chk('打落·对手道具未知 → 给「有道具/无道具」两个值', !!r18.rows[0].item_note && /if the target holds an item/.test(r18.rows[0].item_note) && /if it holds none/.test(r18.rows[0].item_note), String(r18.rows[0].item_note).slice(0, 150));
chk('打落·两个值不同（确认 ×1.5 生效）', (function () { var m = String(r18.rows[0].item_note).match(/Knock Off = ([\d-]+)% if the target holds an item \/ ([\d-]+)% if it holds none/); return !!m && m[1] !== m[2]; })(), String(r18.rows[0].item_note).slice(0, 90));
// 对手当攻击方、EV 未假设 → 两个锚点 + 保守化 faints
var c19 = ctx();
var r19 = sim(c19, { switch: 2 }, [{ move: 'Scald' }]);
chk('对手攻击·EV 未假设 → 给 0EV 与 252+ 两个锚点', !!r19.rows[0].ev_note && /at 0 EV/.test(r19.rows[0].ev_note) && /252 in its attacking stat/.test(r19.rows[0].ev_note), String(r19.rows[0].ev_note).slice(0, 160));
chk('给定 hp_after_max_investment', !!r19.rows[0].mine.hp_after_max_investment, String(r19.rows[0].mine.hp_after_max_investment));
chk('summary 里也标出两个 (see ev_note)', /their spread unassumed/.test(r19.rows[0].mine.summary), r19.rows[0].mine.summary.slice(0, 200));
// 传了 assume → 锚点消失
var c20 = ctx();
var r20 = sim(c20, { switch: 2 }, [{ move: 'Scald' }], { opp_spread: '252 SpA / Modest' });
chk('传了 assume 后不再给锚点', !r20.rows[0].ev_note, String(r20.rows[0].ev_note));

console.log('\n动作编号 → 动作（choiceToAction，与 server.parseAction 同源）');
var nMv = state.me.moves.length, nBn = state.bench.length;
chk('choice 1 → 第 1 个招式的 slot', tools.choiceToAction(1, state).attackSlot === state.me.moves[0].slot && tools.choiceToAction(1, state).type === 'attack');
var firstSw = tools.choiceToAction(nMv + 1, state);
chk('choice moves+1 → bench[0]（换人）', firstSw.type === 'switch' && firstSw.pokeSlot === state.bench[0].slot && firstSw.switchName === state.bench[0].name, JSON.stringify(firstSw));
chk('choice 末项 → bench 最后一只', tools.choiceToAction(nMv + nBn, state).switchName === state.bench[nBn - 1].name);
chk('choice 越界 → null', tools.choiceToAction(nMv + nBn + 1, state) === null && tools.choiceToAction(0, state) === null);

console.log('\n门禁必须按 slot 找招（回归：bannedMoves 过滤后 slot != 数组下标）');
// battle99 T7 实际形态：专爱锁招 Megahorn 被 PO 拒 → 从 me.moves 过滤掉，剩下的 slot 保留原值（1/2/3）
var filtered = JSON.parse(JSON.stringify(state));
filtered.me.moves = [{ name: 'Iron Head', slot: 1 }, { name: 'Close Combat', slot: 2 }, { name: 'Knock Off', slot: 3 }];
var ledEmpty = tools.newLedger();
var ledIH = tools.newLedger();
ledIH.sims.push({ actionKey: 'move Iron Head' });
var ledCC = tools.newLedger();
ledCC.sims.push({ actionKey: 'move Close Combat' });
// 旧代码：moves[3] 越界 → need=null → 静默放行
var g1 = tools.actionGateCheck(ledEmpty, { type: 'attack', attackSlot: 3 }, filtered);
chk('slot 越界（Knock Off, slot3）→ 仍然拦（旧代码放行）', !!g1 && /Knock Off/.test(g1), String(g1).slice(0, 120));
// 旧代码：moves[1] = Close Combat → 错拦
var g2 = tools.actionGateCheck(ledIH, { type: 'attack', attackSlot: 1 }, filtered);
chk('已仿真 Iron Head 且选 slot1 → 放行（旧代码错查 Close Combat 而拦）', g2 === null, String(g2).slice(0, 140));
var g3 = tools.actionGateCheck(ledCC, { type: 'attack', attackSlot: 1 }, filtered);
chk('只仿真了 Close Combat 而选 slot1 → 拦的是 Iron Head', /about to answer "move Iron Head"/.test(String(g3)), String(g3).slice(0, 140));

console.log('\nresolve_choice：把编号翻成动作并与 save_strategy 声明比对');
// battle99 T1 的真实形态：4 招 + 5 换人；声明写 switch 5(=Escavalier)，实际吐 {"choice":5}(=Slurpuff)
var t1state = {
    me: { moves: [{ name: 'Earthquake', slot: 0 }, { name: 'Stone Edge', slot: 1 }, { name: 'Stealth Rock', slot: 2 }, { name: 'Glare', slot: 3 }] },
    bench: [
        { name: 'Slurpuff', slot: 1, hpPct: 100 }, { name: 'Runerigus', slot: 2, hpPct: 100 }, { name: 'Accelgor', slot: 3, hpPct: 100 },
        { name: 'Ninetales', slot: 4, hpPct: 100 }, { name: 'Escavalier', slot: 5, hpPct: 100 }
    ]
};
function rctx(turnAction) {
    return { state: t1state, notes: { turns: { '1': { action: turnAction } } }, turn: 1 };
}
var rc1 = tools.runTool('resolve_choice', { choice: 5 }, rctx('switch 5'));
chk('MISMATCH：choice 5 其实是 Slurpuff', rc1.match === false && /Slurpuff/.test(rc1.resolves_to), JSON.stringify(rc1).slice(0, 200));
chk('MISMATCH 提示正确编号 9（Escavalier）', /\{"choice":9\}/.test(rc1.note) && /Escavalier/.test(rc1.note), String(rc1.note).slice(0, 260));
var rc2 = tools.runTool('resolve_choice', { choice: 9 }, rctx('switch 5'));
chk('MATCH：choice 9 = 声明的 switch 5', rc2.match === true && /Escavalier/.test(rc2.resolves_to), JSON.stringify(rc2).slice(0, 200));
var rc3 = tools.runTool('resolve_choice', { choice: 1 }, rctx('move Earthquake'));
chk('MATCH：招式按名字比对（choice 1 = Earthquake）', rc3.match === true, JSON.stringify(rc3).slice(0, 200));
var rc4 = tools.runTool('resolve_choice', { choice: 9 }, rctx('move Earthquake'));
chk('MISMATCH：声明是招式却答了换人', rc4.match === false && /\{"choice":1\}/.test(rc4.note), String(rc4.note).slice(0, 200));
var rc5 = tools.runTool('resolve_choice', { choice: 99 }, rctx('switch 5'));
chk('越界编号 → 报错并给出合法范围 1-9', !!rc5.error && /1-9/.test(rc5.error), String(rc5.error).slice(0, 160));
var rc6 = tools.runTool('resolve_choice', { choice: 1 }, { state: t1state, notes: { turns: {} }, turn: 1 });
chk('没存过 strategy → match=null 且提示先 save_strategy', rc6.match === null && /save_strategy/.test(rc6.note), String(rc6.note).slice(0, 160));

console.log('\nREPLACEMENT MODE 事实块（tool 0.8.2：给事实，不加限制）');
// 复刻 battle108 PO T7 的局面：我方 Throh 已倒，对手 Bouffalant 86% @ Atk+2，候补里有 Mienshao
var rfState = {
    weather: 'None', terrain: 'None', myHazards: [], oppHazards: [],
    myTeam: [{ slot: 0, name: 'Throh', hpPct: 0, ko: true }, { slot: 3, name: 'Mienshao', hpPct: 100, ko: false }],
    myStats: [{ slot: 3, name: 'Mienshao', level: 100, ev: [0, 0, 0, 0, 0, 252], iv: [31, 31, 31, 31, 31, 31], nature: 0 }],
    bench: [{ slot: 3, name: 'Mienshao', hpPct: 100, types: ['Fighting'], moves: [{ name: 'Close Combat', type: 'Fighting' }] }],
    me: { name: 'Throh', hpPct: 0, fainted: true, moves: [], boosts: [] },
    opp: { name: 'Bouffalant', hpPct: 86, moves: [{ name: 'Body Slam', type: 'Normal' }, { name: 'Throat Chop', type: 'Dark' }], boosts: [] },
    oppTeam: [{ slot: 0, name: 'Bouffalant', hpPct: 86, ko: false, revealed: true }]
};
var rf = tools.replacementFacts(rfState);
chk('事实①：写明替补不吃招（TIMING）',
    (rf.block || []).some(function (x) { return /takes NO damage this turn/.test(x) && /DOES NOT EXIST here/.test(x); }),
    JSON.stringify(rf.block).slice(0, 160));
chk('事实②：速度声明为区间 + 先制单独说', (rf.block || []).some(function (x) { return /Speed is a RANGE/.test(x); }) && (rf.block || []).some(function (x) { return /priority/.test(x); }));
chk('事实③：候补行给出 承伤 / 输出 / 速度对比', /takes .+% from its Body Slam/.test(rf.perSlot[3] || '') && /deals .+% with its Close Combat/.test(rf.perSlot[3] || '') && /CLEARLY faster/.test(rf.perSlot[3] || ''), String(rf.perSlot[3]));
chk('事实③：输出带 KO 判定', /guaranteed OHKO/.test(rf.perSlot[3] || ''), String(rf.perSlot[3]));
chk('只给事实：不含任何"必须/应当选谁"的措辞',
    !/must pick|you should switch to|pick slot|required/i.test(rf.block.join(' ') + JSON.stringify(rf.perSlot)),
    (rf.block.join(' ') + JSON.stringify(rf.perSlot)).slice(0, 200));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
