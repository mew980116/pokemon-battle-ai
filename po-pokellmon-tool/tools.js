// po-pokellmon-tool/tools.js — tool 定义 + 执行器（路线 3：思考 + tool）
//
// 最小实现：先做「纯函数」tool（类型克制 + 能力等级修正），无需种族值/运行时数据即可跑通
// function calling 链路。伤害计算（getMoveDamage 移植）依赖种族值数据，作为下一步补充。
//
// 复用 po-pokellmon 的知识库（typechart.json 由 build-knowledge.js 生成）。

var path = require('path');
var vm = require('vm');
var TYPECHART = require('../po-pokellmon/knowledge/typechart.json');
var POKEMON = require('./knowledge/pokemon.json');
var NATURES = require('./knowledge/natures.json');
var MOVES = require('./knowledge/moves.json');

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
            description: 'Record or update your observation about ONE opposing pokemon (e.g. revealed moves, likely item/ability, damage estimate). Overwrites the previous note by default; set append=true to append instead.',
            parameters: {
                type: 'object',
                properties: {
                    pokemon: { type: 'string', description: 'Opposing pokemon name' },
                    text: { type: 'string', description: 'Your observation text' },
                    append: { type: 'boolean', description: 'If true, append to the existing note instead of overwriting. Default false.' }
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
    },
    {
        type: 'function',
        function: {
            name: 'submit_feedback',
            description: 'Submit feedback about what tool or capability you wish you had (e.g. damage calculation, speed comparison, opponent move prediction). Use this when the available tools are insufficient for the decision.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Describe the tool/capability you want and why' }
                },
                required: ['text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calc_damage',
            description: 'Compute the damage range of up to 10 attacker/defender/move combinations using the standard Pokemon damage formula. Returns the minimum (0.85x roll) and maximum (1.0x roll) damage, plus the percentage of the defender max HP. NOTE: this is a SIMPLIFIED calculator — it does NOT auto-apply item/ability/weather/terrain/burn/critical-hit/STAB-removal etc.; pass an extra multiplier (e.g. 1.5 for critical hit, 0.5 for burn) if needed. Use it to check KO thresholds, then compare the result against the actual damage in the battle log.',
            parameters: {
                type: 'object',
                properties: {
                    legs: {
                        type: 'array',
                        description: 'List of damage calculations to perform (1 to 10).',
                        items: {
                            type: 'object',
                            properties: {
                                attacker: {
                                    type: 'object',
                                    description: 'Attacking pokemon. Either give its name/number, or give explicit base stats.',
                                    properties: {
                                        poke: { type: 'string', description: 'Pokemon name (English or Chinese) or Pokedex number, e.g. "Garchomp" or "445"' },
                                        level: { type: 'integer', description: 'Level, default 100' },
                                        ev: { type: 'array', items: { type: 'number' }, description: 'EVs [HP,Atk,Def,SpA,SpD,Spe], default all 0' },
                                        iv: { type: 'array', items: { type: 'number' }, description: 'IVs [HP,Atk,Def,SpA,SpD,Spe], default all 31' },
                                        nature: { type: 'string', description: 'Nature name (English or Chinese) or number, default neutral' },
                                        boosts: { type: 'object', description: 'Stat stages, e.g. {"atk":1,"spa":-1}', additionalProperties: { type: 'integer' } },
                                        base_stats: { type: 'array', items: { type: 'number' }, description: 'Explicit base stats [HP,Atk,Def,SpA,SpD,Spe] (alternative to poke name)' },
                                        types: { type: 'array', items: { type: 'string' }, description: 'Types (required if base_stats given, for STAB check)' }
                                    },
                                    required: []
                                },
                                defender: {
                                    type: 'object',
                                    description: 'Defending pokemon, same structure as attacker.',
                                    properties: {
                                        poke: { type: 'string', description: 'Pokemon name (English or Chinese) or Pokedex number' },
                                        level: { type: 'integer', description: 'Level, default 100' },
                                        ev: { type: 'array', items: { type: 'number' }, description: 'EVs [HP,Atk,Def,SpA,SpD,Spe], default all 0' },
                                        iv: { type: 'array', items: { type: 'number' }, description: 'IVs [HP,Atk,Def,SpA,SpD,Spe], default all 31' },
                                        nature: { type: 'string', description: 'Nature name or number, default neutral' },
                                        boosts: { type: 'object', description: 'Stat stages, e.g. {"def":1}', additionalProperties: { type: 'integer' } },
                                        base_stats: { type: 'array', items: { type: 'number' }, description: 'Explicit base stats [HP,Atk,Def,SpA,SpD,Spe]' },
                                        types: { type: 'array', items: { type: 'string' }, description: 'Types (required if base_stats given)' }
                                    },
                                    required: []
                                },
                                move: {
                                    type: 'object',
                                    description: 'The move used by the attacker. Either give its name, or explicit power/category/type.',
                                    properties: {
                                        name: { type: 'string', description: 'Move name (English), e.g. "Outrage"' },
                                        power: { type: 'integer', description: 'Move base power (alternative to name)' },
                                        category: { type: 'string', description: '"Physical" or "Special" (required if power given)' },
                                        type: { type: 'string', description: 'Move type, e.g. "Dragon" (required if power given)' }
                                    },
                                    required: []
                                },
                                extra: { type: 'number', description: 'Extra fixed multiplier to apply (critical hit 1.5, burn 0.5, etc.), default 1.0' }
                            },
                            required: ['attacker', 'defender', 'move']
                        }
                    }
                },
                required: ['legs']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'run_js',
            description: 'Run a small JavaScript snippet in a sandbox to compute something no built-in tool covers (e.g. speed comparison, batch damage over a set of pokemon, custom scoring). Sandbox exposes: data.pokemon/data.moves/data.natures/data.types/data.typechart, typeMul(attackType, defendTypes), effStat(baseStat, boost?, level?), resolvePokemon(nameOrNum), resolveMove(name), calcDamage(attackerObj, defenderObj, moveObj), and print/console.log for output. The last expression value is returned. Use only for computation you cannot do with built-in tools.',
            parameters: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: 'JavaScript code to execute. It must be synchronous and not use require/process/fs. Use print(...) or console.log(...) to emit text.' }
                },
                required: ['code']
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

// 记录对某只对手宝可梦的观察（默认覆盖同名旧笔记；append=true 时追加）
function saveObservation(args, ctx) {
    if (!args.pokemon || !args.text) return { error: 'pokemon and text required' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    if (!notes.pokemon) notes.pokemon = {};
    var key = String(args.pokemon);
    if (args.append && notes.pokemon[key]) {
        notes.pokemon[key] = notes.pokemon[key] + ' | ' + String(args.text);
    } else {
        notes.pokemon[key] = String(args.text);
    }
    return { ok: true, pokemon: args.pokemon, mode: (args.append ? 'append' : 'overwrite') };
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

// 提交「想要的 tool」反馈，累积到 notes.feedback（对战结束随 summary 记到 log 末尾）
function submitFeedback(args, ctx) {
    if (!args.text) return { error: 'text required' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    if (!notes.feedback) notes.feedback = [];
    notes.feedback.push({ turn: ctx.turn || 0, text: String(args.text) });
    return { ok: true, count: notes.feedback.length };
}

// ===== 伤害计算（标准宝可梦伤害公式）=====
// 能力值 = floor((2*Base + IV + floor(EV/4)) * Lv/100 + 5) * 性格修正 * 能力等级修正
// HP     = floor((2*Base + IV + floor(EV/4)) * Lv/100 + 10 + Lv)
// 伤害   = floor(floor(((2*Lv/5 + 2) * Power * A) / D) / 50) + 2，再乘 STAB*克制*extra，最后 0.85/1.0 随机档

var STAT_NAMES = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

// 解析宝可梦输入：支持 {poke:名/编号} 或 {base_stats:[...], types:[...]}
// 返回 {baseStats, types, name} 或 {error}
function resolvePokemonInput(spec) {
    if (!spec) return { error: 'attacker/defender missing' };
    if (spec.base_stats && spec.base_stats.length === 6) {
        return { baseStats: spec.base_stats, types: spec.types || [], name: null };
    }
    var key = null;
    if (spec.poke !== undefined && spec.poke !== null) {
        var s = String(spec.poke);
        if (POKEMON.byNum[s] !== undefined) key = s;
        else if (POKEMON.byName[s.toLowerCase()] !== undefined) key = POKEMON.byName[s.toLowerCase()];
    }
    if (key === null || !POKEMON.byNum[key]) return { error: 'unknown pokemon: ' + (spec.poke || '(no name)') };
    var p = POKEMON.byNum[key];
    return { baseStats: p.baseStats, types: p.types, name: p.name_en };
}

// 解析招式输入：支持 {name}（英文或中文）或 {power, category, type}
function resolveMoveInput(spec) {
    if (!spec) return { error: 'move missing' };
    if (spec.name) {
        var name = String(spec.name);
        var lower = name.toLowerCase();
        for (var k in MOVES) {
            var m = MOVES[k];
            if ((m.name && m.name.toLowerCase() === lower) || (m.name_zh && m.name_zh === name)) {
                return { name: m.name, power: m.power, category: m.category, type: m.type };
            }
        }
        return { error: 'unknown move: ' + spec.name };
    }
    if (spec.power !== undefined && spec.category && spec.type) {
        return { name: null, power: spec.power, category: spec.category, type: spec.type };
    }
    return { error: 'move needs name, or power+category+type' };
}

// 读取数组字段（ev/iv）某一维，缺失用默认
function arrAt(arr, idx, dflt) {
    if (arr && arr.length > idx && arr[idx] !== undefined && arr[idx] !== null) return arr[idx];
    return dflt;
}

// 解析性格修正：返回 {buff, debuff}（值为能力索引 1-5，0=无）
function resolveNature(spec) {
    var key = null;
    if (spec.nature === undefined || spec.nature === null || spec.nature === '' || spec.nature === 0) {
        return { buff: 0, debuff: 0 };
    }
    var s = String(spec.nature);
    if (NATURES.byNum[s] !== undefined) key = s;
    else if (NATURES.byName[s.toLowerCase()] !== undefined) key = NATURES.byName[s.toLowerCase()];
    if (key === null) return { buff: 0, debuff: 0 };
    return NATURES.byNum[key];
}

// 读取能力等级修正（boosts 对象，key 用小写缩写）
function boostOf(boosts, statName) {
    if (!boosts) return 0;
    var v = boosts[statName];
    if (v === undefined) return 0;
    return parseInt(v, 10) || 0;
}

// 计算有效能力值（含性格 + 能力等级修正）；statIdx 0-5
function effectiveStat(baseStats, level, ev, iv, nature, boosts, statIdx) {
    var base = baseStats[statIdx];
    var e = arrAt(ev, statIdx, 0);
    var i = arrAt(iv, statIdx, 31);
    var lv = level || 100;
    var raw = (2 * base + i + Math.floor(e / 4)) * lv / 100;
    var val;
    if (statIdx === 0) {
        val = Math.floor(raw + 10 + lv);
    } else {
        val = Math.floor(raw + 5);
        if (nature.buff === statIdx) val = Math.floor(val * 1.1);
        if (nature.debuff === statIdx) val = Math.floor(val * 0.9);
        var b = boostOf(boosts, STAT_NAMES[statIdx]);
        if (b > 0) val = Math.floor(val * (2 + b) / 2);
        if (b < 0) val = Math.floor(val * 2 / (2 - b));
    }
    return val;
}

// 单组伤害计算
function calcOneLeg(leg, idx) {
    var atk = resolvePokemonInput(leg.attacker);
    if (atk.error) return { index: idx, error: atk.error };
    var def = resolvePokemonInput(leg.defender);
    if (def.error) return { index: idx, error: def.error };
    var mv = resolveMoveInput(leg.move);
    if (mv.error) return { index: idx, error: mv.error };

    if (mv.power === 0 || mv.category === 'Status') {
        return { index: idx, min: 0, max: 0, percent_min: 0, percent_max: 0, detail: { category: 'Status', note: 'non-damaging move' } };
    }

    var lv = leg.attacker.level || 100;
    var aNature = resolveNature(leg.attacker);
    var dNature = resolveNature(leg.defender);
    var aStat, dStat;
    if (mv.category === 'Physical') {
        aStat = effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, leg.attacker.boosts, 1);
        dStat = effectiveStat(def.baseStats, leg.defender.level || lv, leg.defender.ev, leg.defender.iv, dNature, leg.defender.boosts, 2);
    } else {
        aStat = effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, leg.attacker.boosts, 3);
        dStat = effectiveStat(def.baseStats, leg.defender.level || lv, leg.defender.ev, leg.defender.iv, dNature, leg.defender.boosts, 4);
    }

    var base = Math.floor(Math.floor(((2 * lv / 5 + 2) * mv.power * aStat) / dStat) / 50) + 2;

    // STAB：攻击方属性含招式属性 -> 1.5
    var stab = 1;
    if (mv.type && atk.types && atk.types.indexOf(mv.type) !== -1) stab = 1.5;

    // 属性克制
    var mult = stab;
    if (mv.type && def.types && def.types.length) {
        var ai = typeIndex(mv.type);
        if (ai >= 0) {
            for (var t = 0; t < def.types.length; t++) {
                var di = typeIndex(def.types[t]);
                if (di >= 0) mult *= CHART[ai][di];
            }
        }
    }

    // extra 系数（默认 1.0）
    var extra = (leg.extra !== undefined && leg.extra !== null) ? leg.extra : 1.0;
    mult *= extra;

    var final = Math.floor(base * mult);
    var min = Math.floor(final * 0.85);
    var max = Math.floor(final * 1.00);

    // 防守方最大 HP（用于百分比）
    var defHp = effectiveStat(def.baseStats, leg.defender.level || lv, leg.defender.ev, leg.defender.iv, dNature, leg.defender.boosts, 0);
    var pctMin = defHp > 0 ? Math.floor(min * 100 / defHp) : 0;
    var pctMax = defHp > 0 ? Math.floor(max * 100 / defHp) : 0;

    return {
        index: idx,
        min: min,
        max: max,
        percent_min: pctMin,
        percent_max: pctMax,
        detail: {
            attack_stat: aStat,
            defense_stat: dStat,
            defender_max_hp: defHp,
            stab: stab,
            type_mult: mult / (stab * extra),
            extra: extra
        }
    };
}

// calc_damage：最多 10 组，一次算完
function calcDamage(args) {
    if (!args.legs || !args.legs.length) return { error: 'legs required' };
    if (args.legs.length > 10) return { error: 'at most 10 legs allowed, got ' + args.legs.length };
    var out = [];
    for (var i = 0; i < args.legs.length; i++) {
        out.push(calcOneLeg(args.legs[i], i));
    }
    return { legs: out };
}

// ===== run_js 逃生舱：让 LLM 在沙箱里跑一小段同步 JS，覆盖没有现成 tool 的计算 =====
// 沙箱内可用：data（pokemon/moves/natures/typechart）、typeMul/effStat/resolvePokemon/resolveMove/calcDamage、print/console.log
// 限制：同步、无 require/process/fs、2s 超时、结果/输出各截 2000 字符。

function runJs(args) {
    if (!args.code) return { error: 'code required' };
    var code = String(args.code);
    if (code.length > 20000) return { error: 'code too long (' + code.length + ' chars, max 20000)' };

    var printed = [];

    // 沙箱 helper：包一层让 LLM 传参更自然（resolvePokemon/resolveMove 直接吃字符串）
    // effStat(baseStat, boost, level) —— 单个能力值（0 EV、31 IV、中性性格），boost 默认 0，level 默认 100
    function sbTypeMul(attackType, defendTypes) {
        var ai = typeIndex(attackType);
        if (ai < 0) return 1;
        if (!defendTypes) return 1;
        var arr = Array.isArray(defendTypes) ? defendTypes : [defendTypes];
        var m = 1;
        for (var i = 0; i < arr.length; i++) {
            var di = typeIndex(arr[i]);
            if (di >= 0) m *= CHART[ai][di];
        }
        return m;
    }
    function sbEffStat(baseStat, boost, level) {
        var lv = level || 100;
        var b = boost || 0;
        var val = Math.floor((2 * baseStat + 31) * lv / 100 + 5);
        if (b > 0) val = Math.floor(val * (2 + b) / 2);
        if (b < 0) val = Math.floor(val * 2 / (2 - b));
        return val;
    }
    function sbResolvePokemon(poke) {
        return resolvePokemonInput({ poke: poke });
    }
    function sbResolveMove(name) {
        return resolveMoveInput({ name: name });
    }
    function sbCalcDamage(attacker, defender, move) {
        return calcOneLeg({ attacker: attacker, defender: defender, move: move }, 0);
    }

    var sandbox = {
        data: {
            pokemon: POKEMON.byNum,
            moves: MOVES,
            natures: NATURES.byNum,
            types: TYPE_NAMES,
            typechart: CHART
        },
        typeMul: sbTypeMul,
        effStat: sbEffStat,
        resolvePokemon: sbResolvePokemon,
        resolveMove: sbResolveMove,
        calcDamage: sbCalcDamage,
        print: function () { printed.push(Array.prototype.slice.call(arguments).map(String).join(' ')); },
        console: { log: function () { printed.push(Array.prototype.slice.call(arguments).map(String).join(' ')); } }
    };

    var result;
    try {
        var ctx = vm.createContext(sandbox);
        result = vm.runInContext(code, ctx, { timeout: 2000 });
    } catch (e) {
        return { error: (e && e.message) ? e.message : String(e), printed: printed.join('\n').slice(0, 2000) };
    }

    var out = { printed: printed.join('\n').slice(0, 2000) };
    if (result !== undefined) {
        var s;
        try { s = JSON.stringify(result); } catch (e) { s = String(result); }
        if (s === undefined) s = String(result);
        if (s && s.length > 2000) s = s.slice(0, 2000) + '...(truncated)';
        out.result = s;
    }
    return out;
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
    if (name === 'submit_feedback') return submitFeedback(args, ctx);
    if (name === 'calc_damage') return calcDamage(args);
    if (name === 'run_js') return runJs(args);
    return { error: 'unknown tool: ' + name };
}

module.exports = {
    TYPE_NAMES: TYPE_NAMES,
    CHART: CHART,
    typeIndex: typeIndex,
    TOOL_DEFS: TOOL_DEFS,
    runTool: runTool
};
