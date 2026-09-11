// ping-deepseek.js — 快速探测 DeepSeek 当前响应情况（非思考模式）
// 发 N 个 dummy 请求，记录耗时/结果，判断服务端是否稳定
const https = require('https');
const fs = require('fs');
const path = require('path');

const key = fs.readFileSync(path.join(__dirname, '..', 'apikey.txt'), 'utf8').trim();
const PROMPT = 'Choose the best action. Output ONLY a JSON object: {"choice": <number>}. No other text.\n1. Flamethrower\n2. Thunderbolt';

function call() {
    return new Promise((res, rej) => {
        const payload = JSON.stringify({
            model: 'deepseek-v4-flash',
            messages: [
                { role: 'system', content: 'You are playing a Pokemon battle and the goal is to win.' },
                { role: 'user', content: PROMPT }
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
        req.setTimeout(20000, () => req.destroy(new Error('timeout20s')));
        req.write(payload);
        req.end();
    });
}

async function main() {
    const n = Number(process.argv[2]) || 5;
    console.log('发 ' + n + ' 个非思考 dummy 请求...\n');
    let ok = 0, slow = 0, err = 0;
    for (let i = 1; i <= n; i++) {
        const t = Date.now();
        try {
            const r = await call();
            const ms = Date.now() - t;
            let c = '';
            try { c = JSON.parse(r.body).choices[0].message.content; } catch (e) { c = r.body.slice(0, 80); }
            if (ms > 5000) slow++;
            if (r.status === 200) ok++;
            console.log('#' + i + ' ' + ms + 'ms status=' + r.status + ' content=' + c + (ms > 5000 ? ' (慢!)' : ''));
        } catch (e) {
            err++;
            console.log('#' + i + ' ERROR ' + (Date.now() - t) + 'ms: ' + e.message);
        }
    }
    console.log('\n成功=' + ok + ' 慢(>5s)=' + slow + ' 错误=' + err);
}

main();
