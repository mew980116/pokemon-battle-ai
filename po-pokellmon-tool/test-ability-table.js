// test-ability-table.js —— 特性表回归（不花 LLM 费用，纯静态对账）
//
//   node po-pokellmon-tool/test-ability-table.js
//
// 背景：po-script.js 的 `pklmAnalyseAbility`（特性消息号 → PO 特性 id）是**从旧版主脚本移植**的，
// 而 PO 删/并过特性（见 po-pokellmon/README 里「PO 删特性后整体串行」的记录）→ 这张表的 id
// 有整体偏移的风险，靠人眼读 150 条 case 又看不出。
//
// 可自动部分的原理：很多特性消息的模板里**直接写着特性名**（`%s's Damp prevents it from working!`、
// `%s's Sturdy made the attack fail!`）→ 于是能自动问：「模板提到的那个特性」与「我们映射到的 id」一致吗？
// 抓不到的那部分（模板用「气息」「veil of sweetness」这类指代、或纯行为描述）单独列出来，供人工/probe 核。
//
// 断言：
//   ① 模板自证的不一致 = 0（曾抓出 case 44 被错写成 Intimidate，实际是 Own Tempo）
//   ② 一条消息的多个变体若提到**不同特性**，必须用 `[a,b][part]` 取值（曾抓出 case 58 只取了 part0 的 Speed Boost）
//   ③ 「我们写了但消息表里没有这个号」只允许白名单里的（当前 133 = PO 两张表都没有 → 死条目）
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var src = fs.readFileSync(path.join(ROOT, 'po-pokellmon', 'po-script.js'), 'utf8');
var start = src.indexOf('function pklmAnalyseAbility');
if (start < 0) { console.log('FAIL: 找不到 pklmAnalyseAbility'); process.exit(1); }
var body = src.slice(start, src.indexOf('return ability;', start));

// 收集 `case N: ability = X;`（X 为纯数字的才参与「模板自证」；`other` / `[..][part]` 跳过）
var cases = {}, literal = {};
var re = /case\s+(\d+):\s*ability\s*=\s*([0-9]+)\s*;/g, m;
while ((m = re.exec(body))) { cases[m[1]] = Number(m[2]); literal[m[1]] = true; }
var reAll = /case\s+(\d+):/g;
while ((m = reAll.exec(body))) { if (cases[m[1]] === undefined) cases[m[1]] = -1; }   // 非纯数字的也登记，用于「消息号是否存在」检查

var tbl = {};
var raw = fs.readFileSync(path.join(ROOT, 'po-data', 'abilities', 'ability_messages.txt'), 'utf8');
raw.split(/\r?\n/).forEach(function (l) {
    var i = l.indexOf(' ');
    if (i < 1) return;
    var n = l.slice(0, i);
    if (!/^\d+$/.test(n)) return;
    tbl[n] = l.slice(i + 1).split('|');
});

var A = require(path.join(__dirname, 'knowledge', 'abilities.json'));
var names = [];
Object.keys(A.byNum).forEach(function (k) {
    var v = A.byNum[k];
    if (v && v.name) names.push([v.name, Number(k)]);
});
names.sort(function (a, b) { return b[0].length - a[0].length; });

var NOENTRY_WHITELIST = { '133': '消息 133 在 po-data 英/中两张表都不存在（死条目，保留以防 PO 版本差异）' };

var bad = [], multi = [], noentry = [], miss = [], okCount = 0;
Object.keys(cases).sort(function (a, b) { return a - b; }).forEach(function (N) {
    var vs = tbl[N];
    if (!vs) { if (!NOENTRY_WHITELIST[N]) noentry.push(N + '(->#' + cases[N] + ')'); return; }

    var perVariant = [];
    vs.forEach(function (t, i) {
        names.forEach(function (nm) { if (nm[0].length >= 4 && t.indexOf(nm[0]) >= 0) perVariant.push([i, nm[0], nm[1]]); });
    });
    var uniq = {};
    perVariant.forEach(function (p) { uniq[p[1]] = p[2]; });
    if (Object.keys(uniq).length > 1 && literal[N]) {   // 已经用 [..][part] 取值的（literal 为空）不算问题
        multi.push(N + ': 变体分别提到 ' + perVariant.map(function (p) { return 'part' + p[0] + '=' + p[1] + '(#' + p[2] + ')'; }).join(' / ') + ' → 应写成 [a,b][part] 而不是单值 ' + cases[N]);
    }
    if (!perVariant.length) { miss.push(N); return; }
    if (!literal[N]) return;                     // 已经是 other / [..][part] 形式，跳过单值比对
    var last = perVariant[perVariant.length - 1];
    if (last[2] === cases[N]) okCount++;
    else bad.push(N + ': 模板写着 "' + last[1] + '"(#' + last[2] + ') 但表映射到 #' + cases[N]);
});

console.log('特性表对账（pklmAnalyseAbility ↔ po-data/ability_messages.txt）');
console.log('  case 总数                     : ' + Object.keys(cases).length);
console.log('  模板自证且一致                : ' + okCount);
console.log('  模板提到多个不同特性（需 part）: ' + multi.length);
console.log('  模板自证但不一致              : ' + bad.length);
console.log('  消息号不存在（白名单外）      : ' + noentry.length);
console.log('  模板不含特性名（只能靠 probe）: ' + miss.length + '  [' + miss.join(', ') + ']');
multi.forEach(function (s) { console.log('  !! ' + s); });
bad.forEach(function (s) { console.log('  !! ' + s); });
noentry.forEach(function (s) { console.log('  !! 消息 ' + s + ' 不在 ability_messages 表里'); });

var fail = multi.length + bad.length + noentry.length;
console.log(fail === 0 ? ('\nPASS —— ' + okCount + ' 条自证一致，无 part 取值缺失、无消息号缺失（白名单 ' + Object.keys(NOENTRY_WHITELIST).length + ' 条）')
                       : ('\nFAIL —— ' + fail + ' 个问题'));
process.exit(fail === 0 ? 0 : 1);
