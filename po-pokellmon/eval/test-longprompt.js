// test-longprompt.js — 用实战日志里的真实 prompt 测当前 DeepSeek 响应速度
// 验证：长中文 prompt 当前是快（<1s）还是慢（10s+），判断服务端是否随时间波动
const https = require('https');
const fs = require('fs');
const path = require('path');

const key = fs.readFileSync(path.join(__dirname, '..', 'apikey.txt'), 'utf8').trim();
const LOG = process.argv[2] || 'po-pokellmon/logs/deepseek_20260912_battle8811.log';

function call(prompt) {
    return new Promise((res, rej) => {
        const payload = JSON.stringify({
            model: 'deepseek-v4-flash',
            messages: [
                { role: 'system', content: 'You are playing a Pokemon battle and the goal is to win.' },
                { role: 'user', content: prompt }
            ],
            stream: false,
            response_format: { type: 'json_object' },
            thinking: { type: 'disabled' },
            temperature: 0.3
        });
        const req = https.request({
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + key,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (r) => {
            let d = '';
            r.on('data', (c) => { d += c; });
            r.on('end', () => res({ status: r.statusCode, body: d }));
        });
        req.on('error', rej);
        req.setTimeout(45000, () => req.destroy(new Error('timeout45s')));
        req.write(payload);
        req.end();
    });
}

async function main() {
    const lines = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.trim());
    // 取一个含 history 的长 prompt（尽量靠后的 turn）
    const target = lines.filter((l) => { try { return JSON.parse(l).turn >= 4; } catch (e) { return false; } })[0];
    if (!target) { console.log('no target prompt'); return; }
    const o = JSON.parse(target);
    const prompt = o.prompt;
    console.log('取 turn=' + o.turn + ' 的 prompt，长度=' + prompt.length + ' 字符\n');

    const n = Number(process.argv[3]) || 5;
    for (let i = 1; i <= n; i++) {
        const t = Date.now();
        try {
            const r = await call(prompt);
            const ms = Date.now() - t;
            let c = '';
            try { c = JSON.parse(r.body).choices[0].message.content; } catch (e) { c = r.body.slice(0, 60); }
            console.log('#' + i + ' ' + ms + 'ms status=' + r.status + ' content=' + c + (ms > 5000 ? ' (慢!)' : ''));
        } catch (e) {
            console.log('#' + i + ' ERROR ' + (Date.now() - t) + 'ms: ' + e.message);
        }
    }
}

main();
