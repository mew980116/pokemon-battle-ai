// test-u200e.js — 测试 U+200E 不可见控制字符对 DeepSeek 响应的影响
// 对比「拳海参（带 U+200E）」vs「拳海参（不带）」的响应时间/结果
const https = require('https');
const fs = require('fs');
const path = require('path');

const key = fs.readFileSync(path.join(__dirname, '..', 'apikey.txt'), 'utf8').trim();

const WITH_MARK = '拳海参\u200E';   // 带 U+200E（LEFT-TO-RIGHT MARK）
const WITHOUT = '拳海参';            // 不带

function call(name) {
    return new Promise((res, rej) => {
        const prompt = 'Choose the best action. Output ONLY a JSON object: {"choice": <number>}. No other text.\n1. 使用招式攻击对手的 ' + name + '\n2. 换人';
        const payload = JSON.stringify({
            model: 'deepseek-v4-flash',
            messages: [{ role: 'user', content: prompt }],
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
    const n = Number(process.argv[2]) || 3;
    console.log('对比「拳海参（带 U+200E）」vs「拳海参（不带）」，各 ' + n + ' 次：\n');
    let wOk = 0, woOk = 0;
    for (let i = 1; i <= n; i++) {
        for (const [label, name] of [['不带', WITHOUT], ['带  ', WITH_MARK]]) {
            const t = Date.now();
            try {
                const r = await call(name);
                const ms = Date.now() - t;
                let c = '';
                try { c = JSON.parse(r.body).choices[0].message.content; } catch (e) { c = r.body.slice(0, 60); }
                if (label === '带  ') wOk++; else woOk++;
                console.log('  ' + label + ' #' + i + ' ' + ms + 'ms status=' + r.status + ' content=' + c);
            } catch (e) {
                console.log('  ' + label + ' #' + i + ' ERROR ' + (Date.now() - t) + 'ms: ' + e.message);
            }
        }
    }
    console.log('\n不带成功=' + woOk + ' | 带成功=' + wOk);
}

main();
