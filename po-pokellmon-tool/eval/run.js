// po-pokellmon-tool/eval/run.js — 固定场景评测：同一 fixture 重放 N 次，出「动作 + 过程」双维度对比报告
//
// 为什么要有它（而不是直接用 replay.js）：
//   1. replay.js 是「按日志回合重放、和旧动作比一致性」，一次一回合；本脚本是「同 fixture 采样 N 次、比分布」。
//   2. 只看最终动作会把「侥幸选对」判成通过（见 错题集.md E001：Toxtricity 那次理由算错但结果安全），
//      所以本脚本同时抽取**过程**：算了哪些伤害（inbound / outbound）、strategy 怎么写的那一步。
//
// 用法：
//   node po-pokellmon-tool/eval/run.js <fixture.json> [选项]
//     --n=10              采样次数（默认 10）
//     --url=http://127.0.0.1:8092   server 地址（默认 8092；旧版跑在 8094 时用 --url 指定）
//     --arm=NAME          本臂名字，用于结果文件名与 battleId 前缀（默认 arm）
//     --concurrency=5     并发请求数（server 单机，但相互独立；太高可能触发 DeepSeek 限流）
//     --timeout=300       单样本超时秒数
//     --out=DIR           结果目录（默认 eval/results）
//     --logdir=DIR        读取 toolLog/strategy 的日志目录（默认 ../logs；跑旧版/临时实例时指向那个实例的 logs）
//
// 输出：终端逐样本表 + 汇总；同时把完整明细（含 strategy 原文）写进 <out>/<arm>-<fixture>-<ts>.json
//
// 判定口径（上帝视角，不告诉 LLM）：
//   对「该动作之后场上那只」——换人 = 换入者，攻击 = 当前场上那只——用 fixture.eval.threatMoves 逐招算最坏承伤：
//     任一招 guaranteed OHKO      -> LETHAL（该动作必然送掉这只）
//     任一招 有几率 OHKO（<100%） -> RISKY
//     全部 <100% 且有几率 OHKO…   -> RISKY
//     其余                        -> SAFE
//   过程指标：inbound 验算次数（有没有去算对手打我方）、strategy 里对承伤倍率的表述。

const fs = require('fs');
const path = require('path');
const tools = require('../tools.js');

const args = process.argv.slice(2);
if (!args.length || args[0].indexOf('--') === 0) {
    console.log('用法: node eval/run.js <fixture.json> [--n=10] [--url=...] [--arm=...] [--concurrency=5] [--timeout=300] [--logdir=DIR] [--out=DIR]');
    process.exit(1);
}
const fixturePath = args[0];
const opts = { n: 10, url: 'http://127.0.0.1:8092', arm: 'arm', concurrency: 5, timeout: 300, out: path.join(__dirname, 'results'), logdir: path.join(__dirname, '..', 'logs') };
for (let i = 1; i < args.length; i++) {
    const m = args[i].match(/^--(n|url|arm|concurrency|timeout|out|logdir)=(.+)$/);
    if (!m) { console.log('未知参数: ' + args[i]); process.exit(1); }
    opts[m[1]] = /^\d+$/.test(m[2]) ? Number(m[2]) : m[2];
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8').replace(/^\uFEFF/, ''));
if (!fixture.state || !fixture.eval) { console.log('fixture 必须含 state 与 eval 块'); process.exit(1); }
const F = fixture.eval;
const baseState = Object.assign({}, fixture.state);
baseState.log = true;

// ---------- 上帝视角判定 ----------
function worstIncoming(state, targetSlot, threats) {
    let worst = { pctMin: 0, pctMax: 0, ko: '(no threats)', move: null, error: null };
    for (const mv of threats) {
        let r;
        try {
            r = tools.runTool('calc_damage', {
                legs: [{ attacker: { from_state: 'opp' }, defender: { from_state: 'me:' + targetSlot }, move: { name: mv } }]
            }, { state: state });
        } catch (e) { r = { error: String(e && e.message || e) }; }
        const leg = (r && r.legs && r.legs[0]) || r;
        if (!leg || leg.error || leg.percent_max === undefined) {
            worst = { pctMin: 0, pctMax: 0, ko: 'CALC FAILED', move: mv, error: JSON.stringify(r).slice(0, 200) };
            continue;
        }
        if (leg.percent_max > worst.pctMax) {
            worst = { pctMin: leg.percent_min, pctMax: leg.percent_max, ko: leg.ko_verdict || leg.ko || '', move: mv, acc: tools.moveAccuracy(mv, state.weather), error: null };
        }
    }
    return worst;
}

function verdictOf(state, action, threats) {
    if (!action) return { verdict: 'NO_ACTION', targetSlot: null, worst: null };
    const isSwitch = action.type === 'switch';
    const targetSlot = isSwitch ? action.pokeSlot : 0;
    const worst = worstIncoming(state, targetSlot, threats);
    const ko = String(worst.ko || '');
    let verdict = 'SAFE';
    if (/CALC FAILED/.test(ko)) verdict = 'UNKNOWN';
    else if (/guaranteed OHKO/i.test(ko)) verdict = 'LETHAL';
    else if (/chance to OHKO/i.test(ko)) verdict = 'RISKY';
    return { verdict, targetSlot, targetName: (state.myTeam && state.myTeam[targetSlot] || {}).name || ('slot' + targetSlot), worst, isSwitch };
}

// ---------- 过程提取（从 server 写的日志里读 toolLog / save_strategy） ----------
function logPathFor(battleId) {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return path.join(opts.logdir, 'deepseek_tool_' + d.getFullYear() + mm + dd + '_battle' + battleId + '.log');
}

function readEntry(battleId, wantTurn) {
    const f = logPathFor(battleId);
    if (!fs.existsSync(f)) return null;
    const lines = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    let found = null;
    for (const l of lines) {
        let o; try { o = JSON.parse(l); } catch (e) { continue; }
        if (o && o.type === 'turn' && (wantTurn === undefined || o.turn === wantTurn)) found = o;
    }
    return found;
}

function extractProcess(entry, state) {
    if (!entry) return { calcs: [], inbound: [], outbound: [], strategy: null };
    const myNames = (state.myTeam || []).map(t => t.name);
    const calcs = [], inbound = [], outbound = [];
    let strategy = null, simCalls = 0, strategyRejections = 0, warningCount = 0, lastWarning = null, multMentions = 0;
    (entry.toolLog || []).forEach(r => {
        (r.calls || []).forEach(c => {
            if (c.name === 'calc_damage') {
                (c.args.legs || []).forEach(l => {
                    const at = l.attacker || {}, df = l.defender || {};
                    const label = (at.poke || at.from_state || '?') + ' -> ' + (df.poke || df.from_state || '?') + ' : ' + ((l.move || {}).name || '?');
                    const mine = (myNames.indexOf(String(df.poke)) !== -1) || String(df.from_state || '').indexOf('me') === 0;
                    calcs.push({ side: mine ? 'INBOUND' : 'OUTBOUND', label: label });
                    (mine ? inbound : outbound).push(label);
                });
            } else if (c.name === 'calc_stats') {
                calcs.push({ side: 'STATS', label: (c.args.legs || []).map(x => (x.poke || '?') + ' spe').join(',') });
            } else if (c.name === 'simulate_turn') {
                simCalls++;
                calcs.push({ side: 'SIM', label: JSON.stringify(c.args.i_do) + ' vs ' + JSON.stringify((c.args.opp_does || []).map(b => b.move || ('switch' + b.switch))) });
            } else if (c.name === 'save_strategy') {
                if (c.result && c.result.error) strategyRejections++;
                else {
                    strategy = c.args;
                    if (c.result && c.result.warning) { warningCount++; lastWarning = String(c.result.warning).slice(0, 300); }
                    if (c.result && c.result.multiplierMentions) multMentions += c.result.multiplierMentions;
                }
            } else if (c.name === 'predict') {
                calcs.push({ side: 'PREDICT', label: '' });
            }
        });
    });
    const led = entry.ledger || { sims: [] };
    const sims = (led.sims || []).map(s => ({ actionKey: s.actionKey, opp_does: s.opp_does }));
    const txt = (strategy && strategy.text) || '';
    // 「以对手行为作为理由」的粗略计数（用于观察防幻觉是否逼出新的行为幻觉）
    const behaviorHits = (txt.match(/they (?:will |would |likely |probably )?(?:switch|u-?turn|pivot|roost)/gi) || []).length +
        (txt.match(/(?:it|they|opponent)[^.]{0,40}(?:won'?t|will not|unlikely to) (?:click|use|attack)/gi) || []).length;
    return {
        calcs, inbound, outbound, strategy, rounds: entry.rounds, ms: entry.totalMs,
        fallback: !!(entry.action && entry.action.fallback), reason: entry.action && entry.action.reason,
        simCalls, sims, strategyRejections,
        warningCount, lastWarning, multMentions,
        assumeConflicts: (entry.ledger && entry.ledger.assumeConflicts) || [],
        gateUnmet: !!entry.gateUnmet, gateBypassed: !!entry.gateBypassed, gateRejections: led.rejections || 0,
        declaredAction: strategy && strategy.action, declaredBranch: strategy && strategy.branch, declaredOutcome: strategy && strategy.outcome,
        behaviorHits
    };
}

// ---------- 采样 ----------
async function oneSample(i) {
    const st = Object.assign({}, baseState);
    const battleId = opts.arm + '-R' + i;
    st.battleId = battleId;
    st.replayOfTurn = 1;
    const url = opts.url + '/choice?state=' + encodeURIComponent(JSON.stringify(st));
    const t0 = Date.now();
    let action = null, err = null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeout * 1000) });
        action = await res.json();
    } catch (ex) { err = ex && ex.message ? ex.message : String(ex); }
    const ms = Date.now() - t0;
    const entry = readEntry(battleId, baseState.turn);
    return { i: i, battleId: battleId, ms: ms, action: action, err: err, proc: extractProcess(entry, baseState) };
}

async function run() {
    console.log('fixture: ' + path.basename(fixturePath) + '  (' + F.name + ')');
    console.log('目标: ' + F.note);
    console.log('arm=' + opts.arm + '   url=' + opts.url + '   n=' + opts.n + '   concurrency=' + opts.concurrency);
    console.log('承伤判定用招: ' + F.threatMoves.join(' / ') + '\n');

    const samples = [];
    for (let s = 0; s < opts.n; s += opts.concurrency) {
        const batch = [];
        for (let i = s; i < Math.min(s + opts.concurrency, opts.n); i++) batch.push(oneSample(i + 1));
        const rs = await Promise.all(batch);
        rs.forEach(r => { samples.push(r); process.stdout.write('.'); });
    }
    console.log('\n');

    samples.sort((a, b) => a.i - b.i);
    samples.forEach(r => {
        const v = verdictOf(baseState, r.action, F.threatMoves);
        r.verdict = v;
        const act = r.err ? ('ERR ' + r.err) : (r.action.type === 'switch' ? ('SWITCH→' + (v.targetName || r.action.pokeSlot)) : ('ATK slot' + r.action.attackSlot + ' (留场 ' + v.targetName + ')'));
        console.log('R' + String(r.i).padStart(2, ' ') + ' | ' + act.padEnd(30, ' ') +
            ' | r=' + String(r.proc.rounds === undefined ? '?' : r.proc.rounds).padStart(2, ' ') +
            ' ' + Math.round(r.ms / 1000) + 's' +
            ' | inbound=' + r.proc.inbound.length +
            ' sims=' + (r.proc.simCalls || 0) +
            ' | 最坏 ' + (v.worst ? (v.worst.move + ' ' + v.worst.pctMin + '-' + v.worst.pctMax + '%' + (v.worst.acc != null && v.worst.acc < 100 ? '（命中' + v.worst.acc + '%）' : '')) : '-') +
            ' | ' + v.verdict + (v.worst && v.worst.acc != null && v.worst.acc < 100 ? '*' : '') + (r.proc.fallback ? ' [FALLBACK ' + r.proc.reason + ']' : ''));
        const simList = (r.proc.sims || []).map(s => s.actionKey + '⟵[' + (s.opp_does || []).join(',') + ']').join(' ; ');
        console.log('      sims: ' + (simList || '(none)') +
            ' | 声明=' + (r.proc.declaredAction || '-') + ' / ' + (r.proc.declaredBranch || '-') + ' → ' + (r.proc.declaredOutcome || '-') +
            ' | strategy拒=' + (r.proc.strategyRejections || 0) + ' gate打回=' + (r.proc.gateRejections || 0) +
            ' 提醒=' + (r.proc.warningCount || 0) + ' 倍率提及=' + (r.proc.multMentions || 0) + (r.proc.assumeConflicts && r.proc.assumeConflicts.length ? ' 假设冲突' : '') +
            (r.proc.gateUnmet ? ' gateUnmet' : '') + (r.proc.gateBypassed ? ' gateBypassed' : '') +
            ' | 行为理由=' + (r.proc.behaviorHits || 0));
    });

    // 汇总
    const byAction = {}, byVerdict = {};
    let inboundTotal = 0, simCalls = 0, branchTotal = 0, stratRej = 0, gateRej = 0, unmet = 0, bypassed = 0, misfits = 0, behTotal = 0, warnTotal = 0, multTotal = 0, assumeConflictSamples = 0;
    samples.forEach(r => {
        const v = r.verdict;
        const key = r.err ? 'ERROR' : (r.action.type === 'switch' ? ('SWITCH→' + v.targetName) : 'ATK(stay)');
        byAction[key] = (byAction[key] || 0) + 1;
        byVerdict[v.verdict] = (byVerdict[v.verdict] || 0) + 1;
        inboundTotal += r.proc.inbound.length;
        simCalls += (r.proc.simCalls || 0);
        (r.proc.sims || []).forEach(s => { branchTotal += (s.opp_does || []).length; });
        stratRej += (r.proc.strategyRejections || 0);
        gateRej += (r.proc.gateRejections || 0);
        if (r.proc.gateUnmet) unmet++;
        if (r.proc.gateBypassed) bypassed++;
        behTotal += (r.proc.behaviorHits || 0);
        warnTotal += (r.proc.warningCount || 0);
        multTotal += (r.proc.multMentions || 0);
        if (r.proc.assumeConflicts && r.proc.assumeConflicts.length) assumeConflictSamples++;
        if (r.proc.declaredOutcome && /faint|die|ko|倒下|送/i.test(r.proc.declaredOutcome)) misfits++;
    });
    const nOk = samples.filter(r => !r.err).length;
    console.log('\n===== ' + opts.arm + ' 汇总 (n=' + nOk + '/' + samples.length + ') =====');
    console.log('动作分布:  ' + Object.keys(byAction).map(k => k + ' ×' + byAction[k]).join('   '));
    console.log('风险分布:  ' + Object.keys(byVerdict).map(k => k + ' ×' + byVerdict[k]).join('   '));
    console.log('inbound 验算: 合计 ' + inboundTotal + '，均值 ' + (inboundTotal / Math.max(1, nOk)).toFixed(2) + ' / 样本');
    console.log('simulate_turn: 调用 ' + simCalls + ' 次（均值 ' + (simCalls / Math.max(1, nOk)).toFixed(2) + '/样本），枚举分支合计 ' + branchTotal);
    console.log('闸门摩擦: strategy 被拒 ' + stratRej + ' 次，最终答案被拒 ' + gateRej + ' 次，gateUnmet ' + unmet + '，gateBypassed ' + bypassed);
    console.log('如实写 faints（承认牺牲/赌）: ' + misfits + '/' + nOk + '；「以对手行为为理由」计数合计 ' + behTotal);
    console.log('非阻断提醒: 合计 ' + warnTotal + ' 条；散文倍率提及合计 ' + multTotal + '；假设冲突样本 ' + assumeConflictSamples + '/' + nOk);
    const acc = samples.filter(r => !r.err && r.action && r.action.type === 'switch' && r.action.pokeSlot === F.accidentSlot).length;
    console.log('事故决策(' + (baseState.myTeam[F.accidentSlot] || {}).name + '): ' + acc + '/' + nOk + ' = ' + (100 * acc / Math.max(1, nOk)).toFixed(0) + '%');

    if (!fs.existsSync(opts.out)) fs.mkdirSync(opts.out, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFile = path.join(opts.out, opts.arm + '-' + F.name + '-' + stamp + '.json');
    fs.writeFileSync(outFile, JSON.stringify({ fixture: F.name, arm: opts.arm, url: opts.url, n: opts.n, when: stamp, summary: { byAction: byAction, byVerdict: byVerdict, inboundTotal: inboundTotal, simCalls: simCalls, branchTotal: branchTotal, strategyRejections: stratRej, gateRejections: gateRej, gateUnmet: unmet, gateBypassed: bypassed, honestFaints: misfits, behaviorHits: behTotal, accident: acc, nOk: nOk }, samples: samples }, null, 1));
    console.log('明细(含 strategy 原文): ' + outFile);
}

run();
