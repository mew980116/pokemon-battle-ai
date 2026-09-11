// check-thinking.js — 对比 reasoning_effort 四档（none/low/high/max）+ 非思考的 content 非空率 + token + 耗时
// 从指定日志挑 N 个场景，每种模式各测 2 次
// 用法：node po-pokellmon/eval/check-thinking.js [日志路径]

const https = require('https');
const fs = require('fs');
const path = require('path');

const LOG = process.argv[2] || 'po-pokellmon/logs/deepseek_20260911_battle8803.log';
const API_KEY = fs.readFileSync(path.join(__dirname, '..', 'apikey.txt'), 'utf8').trim();

const MODEL = 'deepseek-v4-flash';
const SYSTEM_PROMPT = 'You are playing a Pokemon battle and the goal is to win.';

// 五种模式（新版 reasoning_effort 四档 none/low/high/max + 非思考）
const MODES = [
    { name: 'none', extra: { thinking: { type: 'enabled' }, reasoning_effort: 'none' } },
    { name: 'low', extra: { thinking: { type: 'enabled' }, reasoning_effort: 'low' } },
    { name: 'high', extra: { thinking: { type: 'enabled' }, reasoning_effort: 'high' } },
    { name: 'max', extra: { thinking: { type: 'enabled' }, reasoning_effort: 'max' } },
    { name: 'nothink', extra: { thinking: { type: 'disabled' }, temperature: 0.3 } }
];

function callDeepSeek(prompt, extra) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(Object.assign({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            stream: false,
            response_format: { type: 'json_object' }
        }, extra));   // 不传 max_tokens，取消限制
        const req = https.request({
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let d = '';
            res.on('data', (c) => { d += c; });
            res.on('end', () => resolve(d));
        });
        req.on('error', reject);
        req.setTimeout(120000, () => req.destroy(new Error('timeout')));
        req.write(payload);
        req.end();
    });
}

async function main() {
    const lines = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.trim());
    const seenTurns = new Set();
    const scenes = [];
    for (const l of lines) {
        try {
            const o = JSON.parse(l);
            if (o.turn !== undefined && !seenTurns.has(o.turn) && o.prompt) {
                seenTurns.add(o.turn);
                scenes.push({ turn: o.turn, prompt: o.prompt });
            }
        } catch (e) {}
    }
    const picked = scenes.slice(0, 5);
    console.log('picked turns: ' + picked.map((s) => s.turn).join(', ') + ' (' + picked.length + ' scenes x 2)');
    console.log('modes: ' + MODES.map((m) => m.name).join(' / '));
    console.log('(新版四档 + 非思考；不传 max_tokens 取消限制)\n');

    for (const mode of MODES) {
        console.log('======== MODE: ' + mode.name + ' ========');
        let nonEmpty = 0;
        let total = 0;
        let totalMs = 0;
        for (const s of picked) {
            for (let i = 0; i < 2; i++) {
                const t0 = Date.now();
                let data;
                try {
                    data = await callDeepSeek(s.prompt, mode.extra);
                } catch (e) {
                    console.log('  turn' + s.turn + ' #' + (i + 1) + ' ERROR: ' + e.message);
                    total++;
                    continue;
                }
                const ms = Date.now() - t0;
                totalMs += ms;
                let content = '', ct = null;
                try {
                    const o = JSON.parse(data);
                    if (o.choices && o.choices[0] && o.choices[0].message) {
                        content = o.choices[0].message.content || '';
                    }
                    ct = o.usage ? o.usage.completion_tokens : null;
                } catch (e) {
                    content = '(parse error) ' + data.slice(0, 60);
                }
                const ok = content.trim().length > 0;
                if (ok) nonEmpty++;
                total++;
                console.log('  turn' + s.turn + ' #' + (i + 1) + ' ' + ms + 'ms | 非空=' + ok + ' | comp_tokens=' + ct + ' | ["' + content.slice(0, 40) + '"]');
            }
        }
        console.log('  >> 非空率 ' + nonEmpty + '/' + total + ' | 平均 ' + (total ? Math.round(totalMs / total) : 0) + 'ms\n');
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
