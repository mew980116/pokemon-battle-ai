// evaluate.js — 评测集跑分（评分制）
// 读取 cases.jsonl，对每个已评分 case 调 /choice，按 DS 返回的 slot 查分
// 用法：先启动 node po-pokellmon/server.js，再 node po-pokellmon/eval/evaluate.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const CASES_FILE = path.join(__dirname, 'cases.jsonl');
const URL = 'http://127.0.0.1:8091';

function getChoice(state) {
    return new Promise((resolve, reject) => {
        const u = URL + '/choice?state=' + encodeURIComponent(JSON.stringify(state));
        const req = http.get(u, (r) => {
            let d = '';
            r.on('data', (c) => { d += c; });
            r.on('end', () => resolve(d));
        });
        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(new Error('timeout')); });
    });
}

// DS 返回的 slot -> 评分 key（"attack:2" / "switch:3"）
function gotKey(got) {
    if (!got || !got.type) return null;
    return got.type + ':' + (got.type === 'attack' ? got.attackSlot : got.pokeSlot);
}

async function main() {
    const raw = fs.readFileSync(CASES_FILE, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim());
    if (!lines.length) {
        console.log('no cases in ' + CASES_FILE);
        return;
    }

    let totalScore = 0;
    let scored = 0;
    let pending = 0;
    let fullScore = 0;
    let pass = 0;
    const failures = [];

    for (const line of lines) {
        let c;
        try { c = JSON.parse(line); } catch (e) {
            console.log('SKIP invalid line: ' + line.slice(0, 80));
            continue;
        }

        // 未评分：跳过，标记待评分
        if (!c.scores) {
            pending++;
            console.log('[' + c.id + '] 未评分，跳过 ' + (c.desc || ''));
            continue;
        }

        // 评测时不写日志
        if (c.state) c.state.log = false;

        let got;
        try {
            const resp = await getChoice(c.state);
            got = JSON.parse(resp);
        } catch (e) {
            got = { type: 'error' };
        }

        const key = gotKey(got);
        const score = (key && c.scores[key] !== undefined) ? c.scores[key] : 0;
        totalScore += score;
        scored++;
        if (score === 100) fullScore++;
        if (score >= 50) pass++;
        if (score < 50) failures.push(c.id);

        console.log(
            '[' + c.id + '] ' + score + '分 ' + (c.desc || '') +
            ' => got ' + key + ' (' + score + '分)'
        );
    }

    console.log('\n==== 统计 ====');
    console.log('已评分: ' + scored + ' | 待评分: ' + pending);
    if (scored > 0) {
        console.log('平均分: ' + (totalScore / scored).toFixed(1));
        console.log('满分(100): ' + fullScore + '/' + scored);
        console.log('及格(>=50): ' + pass + '/' + scored);
        if (failures.length) console.log('低分(<50) ids: ' + failures.join(', '));
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
