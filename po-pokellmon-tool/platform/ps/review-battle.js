// 复盘一场 PS 对局：把客户端日志里的战报还原成 PS 协议原文，再加上每回合的 LLM 决策摘要。
//
// 用法：
//   node platform/ps/review-battle.js battle-gen9randombattle-67
//   node platform/ps/review-battle.js battle-gen9randombattle-67 --out logs/battle-67.txt
//
// 数据来源：
//   platform/logs/ps-*.jsonl            —— 客户端收到的协议（两个客户端会各写一份，按连续重复去重）
//   po-pokellmon-tool/logs/deepseek_tool_*_battle<roomId>.log —— 决策服务每回合的记录（动作/耗时/token/tool 调用）
'use strict';

var fs = require('fs');
var path = require('path');

var room = process.argv[2];
if (!room) {
    console.error('用法: node platform/ps/review-battle.js <roomId> [--out <file>]');
    process.exit(1);
}
var outIdx = process.argv.indexOf('--out');
var outFile = outIdx !== -1 ? process.argv[outIdx + 1] : null;

var clientLogDir = path.join(__dirname, '..', 'logs');   // platform/logs（run-shadow.js 写这里）
var serviceLogDir = path.join(__dirname, '..', '..', 'logs');   // po-pokellmon-tool/logs

function readJsonl(file) {
    var text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
    var rows = [];
    text.trim().split(/\r?\n/).forEach(function (line) {
        if (!line) return;
        try { rows.push(JSON.parse(line)); } catch (e) { /* 跳过坏行 */ }
    });
    return rows;
}

// ---------- 1) 战报 ----------
var clientFiles = fs.existsSync(clientLogDir)
    ? fs.readdirSync(clientLogDir).filter(function (f) { return /^ps-.*\.jsonl$/.test(f); }).sort()
    : [];
var transcript = [];
var seenTurnCount = 0;
var lastSeen = {};
clientFiles.forEach(function (f) {
    readJsonl(path.join(clientLogDir, f)).forEach(function (row) {
        if (row.type !== 'protocol' || !row.data || row.data.room !== room) return;
        var e = row.data.event || {};
        if (!e.type || e.type === 't:' || e.type === 't') return;
        var args = e.args || [];
        var line = '|' + e.type + (args.length ? '|' + args.join('|') : '');
        // 两个客户端各写一份：带参数的事件在 500ms 内重复出现就丢掉（纯标记行如 |request/|upkeep 保留，
        // 因为同一回合本来就可能有两条 request —— 一条真请求、一条 wait）
        var ts = Date.parse(row.time) || 0;
        if (args.length && lastSeen[line] !== undefined && ts - lastSeen[line] < 500) return;
        lastSeen[line] = ts;
        if (e.type === 'turn') seenTurnCount = Math.max(seenTurnCount, Number(e.turn) || 0);
        transcript.push(line);
    });
});

// ---------- 2) 决策摘要 ----------
var serviceFiles = fs.existsSync(serviceLogDir)
    ? fs.readdirSync(serviceLogDir).filter(function (f) { return f.indexOf(room) !== -1; }).sort()
    : [];
var decisions = [];
var totals = { prompt: 0, completion: 0, ms: 0, fallback: 0, calls: 0 };
serviceFiles.forEach(function (f) {
    readJsonl(path.join(serviceLogDir, f)).forEach(function (r) {
        var calls = 0;
        var p = 0, c = 0;
        (r.toolLog || []).forEach(function (round) {
            var u = round.usage || {};
            p += u.prompt_tokens || 0;
            c += u.completion_tokens || 0;
            calls++;
        });
        if (!calls && r.usage) {
            p = r.usage.prompt_tokens || 0;
            c = r.usage.completion_tokens || 0;
            calls = 1;
        }
        totals.prompt += p; totals.completion += c; totals.ms += r.totalMs || 0; totals.calls += calls;
        if (r.fallback) totals.fallback++;
        var toolCalls = [];
        (r.toolLog || []).forEach(function (round) {
            (round.calls || []).forEach(function (call) {
                var a = call.args || {};
                var brief = a.action || a.i_do || a.choice || a.pokemon || a.move || a.attack_type || '';
                if (typeof brief === 'object') brief = JSON.stringify(brief);
                toolCalls.push(call.name + (brief ? '(' + String(brief).slice(0, 40) + ')' : ''));
            });
        });
        decisions.push({
            turn: r.turn, action: r.action, fallback: !!r.fallback, reason: r.fallbackReason || '',
            ms: r.totalMs, calls: calls, prompt: p, completion: c, tools: toolCalls
        });
    });
});

// ---------- 输出 ----------
var out = [];
out.push('================ 对局 ' + room + ' ================');
out.push('战报行数: ' + transcript.length + ' | 最后回合: ' + seenTurnCount +
    ' | LLM 决策: ' + decisions.length + ' 次（其中兜底 ' + totals.fallback + ' 次）');
if (decisions.length) {
    out.push('LLM 用量: prompt ' + totals.prompt + ' + completion ' + totals.completion +
        ' = ' + (totals.prompt + totals.completion) + ' tokens，共 ' + totals.calls + ' 次请求，累计思考 ' +
        Math.round(totals.ms / 1000) + 's');
}
out.push('');
out.push('---------------- 战报（PS 协议原文）----------------');
transcript.forEach(function (line) { out.push(line); });
out.push('');
out.push('---------------- 每回合决策 ----------------');
decisions.forEach(function (d) {
    out.push('T' + d.turn + ' ' + (d.fallback ? '[兜底] ' : '') + JSON.stringify(d.action) +
        (d.fallback && d.reason ? '(' + d.reason + ')' : '') +
        ' | ' + d.ms + 'ms ' + d.calls + '次请求 ' + (d.prompt + d.completion) + ' tokens' +
        (d.tools.length ? ' | tools: ' + d.tools.join(' ') : ''));
});

var text = out.join('\n');
console.log(text);
if (outFile) {
    fs.writeFileSync(outFile, text);
    console.log('\n[已写入] ' + outFile);
}
