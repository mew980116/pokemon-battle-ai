// po-pokellmon-tool/server.js — 路线 3：思考 + tool（function calling）
//
// 接收 PO 采集的战场状态 → 拼 prompt + tools → DeepSeek（思考 high）多轮 function calling
// → DS 决策前动态调用 tool（类型克制 / 能力等级等确定性计算）→ 最终返回动作。
//
// 运行：
//   $env:DEEPSEEK_API_KEY = "sk-..."   # 或复用 po-pokellmon/apikey.txt
//   node po-pokellmon-tool/server.js
//
// Endpoints:
//   GET /health              -> "ok"
//   GET /choice?state=JSON   -> 返回 {"type":"move"/"switch", ...}

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var path = require('path');
var tools = require('./tools.js');
var ABILITIES = require('./knowledge/abilities.json');
var ABILITY_SIGNALS = require('./knowledge/ability_signals.json');
var MOVES = require('./knowledge/moves.json');

// 对手某招的「已点过次数 / 该招总 PP」标注。
// PO 不给对手的招式数据（实测 team(opp).poke(i).move(j) 返回 num=0/PP=0），所以次数是 po-script 自己数的，
// 总 PP 来自 knowledge/moves.json（PS 数据）。**这不是剩余 PP**（压力特性一次扣 2、PP Up 提高上限），只用来判断「它在这招上投入了多少」。
function movePPLabel(mv) {
    if (!mv) return '';
    var used = mv.used || 0;
    var maxPP = null;
    if (mv.num !== undefined && mv.num !== null) {
        var k = MOVES.byNum ? MOVES.byNum[String(mv.num)] : MOVES[String(mv.num)];
        if (k && k.pp) maxPP = k.pp;
    }
    if (!used && !maxPP) return '';
    return ',used ' + used + (maxPP ? '/' + maxPP : '');
}

// 某个特性的「触发条件 + 日志消息」提示（按名称 → 编号查 ability_signals.json，可自动排除的依据）
// 例：Download → Download(入场: logs "X's Download activates!")；无消息的特性写成 no log message
function abilitySignalHint(name) {
    var num = ABILITIES.byName[String(name).toLowerCase()];
    var s = (num !== undefined && ABILITY_SIGNALS[String(num)]) ? ABILITY_SIGNALS[String(num)] : null;
    if (!s) return String(name);
    var trigger = s.trigger ? String(s.trigger) : '';
    var how = s.msg ? ('logs "' + s.msg + '"') : 'no log message (infer from its effect)';
    return String(name) + '(' + (trigger ? trigger + ': ' : '') + how + ')';
}

// crash 日志：未捕获异常/未处理拒绝写 crash.log（含堆栈），便于定位服务器崩溃导致的断联
function appendCrashLog(msg) {
    try { fs.appendFileSync(path.join(__dirname, 'crash.log'), new Date().toISOString() + ' ' + msg + '\n'); } catch (e) {}
}
process.on('uncaughtException', function (err) {
    var s = err && err.stack ? err.stack : String(err);
    appendCrashLog('uncaughtException: ' + s);
    console.error('uncaughtException: ' + s);
    process.exit(1);
});
process.on('unhandledRejection', function (reason) {
    var s = reason && reason.stack ? reason.stack : String(reason);
    appendCrashLog('unhandledRejection: ' + s);
    console.error('unhandledRejection: ' + s);
});

var PORT = Number(process.env.POKELLMON_TOOL_PORT) || 8092;
var HOST = '127.0.0.1';
var SERVER_VERSION = '0.4.6';   // tool 分支版本（改动时 bump，随日志记录；大改 +0.1.0）

// ==== DeepSeek 模型参数（tool 分支：tool 调用 + 可开关思考链）====
// 对战主脑用 v4-pro（闭卷深想强，决策更深）；一键回 flash：POKELLMON_MODEL=deepseek-v4-flash
var MODEL = process.env.POKELLMON_MODEL || 'deepseek-v4-pro';
var THINKING_ENABLED = false;           // 关闭 reasoning（v4-pro 思考链过长/慢，先关；需要时改回 true）
var REASONING_EFFORT = 'low';           // 仅在 THINKING_ENABLED=true 时生效
var FIRST_TURN_THINKING = true;         // 首回合（turn 0）单独开思考，之后沿用上面的全局设置
var FIRST_TURN_EFFORT = 'low';          // 首回合思考强度（low/high/max）
var MAX_TOKENS = null;                  // 不限制输出 token（思考链 + 最终答案）
var TIMEOUT_MS = 240000;                // 放宽：240s（tool 多轮往返慢）
var MAX_TOOL_ROUNDS = 25;               // 最多 function calling 轮数，超过则 fallback
var MAX_TURN_MS = 0;                    // 单回合总时长上限（0=禁用 no-think 收尾；实测 webCall 120s 不超时，暂不需要兜底）
var RETRY_DELAYS = [2000, 5000, 10000]; // 单次请求失败后的重试延迟：第1次2s、第2次5s、第3次10s（第3次降级 no think），再失败 fallback

// system prompt 结构：战术底色（BATTLE_TIPS）+ 每回合工作流（WORKFLOW）+ 一句 tool 指引。
// 各 tool 的「何时调用 / 怎么用」下沉到 tools.js 的 tool description（tool helper），避免 system prompt 膨胀。
// 工作流是流程性要求（不属于单个 tool 的用法），所以留在 system prompt。
var WORKFLOW = 'WORKFLOW — follow this order every turn: ' +
    '(1) OPEN WORKLOG — this must be your FIRST action every turn. Call update_worklog with a short scratchpad for THIS turn: the goal, the current situation, confirmed facts, open questions and your next action. Treat it as your working memory: the server injects the latest worklog back into your context on every following tool call, so it is what keeps your plan alive across a long tool-calling loop (reasoning is off, so nothing else preserves it). Overwrite the whole text whenever the plan changes or a fact is confirmed; keep it compact and never let it go stale, and update it again before you finish. ' +
    '(2) REVIEW: read the last turn(s) with get_battle_history and work out what they reveal about the opponent — the speed line (who moved first; any speed boost, paralysis, Tailwind or Choice Scarf clue), which moves / items / abilities are now EXPOSED or can be EXCLUDED, and back-calculate from the damage dealt and taken to infer their EV spread and any offensive boost (item or ability). Record all of it with save_observation, tagging every fact [proved] or [estimated] and setting each pokemon\'s threat level to my team (High/Medium/Low — revise it whenever new information changes it). Also RESOLVE the PENDING CHECKS you left for yourself last turn (listed in your notes): confirm or refute each one from the new log, and compare LAST TURN\'S PREDICTION with what actually happened — if they differ, work out why (a newly revealed move or item? a behaviour preference worth recording? or your own miscalculation?) before you move on. ' +
    '(3) PLAN: re-read your previous save_strategy notes, look at the actions you are offered, and run the simulations you need (get_my_stats / calc_stats / calc_damage) plus the tactical guidance you need (battle_tips). ' +
    '(4) VERIFY: never trust memory for a move / ability / item effect, power or accuracy — call get_move_info / get_ability_info / get_item_info unless that detail is already present in the context. Never trust memory for a species base stats / types / abilities / weight either — call get_pokemon_info. Always call get_knowledge for the switch rules before switching unless they are already present in the context. Check the opponent against its legal movepool: if it has used a move it cannot learn (see the CAUTION line in the prompt, or verify with get_pokemon_info), the species is either misread or disguised (Illusion / Transform / Mimic / Ditto) — stop assuming that species and re-read the battle log. ' +
    '(5) DECIDE: choose the action, then record it with save_strategy. `text` = the labeled lines (1) likely attack, (2) likely switch, (3) their read of my team, (4) my own options AND, for any voluntary switch, the full cost (forfeit the turn + the switch-in eats the hit + may take entry hazards) together with how much it actually gains (forces a kill / starts a setup / chunks a threat, or only chips), how confident my read of their action is and why, whether I am already behind (only winning if they play exactly my prediction, or by assuming an unrevealed threat is not carried, or by hoping they err), and whether a steadier line exists (a switch-in that takes little or heals, or simply attacking), (5) their most likely action + my response + falsifier, (6) the action sequence until my next decision — that step is there to SPOT DANGER, not to avoid losing pokemon, so if every option loses the active pokemon anyway, take the most valuable line instead of dragging the team down to save it. In REPLACEMENT MODE (see the NOTE in the prompt) write `text` as (R1)-(R3) instead and skip the opponent-prediction lines. `scene` = the board you expect at your next decision. `checks` = your uncertain assumptions phrased as tests for later turns. Only `scene` (latest one) and `checks` (latest two) are re-injected later, never `text`. Never skip save_strategy.';

var SYSTEM_PROMPT = require('../po-pokellmon/prompts.js').BATTLE_TIPS +
    ' You decide by calling the tools you have been given; every tool description states when to call it, so follow the workflow below and that guidance. get_pokemon_info is the pokedex lookup (base stats / types / abilities / weight + legal movepool) — use it instead of memory, and to validate a surprising opponent move, since a move outside that movepool means a disguise or a misread species.' +
    '\n\n' + WORKFLOW;

// 复用 po-pokellmon 知识库
var KNOWLEDGE_DIR = path.join(__dirname, '..', 'po-pokellmon', 'knowledge');
var MOVES = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, 'moves.json'), 'utf8'));
var TYPECHART = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, 'typechart.json'), 'utf8'));
var TYPE_NAMES = TYPECHART.types;
var CHART = TYPECHART.chart;

var LOG_DIR = path.join(__dirname, 'logs');

function getApiKey() {
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
    // 优先本目录 apikey.txt，其次复用 po-pokellmon/apikey.txt
    var candidates = [path.join(__dirname, 'apikey.txt'), path.join(__dirname, '..', 'po-pokellmon', 'apikey.txt')];
    for (var i = 0; i < candidates.length; i++) {
        try {
            var k = fs.readFileSync(candidates[i], 'utf8').trim();
            if (k) return k;
        } catch (e) {}
    }
    return null;
}

function callDeepSeek(messages, noThink, cb, opts) {
    var apiKey = getApiKey();
    if (!apiKey) {
        cb(new Error('missing DEEPSEEK_API_KEY (set env var or create apikey.txt)'));
        return;
    }
    var payloadObj = {
        model: MODEL,
        messages: messages,
        stream: false,
        tools: tools.TOOL_DEFS
    };
    var mt = MAX_TOKENS;
    if (mt) payloadObj.max_tokens = mt;
    // 思考开关：opts 显式指定时优先（首回合 high），否则用全局设置；noThink（重试降级）永远优先
    var thinkOn = (opts && opts.thinking !== undefined) ? opts.thinking : THINKING_ENABLED;
    var effort = (opts && opts.effort !== undefined) ? opts.effort : REASONING_EFFORT;
    if (thinkOn && !noThink) {
        payloadObj.thinking = { type: 'enabled' };
        if (effort) payloadObj.reasoning_effort = effort;
    } else {
        payloadObj.thinking = { type: 'disabled' };
    }
    var payload = JSON.stringify(payloadObj);
    var req = https.request({
        hostname: 'api.deepseek.com',
        path: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
            'Content-Length': Buffer.byteLength(payload)
        }
    }, function (res) {
        var data = '';
        res.on('data', function (c) { data += c; });
        res.on('end', function () { cb(null, res.statusCode, data); });
    });
    req.setTimeout(TIMEOUT_MS, function () {
        req.destroy(new Error('deepseek timeout'));
    });
    req.on('error', function (e) { cb(e); });
    req.write(payload);
    req.end();
}

// 提取完整 message（含 tool_calls）
function extractMessage(data) {
    try {
        var obj = JSON.parse(data);
        if (obj.choices && obj.choices[0] && obj.choices[0].message) {
            return obj.choices[0].message;
        }
        return { content: data };
    } catch (e) {
        return { content: data };
    }
}

function extractUsage(data) {
    try {
        var obj = JSON.parse(data);
        if (obj.usage) return obj.usage;
        return null;
    } catch (e) {
        return null;
    }
}

function typeIndex(name) {
    return TYPE_NAMES.indexOf(name);
}

function damageMultiplier(attackType, defendTypes) {
    var ai = typeIndex(attackType);
    if (ai < 0) return 1;
    if (!defendTypes || !defendTypes.length) return 1;
    var m = CHART[ai][typeIndex(defendTypes[0])];
    if (defendTypes[1] && typeIndex(defendTypes[1]) >= 0) {
        m *= CHART[ai][typeIndex(defendTypes[1])];
    }
    return m;
}

function buildDefenderAdvantage(oppName, oppTypes, myMoveTypes) {
    var buckets = { 4: [], 2: [], 0.5: [], 0.25: [], 0: [] };
    var seen = {};
    for (var i = 0; i < myMoveTypes.length; i++) {
        var at = myMoveTypes[i];
        if (!at || seen[at]) continue;
        seen[at] = true;
        var m = damageMultiplier(at, oppTypes);
        if (buckets[m] !== undefined) buckets[m].push(at);
    }
    var descs = [];
    if (buckets[4].length) descs.push(buckets[4].join(',') + ' deal 4x damage');
    if (buckets[2].length) descs.push(buckets[2].join(',') + ' deal 2x damage');
    if (buckets[0.5].length) descs.push(buckets[0.5].join(',') + ' only deal 0.5x damage');
    if (buckets[0.25].length) descs.push(buckets[0.25].join(',') + ' only deal 0.25x damage');
    if (buckets[0].length) descs.push(buckets[0].join(',') + ' have no effect');
    if (descs.length) return oppName + ' as defender, ' + descs.join('; ') + ' to ' + oppName + '\n';
    return '';
}

function moveInfo(m) {
    var num = m.num;
    var base = (MOVES[String(num)] || MOVES[num]) || {};
    var power = (m.power !== undefined && m.power !== null) ? m.power : (base.power || 0);
    var acc = base.accuracy || 0;
    var effect = base.effect || '';
    return { name: m.name || base.name || '?', type: m.type || '?', power: power, pp: m.pp, acc: acc, effect: effect };
}

// 对手 bench 槽位详情（[Name,HP%,status] / [Name,fainted] / [???]）
function buildOppBench(state) {
    var team = state.oppTeam || [];
    var parts = [];
    for (var i = 1; i < team.length; i++) {
        var t = team[i];
        if (t.ko) {
            parts.push('[' + (t.name || '???') + ',fainted]');
        } else if (t.revealed) {
            var s = '[' + t.name;
            if (t.hpPct !== null && t.hpPct !== undefined) s += ',' + t.hpPct + '%';
            if (t.status) s += ',' + t.status;
            if (t.abilityInferred) s += ',A:' + t.abilityInferred;
            s += ']';
            parts.push(s);
        } else {
            parts.push('[???]');
        }
    }
    return parts.join('');
}

// 跨回合笔记存储（按 battleId 隔离）：{ battleId: { pokemon:{name:text}, turns:{turn:text} } }
var notesStore = {};
function getNotes(battleId) {
    var id = (battleId !== undefined && battleId !== null) ? String(battleId) : 'unknown';
    if (!notesStore[id]) notesStore[id] = { pokemon: {}, turns: {} };
    return notesStore[id];
}

// 学习面 CAUTION：对手当前宝可梦已暴露的招式若不在其学习面内，追加警告。
// 依据 = tools.js 的 learnsets（数据源 pokemon-showdown）。判定失败（物种/招式无法解析）静默跳过。
function learnsetCaution(state) {
    var opp = (state && state.opp) || {};
    if (!opp.name || !opp.moves || !opp.moves.length) return '';
    var names = [];
    for (var i = 0; i < opp.moves.length; i++) {
        if (opp.moves[i] && opp.moves[i].name) names.push(String(opp.moves[i].name));
    }
    if (!names.length) return '';
    var res;
    try { res = tools.runTool('get_pokemon_info', { pokemon: opp.name, moves: names }); } catch (e) { return ''; }
    if (!res || res.error || !res.checks) return '';
    var bad = [];
    for (var j = 0; j < res.checks.length; j++) {
        // 只在招式编号可解析（move_num 非空）且确实不在学习面时才判为异常，避免本地招式表缺条目造成误报
        if (res.checks[j].can_learn === false && res.checks[j].move_num !== null) bad.push(res.checks[j].move);
    }
    if (!bad.length) return '';
    return 'CAUTION: the opponent ' + opp.name + ' has used ' + bad.join(', ') +
        ', which is NOT in ' + opp.name + "'s legal movepool (source: pokemon-showdown). " +
        'A movepool mismatch means the species is either misread or disguised: the most common cause is Illusion ' +
        '(the active pokemon is not really ' + opp.name + ' — Zoroark/Zorua), or a copied move (Transform / Mimic / Ditto). ' +
        'Illusion breaks when the pokemon takes damage from a move. Do not keep assuming ' + opp.name +
        '; re-read the battle log for a giveaway and treat the real identity / remaining moves as unknown until proven. ' +
        'Use get_pokemon_info to test more revealed moves.\n';
}

// 明知会失败的招式提示（目前只覆盖「入场陷阱已满/已在对方场上」这一确定性情形）。
// 例：对方场上已有隐形岩时再点隐形岩 = 失败（实战中确实发生过）。
function moveFailHint(moveName, state) {
    var n = String(moveName || '').toLowerCase();
    var oh = (state && state.oppHazards) || [];
    function startsWith(prefix) {
        for (var i = 0; i < oh.length; i++) {
            if (String(oh[i]).toLowerCase().indexOf(prefix) === 0) return true;
        }
        return false;
    }
    if (n === 'stealth rock' && startsWith('stealth rock')) {
        return ' [will FAIL: Stealth Rock is already up on the opponent\'s side]';
    }
    if (n === 'spikes' && startsWith('spikes x3')) {
        return ' [will FAIL: Spikes is already at the max 3 layers on the opponent\'s side]';
    }
    if (n === 'toxic spikes' && startsWith('toxic spikes x2')) {
        return ' [will FAIL: Toxic Spikes is already at the max 2 layers on the opponent\'s side]';
    }
    if (n === 'sticky web' && startsWith('sticky web')) {
        return ' [will FAIL: Sticky Web is already up on the opponent\'s side]';
    }
    return '';
}

function buildPrompt(state, notes) {
    var p = '';
    var opp = state.opp || {};
    var me = state.me || {};
    var bench = state.bench || [];
    var oppTypes = opp.types || [];

    // 最后 2 回合战报显式贴进 prompt；更早的走 get_battle_history tool 按需读
    var srcHist = (state.fullHistory && state.fullHistory.length) ? state.fullHistory : (state.history || []);
    var histN = srcHist.length;
    var recent = [];
    for (var i = Math.max(0, histN - 2); i < histN; i++) {
        recent.push(srcHist[i]);
    }
    if (recent.length) {
        p += 'Recent turns:\n' + recent.join('\n') + '\n';
    }
    if (histN > 0) {
        p += 'Earlier battle history (' + histN + ' turns) is available via the get_battle_history tool.\n';
    }

    // 天气/场地/入场陷阱/双墙：固定加载，无则写 None（避免 LLM 误以为信息缺失）
    var mh = state.myHazards || [];
    var oh = state.oppHazards || [];
    var scr = state.screens || {};
    var scrMe = (scr.me || []), scrOpp = (scr.opp || []);
    p += 'Weather:' + (state.weather || 'None') +
        ' | Terrain:' + (state.terrain || 'None') +
        ' | Screens MY side (halve damage when THEY attack me):' + (scrMe.length ? '[' + scrMe.join(',') + ']' : 'None') +
        ' | Screens OPP side (halve damage when I attack them):' + (scrOpp.length ? '[' + scrOpp.join(',') + ']' : 'None') +
        ' | Hazards on MY side (damage MY switch-ins):' + (mh.length ? '[' + mh.join(',') + ']' : 'None') +
        ' | Hazards on OPP side (damage THEIR switch-ins):' + (oh.length ? '[' + oh.join(',') + ']' : 'None') + '\n';

    // 默认注入笔记：对手场上这只的观察 + 最近 2 回合思路
    if (notes) {
        var noteLines = [];
        var pn = notes.pokemon || {};
        var th = notes.threat || {};
        if (opp.name && pn[opp.name]) {
            noteLines.push('Observation on ' + opp.name +
                (th[opp.name] ? ' [threat to me: ' + th[opp.name] + ']' : '') +
                ': ' + pn[opp.name]);
        }
        var tn = notes.turns || {};
        var tkeys = Object.keys(tn).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        // 预设场面：只回灌最近 1 条（用于与实况对比）；待核对判断：最近 2 条
        var scene = null, sceneTurn = null;
        if (tkeys.length) {
            var lastRec = tn[tkeys[tkeys.length - 1]];
            if (lastRec && typeof lastRec === 'object' && lastRec.scene) { scene = lastRec.scene; sceneTurn = tkeys[tkeys.length - 1]; }
        }
        var checks = [];
        var recentT = tkeys.slice(-2);
        for (var ti = 0; ti < recentT.length; ti++) {
            var rec = tn[recentT[ti]];
            // 兼容早前版本：值可能是纯字符串，或 {text, advice}
            var adv = (rec && typeof rec === 'object') ? (rec.checks || rec.advice) : null;
            if (adv) checks.push('(turn ' + recentT[ti] + ') ' + adv);
        }
        if (scene) {
            noteLines.push('LAST TURN\'S PREDICTION (turn ' + sceneTurn + ') — compare it with the actual battle log BEFORE deciding. If the board matches, your read held: continue with the plan you wrote. If it does NOT match, work out WHY first — did the opponent reveal a new move or item? is it showing a behaviour preference worth recording (save_observation)? or was your own calculation wrong? Then decide. Predicted board: ' + scene);
        }
        if (checks.length) {
            noteLines.push('PENDING CHECKS you left for yourself — verify each one against the new battle log BEFORE deciding (confirm or refute it, then update your notes): '
                + checks.join(' | '));
        }
        if (noteLines.length) {
            p += 'Your notes:\n' + noteLines.join('\n') + '\n';
        }
    }

    if (opp.name) {
        var oppStatus = opp.status ? 'Status:' + opp.status + ',' : '';
        var oppBoosts = (opp.boosts && opp.boosts.length) ? 'Boosts:[' + opp.boosts.join(',') + '],' : '';
        var oppAbi = opp.abilityInferred ? 'Ability:' + opp.abilityInferred + ',' : '';
        var oppPossible = '';
        if (!opp.abilityInferred && opp.possibleAbilities && opp.possibleAbilities.length) {
            oppPossible = 'PossibleAbilities:[' + opp.possibleAbilities.join('/') + '],';
        }
        p += 'Opponent current pokemon:' + opp.name + ':Type:' + oppTypes.join('&') + ',HP:' + (opp.hpPct || 0) + '%,' + oppAbi + oppPossible + oppStatus + oppBoosts + '\n';
        // 特性解析提示：这只还没确定特性时，显式列出候选特性各自的「触发条件 + 消息」，
        // 便于用「该出消息却没出」来反向排除（如 Porygon-Z 入场没出 Download 消息 → 排除 Download）
        if (!opp.abilityInferred && opp.possibleAbilities && opp.possibleAbilities.length) {
            var abBits = [];
            for (var pi = 0; pi < opp.possibleAbilities.length; pi++) abBits.push(abilitySignalHint(opp.possibleAbilities[pi]));
            p += 'AbilityAnalysis (unresolved) — ' + abBits.join(' / ') +
                '. EXCLUDE a candidate whose trigger clearly happened but whose message never appeared in the log (record the exclusion with save_observation).\n';
        }
        if (opp.fainted) {
            p += 'NOTE: The opponent current pokemon has fainted and will send out a replacement this turn.\n';
        }
        // 对手已暴露招式（未露的写「未知」，始终补满 4 个槽位）——紧跟当前宝可梦，再往后才是 bench
        var om = '';
        var oppMoves = opp.moves || [];
        for (var i = 0; i < 4; i++) {
            if (i < oppMoves.length) {
                om += '[' + oppMoves[i].name + ',' + oppMoves[i].type + movePPLabel(oppMoves[i]) + '],';
            } else {
                om += '[未知,?],';
            }
        }
        p += 'Opponent revealed moves (usedN/maxPP = how many times it has clicked that move out of its PP pool — NOT its remaining PP): ' + om + '\n';
        p += learnsetCaution(state);
        // 对手后备（bench）槽位详情
        var ob = buildOppBench(state);
        if (ob) p += 'Opponent bench: ' + ob + '\n';
    }

    if (me.name) {
        var meStatus = me.status ? 'Status:' + me.status + ',' : '';
        var meBoosts = (me.boosts && me.boosts.length) ? 'Boosts:[' + me.boosts.join(',') + '],' : '';
        var meAbi = me.ability ? 'Ability:' + me.ability + ',' : '';
        var meItem = me.item ? 'Item:' + me.item + ',' : '';
        p += 'Your current pokemon:' + me.name + ',Type:' + (me.types || []).join('&') + ',HP:' + (me.hpPct || 0) + '%,' + meAbi + meItem + meStatus + meBoosts + '\n';
        if (me.fainted) {
            p += 'NOTE: Your current pokemon has fainted — REPLACEMENT MODE. Only the switch options are legal (the move entries listed above belong to the fainted pokemon and cannot be used). ' +
                'This is a FORCED replacement in the end-of-turn phase, so the opponent gets NO extra action — do not predict its behaviour here. Answer only: ' +
                '(R1) what hit must the replacement survive; ' +
                '(R2) for each candidate: can it take that hit plus any entry hazards on the way in, and what can it do on the very next turn; ' +
                '(R3) your pick. Do NOT simply send out your freshest / still-unrevealed pokemon and then switch it out again next turn — that throws away a whole turn. ' +
                'In save_strategy write `text` as (R1)-(R3) (skip the normal lines), and still fill `scene` and `checks`.\n';
        }
        // 我方已倒下的宝可梦：bench 只含存活者，这里显式列出，避免 LLM 不知道谁已阵亡（也不用从战报里自己数）
        var myTeam = state.myTeam || [];
        var faintedMine = [];
        for (var ft = 0; ft < myTeam.length; ft++) {
            if (myTeam[ft] && myTeam[ft].ko && myTeam[ft].name) faintedMine.push(myTeam[ft].name);
        }
        if (faintedMine.length) {
            p += 'Your fainted pokemon (already KO-ed, cannot be sent out any more): ' + faintedMine.join(', ') +
                ' — ' + faintedMine.length + ' of ' + myTeam.length + ' down.\n';
        }
    }

    p += '\nAvailable actions (choose one number):\n';
    var idx = 0;
    // 专爱锁招：找出唯一可选的招式名，用于把其余招式标注成「不可选」（否则 LLM 会点非法招、被 PO 拒一次）
    var lockedName = null;
    if (me.moves) {
        for (var lk = 0; lk < me.moves.length; lk++) {
            if (me.moves[lk] && me.moves[lk].locked) { lockedName = me.moves[lk].name; break; }
        }
    }
    if (me.moves && me.moves.length) {
        for (var m = 0; m < me.moves.length; m++) {
            var mi = moveInfo(me.moves[m]);
            idx++;
            p += idx + '. ' + mi.name + ':Type:' + mi.type + ',Power:' + mi.power + ',Acc:' + mi.acc + '%';
            if (mi.pp !== undefined && mi.pp !== null) p += ',PP:' + mi.pp;
            if (me.moves[m] && me.moves[m].locked) p += ' [CHOICE-LOCKED — the ONLY selectable move; switching is the only alternative]';
            else if (lockedName) p += ' [NOT selectable: you are Choice-locked into ' + lockedName + ']';
            if (mi.power > 0) {   // 变化招式（Power:0）不写克制关系
                var mult = damageMultiplier(mi.type, oppTypes);
                var multStr = (mult === 0) ? 'no effect' : (mult + 'x');
                p += ',vs opponent ' + multStr;
            }
            if (mi.effect) p += ',Effect:' + mi.effect;
            p += moveFailHint(mi.name, state);
            p += '\n';
        }
    }
    if (bench.length) {
        for (var s = 0; s < bench.length; s++) {
            idx++;
            var bk = bench[s];
            var sw = idx + '. switch to ' + bk.name + ':Type:' + (bk.types || []).join('&') + ',HP:' + (bk.hpPct || 0) + '%' + (bk.status ? ',Status:' + bk.status : '') + (bk.ability ? ',Ability:' + bk.ability : '') + (bk.item ? ',Item:' + bk.item : '');
            if (bk.moves && bk.moves.length) {
                var ms = '';
                for (var mi = 0; mi < bk.moves.length; mi++) {
                    if (mi > 0) ms += '|';
                    ms += bk.moves[mi].name + ',' + bk.moves[mi].type + ((bk.moves[mi].pp !== undefined && bk.moves[mi].pp !== null) ? ',PP' + bk.moves[mi].pp : '');
                }
                sw += ',Moves:[' + ms + ']';
            }
            if (state.teamPreview === false && bk.unrevealed) {
                sw += ' [opponent has not seen this pokemon]';
            }
            p += sw + '\n';
        }
    }

    // 已尝试但被 PO 拒绝的项（锁招/禁换人），提示 LLM 换别的
    var bm = state.bannedMoves || [];
    var bs = state.bannedSwitches || [];
    if (bm.length || bs.length) {
        var rej = [];
        for (var r1 = 0; r1 < bm.length; r1++) rej.push('move:' + bm[r1]);
        for (var r2 = 0; r2 < bs.length; r2++) rej.push('switch:' + bs[r2]);
        p += 'CAUTION: you already tried these actions but the game (PO) rejected them, likely due to move-locking (Choice item / Taunt / Disable) or switch-blocking (Shadow Tag etc.). Do not choose them again: ' + rej.join(', ') + '. The system cannot judge whether the other listed choices are actually available; if one of them is also rejected, it will be added to this list next turn.\n';
    }

    return p;
}

function extractNumber(content) {
    var s = String(content || '').trim();
    s = s.replace(/```json/gi, '').replace(/```/g, '').trim();
    var a = s.indexOf('{');
    var b = s.lastIndexOf('}');
    if (a !== -1 && b > a) {
        try {
            var o = JSON.parse(s.substring(a, b + 1));
            if (o && o.choice !== undefined && o.choice !== null) {
                var n = parseInt(o.choice, 10);
                if (!isNaN(n)) return n;
            }
        } catch (e) {}
    }
    var m = s.match(/\d+/);
    if (m) return parseInt(m[0], 10);
    return null;
}

function parseAction(content, state) {
    var num = extractNumber(content);
    if (num === null) return null;
    var me = state.me || {};
    var moves = me.moves || [];
    var bench = state.bench || [];
    if (num >= 1 && num <= moves.length) {
        return { type: 'attack', attackSlot: moves[num - 1].slot };
    }
    var switchIdx = num - moves.length - 1;
    if (switchIdx >= 0 && switchIdx < bench.length) {
        return { type: 'switch', pokeSlot: bench[switchIdx].slot };
    }
    return null;
}

function fallbackMove(state) {
    var me = state.me || {};
    var moves = me.moves || [];
    if (moves.length) return { type: 'attack', attackSlot: moves[0].slot };
    var bench = state.bench || [];
    if (bench.length) return { type: 'switch', pokeSlot: bench[0].slot };
    return { type: 'attack', attackSlot: 0 };
}

function fallbackAction(state, reason) {
    var a = fallbackMove(state) || { type: 'attack', attackSlot: 0 };
    a.fallback = true;
    a.reason = reason || '';
    return a;
}

// 推送决策到可视化 view server（fire-and-forget，失败不影响主流程）
var VIEW_PUSH_PORT = 8093;
function pushToView(entry) {
    try {
        var payload = JSON.stringify(entry);
        var r = http.request({
            hostname: '127.0.0.1',
            port: VIEW_PUSH_PORT,
            path: '/push',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, function (res) { res.resume(); });
        r.on('error', function () {});
        r.setTimeout(2000, function () { r.destroy(); });
        r.write(payload);
        r.end();
    } catch (e) {}
}

// 回合内增量推送：LLM 思考中（收到局面 / 每轮 tool 调用后），供 view 实时显示
function pushProgress(state, obj) {
    if (!state.log) return;
    obj.type = 'progress';
    obj.battleId = (state.battleId !== undefined && state.battleId !== null) ? state.battleId : null;
    obj.turn = state.turn;
    obj.ts = new Date().toISOString();
    pushToView(obj);
}

function writeLog(entry) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        var d = new Date();
        var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
        var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
        var battleId = (entry.state && entry.state.battleId !== undefined && entry.state.battleId !== null) ? entry.state.battleId : 'unknown';
        var file = path.join(LOG_DIR, 'deepseek_tool_' + d.getFullYear() + mm + dd + '_battle' + battleId + '.log');
        fs.appendFileSync(file, JSON.stringify(entry) + '\n');
        pushToView(entry);
    } catch (e) {
        console.log('[log] write error: ' + e.message);
    }
}

// 对战结束时汇总 LLM 笔记，追加到 log 末尾（供事后复盘）
function appendSummary(battleId, result, winner) {
    var id = (battleId !== undefined && battleId !== null) ? String(battleId) : 'unknown';
    try {
        var notes = getNotes(id);
        var d = new Date();
        var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
        var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
        var file = path.join(LOG_DIR, 'deepseek_tool_' + d.getFullYear() + mm + dd + '_battle' + id + '.log');
        var summary = {
            type: 'summary',
            ts: new Date().toISOString(),
            battleId: id,
            result: result || null,
            winner: (winner !== undefined && winner !== null) ? winner : null,
            notes: notes
        };
        fs.appendFileSync(file, JSON.stringify(summary) + '\n');
        console.log('[summary] battle ' + id + ' notes: ' + Object.keys(notes.pokemon || {}).length + ' pokemon, ' + Object.keys(notes.turns || {}).length + ' turns');
    } catch (e) {
        console.log('[summary] write error: ' + e.message);
    }
    // 对战结束即释放该场笔记，防止长期运行（服务型 BOT 数百上千场）notesStore 内存膨胀
    delete notesStore[id];
}

function handleChoice(res, state) {
    var notes = getNotes(state.battleId);
    var prompt = buildPrompt(state, notes);
    var constraint = 'Choose the best action. Output ONLY a JSON object: {"choice": <number>} where <number> is the number of the action you choose. No other text.\n';
    var switchHint = 'DO USE GET_KNOWLEDGE FOR SWITCH RULES: if you are considering a switch, call get_knowledge with ["换人"] to review the switch mechanics before deciding.\n';
    var userPrompt = prompt + '\n' + switchHint + '\n' + constraint;

    console.log('[choice] turn=' + (state.turn || '?') + ' prompt_len=' + userPrompt.length);
    // 实时推送：开始思考（前端据此启动正计时）
    pushProgress(state, { phase: 'start' });

    var messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
    ];
    var rounds = 0;
    var startTime = Date.now();
    var toolLog = [];        // 记录每轮 tool 调用
    var lastUsage = null;
    var lastReply = '';

    function logEntry(reply, action) {
        if (!state.log) return;
        writeLog({
            type: 'turn',
            ts: new Date().toISOString(),
            serverVersion: SERVER_VERSION,
            scriptVersion: state.scriptVersion || '',
            account: state.account || '',
            turn: state.turn,
            thinking: turnThinkingOpts ? (FIRST_TURN_EFFORT + ' (first-turn)') : (THINKING_ENABLED ? REASONING_EFFORT : 'off'),
            totalMs: Date.now() - startTime,
            rounds: rounds,
            toolLog: toolLog,
            usage: lastUsage,
            fallback: !!action.fallback,
            state: state,
            systemPrompt: SYSTEM_PROMPT,
            prompt: userPrompt,
            reply: reply,
            action: action
        });
    }

    function respond(action, reply) {
        console.log('[choice] => ' + JSON.stringify(action) + (action.fallback ? ' (FALLBACK)' : '') + ' rounds=' + rounds);
        logEntry(reply, action);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end(JSON.stringify(action));
    }

    function loop() {
        rounds++;
        // 快到点：剩余预算不够再跑一轮 tool，直接 no-think 收尾（messages 已含前面所有 tool 结果）
        if (MAX_TURN_MS > 0 && (Date.now() - startTime) >= MAX_TURN_MS) {
            console.log('[choice] turn=' + state.turn + ' deadline ' + MAX_TURN_MS + 'ms hit, final no-think');
            finalizeNoThink();
            return;
        }
        attempt(0);
    }

    // 首回合（turn 0）单独开思考（high），其余回合沿用全局设置（当前关闭）
    var turnThinkingOpts = (FIRST_TURN_THINKING && state.turn === 0)
        ? { thinking: true, effort: FIRST_TURN_EFFORT }
        : null;
    if (turnThinkingOpts) console.log('[choice] turn 0 -> thinking ' + FIRST_TURN_EFFORT);

    // 本轮工作暂存（worklog）：LLM 用 update_worklog 覆盖写入；每次请求把它注入 system，
    // 使它在本次决策的后续所有 tool 轮次里始终可见，且不会随轮数累积膨胀。
    var worklog = '';
    function callDS(noThink, cb) {
        var msgs = messages;
        if (worklog) {
            msgs = messages.slice();
            msgs[0] = {
                role: 'system',
                content: SYSTEM_PROMPT + '\n\n[WORKLOG — your working state for this turn; refresh it with update_worklog as you progress]\n' + worklog
            };
        }
        callDeepSeek(msgs, noThink, cb, turnThinkingOpts);
    }

    // 最后兜底：关思考（no-think）快速要一个答案，不再继续 tool loop
    // reasonTag 用于区分触发路径（超时 / 工具轮次用尽），写进 fallback 的 reason 便于复盘
    function finalizeNoThink(reasonTag) {
        var tag = reasonTag || 'timeout';
        callDS(true, function (err, statusCode, data) {
            var reply = '';
            if (!err && statusCode === 200) {
                var msg2 = extractMessage(data);
                reply = msg2.content || '';
            }
            var action = parseAction(reply, state);
            if (!action) action = fallbackAction(state, err ? (tag + '_noThink_error') : (tag + '_parse_failed'));
            respond(action, reply);
        });
    }

    // 单次 DeepSeek 请求 + 重试阶梯：第1次失败等2s、第2次失败等5s、第3次失败等10s且降级 no think，再失败才 fallback。
    // 重试不消耗 rounds（tool 轮数预算只统计成功拿到回复并处理 tool 的轮数）。
    function attempt(retryIdx) {
        var noThink = retryIdx >= RETRY_DELAYS.length;   // 最后一次重试用 no think
        var t0 = Date.now();
        callDS(noThink, function (err, statusCode, data) {
            var ms = Date.now() - t0;

            if (err || statusCode !== 200) {
                if (retryIdx < RETRY_DELAYS.length) {
                    var delay = RETRY_DELAYS[retryIdx];
                    console.log('[choice] fail ' + ms + 'ms (' + (err ? err.message : ('http ' + statusCode)) + '), retry ' + (retryIdx + 1) + '/' + RETRY_DELAYS.length + ' in ' + delay + 'ms' + (retryIdx + 1 >= RETRY_DELAYS.length ? ' [no think]' : ''));
                    setTimeout(function () { attempt(retryIdx + 1); }, delay);
                    return;
                }
                console.log('[choice] error ' + ms + 'ms: ' + (err ? err.message : ('http ' + statusCode)));
                var fa = fallbackAction(state, err ? 'error' : ('http' + statusCode));
                respond(fa, 'ERROR: ' + (err ? err.message : ('http ' + statusCode)));
                return;
            }

            var usage = extractUsage(data);
            lastUsage = usage;
            var msg = extractMessage(data);
            var reply = msg.content || '';
            lastReply = reply;
            var toolCalls = msg.tool_calls;

            if (toolCalls && toolCalls.length) {
                // DS 想调 tool：记录并执行，把结果追加进 messages，继续下一轮
                var called = [];
                messages.push({ role: 'assistant', content: reply || null, tool_calls: toolCalls });
                for (var i = 0; i < toolCalls.length; i++) {
                    var tc = toolCalls[i];
                    var args = {};
                    try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
                    var result = tools.runTool(tc.function.name, args, { state: state, notes: notes, turn: state.turn, setWorklog: function (t) { worklog = t; } });
                    called.push({ name: tc.function.name, args: args, result: result });
                    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
                }
                toolLog.push({ round: rounds, ms: ms, usage: usage, calls: called });
                console.log('[tool] round ' + rounds + ' ' + ms + 'ms: ' + JSON.stringify(called));
                // 实时推送本轮 tool 调用（只带 name/args，完整 result 在最终 entry 里）
                var liveCalls = [];
                for (var ci = 0; ci < called.length; ci++) {
                    liveCalls.push({ name: called[ci].name, args: called[ci].args });
                }
                pushProgress(state, { phase: 'tool', round: rounds, ms: ms, calls: liveCalls });

                if (rounds >= MAX_TOOL_ROUNDS) {
                    // 工具轮次用尽：不直接硬兜底（旧行为 = 返回招式列表第 1 项，会覆盖掉 LLM 已写下的结论），
                    // 而是追加一条指令让它用 no-think 收敛成最终 JSON（不再执行任何 tool）；解析失败才 fallback。
                    console.log('[choice] turn=' + state.turn + ' tool rounds ' + MAX_TOOL_ROUNDS + ' used up -> finalize no-think');
                    messages.push({
                        role: 'user',
                        content: 'Tool rounds are exhausted — you can NOT call any more tools. Using everything you already gathered, output ONLY the final JSON object {"choice": <number>} now. No explanation, no preamble.'
                    });
                    finalizeNoThink('tool_rounds_exceeded');
                    return;
                }
                loop();
                return;
            }

            // 最终答案
            var action = parseAction(reply, state);
            if (!action) {
                action = fallbackAction(state, 'parse_failed');
            }
            respond(action, reply);
        });
    }

    loop();
}

var server = http.createServer({ maxHeaderSize: 65536 }, function (req, res) {
    var u = url.parse(req.url, true);

    if (req.method === 'GET' && u.pathname === '/health') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end('ok');
        return;
    }

    if (req.method === 'GET' && u.pathname === '/choice') {
        var state = {};
        if (u.query.state) {
            try { state = JSON.parse(u.query.state); } catch (e) {
                res.writeHead(400);
                res.end('invalid state JSON');
                return;
            }
        }
        handleChoice(res, state);
        return;
    }

    if (req.method === 'GET' && u.pathname === '/summary') {
        appendSummary(u.query.battleId, u.query.result, u.query.winner);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end('ok');
        return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.writeHead(200);
    res.end('po-pokellmon-tool server. use GET /health or GET /choice?state=...');
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error('Port ' + PORT + ' in use. Set POKELLMON_TOOL_PORT or stop the other process.');
    } else {
        console.error('Server error: ' + err.message);
    }
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('po-pokellmon-tool server (route 3: thinking + tool)');
    console.log('  health : http://' + HOST + ':' + PORT + '/health');
    console.log('  choice : http://' + HOST + ':' + PORT + '/choice?state=...');
    console.log('  model  : ' + MODEL);
    console.log('  thinking: ' + (THINKING_ENABLED ? 'enabled / ' + REASONING_EFFORT : 'disabled'));
    console.log('  timeout: ' + TIMEOUT_MS + 'ms, max_tool_rounds: ' + MAX_TOOL_ROUNDS);
    console.log('  apiKey : ' + (getApiKey() ? 'present' : 'MISSING'));
    console.log('  tools  : ' + tools.TOOL_DEFS.map(function (t) { return t.function.name; }).join(', '));
});
