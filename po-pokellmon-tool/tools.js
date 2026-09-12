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

// tool 执行器：根据 name 分发
function runTool(name, args) {
    if (name === 'get_type_matchup') return getTypeMatchup(args);
    if (name === 'calc_stat_boost') return calcStatBoost(args);
    return { error: 'unknown tool: ' + name };
}

module.exports = {
    TYPE_NAMES: TYPE_NAMES,
    CHART: CHART,
    typeIndex: typeIndex,
    TOOL_DEFS: TOOL_DEFS,
    runTool: runTool
};
