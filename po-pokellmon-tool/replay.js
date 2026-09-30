// po-pokellmon-tool/replay.js — 用历史日志里的 state 重放指定回合，对比「那时的决策」与「现在这套代码的决策」
//
// 用途：改了 prompt / tool / 知识库之后，验证「以前实战里出现的问题现在是否解决」。
// 原理：每回合的 LLM 决策只依赖 state（战场采集）+ server 的 prompt/tool —— 两者都完整存在日志里，
//      所以把日志里的 state 原样发给正在运行的 /choice，就等价于「用现在的系统再决策一次」。
//
// 用法：
//   node replay.js <logfile> [turn...] [选项]
//     <logfile>       logs/deepseek_tool_YYYYMMDD_battleNN.log
//     turn...         只重放这些回合（省略 = 日志里的全部回合）
//   选项：
//     --url=http://127.0.0.1:8092    server 地址（默认 8092）
//     --tag=REPLAY71                 新日志的 battleId 后缀（默认 REPLAY<原battleId>），用于隔离、不污染原日志
//     --timeout=400                  单回合超时秒数（默认 400）
//     --list                         只列出日志里的回合与旧动作，不发请求
//
// 注意：
//   1. 需要先跑着 `node server.js`（重放走的是真实决策链路，含 tool 调用与 DeepSeek 请求，会产生费用）
//   2. 每个回合 = 一次完整决策（实测 30-200s），全量重放很慢；建议先 --list 挑关键回合
//   3. 新决策会写到 logs/deepseek_tool_<今天>_battle<tag>.log（与原日志隔离），脚本跑完会自动读它做对比
//
// 对比输出：每个回合的「旧动作 vs 新动作」、是否一致、工具轮数/耗时变化、是否触发 fallback、以及新决策的 notes。

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.length || args[0].indexOf('--') === 0) {
    console.log('用法: node replay.js <logfile> [turn...] [--url=...] [--tag=...] [--timeout=400] [--list]');
    process.exit(1);
}
const logFile = args[0];
const opts = { url: 'http://127.0.0.1:8092', tag: null, timeout: 400, list: false };
const wantTurns = [];
for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--list') { opts.list = true; continue; }
    const m = a.match(/^--(url|tag|timeout)=(.+)$/);
    if (m) { opts[m[1]] = m[1] === 'timeout' ? Number(m[2]) : m[2]; continue; }
    if (/^\d+$/.test(a)) { wantTurns.push(Number(a)); continue; }
    console.log('未知参数: ' + a);
    process.exit(1);
}

const raw = fs.readFileSync(logFile, 'utf8').replace(/^\uFEFF/, '');
const entries = raw.split(/\r?\n/).filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(o => o && o.type === 'turn');
if (!entries.length) { console.log('日志里没有 type=turn 的记录: ' + logFile); process.exit(1); }

const battleId = (entries[0].state && entries[0].state.battleId) || 'unknown';
const tag = opts.tag || ('REPLAY' + battleId);

console.log('日志: ' + path.basename(logFile) + '  battleId=' + battleId + '  回合数=' + entries.length);
console.log('server: ' + opts.url + (opts.list ? '   (--list 模式，不发请求)' : ''));
console.log('');

const chosen = entries.filter(e => !wantTurns.length || wantTurns.indexOf(e.turn) >= 0);
if (!chosen.length) { console.log('没有匹配的回合。可用回合：' + entries.map(e => e.turn).join(',')); process.exit(1); }

function actStr(a) {
    if (!a) return '(none)';
    if (a.type === 'attack') return 'attack slot' + a.attackSlot;
    if (a.type === 'switch') return 'switch slot' + a.pokeSlot;
    return JSON.stringify(a);
}

if (opts.list) {
    for (const e of chosen) {
        console.log('T' + e.turn + '  旧动作=' + actStr(e.action) + '  rounds=' + e.rounds + '  ' + Math.round((e.totalMs || 0) / 1000) + 's' + (e.action && e.action.fallback ? '  [FALLBACK ' + (e.action.reason || '') + ']' : ''));
    }
    process.exit(0);
}

// 逐回合重放（串行：server 是单机、且并发会打乱日志顺序）
async function run() {
    const results = [];
    for (const e of chosen) {
        const state = Object.assign({}, e.state);
        state.battleId = tag;                 // 关键：写到独立日志文件，不污染原日志
        state.replayOfTurn = e.turn;
        const t0 = Date.now();
        process.stdout.write('T' + e.turn + ' 重放中… ');
        let action = null, err = null;
        try {
            const res = await fetch(opts.url + '/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state),
                signal: AbortSignal.timeout(opts.timeout * 1000)
            });
            action = await res.json();
        } catch (ex) { err = ex && ex.message ? ex.message : String(ex); }
        const ms = Date.now() - t0;
        const oldAct = e.action;
        const same = !err && oldAct && action && action.type === (oldAct.type || 'attack') &&
            (oldAct.type === 'attack' ? action.attackSlot === oldAct.attackSlot : action.pokeSlot === oldAct.pokeSlot);
        console.log((err ? ('ERR ' + err) : actStr(action)) + '  (' + Math.round(ms / 1000) + 's)' + (same ? '  = 与旧决策一致' : '  ≠ 旧决策: ' + actStr(oldAct)));
        if (err) console.log('    ⚠ 该回合重放失败（server 未启动？超时？）');
        results.push({ turn: e.turn, oldAction: oldAct, newAction: action, same: same, ms: ms, err: err });
    }

    // 读新日志，取出新决策的细节（rounds/toolLog/notes）
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const newLog = path.join(__dirname, 'logs', 'deepseek_tool_' + d.getFullYear() + mm + dd + '_battle' + tag + '.log');
    let newEntries = [];
    if (fs.existsSync(newLog)) {
        newEntries = fs.readFileSync(newLog, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
            .map(l => { try { return JSON.parse(l); } catch (x) { return null; } }).filter(o => o && o.type === 'turn');
    }

    console.log('\n===== 对比汇总 =====');
    console.log('turn | 旧动作 (rounds) | 新动作 (rounds) | 一致 | 旧耗时 | 新耗时');
    let changed = 0;
    // 同一个 turn 可能有多条记录（如"强制替补"+"换人后的正常回合"）：必须按组内序号配对，
    // 否则 find/filter(...).pop() 会把同一回合的旧/新记录都取到同一条上（汇总表与上面的逐条结果矛盾）。
    const oldByTurn = {}, newByTurn = {};
    chosen.forEach(x => { (oldByTurn[x.turn] = oldByTurn[x.turn] || []).push(x); });
    newEntries.forEach(x => { (newByTurn[x.turn] = newByTurn[x.turn] || []).push(x); });
    const seen = {};
    for (const r of results) {
        const ord = seen[r.turn] = (seen[r.turn] || 0); seen[r.turn] = ord + 1;
        const oldE = (oldByTurn[r.turn] || [])[ord] || {};
        const newE = (newByTurn[r.turn] || [])[ord] || null;
        if (!r.same) changed++;
        const nAct = newE && newE.action ? newE.action : r.newAction;
        console.log('T' + r.turn + ' | ' + actStr(r.oldAction) + ' (' + oldE.rounds + ') | ' + actStr(nAct) + ' (' + (newE ? newE.rounds : '?') + ') | ' +
            (r.same ? 'Y' : 'N') + ' | ' + Math.round((oldE.totalMs || 0) / 1000) + 's | ' + Math.round(r.ms / 1000) + 's' +
            (nAct && nAct.fallback ? '  [FALLBACK ' + (nAct.reason || '') + ']' : ''));
    }
    console.log('\n共 ' + results.length + ' 回合，' + changed + ' 个决策发生变化' + (results.some(r => r.err) ? '，' + results.filter(r => r.err).length + ' 个重放失败' : ''));
    if (fs.existsSync(newLog)) console.log('新日志: ' + newLog + '（含新决策的 prompt / toolLog / notes，可继续用同样方式分析）');
}

run();
