// po-pokellmon-tool/tools.js — tool 定义 + 执行器（路线 3：思考 + tool）
//
// 最小实现：先做「纯函数」tool（类型克制 + 能力等级修正），无需种族值/运行时数据即可跑通
// function calling 链路。伤害计算（getMoveDamage 移植）依赖种族值数据，作为下一步补充。
//
// 复用 po-pokellmon 的知识库（typechart.json 由 build-knowledge.js 生成）。

var path = require('path');
var TYPECHART = require('../po-pokellmon/knowledge/typechart.json');

var TYPE_NAMES = TYPECHART.types;   // 18 个属性名，与主脚本 sys.type 顺序对齐
var CHART = TYPECHART.chart;        // 18x18 克制矩阵

function typeIndex(name) {
    return TYPE_NAMES.indexOf(name);
}

// ===== tool 定义（OpenAI 兼容 function calling 格式）=====
var TOOL_DEFS = [
    {
        type: 'function',
        function: {
            name: 'get_type_matchup',
            description: 'Return the damage multiplier of an attack type against a defender type combination. 0=immune, 0.25/0.5=resist, 1=neutral, 2/4=super effective.',
            parameters: {
                type: 'object',
                properties: {
                    attack_type: { type: 'string', description: 'Attack type name, e.g. "Fire"' },
                    defend_types: { type: 'array', items: { type: 'string' }, description: 'Defender type names (1 or 2)' }
                },
                required: ['attack_type', 'defend_types']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calc_stat_boost',
            description: 'Apply a stat stage boost to a base stat value (Pokemon formula).',
            parameters: {
                type: 'object',
                properties: {
                    base_stat: { type: 'number', description: 'Base stat value before boost' },
                    boost: { type: 'integer', description: 'Stat stage, -6 to +6' }
                },
                required: ['base_stat', 'boost']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_battle_history',
            description: 'Read the battle log (turn-by-turn history) for a given turn range. Use this to recall what happened in previous turns instead of guessing. Omit both arguments to read the full history.',
            parameters: {
                type: 'object',
                properties: {
                    start_turn: { type: 'integer', description: 'First turn to include (1-based, inclusive). Omit for the beginning.' },
                    end_turn: { type: 'integer', description: 'Last turn to include (1-based, inclusive). Omit for the latest.' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'save_observation',
            description: 'Record or update your observation about ONE opposing pokemon (e.g. revealed moves, likely item/ability, damage estimate). Overwrites the previous note for the same pokemon.',
            parameters: {
                type: 'object',
                properties: {
                    pokemon: { type: 'string', description: 'Opposing pokemon name' },
                    text: { type: 'string', description: 'Your observation text' }
                },
                required: ['pokemon', 'text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'save_strategy',
            description: 'Record your current strategic thinking/plan for this turn (e.g. "opponent likely switches to X, so I should use Y"). Stored per turn.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Your strategy/thinking text' }
                },
                required: ['text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_observation',
            description: 'Read your saved pokemon observations. Omit pokemon to read all observations.',
            parameters: {
                type: 'object',
                properties: {
                    pokemon: { type: 'string', description: 'Pokemon name to read; omit for all' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_strategy',
            description: 'Read your saved strategic thinking by turn. Omit turn to read all turns.',
            parameters: {
                type: 'object',
                properties: {
                    turn: { type: 'integer', description: 'Turn number to read; omit for all' }
                },
                required: []
            }
        }
    }
];

// 类型克制（移植主脚本 typechart）
function getTypeMatchup(args) {
    var ai = typeIndex(args.attack_type);
    if (ai < 0) return { error: 'unknown attack_type: ' + args.attack_type };
    var m = 1;
    var types = args.defend_types || [];
    for (var i = 0; i < types.length; i++) {
        var di = typeIndex(types[i]);
        if (di < 0) return { error: 'unknown defend_type: ' + types[i] };
        m *= CHART[ai][di];
    }
    return { multiplier: m };
}

// 能力等级修正（移植主脚本 calcStatWhenBoost）
function calcStatBoost(args) {
    var b = args.boost || 0;
    var v = args.base_stat;
    if (b > 0) return { result: v * (2 + b) / 2 };
    if (b < 0) return { result: v * 2 / (2 + b) };
    return { result: v };
}

// 从战报行提取回合号（"Turn N: ..." -> N；开局行无前缀返回 0）
function parseTurn(line) {
    var m = String(line).match(/^Turn (\d+):/);
    return m ? parseInt(m[1], 10) : 0;
}

// 读取过往战报（按回合范围截取，不传则全文）
function getBattleHistory(args, state) {
    var full = (state && state.fullHistory) || (state && state.history) || [];
    var start = (args.start_turn !== undefined && args.start_turn !== null) ? parseInt(args.start_turn, 10) : null;
    var end = (args.end_turn !== undefined && args.end_turn !== null) ? parseInt(args.end_turn, 10) : null;
    var out = [];
    for (var i = 0; i < full.length; i++) {
        var t = parseTurn(full[i]);
        if (start !== null && t < start) continue;
        if (end !== null && t > end) continue;
        out.push(String(full[i]));
    }
    return { turns: out, count: out.length };
}

// 记录对某只对手宝可梦的观察（覆盖同名旧笔记）
function saveObservation(args, ctx) {
    if (!args.pokemon || !args.text) return { error: 'pokemon and text required' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    if (!notes.pokemon) notes.pokemon = {};
    notes.pokemon[String(args.pokemon)] = String(args.text);
    return { ok: true, pokemon: args.pokemon };
}

// 记录当前回合的战略思路（默认用当前 turn；可显式指定 turn）
function saveStrategy(args, ctx) {
    if (!args.text) return { error: 'text required' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    if (!notes.turns) notes.turns = {};
    var t = (args.turn !== undefined && args.turn !== null) ? parseInt(args.turn, 10) : (ctx.turn || 0);
    notes.turns[String(t)] = String(args.text);
    return { ok: true, turn: t };
}

// 读取观察（不传 pokemon 返回全部）
function getObservation(args, ctx) {
    var notes = ctx && ctx.notes;
    var p = (notes && notes.pokemon) || {};
    if (args.pokemon) {
        return { pokemon: args.pokemon, observation: p[String(args.pokemon)] || null };
    }
    return { observations: p };
}

// 读取战略思路（不传 turn 返回全部）
function getStrategy(args, ctx) {
    var notes = ctx && ctx.notes;
    var t = (notes && notes.turns) || {};
    if (args.turn !== undefined && args.turn !== null) {
        var ti = parseInt(args.turn, 10);
        return { turn: ti, strategy: t[String(ti)] || null };
    }
    return { strategies: t };
}

// tool 执行器：根据 name 分发；ctx 含 state（供 get_battle_history 读取战报）+ notes（笔记存储）+ turn
function runTool(name, args, ctx) {
    if (name === 'get_type_matchup') return getTypeMatchup(args);
    if (name === 'calc_stat_boost') return calcStatBoost(args);
    if (name === 'get_battle_history') return getBattleHistory(args, ctx && ctx.state);
    if (name === 'save_observation') return saveObservation(args, ctx);
    if (name === 'save_strategy') return saveStrategy(args, ctx);
    if (name === 'get_observation') return getObservation(args, ctx);
    if (name === 'get_strategy') return getStrategy(args, ctx);
    return { error: 'unknown tool: ' + name };
}

module.exports = {
    TYPE_NAMES: TYPE_NAMES,
    CHART: CHART,
    typeIndex: typeIndex,
    TOOL_DEFS: TOOL_DEFS,
    runTool: runTool
};
