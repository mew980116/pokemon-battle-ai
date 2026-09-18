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
var TACTICS = require('./knowledge/tactics.json');
var MECHANICS = require('./knowledge/mechanics.json');
var ABILITIES = require('./knowledge/abilities.json');
var ABILITY_SIGNALS = require('./knowledge/ability_signals.json');
var ITEMS = require('./knowledge/items.json');

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
            description: 'Read the battle log (turn-by-turn history) for a given turn range. Call it at the start of each turn to review what actually happened last turn(s) — who moved first, how much damage landed, which move/ability/item triggered, what boosts or status changed — instead of guessing from memory. Omit both arguments to read the full history.',
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
            description: 'Record or update your observation about ONE opposing pokemon (e.g. revealed moves, likely item/ability, damage estimate). Tag how each fact was obtained: [proved] if directly observed (revealed move, triggered ability/item message, observed damage), [estimated] if inferred (likely item, possible ability, EV spread, unrevealed moves) — e.g. "item: Choice Scarf [estimated] | move: Knock Off [proved]". Always tag inferences so a guess is not later mistaken for a fact. If the opponent has several pokemon of the same species (no Species Clause), append the team slot to the name (pokemon="Garchomp#1" vs "Garchomp#2") so their notes do not overwrite each other. Keep the speed line in this exact format so you can recall it later without recomputing: "Speed:<current>(<spread>)|<boostMove>+<stage>:<boosted>|<reference>:<speed>", e.g. "Speed:259(252Spe Adamant)|DragonDance+1:388|Garchomp:303". Overwrites the previous note by default; set append=true to append instead.',
            parameters: {
                type: 'object',
                properties: {
                    pokemon: { type: 'string', description: 'Opposing pokemon name' },
                    text: { type: 'string', description: 'Your observation text. Tag each fact as [proved] (directly observed) or [estimated] (inferred).' },
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
            description: 'Record your strategic thinking for this turn: your READ on the opponent plus the action you commit to. Stored per turn, and re-read (and re-checked against reality) in later turns. Write it as a compact read→plan note following these steps: (1) Is the opponent likely to ATTACK, and with what? Consider their revealed moves plus moves they plausibly carry but have not shown. (2) Are they likely to SWITCH, and to whom? Infer only from the pokemon they have revealed plus their current HP/status. (3) What do they KNOW about my team, and how will they treat what they have not seen — as a threat, or ignore it? (4) Given all that, what is their single most likely action, what is my best response to it, and if my prediction is wrong does it leave me badly off? (5) Final call: the action you actually choose. Two extra heuristics: when several moves could KO, prefer the one that also covers a likely switch-in over the single highest damage; when you hard-counter the pokemon in front but know little about their bench, consider setting hazards / boosting / Substitute instead of attacking into a switch. Keep it concise: state the read, the plan, and what would falsify the read.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Your read + plan, following the 5 steps: likely attack? likely switch? what they know about me? their most likely action + my response + risk if wrong? final call?' }
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
            description: 'Submit feedback when (a) a tool result disagrees with what you observe in the battle log (e.g. calc_damage off by roughly 2x with no modifier to explain it), or (b) you wish a tool existed for a computation the current tools cannot do. Describe what you expected vs what you got, or the tool you want and why.',
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
            description: 'Compute the damage range of up to 10 attacker/defender/move combinations using the standard Pokemon damage formula. Returns the minimum (0.85x roll) and maximum (1.0x roll) damage, plus the percentage of the defender max HP. NOTE: this is a SIMPLIFIED calculator — it does NOT auto-apply item/ability/weather/terrain/burn/critical-hit/STAB-removal etc.; pass an extra multiplier (e.g. 1.5 for critical hit, 0.5 for burn) if needed. Call it before committing to a move whenever a KO threshold or the expected damage actually matters; then compare the result with the damage you observe in the battle log (call submit_feedback if they disagree by a large factor).',
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
                                        atk: { type: 'number', description: 'Direct final Attack stat (bypasses base-stats/EV/IV/nature calculation). Use if you already know the value.' },
                                        spa: { type: 'number', description: 'Direct final Special Attack stat (bypasses calculation).' },
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
                                        def: { type: 'number', description: 'Direct final Defense stat (bypasses calculation).' },
                                        spd: { type: 'number', description: 'Direct final Special Defense stat (bypasses calculation).' },
                                        hp: { type: 'number', description: 'Direct max HP (bypasses calculation), used for the damage %. ' },
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
            description: 'Run a small JavaScript snippet in a sandbox to compute something no built-in tool covers (e.g. speed comparison, batch damage over a set of pokemon, custom scoring). Sandbox exposes: data.pokemon/data.moves/data.natures/data.types/data.typechart, typeMul(attackType, defendTypes), effStat(baseStat, boost?, level?), resolvePokemon(nameOrNum), resolveMove(name), calcDamage(attackerObj, defenderObj, moveObj), and print/console.log for output. The last expression value is returned. Call it only as a last resort, when a computation you need is genuinely not covered by any built-in tool — prefer the built-in tools.',
            parameters: {
                type: 'object',
                properties: {
                    code: { type: 'string', description: 'JavaScript code to execute. It must be synchronous and not use require/process/fs. Use print(...) or console.log(...) to emit text.' }
                },
                required: ['code']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calc_stats',
            description: 'Compute the final stat(s) of a pokemon given its name (or explicit base stats) plus EVs, IVs, nature, and stat-stage boosts. Returns the requested stats after applying nature and boost. Call it for any stat estimate you cannot read directly — most often a SPEED comparison (do I outspeed, with or without a boost / Choice Scarf / a speed ability?), or to work out a hidden stat. Up to 10 legs in one call.',
            parameters: {
                type: 'object',
                properties: {
                    legs: {
                        type: 'array',
                        description: 'List of stat calculations to perform (1 to 10).',
                        items: {
                            type: 'object',
                            properties: {
                                poke: { type: 'string', description: 'Pokemon name (English or Chinese) or Pokedex number' },
                                base_stats: { type: 'array', items: { type: 'number' }, description: 'Explicit base stats [HP,Atk,Def,SpA,SpD,Spe] (alternative to poke)' },
                                level: { type: 'integer', description: 'Level, default 100' },
                                ev: { type: 'array', items: { type: 'number' }, description: 'EVs [HP,Atk,Def,SpA,SpD,Spe], default all 0' },
                                iv: { type: 'array', items: { type: 'number' }, description: 'IVs [HP,Atk,Def,SpA,SpD,Spe], default all 31' },
                                nature: { type: 'string', description: 'Nature name (English or Chinese) or number, default neutral' },
                                boosts: { type: 'object', description: 'Stat stages, e.g. {"spe":1,"atk":-1}', additionalProperties: { type: 'integer' } },
                                stats: { type: 'array', items: { type: 'string' }, description: 'Which stats to return, e.g. ["spe"] or ["atk","spa"]. Omit to return all six.' }
                            },
                            required: []
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
            name: 'get_my_stats',
            description: 'Get the final unboosted stats (HP/Atk/Def/SpA/SpD/Spe) of MY pokemon from the actual battle data (real EVs, IVs, nature, and level). Call it to read your own exact stats before a speed or damage comparison, instead of assuming a spread. Specify a pokemon name or slot to get one, or omit to get all six of my team.',
            parameters: {
                type: 'object',
                properties: {
                    poke: { type: 'string', description: 'Pokemon name (English) or slot number to look up; omit for all' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'battle_tips',
            description: 'Look up battle tactics / strategy tips by name, e.g. "优势局" (ahead), "劣势局" (behind), "预知未来" (Future Sight), "撒钉", "牺牲", "残局", "太晶", "强化手", plus core strategy concepts like "联防", "联攻", "攻防转换", "胜利路线". Call it whenever you need strategic guidance for the current situation (ahead / behind / endgame / deciding a switch or a sacrifice) or want to review a core concept before committing. Pass up to 10 tip names at once; Chinese or English. Each core strategy concept has a concise version and a detailed version — add suffix "详解"/"详细"/"展开" for the detailed one (e.g. "联防详解").',
            parameters: {
                type: 'object',
                properties: {
                    tips: { type: 'array', items: { type: 'string' }, description: 'Tip names to look up (up to 10). E.g. ["优势局", "预知未来", "残局"]' }
                },
                required: ['tips']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_knowledge',
            description: 'Read objective battle mechanics and rules (switch cost, type/status immunities, weather effects, terrain effects, what "grounded"/接触地面 means). Call it before acting on a rule you are unsure about — especially before switching, or when weather/terrain/status/grounded interactions decide the play — so you never act on a wrong assumption. Use this for factual rules; use battle_tips for strategic advice.',
            parameters: {
                type: 'object',
                properties: {
                    topics: { type: 'array', items: { type: 'string' }, description: 'Knowledge topic names (up to 10). E.g. ["换人"], ["天气"], ["场地"], ["地面"]; Chinese or English.' }
                },
                required: ['topics']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_move_info',
            description: 'Look up a move mechanics: power, accuracy, category, type, priority, its battle effect (desc — what it actually does on hit, e.g. "可能引起烧伤" = may burn, "自身物攻提升两级" = raises own Attack by 2), secondary-effect chance (effect_chance %), flinch chance (%), healing/recoil (% of max HP; negative = self-damage), crit rate (>=1 = high crit), and tags (contact/sound/punch/bite/pulse/recoil) with meanings. Call this when a move decision hinges on its side effects or tags — e.g. to see what a status move actually does, how reliable a secondary effect is, whether contact triggers recoil abilities (Rough Skin/Static/Flame Body), or whether sound immunity blocks it.',
            parameters: {
                type: 'object',
                properties: {
                    move: { type: 'string', description: 'Move name (English or Chinese) or move number. E.g. "Earthquake", "地震", or "89".' }
                },
                required: ['move']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_ability_info',
            description: 'Look up an ability details: description, whether it triggers a visible message in the battle log (and when), and how to infer/exclude it from the battle log (e.g. via status/type/effect changes). Call it when an opponent ability matters (to check its mechanics) or when the battle log shows — or lacks — a trigger and you want to narrow down which ability it is.',
            parameters: {
                type: 'object',
                properties: {
                    ability: { type: 'string', description: 'Ability name (English or Chinese) or PO ability number. E.g. "Intimidate", "威吓", or "22".' }
                },
                required: ['ability']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_item_info',
            description: 'Look up an item details: description and effect. Call it when an item decides a play — e.g. to check what a revealed/likely opponent item does (Choice items lock a move, Leftovers heal each turn, Focus Sash survives a hit at full HP, Rocky Helmet recoils contact moves), or to re-check your own item before relying on it.',
            parameters: {
                type: 'object',
                properties: {
                    item: { type: 'string', description: 'Item name (English or Chinese) or PO item number. E.g. "Choice Band", "讲究头带", or "4".' }
                },
                required: ['item']
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

// 宝可梦的 pokeRound：小数部分 > 0.5 才向上取整，否则向下（对齐 @smogon/calc）
function pokeRound(n) {
    return n % 1 > 0.5 ? Math.ceil(n) : Math.floor(n);
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
        aStat = (leg.attacker.atk !== undefined && leg.attacker.atk !== null) ? leg.attacker.atk : effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, leg.attacker.boosts, 1);
        dStat = (leg.defender.def !== undefined && leg.defender.def !== null) ? leg.defender.def : effectiveStat(def.baseStats, leg.defender.level || lv, leg.defender.ev, leg.defender.iv, dNature, leg.defender.boosts, 2);
    } else {
        aStat = (leg.attacker.spa !== undefined && leg.attacker.spa !== null) ? leg.attacker.spa : effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, leg.attacker.boosts, 3);
        dStat = (leg.defender.spd !== undefined && leg.defender.spd !== null) ? leg.defender.spd : effectiveStat(def.baseStats, leg.defender.level || lv, leg.defender.ev, leg.defender.iv, dNature, leg.defender.boosts, 4);
    }

    var base = Math.floor(Math.floor(Math.floor((2 * lv / 5 + 2) * mv.power * aStat) / dStat) / 50) + 2;

    // STAB：攻击方属性含招式属性 -> 1.5
    var stab = 1;
    if (mv.type && atk.types && atk.types.indexOf(mv.type) !== -1) stab = 1.5;

    // 属性克制（纯克制系数，不含 STAB/extra）
    var typeMult = 1;
    if (mv.type && def.types && def.types.length) {
        var ai = typeIndex(mv.type);
        if (ai >= 0) {
            for (var t = 0; t < def.types.length; t++) {
                var di = typeIndex(def.types[t]);
                if (di >= 0) typeMult *= CHART[ai][di];
            }
        }
    }

    // extra 系数（默认 1.0）
    var extra = (leg.extra !== undefined && leg.extra !== null) ? leg.extra : 1.0;

    // 对齐 @smogon/calc getFinalDamage 的顺序：随机系数 → STAB(4096定点) → 克制(pokeRound) → extra
    var min = Math.floor(base * 85 / 100);
    var max = Math.floor(base * 100 / 100);
    if (stab === 1.5) {
        min = min * 6144 / 4096;
        max = max * 6144 / 4096;
    }
    min = Math.floor(pokeRound(min) * typeMult);
    max = Math.floor(pokeRound(max) * typeMult);
    // extra 对应 @smogon 的 finalMod，用 pokeRound（四舍五入），对齐 finalMods 应用
    min = pokeRound(min * extra);
    max = pokeRound(max * extra);

    // 防守方最大 HP（用于百分比）
    var defHp = (leg.defender.hp !== undefined && leg.defender.hp !== null) ? leg.defender.hp : effectiveStat(def.baseStats, leg.defender.level || lv, leg.defender.ev, leg.defender.iv, dNature, leg.defender.boosts, 0);
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
            type_mult: typeMult,
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

// ===== calc_stats：LLM 自定参数算能力值（名/种族值 + ev/iv/nature/boosts），legs≤10 =====
// 复用 resolvePokemonInput / resolveNature / effectiveStat
function calcStats(args) {
    if (!args.legs || !args.legs.length) return { error: 'legs required' };
    if (args.legs.length > 10) return { error: 'at most 10 legs allowed, got ' + args.legs.length };
    var out = [];
    for (var i = 0; i < args.legs.length; i++) {
        out.push(calcOneStatLeg(args.legs[i], i));
    }
    return { legs: out };
}

function calcOneStatLeg(leg, idx) {
    var p = resolvePokemonInput(leg);
    if (p.error) return { index: idx, error: p.error };
    var nature = resolveNature(leg);
    var wanted = leg.stats || STAT_NAMES;
    var stats = {};
    for (var s = 0; s < 6; s++) {
        var name = STAT_NAMES[s];
        if (wanted.indexOf(name) === -1) continue;
        stats[name] = effectiveStat(p.baseStats, leg.level || 100, leg.ev, leg.iv, nature, leg.boosts, s);
    }
    return { index: idx, name: p.name || leg.poke || null, level: leg.level || 100, stats: stats };
}

// ===== get_my_stats：读我方实际宝可梦的无加成六维（数据来自 state.myStats）=====
function getMyStats(args, ctx) {
    var state = ctx && ctx.state;
    var myStats = state && state.myStats;
    if (!myStats || !myStats.length) return { error: 'no myStats in state (PO script too old? update po-script.js)' };
    var wanted = args.poke ? String(args.poke) : null;
    var out = [];
    for (var i = 0; i < myStats.length; i++) {
        var m = myStats[i];
        if (wanted && m.name !== wanted && String(m.slot) !== wanted) continue;
        var p = POKEMON.byNum[String(m.numRef)];
        if (!p) { out.push({ slot: m.slot, name: m.name, error: 'unknown numRef ' + m.numRef }); continue; }
        var nat = NATURES.byNum[String(m.nature)] || { buff: 0, debuff: 0 };
        var stats = {};
        for (var s = 0; s < 6; s++) {
            stats[STAT_NAMES[s]] = effectiveStat(p.baseStats, m.level, m.ev, m.iv, nat, null, s);
        }
        out.push({ slot: m.slot, name: m.name, level: m.level, nature: m.nature, stats: stats });
    }
    if (wanted && out.length === 0) return { error: 'pokemon not found: ' + wanted };
    return { pokemon: out };
}

// ===== battle_tips：查战术/策略 tips（数据来自 knowledge/tactics.json）=====
// 把任意 JSON 值递归压成可读文本行
function flattenTip(v, prefix) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) {
        var arrLines = [];
        for (var i = 0; i < v.length; i++) {
            var it = v[i];
            if (typeof it === 'string') arrLines.push((i + 1) + '. ' + it);
            else arrLines.push((i + 1) + '. ' + flattenTip(it, ''));
        }
        return arrLines.join('\n');
    }
    if (typeof v === 'object') {
        var lines = [];
        for (var k in v) {
            if (k === 'name' || k === 'en' || k === 'id' || k === 'meta' || k === 'scope') continue;
            var s = flattenTip(v[k], '');
            if (s) lines.push(k + ': ' + s);
        }
        return lines.join('\n');
    }
    return String(v);
}

// 组队战术条目转文本（精简：原理 + 两代用法 + 代表宝可梦，不含完整 Showdown import）
function tacticToText(t) {
    var lines = [];
    lines.push('【' + t.name + '】' + (t.en ? ' (' + t.en + ')' : ''));
    lines.push('原理: ' + t.principle);
    if (t.gen8) {
        lines.push('Gen8: ' + (t.gen8.summary || ''));
        if (t.gen8.usage && t.gen8.usage.length) lines.push('Gen8 用法: ' + t.gen8.usage.join('；'));
        if (t.gen8.representative && t.gen8.representative.length) lines.push('Gen8 代表: ' + t.gen8.representative.join(', '));
    }
    if (t.gen9) {
        lines.push('Gen9: ' + (t.gen9.summary || ''));
        if (t.gen9.usage && t.gen9.usage.length) lines.push('Gen9 用法: ' + t.gen9.usage.join('；'));
        if (t.gen9.representative && t.gen9.representative.length) lines.push('Gen9 代表: ' + t.gen9.representative.join(', '));
    }
    return lines.join('\n');
}

// 别名表：把「简称/关键词」映射到标准 tip 名（组队战术 + playbook section）
var TIP_ALIASES = {
    // 组队战术
    '撒钉': 'hazard-stack', '撒菱': 'hazard-stack', '隐形岩': 'hazard-stack', '钉子': 'hazard-stack', '阻止除钉': 'hazard-stack', 'hazard': 'hazard-stack', 'hazard stack': 'hazard-stack', 'spikes': 'hazard-stack',
    '双墙': 'screens-ho', '光墙': 'screens-ho', '反射壁': 'screens-ho', '极光幕': 'screens-ho', 'screens': 'screens-ho', 'ho': 'screens-ho', 'hyper offense': 'screens-ho',
    '天气': 'weather', '天气队': 'weather', '天气进攻': 'weather', 'weather': 'weather', 'weather offense': 'weather',
    '场地种子': 'terrain-seed', '电气种子': 'terrain-seed', '青草种子': 'terrain-seed', '精神种子': 'terrain-seed', '轻装': 'terrain-seed', 'unburden': 'terrain-seed', 'seed': 'terrain-seed',
    '预知未来': 'future-sight', 'future sight': 'future-sight', 'futuresight': 'future-sight',
    '中转': 'pivot', '伏特替换': 'pivot', '急速折返': 'pivot', '快速折返': 'pivot', 'volt switch': 'pivot', 'u-turn': 'pivot', 'flip turn': 'pivot', 'pivot': 'pivot',
    '磁力': 'magnet-pull', '磁力诱捕': 'magnet-pull', '自爆磁怪': 'magnet-pull', 'magnet pull': 'magnet-pull', 'magnetpull': 'magnet-pull', '诱捕': 'magnet-pull',
    '盐腌': 'salt-cure-block', '盐石巨灵': 'salt-cure-block', 'salt cure': 'salt-cure-block', 'saltcure': 'salt-cure-block', '困杀': 'salt-cure-block', '熔岩风暴': 'salt-cure-block',
    '受队': 'stall', '半受': 'stall', '纯受': 'stall', 'stall': 'stall', 'semistall': 'stall', '耐久队': 'stall',
    '太晶诱杀': 'tera-bait', '太晶': 'tera-bait', 'tera': 'tera-bait', 'tera bait': 'tera-bait', 'terabait': 'tera-bait', '太晶化': 'tera-bait',
    // playbook 决策 section
    '开局': 'opening-audit', '开局审计': 'opening-audit', '队伍审计': 'opening-audit', 'opening': 'opening-audit',
    '配置范围': 'config-range', '配置推断': 'config-range', '配置': 'config-range', '信念': 'config-range', '猜测配置': 'config-range',
    '首发对位': 'opening-matchups', '首发局面': 'opening-matchups', '对位': 'opening-matchups',
    '讲究': 'choice-items', '围巾': 'choice-items', '头带': 'choice-items', '眼镜': 'choice-items', '戏法': 'choice-items', 'choice': 'choice-items', 'scarf': 'choice-items', '锁招': 'choice-items',
    '强化手': 'setup-sweeper', '强化': 'setup-sweeper', '破壳': 'setup-sweeper', '腹鼓': 'setup-sweeper', '龙舞': 'setup-sweeper', '剑舞': 'setup-sweeper',
    '耐久消耗': 'stall-handling', '回复': 'stall-handling', '再生力': 'stall-handling', 'regenerator': 'stall-handling', '保护': 'stall-handling', 'protect': 'stall-handling',
    '钉子局': 'hazards', '除钉': 'hazards', '清钉': 'hazards', 'hazards': 'hazards',
    '太晶局': 'tera', '太晶': 'tera', '太晶思路': 'tera', 'tera': 'tera',
    '牺牲': 'sacrifice', '炮灰': 'sacrifice', '死出': 'sacrifice', 'sacrifice': 'sacrifice',
    '残局': 'endgame', 'endgame': 'endgame', '收尾': 'endgame',
    '工厂': 'factory', 'battle factory': 'factory', '工厂战': 'factory', 'factory': 'factory',
    '回合清单': 'turn-checklist', '决策清单': 'turn-checklist', '回合决策': 'turn-checklist',
    '优势局': 'advantage', '领先': 'advantage', 'advantage': 'advantage',
    '劣势局': 'disadvantage', '落后': 'disadvantage', 'disadvantage': 'disadvantage',
    '核心原则': 'principles', '原则': 'principles', '五原则': 'principles', 'principles': 'principles',
    '案例': 'cases', '实战案例': 'cases', 'cases': 'cases',
    '记录习惯': 'record-habit', '记笔记': 'record-habit', '记录': 'record-habit',
    // 通用战略层（core_strategy）
    '联攻联防总纲': 'synergy-overview', '战略总纲': 'synergy-overview', '总纲': 'synergy-overview', '战略层': 'synergy-overview', '胜利路线': 'synergy-overview', 'win condition': 'synergy-overview', 'win_condition': 'synergy-overview', 'wincon': 'synergy-overview', 'synergy': 'synergy-overview', 'core strategy': 'synergy-overview',
    '联防': 'defensive-synergy', '防守协同': 'defensive-synergy', '防御协同': 'defensive-synergy', 'defensive': 'defensive-synergy',
    '联攻': 'offensive-synergy', '进攻协同': 'offensive-synergy', 'offensive': 'offensive-synergy',
    '攻防转换': 'transition', '压制链': 'transition', '转换': 'transition', 'transition': 'transition',
    '诱杀': 'bait', 'bait': 'bait',
    '共同消耗': 'chip-progress', 'chip-progress': 'chip-progress', 'chip': 'chip-progress',
    '速度联防': 'speed-defense', '速度防守': 'speed-defense', 'speed defense': 'speed-defense',
    '状态联防': 'status-defense', '状态防守': 'status-defense', 'status defense': 'status-defense',
    '核心分类': 'core-taxonomy', '核心': 'core-taxonomy', 'core taxonomy': 'core-taxonomy',
    '总纲详解': 'synergy-overview-detail', '总纲详细': 'synergy-overview-detail', '总纲展开': 'synergy-overview-detail', '联攻联防总纲详解': 'synergy-overview-detail',
    '联防详解': 'defensive-synergy-detail', '联防详细': 'defensive-synergy-detail', '联防展开': 'defensive-synergy-detail',
    '联攻详解': 'offensive-synergy-detail', '联攻详细': 'offensive-synergy-detail', '联攻展开': 'offensive-synergy-detail',
    '攻防转换详解': 'transition-detail', '攻防转换详细': 'transition-detail', '攻防转换展开': 'transition-detail', '压制链详解': 'transition-detail', '攻防转换与压制链详解': 'transition-detail',
    '诱杀详解': 'bait-detail', '诱杀详细': 'bait-detail', '诱杀展开': 'bait-detail',
    '共同消耗详解': 'chip-progress-detail', '共同消耗详细': 'chip-progress-detail', '共同消耗展开': 'chip-progress-detail',
    '速度联防详解': 'speed-defense-detail', '速度联防详细': 'speed-defense-detail', '速度联防展开': 'speed-defense-detail',
    '状态联防详解': 'status-defense-detail', '状态联防详细': 'status-defense-detail', '状态联防展开': 'status-defense-detail',
    '核心分类详解': 'core-taxonomy-detail', '核心分类详细': 'core-taxonomy-detail', '核心分类展开': 'core-taxonomy-detail'
};

// 构建 tip 索引：id -> { title, text }
var TIPS = buildTipIndex();

function buildTipIndex() {
    var map = {};
    // 组队战术
    var tactics = TACTICS.tactics || [];
    for (var i = 0; i < tactics.length; i++) {
        map[tactics[i].id] = { title: tactics[i].name, text: tacticToText(tactics[i]) };
    }
    // playbook section（用 key 做 id，加前缀避免与组队战术 id 撞名）
    var rb = TACTICS.random_battle_playbook || {};
    var pbKeys = {
        'opening_audit': 'opening-audit', 'config_range': 'config-range', 'opening_matchups': 'opening-matchups',
        'choice_items': 'choice-items', 'setup_sweeper': 'setup-sweeper', 'stall_handling': 'stall-handling',
        'hazards': 'hazards', 'tera': 'tera', 'sacrifice': 'sacrifice', 'endgame': 'endgame',
        'factory': 'factory', 'turn_checklist': 'turn-checklist', 'advantage': 'advantage',
        'disadvantage': 'disadvantage', 'principles': 'principles', 'cases': 'cases', 'record_habit': 'record-habit'
    };
    for (var pk in pbKeys) {
        var v = rb[pk];
        if (!v) continue;
        var id = pbKeys[pk];
        var title = v.name || pk;
        var text = flattenTip(v, '');
        map[id] = { title: title, text: text };
    }
    // 通用战略层（core_strategy）：每条生成精简（summary）+ 详解（detail）两个入口
    var cs = TACTICS.core_strategy || {};
    for (var cid in cs) {
        if (cid === 'meta') continue;
        var cv = cs[cid];
        if (!cv) continue;
        var summaryText = cv.summary || '';
        if (cv.detail) {
            summaryText += '\n（要查看详细展开含例子与决策条件：battle_tips(["' + cv.name + '详解"])）';
        }
        map[cid] = { title: cv.name, text: summaryText };
        if (cv.detail) map[cid + '-detail'] = { title: cv.name + '（详解）', text: cv.detail };
    }
    return map;
}

// 通用 lookup：按别名在 map 中查找一组名称，返回 found/missing
function lookupEntries(map, aliases, names, max) {
    if (!Array.isArray(names)) return { error: 'expect an array of names' };
    var list = names.slice(0, max);
    var found = [];
    var missing = [];
    for (var i = 0; i < list.length; i++) {
        var name = String(list[i]).trim();
        var lname = name.toLowerCase();
        var key = aliases[lname] || null;
        if (!key) {
            if (map[name]) key = name;
            else if (map[lname]) key = lname;
            else {
                for (var ak in aliases) {
                    if (ak.toLowerCase() === lname) { key = aliases[ak]; break; }
                }
            }
        }
        if (key && map[key]) {
            found.push({ name: name, title: map[key].title, tip: map[key].text });
        } else {
            missing.push(name);
        }
    }
    return { found: found, missing: missing };
}

function battleTips(args) {
    return lookupEntries(TIPS, TIP_ALIASES, args.tips || [], 10);
}

// ===== get_knowledge：查客观机制/规则（数据来自 knowledge/mechanics.json）=====
var KNOWLEDGE_ALIASES = {
    '换人': 'switch', '切换': 'switch', 'switch': 'switch', 'switch basics': 'switch',
    '异常状态': 'status', '状态': 'status', 'status': 'status', '属性免疫': 'status', '免疫': 'status', 'immunity': 'status',
    '睡眠': 'status', 'sleep': 'status', '中毒': 'status', '剧毒': 'status', 'poison': 'status', 'toxic': 'status',
    '烧伤': 'status', '灼伤': 'status', 'burn': 'status', '麻痹': 'status', 'paralysis': 'status',
    '冰冻': 'status', 'freeze': 'status', '混乱': 'status', 'confusion': 'status',
    '天气': 'weather', '雨天': 'weather', '晴天': 'weather', '沙暴': 'weather', '冰雹': 'weather', '雪天': 'weather', 'rain': 'weather', 'sun': 'weather', 'sand': 'weather', 'sandstorm': 'weather', 'hail': 'weather', 'snow': 'weather', 'weather': 'weather',
    '场地': 'terrain', '电气场地': 'terrain', '青草场地': 'terrain', '薄雾场地': 'terrain', '精神场地': 'terrain', 'terrain': 'terrain', 'electric terrain': 'terrain', 'grassy terrain': 'terrain', 'misty terrain': 'terrain', 'psychic terrain': 'terrain',
    '地面': 'grounded', '接触地面': 'grounded', 'grounded': 'grounded', '地面上的宝可梦': 'grounded', '飞行': 'grounded', '浮游': 'grounded', 'levitate': 'grounded', 'ground': 'grounded',
    '替身': 'substitute', 'substitute': 'substitute', 'sub': 'substitute'
};

var KNOWLEDGE = buildKnowledgeIndex();

function buildKnowledgeIndex() {
    var map = {};
    for (var id in MECHANICS) {
        if (id === 'meta') continue;
        var v = MECHANICS[id];
        map[id] = { title: v.name || id, text: flattenTip(v, '') };
    }
    return map;
}

function getKnowledge(args) {
    return lookupEntries(KNOWLEDGE, KNOWLEDGE_ALIASES, args.topics || [], 10);
}

// ===== get_move_info：查招式详情 + tag（数据来自 knowledge/moves.json）=====
var MOVE_TAGS = {
    touch: '接触类：会触发对手的接触类特性（鲨鱼皮/静电/火焰之躯/孢子/毒刺/木乃伊/铁刺/黏滑等），也会被凸凸头盔反伤。',
    voice: '声音类：被隔音（Soundproof）特性免疫；Gen6+ 可穿过替身。',
    ironFist: '拳类：受铁拳（Iron Fist）特性加成，威力×1.2。',
    reckless: '反伤类：受舍身（Reckless）特性加成，威力×1.2。',
    strongJaw: '咬类：受强壮之颚（Strong Jaw）特性加成，威力×1.5。',
    megaLauncher: '波导类：受超级发射器（Mega Launcher）特性加成，威力×1.5。'
};

function findMove(name) {
    var lname = String(name).trim().toLowerCase();
    if (/^\d+$/.test(lname) && MOVES[lname]) return { num: lname, move: MOVES[lname] };
    for (var num in MOVES) {
        var mv = MOVES[num];
        if (mv.name.toLowerCase() === lname) return { num: num, move: mv };
        if (mv.name_zh === name) return { num: num, move: mv };
    }
    return null;
}

function getMoveInfo(args) {
    var name = args.move || args.name;
    if (!name) return { error: 'missing move name' };
    var found = findMove(name);
    if (!found) return { error: 'unknown move: ' + name };
    var mv = found.move;
    var tagMeanings = {};
    for (var i = 0; i < mv.tags.length; i++) {
        var t = mv.tags[i];
        if (MOVE_TAGS[t]) tagMeanings[t] = MOVE_TAGS[t];
    }
    var out = {
        num: found.num,
        name: mv.name,
        name_zh: mv.name_zh,
        desc: mv.desc || '',
        power: mv.power,
        accuracy: mv.accuracy,
        category: mv.category,
        type: mv.type,
        priority: mv.priority,
        tags: mv.tags,
        tag_meanings: tagMeanings
    };
    // 附加效果数值（为 0 的字段不输出，避免噪音）
    if (mv.effect_chance) out.effect_chance = mv.effect_chance;   // 附加效果触发概率 %
    if (mv.flinch_chance) out.flinch_chance = mv.flinch_chance;   // 畏缩概率 %
    if (mv.healing) out.healing = mv.healing;                     // 回复/自损 %（负值=自损）
    if (mv.crit_rate) out.crit_rate = mv.crit_rate;               // 暴击等级（>=1 为高暴击）
    return out;
}

// ===== get_ability_info：查特性详情 + 触发提示（数据来自 knowledge/abilities.json + ability_signals.json）=====
function getAbilityInfo(args) {
    var name = args.ability || args.name;
    if (!name) return { error: 'missing ability name' };
    var lname = String(name).trim().toLowerCase();
    var num = null;
    if (/^\d+$/.test(lname) && ABILITIES.byNum[lname]) num = lname;
    if (!num) num = ABILITIES.byName[lname];
    if (!num) num = ABILITIES.byName[String(name).trim()];
    if (!num) {
        var del = null;
        if (ABILITIES.deleted) {
            var raw = String(name).trim();
            if (ABILITIES.deleted[lname]) del = ABILITIES.deleted[lname];
            else if (ABILITIES.deleted[raw]) del = ABILITIES.deleted[raw];
            else {
                for (var k in ABILITIES.deleted) {
                    var d = ABILITIES.deleted[k];
                    if (d.name_zh === raw || d.name.toLowerCase() === lname) { del = d; break; }
                }
            }
        }
        if (del) {
            return { num: null, name: del.name, name_zh: del.name_zh, desc: del.desc, merged: null, signal: null, deleted: true, note: del.note };
        }
        return { error: 'unknown ability: ' + name };
    }

    var a = ABILITIES.byNum[num];
    return {
        num: num,
        name: a.name,
        name_zh: a.name_zh || '',
        desc: a.desc_zh || a.desc_en || '',
        merged: a.merged || null,
        signal: ABILITY_SIGNALS[num] || null
    };
}

// ===== get_item_info：查道具详情（数据来自 knowledge/items.json）=====
function getItemInfo(args) {
    var name = args.item || args.name;
    if (!name) return { error: 'missing item name' };
    var lname = String(name).trim().toLowerCase();
    var num = null;
    if (/^\d+$/.test(lname) && ITEMS.byNum[lname]) num = lname;
    if (!num) num = ITEMS.byName[lname];
    if (!num) num = ITEMS.byName[String(name).trim()];
    if (!num) return { error: 'unknown item: ' + name };

    var a = ITEMS.byNum[num];
    return {
        num: num,
        name: a.name,
        name_zh: a.name_zh || '',
        desc: a.desc_zh || a.desc_en || '',
        has_msg: a.has_msg || false
    };
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
    if (name === 'calc_stats') return calcStats(args);
    if (name === 'get_my_stats') return getMyStats(args, ctx);
    if (name === 'battle_tips') return battleTips(args);
    if (name === 'get_knowledge') return getKnowledge(args);
    if (name === 'get_move_info') return getMoveInfo(args);
    if (name === 'get_ability_info') return getAbilityInfo(args);
    if (name === 'get_item_info') return getItemInfo(args);
    return { error: 'unknown tool: ' + name };
}

module.exports = {
    TYPE_NAMES: TYPE_NAMES,
    CHART: CHART,
    typeIndex: typeIndex,
    TOOL_DEFS: TOOL_DEFS,
    runTool: runTool
};
