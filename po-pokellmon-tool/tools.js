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
var LEARNSETS = require('./knowledge/learnsets.json');   // 学习面（pokemon-showdown Gen8 过滤 + 合并 prevo/形态 ∪ PO Gen8 all_moves）

var TYPE_NAMES = TYPECHART.types;   // 18 个属性名，与主脚本 sys.type 顺序对齐
var CHART = TYPECHART.chart;        // 18x18 克制矩阵

function typeIndex(name) {
    return TYPE_NAMES.indexOf(name);
}
// 招式属性对防御方类型的总倍率（0 = 真免疫，null = 查不到）。
// 只用于区分「真的免疫」和「计算器算不出这类招的伤害（固定伤害/依赖当前 HP）」—— 两者都返回 0。
function typeMultOf(mvType, defTypes) {
    if (!mvType || !defTypes || !defTypes.length) return null;
    var ai = typeIndex(mvType);
    if (ai < 0) return null;
    var m = 1;
    for (var i = 0; i < defTypes.length; i++) {
        var di = typeIndex(defTypes[i]);
        if (di < 0) return null;
        m *= CHART[ai][di];
    }
    return m;
}

// ===== 官方伤害计算器（@smogon/calc，内嵌于 vendor/，MIT）=====
// calc_damage 的引擎：特性/道具/天气/场地/光墙/状态等修正全部由它算，避免手工移植遗漏。
// 详见 vendor/smogon-calc/README.md（含 gen8 数据校验与升级方式）。
var SMOGON = require('./vendor/smogon-calc/index.js');
var PKLM_GEN = 8;   // PO 环境 = Gen8 单打
var STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
// 计算器只认 PS 的短名（'Sun' / 'Grassy' / 'Harsh Sunshine'），不认识 'Grassy Terrain'、'Harsh Sunlight' 这类
// 「带后缀的全名」——传错会**静默不生效**（伤害照常返回、只是少了那一份）。po-script 的 state.weather/terrain
// 恰好是全名（'Grassy Terrain' / 'Harsh Sunlight'），所以别名表必须覆盖它们。
var PS_WEATHER_ALIAS = { 'sunny': 'Sun', 'sun': 'Sun', 'rain': 'Rain', 'rainy': 'Rain', 'sand': 'Sand', 'sandstorm': 'Sand', 'snow': 'Snow', 'hail': 'Snow', 'harsh sunshine': 'Harsh Sunshine', 'harsh sunlight': 'Harsh Sunshine', 'heavy rain': 'Heavy Rain', 'strong winds': 'Strong Winds', '晴天': 'Sun', '日照': 'Sun', '雨天': 'Rain', '下雨': 'Rain', '沙暴': 'Sand', '冰雹': 'Snow', '下雪': 'Snow', '大晴天': 'Harsh Sunshine', '大雨': 'Heavy Rain' };
var PS_TERRAIN_ALIAS = { 'electric': 'Electric', 'grassy': 'Grassy', 'misty': 'Misty', 'psychic': 'Psychic', 'electric terrain': 'Electric', 'grassy terrain': 'Grassy', 'misty terrain': 'Misty', 'psychic terrain': 'Psychic', '电气': 'Electric', '青草': 'Grassy', '薄雾': 'Misty', '精神': 'Psychic', '电气场地': 'Electric', '青草场地': 'Grassy', '薄雾场地': 'Misty', '精神场地': 'Psychic' };
// 计算器真正认得的取值（用于「传了却没被识别」的提示）
var PS_WEATHER_NAMES = ['Sand', 'Sun', 'Rain', 'Hail', 'Snow', 'Harsh Sunshine', 'Heavy Rain', 'Strong Winds'];
var PS_TERRAIN_NAMES = ['Electric', 'Grassy', 'Misty', 'Psychic'];

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
                    threat: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Your current read of how dangerous this pokemon is TO ME (High/Medium/Low). Always include it and revise it whenever new information changes how much it threatens my team — a new revealed move, item or set can move it up or down.' },
                    append: { type: 'boolean', description: 'If true, append to the existing note instead of overwriting. Default false.' }
                },
                required: ['pokemon', 'text', 'threat']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'save_strategy',
            description: 'Record this turn\'s strategy note. All three fields are required. `text` — answer these labeled lines, short: (1) ATTACK? — is the opponent likely to attack, with what? Name 2-3 candidate moves, say which you expect, how confident you are and on what that confidence rests. Two things must shape it: (a) DO NOT assume it uses the highest-damage move against your active pokemon — especially when you know little about its set (a safe/utility move or unshown coverage is often just as likely); (b) it is playing against what it expects YOU to do, so a move that punishes your planned action (e.g. a Dark move aimed at the Ghost you are about to switch in) is likelier than its raw frequency in its movepool suggests. (2) SWITCH? — is it likely to switch, to whom (only from revealed pokemon + their HP/status)? (3) THEIR READ OF ME — what does it know about my team, what will it treat as a threat or ignore? (4) MY OPTIONS & THE COST OF SWITCHING — for any VOLUNTARY switch, work through all of it: (a) the cost — you forfeit this turn, the switch-in eats the opponent\'s move, and it may ALSO take entry-hazard damage coming in; (b) how much do you actually GAIN — does the switch-in force a kill, start a setup, or chunk/KO a dangerous threat, or can it only chip? (c) how confident are you in your read of their action this turn, and on what basis (their set, what they think you will do, their revealed habits)? (d) are you already behind — do you only win if they play exactly what you predicted, or by assuming an unrevealed high-threat move is not carried, or by hoping they make a mistake? (e) is there a steadier line — a switch-in that takes little (or heals / can stall), or simply attacking? Only skip this when the opponent\'s action is genuinely forced (e.g. it is Choice-locked into a move you already know). (5) MOST LIKELY ACTION + MY RESPONSE — the single most likely opponent action, my best reply, and what would falsify the read. (6) ACTION SEQUENCE UNTIL MY NEXT DECISION — in order, everything that happens from now until your next decision, respecting speed/priority. PURPOSE: this step exists to SPOT DANGER, not to avoid losing pokemon. If every option gets your active pokemon killed anyway, pick the most valuable one (fire off its last hit, trade it for a kill) — never drag the team into a worse position just to keep it alive. `scene` — the board you EXPECT at your next decision (both active pokemon with HP ranges, who is fainted, and any relevant item / ability / boost / hazard / weather state). It is carried into your next prompt and compared against what actually happened. `checks` — what your later turns must VERIFY against the battle log: your uncertain assumptions, written as tests with what would confirm or refute each. REPLACEMENT MODE: if the prompt NOTE says your pokemon has fainted and you are only choosing a replacement, do NOT answer (1)(2)(5)(6); instead answer (R1) what the replacement must survive (a forced replacement happens in the end-of-turn phase, so the opponent gets NO extra action), (R2) each candidate: can it take that hit plus entry hazards, and what can it do on the very next turn, (R3) your pick. Still fill `scene` and `checks`.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Labeled lines (1)-(6) as described — or the (R1)-(R3) replacement template when picking a replacement. Not carried over to later turns.' },
                    scene: { type: 'string', description: 'The board you EXPECT at your next decision: both HP ranges, who is fainted, key item/ability/boost/hazard/weather state. Carried into your next prompt and compared with reality.' },
                    checks: { type: 'string', description: 'Assumptions your later turns must verify against the battle log, written as tests (e.g. "verify X hits harder than I assumed, refuted if <40%"; "check whether X is really faster"). The most recent TWO turns\' checks are merged into later prompts; drop ones already resolved.' },
                    action: { type: 'string', description: 'The action this plan commits to, in the same form simulate_turn takes: "move Thunderbolt" or "switch 3". Must match an i_do you already simulated.' },
                    branch: { type: 'string', description: 'Which opponent branch your plan is playing around: "Hydro Pump" / "switch 2" — one of the opp_does entries you simulated.' },
                    outcome: { type: 'string', description: 'What happens to the pokemon YOUR action puts on the field, under that branch: "survives" / "faints" / "<a-b>%" (its remaining HP or the damage it takes). This is checked against the simulation, so state it honestly — a sacrifice play is fine as long as you write "faints".' }
                },
                required: ['text', 'scene', 'checks']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'predict',
            description: 'COMMIT to a number BEFORE you compute it. Register every quantitative assumption your plan depends on as a claim, then verify it by calling the matching tool with that claim_id (calc_damage for damage/existing HP, calc_stats for speed, get_type_matchup for a defensive/offensive multiplier). The tool returns MATCH or MISMATCH against what you predicted. WHY THIS EXISTS: a number you assert must be either verified or flagged as wrong — never invented. Every claim you register must end MATCH before save_strategy will accept your plan, and the action you finally choose must carry at least one MATCHed claim about the pokemon it puts on the field (the switch-in for a switch, the active mon for an attack). If a claim comes back MISMATCH, your number was wrong: fix the plan so it is consistent with the computed value and re-verify (register a new claim if the prediction itself changes). Do NOT skip this to save a round — an unverified claim blocks the plan.',
            parameters: {
                type: 'object',
                properties: {
                    claims: {
                        type: 'array',
                        description: 'One entry per quantitative assumption your plan relies on.',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', description: 'Short handle, e.g. "c1". You pass it back as claim_id when verifying.' },
                                kind: { type: 'string', description: 'damage (my move\'s output) | survive (the incoming hit on one of my pokemon) | type (a defensive/offensive multiplier) | order (who moves first)' },
                                on_slot: { type: 'integer', description: 'Which of MY pokemon this is about, by team slot (0 = the active one, 1-5 = bench). Required for survive/order so the gate can tie it to your action.' },
                                move: { type: 'string', description: 'The move involved, when the claim is about one.' },
                                about: { type: 'string', description: 'Free text, e.g. "my Rotom-Heat vs their Pelipper".' },
                                expects: { type: 'string', description: 'Your prediction, concretely: "22-26%", "~45%", "OHKO", "survives", "2x", "neutral", "I move first". Vague wording cannot be verified and will be treated as unverified.' }
                            },
                            required: ['id', 'kind', 'expects']
                        }
                    }
                },
                required: ['claims']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'simulate_turn',
            description: 'Simulate THIS turn for the branches YOU name: give your action and one or more candidate opponent actions, and get back what the engine computes for each branch (who acts first, damage both ways, resulting HP, who faints, each move\'s accuracy) plus an explicit list of what it could NOT know. Accuracy is weather-adjusted (Hurricane/Thunder are 100% in rain, 50% in sun; Blizzard never misses in hail/snow), and a move under 100% gets an explicit note that it can miss — a branch that only kills you because a low-accuracy move connects is NOT the same as a guaranteed kill. Use it BEFORE you commit: save_strategy checks your stated outcome against this table, so a number you did not simulate is a number you cannot use. It only projects the current turn from the live board — for later turns, state assumptions in `assume`. The branch list is yours to provide: this tool never guesses what the opponent carries, and it never ranks your options.',
            parameters: {
                type: 'object',
                properties: {
                    i_do: { type: 'object', description: 'Your action: {"move":"Thunderbolt"} or {"switch":3} (your team slot, 0 = active).' },
                    opp_does: { type: 'array', description: 'Up to 8 candidate opponent actions for this turn: [{"move":"Hydro Pump"},{"switch":2}, ...] — list every branch you are relying on.', items: { type: 'object' } },
                    assume: { type: 'object', description: 'Assumptions the state does not know, e.g. {"opp_spread":"252 HP / 0 SpD"} or {"opp_spread_off":"Modest 252 SpA"} — they are reported back so a wrong assumption is visible, not silent.' }
                },
                required: ['i_do', 'opp_does']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_worklog',
            description: 'Set/OVERWRITE the WORKLOG for the CURRENT turn — a running scratchpad of your working state, which stays in your context for the rest of this turn. Use it like a harness worklog to make your reasoning explicit and durable even without a thinking channel: (a) after reading the battle state, write the task you are solving and how you break it into steps; (b) after each tool call, refresh it with what you confirmed, how your plan changed, and what is still open; (c) mark it done when you commit to an action. Because it is overwritten, always write the FULL current state, not a delta. It is cleared at the start of every new turn.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Full worklog text (replaces the previous one). Suggested shape: Goal / Steps / Confirmed / Open / Next action.' }
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
            description: 'Report a problem or a gap to the developer. Call it ONLY when (a) a tool result disagrees with what the battle log shows (e.g. calc_damage off by roughly 2x with no modifier to explain it, or a state field that contradicts the log), or (b) you wanted a tool that does not exist. Do NOT use it to jot down ordinary decisions, notes, or "no issue" remarks — use save_strategy for your plans and save_observation for opponent facts.',
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
            description: 'Compute the damage range of up to 10 attacker/defender/move combinations. Uses the official Pokemon Showdown calculator (@smogon/calc, Gen 8) internally, so abilities / items / weather / terrain / screens / status / criticals / stat-substitution moves / multi-hit / Fishious Rend doubling are all handled automatically — just name them. **PREFER `from_state`**: pass attacker.from_state="me" / defender.from_state="opp" and the battle state fills the numbers for you (my side: level/EV/IV/nature/boosts/item/ability/HP%; opponent: boosts/HP%/status + only its revealed item and log-confirmed ability) — far safer than typing them. `detail.inputs_used` echoes exactly which values were used and where each came from. If you use `from_state` on only ONE side, the OTHER side keeps the values you wrote yourself (it is never silently swapped to your own pokemon) and is only topped up where you left a field empty — still, writing it on both sides (e.g. `attacker.from_state:"opp"` + `defender.from_state:"me"` to calc the opponent hitting you) is the cleanest and safest. Returns min/max damage, % of the defender max HP, a PS-style one-line summary (e.g. "252+ Atk Urshifu Wicked Blow (80 BP) vs. 252 HP / 252+ Def Corviknight: 153-180 (38.2 - 45%) -- guaranteed 3HKO"), a KO verdict against the defender CURRENT HP, and `detail.applied` listing which modifiers the calculator actually recognised. TWO WAYS to describe extra effects, NEVER both at once: (1) PREFERRED — name them (`attacker.ability` / `attacker.item` / `attacker.status` / `defender.ability` / `defender.item` / `defender.status` / `field.*`, all of which `from_state` fills for you); (2) fallback `extra` = a single manual final multiplier for something the calculator cannot express. Passing `extra` together with any modifier input returns an error. IMPORTANT: if you type the numbers yourself, always include ev + nature for both sides — when omitted the calculator falls back to 0 EV / neutral nature and flags `assumed: true` (a wrong default once made a 44% hit look like 13%).',
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
                                        from_state: { type: 'string', description: 'RECOMMENDED: take this side straight from the live battle state instead of typing the numbers. Values: "me" / "opp" = the CURRENTLY ACTIVE pokemon; "me:3" / "opp:2" = a specific TEAM SLOT (0-5, slot 0 = my lead). Bench pokemon have no stat stages (reset on switch-in), so their boosts are taken as 0. What the state can supply: my side = full data (level/EV/IV/nature/boosts/item/ability/HP%); opponent = only what has been revealed (name once seen, HP%/status/boosts while active, log-confirmed ability, revealed item). PRIORITY RULE: values the state KNOWS always win (marked "OVERRIDES your value" in detail.inputs_used); values the state CANNOT know (opponent EV/IV/nature/level, unresolved ability/item) keep whatever you pass — so you may hand-fill an opponent spread you deduced from damage rolls.' },
                                        level: { type: 'integer', description: 'Level, default 100' },
                                        ev: { type: 'array', items: { type: 'number' }, description: 'EVs [HP,Atk,Def,SpA,SpD,Spe], default all 0' },
                                        iv: { type: 'array', items: { type: 'number' }, description: 'IVs [HP,Atk,Def,SpA,SpD,Spe], default all 31' },
                                        nature: { type: 'string', description: 'Nature name (English or Chinese) or number, default neutral' },
                                        boosts: { type: 'object', description: 'Stat stages, e.g. {"atk":1,"spa":-1}', additionalProperties: { type: 'integer' } },
                                        atk: { type: 'number', description: 'Direct UNBOOSTED Attack stat (bypasses the base-stat/EV/IV/nature derivation). Existing stat-stage boosts in `boosts` are still applied on top. Use the number from get_my_stats.' },
                                        spa: { type: 'number', description: 'Direct UNBOOSTED Special Attack stat (boosts still applied on top).' },
                                        def: { type: 'number', description: 'Direct UNBOOSTED Defense stat (boosts still applied on top); also used as the offensive stat of Body Press.' },
                                        spe: { type: 'number', description: 'Direct final Speed stat (bypasses calculation); also used by Fishious Rend / Bolt Beak doubling.' },
                                        ability: { type: 'string', description: 'Ability name in English, e.g. "Huge Power", "Adaptability", "Guts". Applied automatically (attack/defence/base-power/final-damage chains).' },
                                        item: { type: 'string', description: 'Held item in English, e.g. "Choice Band", "Life Orb", "Expert Belt", "Choice Specs". Applied automatically. Do not pass an item together with a manual `extra`.' },
                                        status: { type: 'string', enum: ['brn', 'par', 'slp', 'frz', 'psn', 'tox'], description: 'Major status: brn (burn, halves Physical damage), etc. Burn has the same effect as the `burn` flag.' },
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
                                        from_state: { type: 'string', description: 'RECOMMENDED: take this side straight from the live battle state. Same values as the attacker: "me"/"opp" = active pokemon, "me:3"/"opp:2" = a team slot 0-5 (bench). Same PRIORITY RULE: state-known values win (marked "OVERRIDES your value"); state-unknown values (opponent EV/IV/nature/level, unresolved ability/item) keep your input. Also note the SCREENS in field are taken from the DEFENDER side. See detail.inputs_used.' },
                                        level: { type: 'integer', description: 'Level, default 100' },
                                        ev: { type: 'array', items: { type: 'number' }, description: 'EVs [HP,Atk,Def,SpA,SpD,Spe], default all 0' },
                                        iv: { type: 'array', items: { type: 'number' }, description: 'IVs [HP,Atk,Def,SpA,SpD,Spe], default all 31' },
                                        nature: { type: 'string', description: 'Nature name or number, default neutral' },
                                        boosts: { type: 'object', description: 'Stat stages, e.g. {"def":1}', additionalProperties: { type: 'integer' } },
                                        atk: { type: 'number', description: 'Direct UNBOOSTED Attack stat (boosts still applied on top); also used as the offensive stat of Foul Play.' },
                                        def: { type: 'number', description: 'Direct UNBOOSTED Defense stat (boosts still applied on top).' },
                                        spd: { type: 'number', description: 'Direct UNBOOSTED Special Defense stat (boosts still applied on top).' },
                                        spe: { type: 'number', description: 'Direct UNBOOSTED Speed stat (boosts still applied on top); also used by Fishious Rend / Bolt Beak doubling.' },
                                        hp: { type: 'number', description: 'Direct max HP (bypasses calculation), used for the damage %.' },
                                        curHp: { type: 'number', description: 'Current remaining HP (absolute). Give it to get a KO verdict against the remaining HP instead of full HP.' },
                                        hpPct: { type: 'number', description: 'Current remaining HP as a percentage (0-100); used if curHp is not given.' },
                                        ability: { type: 'string', description: 'Ability name in English, e.g. "Multiscale", "Filter", "Thick Fat", "Fur Coat", "Marvel Scale", "Intimidate" is NOT a damage ability. Applied automatically.' },
                                        item: { type: 'string', description: 'Held item in English, e.g. "Assault Vest", "Eviolite", "Leftovers" (no damage effect), "Shuca Berry". Applied automatically.' },
                                        status: { type: 'string', enum: ['brn', 'par', 'slp', 'frz', 'psn', 'tox'], description: 'Major status (matters e.g. for Marvel Scale: a statused defender gets 1.5x Def on Physical hits).' },
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
                                extra: { type: 'number', description: 'Fallback ONLY: a single manual final-damage multiplier the calculator cannot express (e.g. 0.75 for a damage-reducing effect it does not know). MUST NOT be combined with ability / item / status / burn / field — those are computed automatically, and passing both returns an error. Do not use it for critical hits (use isCrit) or burn (use burn).' },
                                field: {
                                    type: 'object',
                                    description: 'Field conditions (weather / terrain / screens). All computed automatically by the calculator.',
                                    properties: {
                                        weather: { type: 'string', description: '"Sun" (Sunny Day), "Rain", "Sand" (Sandstorm), "Snow" (Hail). Also accepts "Harsh Sunshine" / "Heavy Rain" and the long/Chinese forms ("Sandstorm", "Harsh Sunlight", "沙暴" / "晴天" ...).' },
                                        terrain: { type: 'string', description: '"Electric", "Grassy", "Misty", "Psychic" (also accepts the long/Chinese forms: "Grassy Terrain", "青草场地" ...).' },
                                        reflect: { type: 'boolean', description: 'Reflect is up on the DEFENDER side (halves incoming Physical damage unless the attacker crits).' },
                                        lightScreen: { type: 'boolean', description: 'Light Screen on the DEFENDER side (halves incoming Special damage unless the attacker crits).' },
                                        auroraVeil: { type: 'boolean', description: 'Aurora Veil on the DEFENDER side (halves both, unless the attacker crits).' },
                                        helpingHand: { type: 'boolean', description: 'Attacker is helped by Helping Hand (1.5x). Singles only rarely.' }
                                    },
                                    required: []
                                },
                                isCrit: { type: 'boolean', description: 'Force / forbid a critical hit. Omit to let the calculator auto-detect always-critical moves (Wicked Blow, Surging Strikes, Storm Throw, Frost Breath).' },
                                burn: { type: 'boolean', description: 'Attacker is burned (halves Physical damage; still applies even on a critical hit in Gen 3+).' },
                                hits: { type: 'integer', description: 'Number of hits to total (e.g. 3 for Surging Strikes). Defaults to the move\'s fixed hit count; multi-hit 2-5 moves are shown per hit unless you pass hits.' },
                                attackerMovesFirst: { type: 'boolean', description: 'For Fishious Rend / Bolt Beak only: whether the attacker moves first. If omitted, the calculator compares effective Speed like @smogon/calc.' },
                                targetSwitchedIn: { type: 'boolean', description: 'For Fishious Rend / Bolt Beak only: the target switched in this turn (the game engine doubles the power regardless of Speed; @smogon/calc cannot model this).' },
                                power_multiplier: { type: 'number', description: 'Manual multiplier on the final base power (e.g. 2 for a scenario the calculator cannot infer).' }
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
            description: 'Run a small JavaScript snippet in a sandbox to compute something no built-in tool covers (e.g. speed comparison, batch damage over a set of pokemon, custom scoring). Sandbox exposes: data.pokemon/data.moves/data.natures/data.types/data.typechart, typeMul(attackType, defendTypes), effStat(baseStat, boost?, level?), resolvePokemon(nameOrNum), resolveMove(name), calcDamage(attackerObj, defenderObj, moveObj) (same engine as calc_damage, so attackerObj/defenderObj may carry ability/item/status and moveObj may carry field: {weather,terrain,reflect,lightScreen,auroraVeil}), movePP(moveName) (the move\'s max PP), oppMoves(pokeName) (that opposing pokemon\'s revealed moves as [{name,type,num,used}]), oppUsed(pokeName, moveName) (how many times it has clicked that move — PO does NOT expose the opponent\'s PP, so this counter is all we have; it is a usage count, not remaining PP), and print/console.log for output. The last expression value is returned. Call it only as a last resort, when a computation you need is genuinely not covered by any built-in tool — prefer the built-in tools.',
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
            description: 'Get the current state and final unboosted stats (HP/Atk/Def/SpA/SpD/Spe) of MY pokemon from the actual battle data (real EVs, IVs, nature, level). Each entry also carries `hpPct`, `ko` and `status`, so this is also how you check which of my pokemon are still alive, who has fainted, and how much HP the bench has left. Call it to read your own exact stats before a speed or damage comparison instead of assuming a spread. Specify a pokemon name or slot to get one, or omit to get all six of my team.',
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
            description: 'Look up a move mechanics: power, accuracy, category, type, priority, its battle effect (desc — the concise in-battle effect, e.g. "Burns the target." or "Raises the user\'s Attack by 2 stages."), secondary-effect chance (effect_chance %), flinch chance (%), healing/recoil (% of max HP; negative = self-damage), crit rate (>=1 = high crit), and tags (contact/sound/punch/bite/pulse/recoil) with meanings. Call this when a move decision hinges on its side effects or tags — e.g. to see what a status move actually does, how reliable a secondary effect is, whether contact triggers recoil abilities (Rough Skin/Static/Flame Body), or whether sound immunity blocks it.',
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
            description: 'Look up an ability details: description, whether it triggers a visible message in the battle log (and when), and how to infer/exclude it from the battle log (e.g. via status/type/effect changes). Both `desc` (PO Chinese) and `desc_en` are returned — the Chinese text is sometimes vague, so read `desc_en` for the exact specifics (e.g. Magic Bounce\'s full reflect list: stat/hazard moves, Defog, Roar, Whirlwind, Spite). Call this BEFORE committing to a plan that a single ability could blank (phazing into Magic Bounce, status into an immunity ability, hazards into a bounce/absorb ability), and when the battle log shows — or lacks — a trigger and you want to narrow down which ability it is.',
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
    },
    {
        type: 'function',
        function: {
            name: 'get_pokemon_info',
            description: 'Pokedex lookup for a species: base stats (hp/atk/def/spa/spd/spe + total), type(s), possible abilities (static, so it does not depend on what has been revealed), and weight (kg — needed for weight-based moves: Grass Knot / Low Kick / Heavy Slam / Heat Crash). It also covers the movepool. This returns FACTS, so call it instead of relying on memory whenever a base stat, type, ability list or weight matters — e.g. to check speed/offense before a damage race, or to see which abilities an opponent species could still have. Movepool mode: pass `moves` to test whether the species can legally learn specific moves (returns can_learn per move) — use it whenever the opponent uses a move that surprises you, since a false result means the species is misread or disguised (Illusion / Transform / Mimic / Ditto); pass `full_movepool: true` to list the whole movepool (long — only when you actually need to scan it).',
            parameters: {
                type: 'object',
                properties: {
                    pokemon: { type: 'string', description: 'Pokemon name (English or Chinese) or number. E.g. "Entei", "炎帝", or "244".' },
                    moves: { type: 'array', items: { type: 'string' }, description: 'Optional. Move names (English or Chinese) or numbers to test against this species movepool. E.g. ["Nasty Plot", "Night Daze"].' },
                    full_movepool: { type: 'boolean', description: 'Optional. Set true to return the species entire movepool (may be ~90 moves). Default false.' }
                },
                required: ['pokemon']
            }
        }
    }
];

// 类型克制（移植主脚本 typechart）
function getTypeMatchup(args, ctx) {
    var ai = typeIndex(args.attack_type);
    if (ai < 0) return { error: 'unknown attack_type: ' + args.attack_type };
    var m = 1;
    var types = args.defend_types || [];
    for (var i = 0; i < types.length; i++) {
        var di = typeIndex(types[i]);
        if (di < 0) return { error: 'unknown defend_type: ' + types[i] };
        m *= CHART[ai][di];
    }
    var out = { multiplier: m };
    if (ctx && ctx.ledger) ctx.ledger.typeChecks = (ctx.ledger.typeChecks || 0) + 1;
    var cv = attachClaimVerdict(ctx, args.claim_id, { multiplier: m });
    if (cv) out.claim_verdict = cv;
    return out;
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
    if (!args.threat) return { error: 'threat required (High / Medium / Low — how dangerous this pokemon is to my team)' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    if (!notes.pokemon) notes.pokemon = {};
    if (!notes.threat) notes.threat = {};
    var key = String(args.pokemon);
    if (args.append && notes.pokemon[key]) {
        notes.pokemon[key] = notes.pokemon[key] + ' | ' + String(args.text);
    } else {
        notes.pokemon[key] = String(args.text);
    }
    notes.threat[key] = String(args.threat);
    return { ok: true, pokemon: args.pokemon, threat: String(args.threat), mode: (args.append ? 'append' : 'overwrite') };
}

// ===== 预测账本（门禁 Rule 1 + Rule 4）=====
// 只做两件事：① 强制「你写下的预测必须被工具裁决过」（Rule 1）；② 裁决结果必须与你的预测一致（Rule 4，数字不能编）。
// 明确不做：不判断决策好坏、不判断该不该赌、不建「对手可能带什么招」的表 —— 只查「你说的」与「你算的」是否自洽。
function newLedger() { return { claims: {}, order: [], sims: [], rejections: 0 }; }

function registerClaims(args, ctx) {
    var led = ctx && ctx.ledger;
    if (!led) return { error: 'no ledger (server too old for predict)' };
    var list = args.claims;
    if (!list || !list.length) return { error: 'claims required (at least one)' };
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var c = list[i] || {};
        if (!c.id) return { error: 'claim #' + (i + 1) + ' needs an id' };
        if (!c.expects) return { error: 'claim ' + c.id + ' needs expects (a concrete prediction: "22-26%" / "survives" / "2x" / "I move first")' };
        var id = String(c.id);
        led.claims[id] = {
            id: id,
            kind: String(c.kind || ''),
            about: String(c.about || ''),
            on_slot: (c.on_slot === undefined || c.on_slot === null) ? null : Number(c.on_slot),
            move: c.move ? String(c.move) : '',
            predicted: String(c.expects),
            status: 'unresolved',
            actual: null,
            note: null
        };
        if (led.order.indexOf(id) < 0) led.order.push(id);
        out.push(id);
    }
    return {
        ok: true,
        recorded: out,
        note: 'Now verify each id by calling the matching tool with claim_id: calc_damage (damage / survival), get_type_matchup (multipliers), calc_stats (speed). save_strategy is REJECTED while any claim is unresolved or MISMATCHed.'
    };
}

// claim 摘要（给 save_strategy 的 error 用）
function claimLine(c) {
    return c.id + ' [' + (c.kind || '?') + (c.on_slot === null ? '' : ' slot' + c.on_slot) + (c.move ? ' ' + c.move : '') + '] predicted "' + c.predicted + '"';
}

// 从预测文本里抠数字：支持 "22-26%" / "~45%" / "45%" / "2x" / "0.5x" / "neutral"
function parseExpectNumbers(s) {
    var t = String(s || '').toLowerCase();
    var out = { min: null, max: null, single: null };
    var m = t.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|~|to)\s*(-?\d+(?:\.\d+)?)\s*%/);
    if (m) { out.min = parseFloat(m[1]); out.max = parseFloat(m[2]); return out; }
    var s2 = t.match(/~?\s*(-?\d+(?:\.\d+)?)\s*%/);
    if (s2) { out.single = parseFloat(s2[1]); return out; }
    var s3 = t.match(/~?\s*(-?\d+(?:\.\d+)?)/);
    if (s3) out.single = parseFloat(s3[1]);
    return out;
}

function parseExpectMultiplier(s) {
    var t = String(s || '').toLowerCase();
    if (/immune|no effect|0\s*x/.test(t)) return 0;
    if (/0\.25|1\/4/.test(t)) return 0.25;
    if (/0\.5|1\/2|half|resist/.test(t)) return 0.5;
    if (/4\s*x/.test(t)) return 4;
    if (/2\s*x/.test(t)) return 2;
    if (/neutral|1\s*x/.test(t)) return 1;
    return null;
}

// 把工具算出的实际值挂到 claim 上，给出 MATCH / MISMATCH。
// 解析不出来的预测一律放行（标 unparsed），只拦「能读懂且明确矛盾」的情况——避免解析器误伤导致多跑轮次。
function attachClaimVerdict(ctx, claimId, payload) {
    var led = ctx && ctx.ledger;
    if (!led || claimId === undefined || claimId === null || claimId === '') return null;
    var c = led.claims[String(claimId)];
    if (!c) return { claim_id: String(claimId), status: 'UNKNOWN_CLAIM', note: 'no claim with this id — call predict first' };
    var pred = String(c.predicted);
    var pl = payload || {};
    var status = 'MATCH', note = '';

    if (pl.multiplier !== undefined && pl.multiplier !== null) {
        var pm = parseExpectMultiplier(pred);
        if (pm === null) note = 'prediction not machine-readable — passed';
        else if (Math.abs(pm - pl.multiplier) < 1e-9) note = 'multiplier matches';
        else status = 'MISMATCH';
        c.actual = pl.multiplier + 'x';
    } else if (pl.percent_max !== undefined && pl.percent_max !== null) {
        var pn = parseExpectNumbers(pred);
        var lo = pl.percent_min, hi = pl.percent_max;
        if (pn.min !== null) {
            if (pn.max < lo - 3 || pn.min > hi + 3) status = 'MISMATCH'; else note = 'range matches';
        } else if (pn.single !== null) {
            if (pn.single >= lo - 3 && pn.single <= hi + 3) note = 'value inside computed range'; else status = 'MISMATCH';
        } else if (/ohko|one.?shot/.test(pred.toLowerCase())) {
            if (/ohko/i.test(String(pl.ko || ''))) note = 'OHKO confirmed'; else status = 'MISMATCH';
        } else if (/surviv|live|won.?t ko|not ko|safe/.test(pred.toLowerCase())) {
            if (hi < 100) note = 'survives (max ' + hi + '%)'; else status = 'MISMATCH';
        } else {
            note = 'prediction not machine-readable — passed';
        }
        c.actual = pl.percent_min + '-' + pl.percent_max + '%' + (pl.ko ? ' (' + pl.ko + ')' : '');
    } else if (pl.speed !== undefined && pl.speed !== null) {
        var sn = parseExpectNumbers(pred);
        if (sn.single !== null) {
            if (Math.abs(sn.single - pl.speed) <= 2) note = 'speed matches'; else status = 'MISMATCH';
        } else note = 'prediction not machine-readable — passed';
        c.actual = 'spe ' + pl.speed;
    } else {
        note = 'nothing to compare — passed';
        c.actual = '(no value)';
    }

    c.status = status;
    c.note = note;
    return { claim_id: c.id, status: status, predicted: pred, actual: c.actual, note: note };
}

// 门禁检查（Rule 1）：提交计划时，所有登记过的预测都必须已裁决且一致。
function predictGate(ledger) {
    if (!ledger) return null;
    var unresolved = [], mismatched = [];
    for (var i = 0; i < ledger.order.length; i++) {
        var c = ledger.claims[ledger.order[i]];
        if (!c) continue;
        if (c.status === 'unresolved') unresolved.push(claimLine(c));
        else if (c.status === 'MISMATCH') mismatched.push(c.id + ': you predicted "' + c.predicted + '" but the calculation says ' + c.actual + '  → your number was wrong, fix the plan so it is consistent with the computed value');
    }
    if (unresolved.length) {
        return 'STRATEGY REJECTED — these predictions were never verified. Verify each with the matching tool passing claim_id, or drop it (register an updated claim) if you no longer rely on it:\n - ' + unresolved.join('\n - ');
    }
    if (mismatched.length) {
        return 'STRATEGY REJECTED — your own numbers contradict the calculations. Rewrite the plan so it matches what was computed, re-verify, then save again:\n - ' + mismatched.join('\n - ');
    }
    if (!ledger.order.length) {
        return 'STRATEGY REJECTED — you registered no predictions. Call predict first with the quantitative assumptions your plan relies on (the incoming hit on the pokemon that will be on the field, your own damage output, any type/speed assumption), verify them, then save.';
    }
    return null;
}

// 最终答案前的门禁（Rule 1 的动作层）：你选中的动作，必须挂着一个已裁决(MATCH)的 claim —— 覆盖「你将放到场上那只」。
// 换人时**必须**是承伤类 claim（kind=survive）：因为 save_strategy 的 scene 断言了换入者活到什么血量，
// 那句断言必须被验算过。用「我打它多少」这种输出 claim 不能代替（实测被这么绕过：C 臂 R1/R2）。
function actionGateCheck(ledger, action) {
    if (!ledger || !action) return null;
    var isSwitch = (action.type === 'switch');
    var needSlot = isSwitch ? Number(action.pokeSlot) : 0;
    var unresolved = [], mismatched = [];
    for (var i = 0; i < ledger.order.length; i++) {
        var c = ledger.claims[ledger.order[i]];
        if (!c) continue;
        if (c.status === 'unresolved') unresolved.push(claimLine(c));
        else if (c.status === 'MISMATCH') mismatched.push(c.id + ': you predicted "' + c.predicted + '" but the calculation says ' + c.actual);
    }
    if (unresolved.length || mismatched.length) {
        var msgs = [];
        if (unresolved.length) msgs.push('still unverified: ' + unresolved.join('; '));
        if (mismatched.length) msgs.push('contradicted by your own calculation: ' + mismatched.join('; '));
        return 'NOT READY — ' + msgs.join(' | ') + ' Fix or verify them, re-save the strategy, then answer.';
    }
    var hit = false;
    for (var j = 0; j < ledger.order.length; j++) {
        var c2 = ledger.claims[ledger.order[j]];
        if (!c2 || c2.status !== 'MATCH') continue;
        if (Number(c2.on_slot) !== needSlot) continue;
        // 换人：必须是承伤 claim（scene 断言的「它活下来」必须被验算）；攻击：输出或承伤都算
        if (isSwitch) { if (c2.kind === 'survive') { hit = true; break; } }
        else if (c2.kind === 'damage' || c2.kind === 'survive' || c2.kind === 'order') { hit = true; break; }
    }
    if (!hit) {
        if (isSwitch) {
            return 'NOT READY — your plan switches in slot ' + needSlot + ' and your `scene` asserts how much HP it has left, but no verified INCOMING prediction is attached to it. Call predict with kind="survive", on_slot=' + needSlot + ', move=<the move you expect to eat>, expects=<your predicted %>, then verify it with calc_damage passing claim_id (defender = from_state "me:' + needSlot + '"). A claim about YOUR damage output does not cover this.';
        }
        return 'NOT READY — your choice attacks with the active pokemon (slot 0), but no verified prediction is attached to it. Call predict for it (its outgoing damage, or the hit it eats) with on_slot=0, verify it with claim_id, re-save the strategy, then answer.';
    }
    return null;
}

// ===== simulate_turn：单回合分支仿真（幻觉门禁的执行体）=====
// 设计边界（与用户 2026-09-20 讨论确定）：
//   1) 分支由 LLM 指名（i_do / opp_does），服务端只负责算 —— 不建「对手可能带什么招」的表，也不排序/选最优
//   2) 只做「本回合」投影；引用当前实物（from_state）时，系统已知的（我方能力值、天气、场地）以 state 为准
//   3) 必须显式列出 unknown（未暴露的道具/特性、未知 EV、残余伤害、陷阱……）—— 只报算得了的，不假装精确
//   4) 合法性只做 soft check：学习面外 → 提示「可能是伪装 / 误读」（保留 Illusion / Ditto 的可能），不硬拒
function sideSpec(s) {
    if (!s || typeof s !== 'object') return { error: 'must be {"move":"X"} or {"switch":<slot>}' };
    var hasMv = (s.move !== undefined && s.move !== null);
    var hasSw = (s.switch !== undefined && s.switch !== null);
    if (hasMv && hasSw) return { error: 'give only one of "move" / "switch"' };
    if (hasMv) return { kind: 'move', move: String(s.move) };
    if (hasSw) {
        var n = Number(s.switch);
        if (isNaN(n)) return { error: '"switch" must be a team slot number' };
        return { kind: 'switch', slot: n };
    }
    return { error: 'needs either "move" or "switch"' };
}
function actionKey(spec) { return spec.kind === 'move' ? ('move ' + spec.move) : ('switch ' + spec.slot); }
function branchKey(spec) { return spec.kind === 'move' ? spec.move : ('switch ' + spec.slot); }

function slotName(team, slot) {
    for (var i = 0; i < (team || []).length; i++) {
        if (team[i] && Number(team[i].slot) === Number(slot)) return team[i].name || null;
    }
    return null;
}
function slotEntry(team, slot) {
    for (var i = 0; i < (team || []).length; i++) {
        if (team[i] && Number(team[i].slot) === Number(slot)) return team[i];
    }
    return null;
}
// 我方某槽位的已知能力值（state.myStats）与道具名（state.me / state.bench）—— 系统已知，以 state 为准
function myStatOf(state, slot) {
    var arr = (state && state.myStats) || [];
    for (var i = 0; i < arr.length; i++) if (Number(arr[i].slot) === Number(slot)) return arr[i];
    return null;
}
function myItemOf(state, slot) {
    if (Number(slot) === 0) return (state.me || {}).item || null;
    var b = slotEntry(state.bench, slot);
    return (b && b.item) || null;
}
// 对手速度只能用区间（EV/性格未知）：按标准 IV31，0EV/降性格 ~ 252EV/升性格
function oppSpeedRange(pokeName) {
    var r = resolvePokemonInput({ poke: pokeName });
    if (!r || r.error || !r.baseStats) return null;
    var bs = r.baseStats;
    var base = Array.isArray(bs) ? bs[5] : (bs && bs.spe);
    if (base === undefined || base === null) return null;
    return { min: Math.floor((2 * base + 31 + 5) * 0.9), max: Math.floor((2 * base + 31 + 63 + 5) * 1.1) };
}
// 我方速度：state.myStats 只给 ev/iv/nature（没有算好的能力值），必须用 effectiveStat 现算；围巾按已知道具×1.5
function mySpeedOf(state, slot, boosts) {
    var ms = myStatOf(state, slot);
    if (!ms || !ms.name) return null;
    var r = resolvePokemonInput({ poke: ms.name });
    if (!r || r.error || !r.baseStats) return null;
    var spe = null;
    try {
        spe = effectiveStat(r.baseStats, ms.level || 100, ms.ev, ms.iv, resolveNature({ nature: ms.nature }), boosts || {}, 5);
    } catch (e) { return null; }
    if (spe && String(myItemOf(state, slot) || '').toLowerCase().indexOf('choice scarf') >= 0) spe = Math.floor(spe * 1.5);
    return spe;
}
function movePriorityByName(name) {
    var rm = resolveMoveInput({ name: name });
    if (!rm || rm.error || rm.num === undefined || rm.num === null) return 0;
    var rec = MOVES[String(rm.num)] || (MOVES.byNum ? MOVES.byNum[String(rm.num)] : null) || {};
    return Number(rec.priority || 0);
}
function applyFromStateSpec(state, who, slot, extra) {
    var spec = { from_state: who + (slot === null ? '' : ':' + slot) };
    for (var k in (extra || {})) spec[k] = extra[k];
    return spec;
}
function simLeg(state, atkSpec, defSpec, moveName) {
    var r = calcOneLeg({ attacker: atkSpec, defender: defSpec, move: { name: moveName } }, 0, { state: state });
    if (!r || r.percent_max === undefined) return { error: (r && r.error) || 'calc failed' };
    return r;
}

// 招式命中率（含天气修正）：返回 0-100 的数字；101/必中 视作 100；查不到返回 null。
// 天气修正：雨 → Thunder/Hurricane 必中；晴 → Thunder/Hurricane 50%；冰雹/雪 → Blizzard 必中。
// （Hustle / Compound Eyes / No Guard 等改变命中的特性**不建模**——对手特性未暴露，simulate_turn 的 unknown 里会说明。）
function moveAccuracy(name, weather) {
    var rm = resolveMoveInput({ name: name });
    if (!rm || rm.error || rm.num === undefined || rm.num === null) return null;
    var rec = MOVES[String(rm.num)] || (MOVES.byNum ? MOVES.byNum[String(rm.num)] : null) || {};
    var acc = rec.accuracy;
    if (acc === undefined || acc === null) return null;
    acc = Number(acc);
    if (isNaN(acc)) return null;
    if (acc > 100 || acc <= 0) return 100;                       // 101 / 必中
    var w = String(weather || '').toLowerCase();
    var nm = String(rm.name || name).toLowerCase();
    if (nm === 'thunder' || nm === 'hurricane') {
        if (w.indexOf('rain') >= 0) return 100;
        if (w.indexOf('sun') >= 0) return 50;
    }
    if (nm === 'blizzard' && (w.indexOf('snow') >= 0 || w.indexOf('hail') >= 0)) return 100;
    return acc;
}

// 会心率（Gen7+ 表）：crit_rate 0 → 1/24，1 → 1/8，2 → 1/2，≥3（含 6=必会心）→ 必定。
// 注意：simulate_turn **不把 crit 展开成分支**（那会指数爆炸），只把"它没被计入"这件事写清楚。
function moveCritStage(name) {
    var rm = resolveMoveInput({ name: name });
    if (!rm || rm.error || rm.num === undefined || rm.num === null) return null;
    var rec = MOVES[String(rm.num)] || (MOVES.byNum ? MOVES.byNum[String(rm.num)] : null) || {};
    var r = Number(rec.crit_rate || 0);
    if (isNaN(r)) return null;
    if (r >= 6) return 'ALWAYS crits';
    if (r >= 3) return 'crit every time';
    if (r === 2) return 'crit rate 1/2 (50%)';
    if (r === 1) return 'crit rate 1/8 (12.5%)';
    return 'crit rate 1/24 (4.2%)';
}

// 变化招：本表只算伤害 → 变化招会退化成"0% 伤害"，**必须明确标注其真实效果未被建模**，
// 否则那一行会读成"这一支很安全"（工具制造的安全感，比模型自己编更危险）。
function statusMoveNote(name) {
    var rm = resolveMoveInput({ name: name });
    if (!rm || rm.error) return null;
    if (String(rm.category || '').toLowerCase() !== 'status') return null;
    var rec = MOVES[String(rm.num)] || (MOVES.byNum ? MOVES.byNum[String(rm.num)] : null) || {};
    var eff = String(rec.effect || '').replace(/\s+/g, ' ').trim();
    return name + ' is a STATUS move — its effect' + (eff ? ' ("' + eff.slice(0, 90) + '")' : '') +
        ' is NOT modelled here. The row shows 0% damage, which does NOT mean the branch is harmless, and it is NOT a valid basis for declaring "survives": what it actually does (status / hazards / boost / heal) is unknown to this table.';
}

// 异常状态也会让本表的数字失真（睡眠不能动、麻痹速度×0.5、烧伤物攻×0.5、中毒回合末掉血）——
// 现在是**标注**而不是建模（后续若换 PS 引擎会整体取代）。
function statusConditionNote(label, status) {
    if (!status) return null;
    var map = { slp: 'asleep — it may not be able to move at all', par: 'paralysed — its Speed is halved', brn: 'burned — its physical Attack is halved and it loses HP each turn', psn: 'poisoned — it loses HP each turn', tox: 'badly poisoned — it loses increasing HP each turn', frz: 'frozen — it cannot move' };
    var what = map[String(status).toLowerCase()] || String(status);
    return label + ' is ' + what + ' — this is NOT applied to the numbers above';
}

// 「它没想到的」：从对手**学得到的攻击招**里，找出对「我行动后留在场上那只」威胁最大的几个。
// 这是**可能性空间的上界**——只回答"若它带了会怎样"，**不声称它带了或会点**。
// 与"建合理招表"不同：纯逻辑推导（学习面 ∩ 伤害计算），不含任何对配置频率的猜测，所以不需要使用率先验。
function unlistedThreats(state, oppName, mySlot, myHpPct, listed, ctx) {
    if (!oppName) return null;
    var key = resolvePokemonKey(oppName);
    var list = (key && LEARNSETS.byKey[key]) || null;
    if (!list || !list.length) return null;
    var listedLower = {};
    for (var i = 0; i < (listed || []).length; i++) listedLower[String(listed[i]).toLowerCase()] = true;
    var rows = [], checked = 0, skippedVar = 0;
    for (var j = 0; j < list.length; j++) {
        var num = Number(list[j]);
        var me = MOVES[String(num)] || (MOVES.byNum ? MOVES.byNum[String(num)] : null);
        if (!me || !me.name) continue;
        if (String(me.category || '').toLowerCase() === 'status') continue;   // 本表只算伤害，变化招不在此列
        if (listedLower[String(me.name).toLowerCase()]) continue;             // 已经列过的分支不重复
        if (me.variable_power) skippedVar++;
        checked++;
        var r = calcOneLeg({ attacker: applyFromStateSpec(state, 'opp', null), defender: applyFromStateSpec(state, 'me', mySlot), move: { name: me.name } }, 0, ctx);
        if (!r || r.percent_max === undefined) continue;
        if (r.percent_max < 25) continue;   // 只报真有威胁的（≥25%），避免刷屏
        var koTxt = r.ko_verdict || (r.percent_min >= 100 ? 'guaranteed OHKO' : (r.percent_max >= 100 ? 'possible OHKO' : ''));
        rows.push({ move: me.name, type: me.type, dmg: r.percent_min + '-' + r.percent_max + '%', ko: koTxt, faints: (r.percent_min >= 100 ? true : (r.percent_max >= 100 ? 'possible' : false)), _sort: -r.percent_max });
    }
    if (!rows.length) {
        return { attack_moves_checked: checked, note: 'No unlisted attack move from ' + oppName + "'s learnable pool reaches 25% on the pokemon your action leaves on the field." };
    }
    rows.sort(function (a, b) { return a._sort - b._sort; });
    var top = rows.slice(0, 4);
    for (var k = 0; k < top.length; k++) delete top[k]._sort;
    return {
        attack_moves_checked: checked,
        total_reaching_25pct: rows.length,
        unlisted_dangerous: top,
        note: 'Moves ' + oppName + ' CAN LEARN that would do ≥25% to the pokemon your action leaves on the field BECAUSE YOU DID NOT LIST THEM AS BRANCHES. This is NOT a prediction that it carries or clicks them — it is the upper bound of the possibility space. But if any of them is plausibly in its set, your branch list is incomplete: the table above only covers the branches you declared, and so does the gate. Consider adding the plausible ones as branches.',
        caveats: 'Variable-power moves (Grass Knot / Low Kick / Gyro Ball / Foul Play …) use one fixed assumption; ability / item / field modifiers are not applied.' + (skippedVar ? (' (' + skippedVar + ' variable-power moves checked this way.)') : '')
    };
}

function simulateTurn(args, ctx) {
    var state = ctx && ctx.state;
    if (!state) return { error: 'no state' };
    var mine = sideSpec(args.i_do);
    if (mine.error) return { error: 'i_do: ' + mine.error };
    if (mine.kind === 'switch' && Number(mine.slot) === 0) return { error: 'i_do switch 0 is the pokemon already on the field' };
    var opps = args.opp_does;
    if (!opps || !opps.length) return { error: 'opp_does needs at least one branch (the actions you are playing around)' };
    if (opps.length > 8) return { error: 'at most 8 branches, got ' + opps.length };
    var branches = [];
    for (var b = 0; b < opps.length; b++) {
        var sp = sideSpec(opps[b]);
        if (sp.error) return { error: 'opp_does[' + b + ']: ' + sp.error };
        sp.key = branchKey(sp);
        branches.push(sp);
    }

    var myTeam = state.myTeam || [];
    var oppTeam = state.oppTeam || [];
    var opp = state.opp || {};
    var oppActive = opp.name || null;
    var iSwitch = (mine.kind === 'switch');
    var mySlot = iSwitch ? Number(mine.slot) : 0;
    var myName = iSwitch ? (slotName(myTeam, mySlot) || ('slot ' + mySlot)) : (myTeam[0] && myTeam[0].name) || oppActive;
    if (iSwitch && !slotName(myTeam, mySlot)) return { error: 'i_do: my team has no slot ' + mySlot };
    var myHpPct = (function () {
        if (!iSwitch) { var m = slotEntry(myTeam, 0); return m && m.hpPct !== undefined && m.hpPct !== null ? m.hpPct : 100; }
        var b2 = slotEntry(state.bench, mySlot);
        return b2 && b2.hpPct !== undefined && b2.hpPct !== null ? b2.hpPct : 100;
    })();

    var out = {
        my_action: actionKey(mine),
        my_pokemon_on_field_after: myName,
        board: 'weather=' + (state.weather || 'None') + ' terrain=' + (state.terrain || 'None') +
            ' myHazards=' + JSON.stringify(state.myHazards || []) + ' oppHazards=' + JSON.stringify(state.oppHazards || []),
        rows: []
    };

    for (var k = 0; k < branches.length; k++) {
        var br = branches[k];
        var row = { opp: br.key, branchKey: br.key, legal: 'ok', order: '', mine: null, theirs: null, unknown: [], note: '' };

        // ---- 合法性：对手侧 ----
        if (br.kind === 'switch') {
            var te = slotEntry(oppTeam, br.slot);
            if (!te || !te.name || te.revealed === false) { row.legal = 'NOT possible — opponent slot ' + br.slot + ' has not been revealed'; }
            else if (te.ko) { row.legal = 'NOT possible — ' + te.name + ' is fainted'; }
            else if (oppActive && te.name === oppActive) { row.legal = 'NOT possible — ' + te.name + ' is already on the field'; }
        } else {
            var rm = resolveMoveInput({ name: br.move });
            if (rm.error) row.legal = 'unknown move name — ' + br.move;
            else if (oppActive) {
                var gi = getPokemonInfo({ pokemon: oppActive, moves: [rm.name] });
                var chk = (gi && gi.checks && gi.checks[0]) || null;
                if (chk && chk.can_learn === false) {
                    row.legal = 'NOT in ' + oppActive + '\'s movepool';
                    row.note = 'A move outside the movepool does not mean "illegal branch" — it means the species is misread OR this is a disguise (Zoroark/Illusion) or a copied move (Ditto/Transform/Mimic). Re-read the log before relying on this branch.';
                }
            }
        }
        // 受招式合法性：i_do 是 move 时，确认自己这只学得到
        if (mine.kind === 'move') {
            var myRm = resolveMoveInput({ name: mine.move });
            if (myRm.error) return { error: 'i_do move not found: ' + mine.move };
            // 还要确认**当前场上这只**真的有这一招（否则会算出一个不存在的动作）
            var myMoveList = (state.me && state.me.moves) || [];
            if (myMoveList.length) {
                var hasIt = false;
                for (var mm = 0; mm < myMoveList.length; mm++) {
                    if (String(myMoveList[mm].name || '').toLowerCase() === String(myRm.name).toLowerCase()) { hasIt = true; break; }
                }
                if (!hasIt) {
                    return { error: 'i_do "' + mine.move + '" is not a move your active pokemon (' + ((state.me || {}).name || '?') + ') has. Available: ' + myMoveList.map(function (x) { return x.name; }).join(', ') };
                }
            }
        }

        var oppAfterName = oppActive;
        if (br.kind === 'switch') oppAfterName = slotName(oppTeam, br.slot) || oppActive;

        // ---- 出手顺序：PO 的换人阶段先于出招阶段 ----
        // orderModes = 谁先动：['you'] / ['they'] / ['you','they']（速度重叠或解析不出时**两种情况都算**，不猜）
        var orderModes = [];
        if (iSwitch || br.kind === 'switch') {
            if (iSwitch && br.kind === 'switch') { row.order = 'both switch (switch phase): no damage either way this turn'; orderModes = ['none']; }
            else if (iSwitch) { row.order = 'you switch first (switch phase), then they act — your switch-in eats the hit'; orderModes = ['they']; }
            else { row.order = 'they switch first (switch phase), then your move lands on the pokemon they bring in'; orderModes = ['you']; }
        } else {
            var myPrio = movePriorityByName(mine.move), theirPrio = movePriorityByName(br.move);
            var mySpe = mySpeedOf(state, 0, null);
            var osr = oppSpeedRange(oppActive);
            if (myPrio !== theirPrio) {
                var prioYou = (myPrio > theirPrio);
                row.order = (prioYou ? 'you move first' : 'they move first') + ' (priority ' + myPrio + ' vs ' + theirPrio + ')';
                orderModes = [prioYou ? 'you' : 'they'];
            } else if (mySpe && osr) {
                if (mySpe > osr.max) { row.order = 'you move first (your spe ' + mySpe + ' vs their ' + osr.min + '-' + osr.max + ')'; orderModes = ['you']; }
                else if (mySpe < osr.min) { row.order = 'they move first (your spe ' + mySpe + ' vs their ' + osr.min + '-' + osr.max + ')'; orderModes = ['they']; }
                else {
                    row.order = 'speed UNRESOLVED: your spe ' + mySpe + ' is inside their possible range ' + osr.min + '-' + osr.max + ' → BOTH orders simulated (see cases[])';
                    orderModes = ['you', 'they'];
                }
            } else {
                row.order = 'speed unknown (could not resolve) → BOTH orders simulated (see cases[])';
                orderModes = ['you', 'they'];
            }
            if (osr) row.unknown.push('opponent speed range ' + osr.min + '-' + osr.max + ' (EV/nature unrevealed)');
        }

        // ---- 伤害 ----
        if (iSwitch) {
            if (br.kind === 'move') {
                var legA = simLeg(state, applyFromStateSpec(state, 'opp', null), applyFromStateSpec(state, 'me', mySlot), br.move);
                if (legA.error) row.unknown.push('incoming damage could not be computed (' + legA.error + ')');
                else {
                    var hpLo = Math.round(myHpPct - legA.percent_max), hpHi = Math.round(myHpPct - legA.percent_min);
                    row.mine = { takes: legA.percent_min + '-' + legA.percent_max + '%', hp_after: hpLo + '-' + hpHi + '%', faints: (hpHi <= 0 ? true : (hpLo <= 0 ? 'possible' : false)), summary: myName + ' takes ' + legA.percent_min + '-' + legA.percent_max + '% from ' + br.move + ' → ' + hpLo + '-' + hpHi + '% left' };
                }
            } else {
                row.mine = { takes: '0%', hp_after: myHpPct + '%', faints: false, summary: myName + ' comes in untouched (they also switched)' };
            }
            row.unknown.push('entry hazards on your side are NOT applied here (' + JSON.stringify(state.myHazards || []) + ')');
        } else {
            // 我出招 + 他们出招 → 两边都算，并按 orderModes 逐种顺序给出结果
            if (br.kind === 'move') {
                var legOut = simLeg(state, applyFromStateSpec(state, 'me', null), applyFromStateSpec(state, 'opp', null), mine.move);
                var legIn2 = simLeg(state, applyFromStateSpec(state, 'opp', null), applyFromStateSpec(state, 'me', null), br.move);
                if (legOut.error) row.unknown.push('your outgoing damage could not be computed (' + legOut.error + ')');
                if (legIn2.error) row.unknown.push('incoming damage could not be computed (' + legIn2.error + ')');
                if (!legOut.error && !legIn2.error) {
                    var theirHp = (opp.hpPct === undefined || opp.hpPct === null) ? 100 : opp.hpPct;
                    row.theirs = { takes: legOut.percent_min + '-' + legOut.percent_max + '%', ko: legOut.ko_verdict || '', summary: oppActive + ' takes ' + legOut.percent_min + '-' + legOut.percent_max + '% from ' + mine.move };
                    row.cases = [];
                    var worstCase = null;
                    for (var oc = 0; oc < orderModes.length; oc++) {
                        var first = orderModes[oc];
                        // 先动的一方如果直接把对手打倒下，对手就**不会还手**（这是顺序真正影响结果的地方）
                        var takeMin = legIn2.percent_min, takeMax = legIn2.percent_max;
                        var dealTxt = legOut.percent_min + '-' + legOut.percent_max + '%';
                        var extra = [];
                        if (first === 'you') {
                            if (legOut.percent_min >= theirHp) { takeMin = 0; takeMax = 0; extra.push(oppActive + ' faints before it can act'); }
                            else if (legOut.percent_max >= theirHp) extra.push('if your roll KOs it (' + legOut.percent_max + '% vs its ' + theirHp + '%), it never acts; otherwise you eat the hit');
                        } else if (first === 'they') {
                            if (legIn2.percent_min >= myHpPct) { dealTxt = '0% — you faint before your move lands'; }
                            else if (legIn2.percent_max >= myHpPct) extra.push('if their roll KOs you (' + legIn2.percent_max + '% vs your ' + myHpPct + '%), your move never lands');
                        }
                        var cHpLo = Math.round(myHpPct - takeMax), cHpHi = Math.round(myHpPct - takeMin);
                        var c = {
                            order: first + ' first',
                            you_deal: dealTxt,
                            you_take: (takeMin === 0 && takeMax === 0) ? '0%' : (takeMin + '-' + takeMax + '%'),
                            mine_hp_after: cHpLo + '-' + cHpHi + '%',
                            mine_faints: (cHpHi <= 0 ? true : (cHpLo <= 0 ? 'possible' : false)),
                            note: extra.join('; ')
                        };
                        c.summary = c.order + ' → ' + myName + ': ' + c.you_deal + ' out, ' + c.you_take + ' in → ' + c.mine_hp_after + ' left' + (c.note ? ' (' + c.note + ')' : '');
                        row.cases.push(c);
                        if (!worstCase || cHpLo < worstCase._lo) { worstCase = c; worstCase._lo = cHpLo; }
                    }
                    if (worstCase) delete worstCase._lo;   // 内部打分字段，不往外传
                    // row.mine 取**最坏的那个顺序**（门禁按它比对，保持保守）；两种顺序结果相同时不加冗余后缀
                    var allSame = row.cases.length > 1 && row.cases.every(function (x) { return x.mine_hp_after === row.cases[0].mine_hp_after; });
                    row.mine = {
                        takes: worstCase.you_take, hp_after: worstCase.mine_hp_after, faints: worstCase.mine_faints,
                        summary: worstCase.summary + ((row.cases.length > 1 && !allSame) ? '  [worst of ' + row.cases.length + ' order cases: ' + row.cases.map(function (x) { return x.order + ' = ' + x.mine_hp_after; }).join(' | ') + ']' : '')
                    };
                }
            } else {
                var incomingName = slotName(oppTeam, br.slot);
                var legOut3 = simLeg(state, applyFromStateSpec(state, 'me', null), applyFromStateSpec(state, 'opp', br.slot), mine.move);
                if (legOut3.error) {
                    row.unknown.push('your move vs the pokemon they bring in could not be computed (' + legOut3.error + ')');
                    row.theirs = { takes: 'unknown', summary: 'cannot compute ' + mine.move + ' vs ' + (incomingName || ('slot ' + br.slot)) };
                } else {
                    row.theirs = { takes: legOut3.percent_min + '-' + legOut3.percent_max + '%', ko: legOut3.ko_verdict || '', summary: (incomingName || ('slot ' + br.slot)) + ' takes ' + legOut3.percent_min + '-' + legOut3.percent_max + '% from ' + mine.move };
                }
                row.mine = { takes: '0%', hp_after: myHpPct + '%', faints: false, summary: myName + ' untouched (they switched instead of attacking)' };
                row.unknown.push('the switch-in\'s defensive spread is unknown — number assumes the spread you passed / defaults');
            }
        }
        // ---- 命中率（含天气修正）：低命中招必须写清"它有机会落空" ----
        row.accuracy = {};
        if (mine.kind === 'move') {
            var myAcc = moveAccuracy(mine.move, state.weather);
            if (myAcc !== null) row.accuracy.your_move = { move: mine.move, acc: myAcc };
        }
        if (br.kind === 'move') {
            var theirAcc = moveAccuracy(br.move, state.weather);
            if (theirAcc !== null) row.accuracy.their_move = { move: br.move, acc: theirAcc };
        }
        var accNotes = [];
        if (row.accuracy.your_move && row.accuracy.your_move.acc < 100) {
            accNotes.push('your ' + mine.move + ' connects ' + row.accuracy.your_move.acc + '% of the time → ' + (100 - row.accuracy.your_move.acc) + '% it misses and deals NOTHING');
        }
        if (row.accuracy.their_move && row.accuracy.their_move.acc < 100) {
            accNotes.push('their ' + br.move + ' connects ' + row.accuracy.their_move.acc + '% of the time → ' + (100 - row.accuracy.their_move.acc) + '% it MISSES and you take 0% from it (the damage above assumes it connects)');
        }
        if (accNotes.length) row.accuracy_note = accNotes.join('; ') + '  [weather=' + (state.weather || 'None') + ']';

        // crit / 附加效果：**不展开成分支**，但必须声明它们没被计入（否则"余量很薄"的分支会被读成安全）
        var critNotes = [];
        if (mine.kind === 'move') { var mc = moveCritStage(mine.move); if (mc) critNotes.push('your ' + mine.move + ' — ' + mc); }
        if (br.kind === 'move') { var tcr = moveCritStage(br.move); if (tcr) critNotes.push('their ' + br.move + ' — ' + tcr); }
        if (critNotes.length) {
            row.crit_note = 'critical hits are NOT included in the numbers above (' + critNotes.join('; ') + '). A crit only ever makes a branch MORE lethal, never less — so treat a thin margin as thinner.';
        }

        // 变化招：本表只算伤害 → 必须标注它的效果完全没算（否则 0% 会被读成安全）
        var smNotes = [];
        if (br.kind === 'move') { var smn = statusMoveNote(br.move); if (smn) smNotes.push('THEIR ' + smn); }
        if (mine.kind === 'move') { var smn2 = statusMoveNote(mine.move); if (smn2) smNotes.push('YOUR ' + smn2); }
        if (smNotes.length) { row.status_move_note = smNotes.join(' | '); row.status_move = true; }

        // 异常状态：数字会失真 → 标注（不建模）
        var scNotes = [];
        var myStatus = ((state.me || {}).status) || ((slotEntry(myTeam, 0) || {}).status) || null;
        var oppStatus = ((state.opp || {}).status) || null;
        var scMine = statusConditionNote('your ' + myName, myStatus);
        if (scMine) scNotes.push(scMine);
        var scOpp = statusConditionNote('the opponent ' + (oppActive || '?'), oppStatus);
        if (scOpp) scNotes.push(scOpp);
        if (scNotes.length) row.status_condition_note = scNotes.join('; ');

        if (row.legal !== 'ok') row.unknown.push('legality: ' + row.legal);
        row.unknown.push('unrevealed items/abilities are NOT modelled (no Leftovers/Rain Dish/Intimidate-on-entry/etc.)');
        row.unknown.push('accuracy-changing abilities (Hustle / Compound Eyes / No Guard / Sand Veil …) are NOT modelled');
        row.unknown.push('critical hits and secondary effects (burn/paralysis/flinch/drops) are NOT modelled — see crit_note');
        row.unknown.push('status conditions are NOT applied (sleep = no move, paralysis = half Speed, burn = half Attack) — see status_condition_note');
        row.unknown.push('stat stages (your boosts / the opponent\'s boosts) are NOT applied to these numbers');
        row.unknown.push('end-of-turn residuals (poison/burn/sand/hail/Leftovers/Black Sludge) and hazards on switch-in are NOT applied');
        row.unknown.push('ability triggers on switch-in (Intimidate / weather setters / etc.) are NOT modelled');
        out.rows.push(row);
    }

    out.model_scope = 'DAMAGE & SURVIVAL ONLY. MODELLED: damage, type effectiveness, weather/terrain, hazards/screens already on the field, switch-phase ordering, move priority, move accuracy (weather-adjusted), and YOUR exact stats. NOT MODELLED: status-move effects, status conditions (sleep / paralysis / burn / poison), stat stages, critical hits, secondary effects, end-of-turn residuals, hazards on switch-in, ability and item triggers. Each row repeats what it could not know — a 0% row is NOT evidence that a branch is harmless.';
    out.how_to_read = 'Each row is one opponent branch under YOUR action. `mine` describes the pokemon your action leaves on the field. Use these numbers, not your own estimates; save_strategy will check your stated outcome against them. Whenever a row marks something as not modelled (status_move_note / status_condition_note / crit_note / unknown[]), do NOT treat that branch as safe on the strength of its 0%.';
    // 「它没想到的」：补出你没列进 opp_does、但它学得到且会重伤你的攻击招（可能性空间上界，不是预测）
    var listedKeys = [];
    for (var lb = 0; lb < branches.length; lb++) { if (branches[lb].kind === 'move') listedKeys.push(branches[lb].move); }
    out.possibility_space = unlistedThreats(state, oppActive, mySlot, myHpPct, listedKeys, ctx);

    out.assumptions = args.assume || {};
    if (!args.assume || (!args.assume.opp_spread && !args.assume.opp_spread_off)) {
        out.assumptions_warning = 'You passed no opponent spread assumption — numbers for the OPPONENT\'s stats default to 0 EV / neutral. Pass assume.opp_spread (defensive) and/or assume.opp_spread_off (offensive) if you have a read on its set.';
    }

    var led = ctx && ctx.ledger;
    if (led) {
        if (!led.sims) led.sims = [];
        led.sims.push({ actionKey: actionKey(mine), i_do: actionKey(mine), opp_does: branches.map(function (x) { return x.key; }), rows: out.rows, ts: Date.now() });
        // (a) 假设一致性（结构化，不碰文本）：同一只对手在本次决策内必须用同一套 assume，
        //     否则不同选项的数字来自不同前提、根本不可比（这正是 E001 里"对想否掉的用进攻型、对想选的用防御型"的机制）。
        var asm = args.assume || {};
        if (oppActive && Object.keys(asm).length) {
            if (!led.assumeByOpp) led.assumeByOpp = {};
            var cur = JSON.stringify(asm);
            var prev = led.assumeByOpp[oppActive];
            if (prev && prev.json !== cur) {
                if (!led.assumeConflicts) led.assumeConflicts = [];
                led.assumeConflicts.push('inconsistent assumptions for ' + oppActive + ' within one turn: an earlier simulate_turn used ' + prev.json + ' (from ' + prev.from + '), this one uses ' + cur + '. Options evaluated under different assumptions are not comparable — re-run them all with ONE shared assumption set.');
                out.assumption_conflict = led.assumeConflicts[led.assumeConflicts.length - 1];
            } else if (!prev) {
                led.assumeByOpp[oppActive] = { json: cur, from: actionKey(mine) };
            }
        }
    }
    return out;
}

// 按 action 字符串在账本里找那次仿真（容错大小写/多余空格）
function findSimByAction(ledger, actionStr) {
    if (!ledger) return null;
    var sims = ledger.sims || [];
    var want = String(actionStr || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!want) return null;
    for (var i = 0; i < sims.length; i++) {
        var a = String(sims[i].actionKey).toLowerCase();
        if (a === want || a === want.replace(/^(use|i )/, '')) return sims[i];
    }
    return null;
}

// 强提醒（不拦）：你声明的分支若**不是最坏的那个**，就把最坏分支的数字直接摆出来。
// 允许赌，但必须知道自己赌的是什么（用户 2026-09-20：不用拦，强提醒就行）。
function worstBranchNote(ledger, args) {
    if (!ledger || !args || !args.action || !args.branch) return null;
    var sim = findSimByAction(ledger, args.action);
    if (!sim) return null;
    var declared = null, worst = null;
    for (var i = 0; i < sim.rows.length; i++) {
        var r = sim.rows[i];
        if (!r.mine) continue;
        if (String(r.branchKey).toLowerCase() === String(args.branch).trim().toLowerCase()) declared = r;
        var lo = parseInt(String(r.mine.hp_after || '').replace(/[^0-9\-]/g, '').split('-')[0], 10);
        var score = (r.mine.faints === true ? -9999 : (isNaN(lo) ? 9999 : lo));
        if (!worst || score < worst._score) { worst = r; worst._score = score; }
    }
    if (!declared || !worst || declared === worst) return null;
    return 'REMINDER (not blocking) — the branch you declared (' + args.branch + ') is NOT the worst branch for that action. Worst is "' + worst.branchKey + '": ' + worst.mine.summary + '  If you are deliberately betting against that branch, say so explicitly in `text` (which branch you are betting against, and what it costs if it comes).';
}

// (b).1 倍率词窄正则：散文里出现「属性名 + 倍率词」但本回合完全没查过 get_type_matchup → 只警告不拦。
// 只做观察用；从 simulate_turn 里拿到的数字才是权威。
var MULT_WORD_RE = /(neutral|resists?|resisted|super[- ]?effective|not very effective|immune|\b[0-9.]+x\b|\bhalf\b)/i;
function multiplierProseHits(text) {
    if (!text) return [];
    var hits = [], low = String(text).toLowerCase();
    for (var i = 0; i < TYPE_NAMES.length; i++) {
        var tn = String(TYPE_NAMES[i]).toLowerCase();
        var idx = low.indexOf(tn);
        while (idx >= 0) {
            var win = text.substring(Math.max(0, idx - 45), idx + tn.length + 45);
            if (MULT_WORD_RE.test(win)) { hits.push(TYPE_NAMES[i] + ': "' + win.replace(/\s+/g, ' ').trim().slice(0, 70) + '"'); break; }
            idx = low.indexOf(tn, idx + 1);
        }
        if (hits.length >= 3) break;
    }
    return hits;
}

// 门禁：提交计划时必须与仿真一致（Rule 1 + Rule 4 的仿真版）
// 断言口径：换人/攻击都不要求"必须活下来"——炮灰打法只要如实写 "faints" 就能过；但描述必须与仿真一致。
function simGate(ledger, args) {
    if (!ledger) return null;
    var sims = ledger.sims || [];
    if (!sims.length) {
        return 'STRATEGY REJECTED — you have not run simulate_turn this turn. Simulate the branches your plan relies on (i_do + opp_does), then state action / branch / outcome.';
    }
    var want = String(args.action || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!want) {
        return 'STRATEGY REJECTED — save_strategy needs `action` (same form as simulate_turn i_do, e.g. "switch 3" or "move Thunderbolt"). You simulated: ' + sims.map(function (s) { return s.actionKey; }).join(', ');
    }
    var sim = null;
    for (var i = 0; i < sims.length; i++) {
        var a = String(sims[i].actionKey).toLowerCase();
        if (a === want || a === want.replace(/^(use|i )/, '')) { sim = sims[i]; break; }
    }
    if (!sim) {
        return 'STRATEGY REJECTED — your action "' + args.action + '" was never simulated. Run simulate_turn with that exact i_do first. Simulated so far: ' + sims.map(function (s) { return s.actionKey; }).join(', ') + '.';
    }
    var branch = String(args.branch || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!branch) {
        return 'STRATEGY REJECTED — save_strategy needs `branch`: which opponent action your plan is playing around (one of: ' + sim.rows.map(function (r) { return r.branchKey; }).join(', ') + ').';
    }
    var row = null;
    for (var j = 0; j < sim.rows.length; j++) {
        if (String(sim.rows[j].branchKey).toLowerCase() === branch) { row = sim.rows[j]; break; }
    }
    if (!row) {
        return 'STRATEGY REJECTED — branch "' + args.branch + '" is not among the simulated branches for that action (' + sim.rows.map(function (r) { return r.branchKey; }).join(', ') + '). Simulate it, or pick a branch you did simulate.';
    }
    var outcome = String(args.outcome || '').trim();
    if (!outcome) {
        return 'STRATEGY REJECTED — save_strategy needs `outcome`: what happens to ' + (row.mine && row.mine.summary ? '(see simulation) ' : '') + 'the pokemon your action puts on the field under that branch — "survives" / "faints" / "<a-b>%". A sacrifice play is allowed: just write "faints".';
    }
    // 与仿真比对
    var m = row.mine || {};
    var t = outcome.toLowerCase();
    var bad = false, why = '';
    if (/faint|die|ko|倒下|送/.test(t)) {
        if (m.faints === false) { bad = true; why = 'simulation says it survives (' + m.summary + ')'; }
    } else if (/surviv|live|safe|没事|活/.test(t)) {
        if (m.faints === true || m.faints === 'possible') { bad = true; why = 'simulation says it may faint (' + m.summary + ')'; }
    } else {
        var nums = parseExpectNumbers(outcome);
        var hp = String(m.hp_after || '').match(/(-?\d+)\s*-\s*(-?\d+)/);
        if (nums.single !== null && hp) {
            var lo = Number(hp[1]), hi = Number(hp[2]);
            if (nums.single < lo - 5 || nums.single > hi + 5) { bad = true; why = 'simulation says ' + m.hp_after + ' HP left (' + m.summary + ')'; }
        }
    }
    if (bad) {
        return 'STRATEGY REJECTED — your stated outcome "' + args.outcome + '" contradicts the simulation on branch "' + args.branch + '": ' + why + '. Rewrite the plan so it matches what the engine computes. (If you expect a DIFFERENT move than the branch you simulated, simulate that move and use it as the branch.)';
    }
    return null;
}

// 最终答案前的门禁：你选中的动作必须已经被仿真过（不要求活下来，只要求"你没在没仿真的情况下下结论"）
function actionGateCheck(ledger, action, state) {
    if (!ledger || !action) return null;
    var sims = ledger.sims || [];
    var need = null;
    if (action.type === 'switch') need = 'switch ' + Number(action.pokeSlot);
    else {
        var moves = (state && state.me && state.me.moves) || [];
        var mv = moves[Number(action.attackSlot)];
        if (mv && mv.name) need = 'move ' + mv.name;
    }
    if (!need) return null;   // 解析不到招式名 → 不拦（避免误伤）
    for (var i = 0; i < sims.length; i++) {
        if (String(sims[i].actionKey).toLowerCase() === need.toLowerCase()) return null;
    }
    return 'NOT READY — you are about to answer "' + need + '" but you never simulated it. Call simulate_turn with i_do = {"' +
        (action.type === 'switch' ? ('switch":' + Number(action.pokeSlot)) : ('move":"' + need.replace(/^move /, ''))) +
        '} and the opponent branches you are playing around, then re-save the strategy and answer.' + (sims.length ? (' Simulated so far: ' + sims.map(function (s) { return s.actionKey; }).join(', ') + '.') : '');
}

// 记录当前回合的战略思路（默认用当前 turn；可显式指定 turn）
// 存成 {text, scene, checks}：text = 本回合推演（不回灌）；scene = 预设的下次决策场面（回灌 1 条，用于与实况对比）；
// checks = 留给后续回合核对的待验证假设（回灌最近 2 条）
// 门禁：action / branch / outcome 必须与 simulate_turn 的结果一致（见 simGate）。
function saveStrategy(args, ctx) {
    if (!args.text) return { error: 'text required' };
    if (!args.scene) return { error: 'scene required (the board you expect at your next decision)' };
    if (!args.checks) return { error: 'checks required (the assumptions your later turns should verify against the battle log)' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    // 门禁：没跑仿真 / 动作没仿真过 / 分支不在仿真里 / 结论与仿真矛盾 → 拒绝提交
    var gateMsg = ctx && ctx.simGateOn ? simGate(ctx.ledger, args) : null;
    if (gateMsg) return { error: gateMsg };
    if (!notes.turns) notes.turns = {};
    var t = (args.turn !== undefined && args.turn !== null) ? parseInt(args.turn, 10) : (ctx.turn || 0);
    notes.turns[String(t)] = {
        text: String(args.text), scene: String(args.scene), checks: String(args.checks),
        action: args.action ? String(args.action) : null,
        branch: args.branch ? String(args.branch) : null,
        outcome: args.outcome ? String(args.outcome) : null
    };
    // 非阻断提醒（只警告、不拒绝）：① 声明的分支不是最坏分支；② 散文里写了倍率但没查过表；③ 对手假设不一致
    var ret = { ok: true, turn: t };
    var warns = [];
    if (ctx && ctx.simGateOn && ctx.ledger) {
        var wb = worstBranchNote(ctx.ledger, args);
        if (wb) warns.push(wb);
        var hits = multiplierProseHits(args.text);
        if (hits.length) {
            ret.multiplierMentions = hits.length;
            if (!(ctx.ledger.typeChecks > 0)) {
                warns.push('WARNING (not blocking) — your `text` asserts a type-multiplier (' + hits.join(' | ') + ') but you never called get_type_matchup this turn. Prose multipliers are a known hallucination source (e.g. "Water is neutral to Fire/Electric" when it is actually 2x). Verify with get_type_matchup; treat simulate_turn\'s numbers as authoritative.');
            }
        }
        if (ctx.ledger.assumeConflicts && ctx.ledger.assumeConflicts.length) {
            warns.push('WARNING (not blocking) — ' + ctx.ledger.assumeConflicts[ctx.ledger.assumeConflicts.length - 1]);
        }
    }
    if (warns.length) {
        ret.warning = warns.join('\n');
        ctx.ledger.warningCount = (ctx.ledger.warningCount || 0) + warns.length;
    }
    return ret;
}

// 读取观察（不传 pokemon 返回全部）
function getObservation(args, ctx) {
    var notes = ctx && ctx.notes;
    var p = (notes && notes.pokemon) || {};
    var th = (notes && notes.threat) || {};
    if (args.pokemon) {
        var k = String(args.pokemon);
        return { pokemon: args.pokemon, observation: p[k] || null, threat: th[k] || null };
    }
    var out = {};
    for (var key in p) {
        out[key] = { threat: th[key] || null, observation: p[key] };   // 带威胁等级（高中低）一起返回
    }
    return { observations: out };
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
// 按名字查表时一并带回 num/crit_rate/hits/variable_power/pp，供 calcOneLeg 做属性替换/暴击/连击判断
function resolveMoveInput(spec) {
    if (!spec) return { error: 'move missing' };
    if (spec.name) {
        var name = String(spec.name);
        var lower = name.toLowerCase();
        for (var k in MOVES) {
            var m = MOVES[k];
            if ((m.name && m.name.toLowerCase() === lower) || (m.name_zh && m.name_zh === name)) {
                return {
                    name: m.name, num: m.num, power: m.power, category: m.category, type: m.type,
                    crit_rate: m.crit_rate || 0, hits: m.hits || 1,
                    variable_power: !!m.variable_power, pp: m.pp
                };
            }
        }
        return { error: 'unknown move: ' + spec.name };
    }
    if (spec.power !== undefined && spec.category && spec.type) {
        return { name: null, num: null, power: spec.power, category: spec.category, type: spec.type, crit_rate: 0, hits: 1, variable_power: false };
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

// ===== 特殊招式（对齐 @smogon/calc mechanics/gen789.ts）=====
//   776 Body Press                                -> 攻击值改用「使用者 Def」（含使用者 def 等级）
//   492 Foul Play                                 -> 攻击值改用「目标 Atk」（含目标 atk 等级）
//   473/540/548 Psyshock/Psystrike/Secret Sword   -> 防御值改用「目标 Def」（攻击仍是特攻）
//   755/754 Fishious Rend/Bolt Beak               -> 先手（或目标本回合换入）时威力翻倍 85->170
//   crit_rate >= 6 的 4 招 = 必定暴击：Wicked Blow 843 / Surging Strikes 844 / Storm Throw 480 / Frost Breath 524
var MV_BODY_PRESS = 776;
var MV_FOUL_PLAY = 492;
var MV_DEF_OVERRIDE = { 473: 1, 540: 1, 548: 1 };
var MV_FIRST_DOUBLE = { 755: 1, 754: 1 };
var CRIT_ALWAYS_RATE = 6;

// 某一侧是否用了默认词条（没传 EV/性格）——用了就必须警示（battle69 T50 因漏传 ev/nature 把 44% 估成 13%）
// 注：IV 默认 31 是通用前提，不算「未知词条」（只有极少数非 31 IV 配置），所以不列入
function assumedFields(spec, needNature) {
    var miss = [];
    if (spec.ev === undefined || spec.ev === null) miss.push('ev');
    if (needNature && (spec.nature === undefined || spec.nature === null || spec.nature === '')) miss.push('nature');
    return miss;
}
function markAssumed(arr, spec, needNature) {
    var m = assumedFields(spec, needNature);
    for (var i = 0; i < m.length; i++) { if (arr.indexOf(m[i]) === -1) arr.push(m[i]); }
}

// KO 判定：把「单次命中」的伤害分布做卷积，看第 n 次「使用本招」（= n*hits 次命中）的累计伤害能否打掉 hp。
// 返回 PS 风格结论文本（guaranteed OHKO / 99.9% chance to 3HKO / not a 4HKO）。
// 百分比按 PS 的 roundChance 处理：四舍五入到 0.1% 并夹在 [0.1, 99.9]，避免出现误导性的 100%/0%
function koName(n) { return n <= 1 ? 'OHKO' : (n + 'HKO'); }
function koChancePct(chance) {
    return Math.max(Math.min(Math.round(chance * 1000), 999), 1) / 10;
}
function koVerdict(perHit, hits, hp) {
    if (!hp || hp <= 0) return null;
    if (!perHit || !perHit.length) return null;   // 空分布（算不出伤害的招）绝不能返回「guaranteed OHKO」
    var counts = { 0: 1 };
    var total = 1;
    var maxUses = 4;
    for (var n = 1; n <= maxUses * hits; n++) {
        var next = {};
        for (var k in counts) {
            var dmg = parseInt(k, 10);
            var c = counts[k];
            for (var r = 0; r < perHit.length; r++) {
                var nd = dmg + perHit[r];
                next[nd] = (next[nd] || 0) + c;
            }
        }
        counts = next;
        total = total * perHit.length;
        if (n % hits !== 0) continue;   // 只在整次「使用」后判定
        var ko = 0;
        for (var k2 in counts) { if (parseInt(k2, 10) >= hp) ko += counts[k2]; }
        if (ko === total) return 'guaranteed ' + koName(n / hits);
        if (ko > 0) return koChancePct(ko / total) + '% chance to ' + koName(n / hits);
    }
    // 5 次及以上：组合数太大，改用保守外推（对齐 PS 的 predictTotal 写法）：
    // 最低伤害×n 达标 -> guaranteed；最高伤害×n 达标 -> possible（不给具体概率）
    var perUseMin = perHit[0] * hits;
    var perUseMax = perHit[perHit.length - 1] * hits;
    for (var u = maxUses + 1; u <= 9; u++) {
        if (perUseMin * u >= hp) return 'guaranteed ' + koName(u);
        if (perUseMax * u >= hp) return 'possible ' + koName(u);
    }
    return 'not a 9HKO';
}

// EV/性格 前缀（PS 风格，如 "252+ Atk" / "0 Def" / "?"），statIdx 0-5
function evNatDesc(spec, nature, statIdx) {
    if (spec.ev === undefined || spec.ev === null) return '?';
    var e = arrAt(spec.ev, statIdx, 0);
    if (nature.buff === statIdx) return e + '+';
    if (nature.debuff === statIdx) return e + '-';
    return String(e);
}

// ===== 我们的 leg 入参 -> @smogon/calc 的对象 =====

// EV/IV 数组 [hp,atk,def,spa,spd,spe] -> @smogon 的对象；不传时用默认（EV 0 / IV 31）
function evArrToObj(arr) {
    var o = {};
    if (!arr) return o;
    for (var i = 0; i < 6; i++) o[STAT_KEYS[i]] = arrAt(arr, i, 0);
    return o;
}
function ivArrToObj(arr) {
    var o = {};
    for (var i = 0; i < 6; i++) o[STAT_KEYS[i]] = arrAt(arr, i, 31);
    return o;
}
// 性格 -> @smogon 的英文名（接受英文/中文/编号；认不出时用中性 Serious）
function natureNameOf(spec) {
    if (spec.nature === undefined || spec.nature === null || spec.nature === '' || spec.nature === 0) return 'Serious';
    var s = String(spec.nature);
    var key = null;
    if (NATURES.byNum[s] !== undefined) key = s;
    else if (NATURES.byName[s.toLowerCase()] !== undefined) key = NATURES.byName[s.toLowerCase()];
    if (key === null) return 'Serious';
    var entry = NATURES.byNum[key];
    return (entry && entry.name_en) ? entry.name_en : 'Serious';
}
// 天气/场地规范化（接受常见别名与中文）
function normalizeWeather(w) {
    if (!w) return undefined;
    var k = String(w).trim().toLowerCase();
    return PS_WEATHER_ALIAS[k] || String(w);
}
function normalizeTerrain(t) {
    if (!t) return undefined;
    var k = String(t).trim().toLowerCase();
    return PS_TERRAIN_ALIAS[k] || String(t);
}

// @smogon/calc 的 calculate() 会 clone() 两侧，而 Pokemon.clone() 用「种族值 + EV/IV/性格」重建 rawStats，
// 于是我们「直传能力值」的覆盖会被丢掉（实测：attacker.def=580 被当成未强化的 232）。
// 这里包一层 clone，把被覆盖过的 rawStats 原样带到克隆体上。
var _pkmClone = SMOGON.Pokemon.prototype.clone;
SMOGON.Pokemon.prototype.clone = function () {
    var c = _pkmClone.call(this);
    if (this.__directKeys && this.__directKeys.length) {
        for (var i = 0; i < this.__directKeys.length; i++) {
            var k = this.__directKeys[i];
            c.rawStats[k] = this.rawStats[k];
            c.stats[k] = this.stats[k];
        }
    }
    return c;
};

// 一个 leg 侧（attacker/defender）-> @smogon 的 Pokemon
// 支持：poke 名/编号 或 base_stats+types；ev/iv/nature/boosts/level；ability/item/status；
//       直接能力值（atk/def/spa/spd/hp/spe，当作**未计入能力等级**的数值，等级仍照常生效）；hpPct/curHp
function toCalcPokemon(spec) {
    var opts = {};
    if (spec.level) opts.level = parseInt(spec.level, 10) || 100;
    opts.evs = evArrToObj(spec.ev);
    opts.ivs = ivArrToObj(spec.iv);
    opts.nature = natureNameOf(spec);
    if (spec.boosts) opts.boosts = parseStateBoosts(spec.boosts);   // 兼容 ["Def+3"] 数组写法
    if (spec.ability) opts.ability = normalizeDexName(String(spec.ability), psAbilityExists);
    if (spec.item) opts.item = normalizeDexName(String(spec.item), psItemExists);
    if (spec.status) opts.status = String(spec.status);
    if (spec.gender) opts.gender = String(spec.gender);
    if (spec.alliesFainted !== undefined) opts.alliesFainted = parseInt(spec.alliesFainted, 10) || 0;

    var name = 'Mew';
    if (spec.base_stats && spec.base_stats.length === 6) {
        var bs = {};
        for (var i = 0; i < 6; i++) bs[STAT_KEYS[i]] = spec.base_stats[i];
        opts.overrides = { baseStats: bs, types: spec.types || ['Normal'] };
    } else if (spec.poke !== undefined && spec.poke !== null) {
        var rp = resolvePokemonInput({ poke: spec.poke });
        if (rp.error) return { error: rp.error };
        name = rp.name || String(spec.poke);
    } else {
        return { error: 'attacker/defender needs poke name or base_stats' };
    }

    var pk = new SMOGON.Pokemon(PKLM_GEN, name, opts);

    // 直接能力值：当作「未计入能力等级的最终值」（如 get_my_stats 的读数），能力等级仍照常生效
    pk.__directKeys = [];
    for (var s = 0; s < 6; s++) {
        var k = STAT_KEYS[s];
        var v = spec[k];
        if (v !== undefined && v !== null) {
            pk.rawStats[k] = v;
            pk.stats[k] = v;
            pk.__directKeys.push(k);
        }
    }
    // 当前 HP（Defeatist/Multiscale 等要看剩余血量；KO 判定也用它）
    if (spec.curHp !== undefined && spec.curHp !== null) {
        pk.originalCurHP = Math.max(1, Math.min(parseInt(spec.curHp, 10) || 1, pk.rawStats.hp));
    } else if (spec.hpPct !== undefined && spec.hpPct !== null) {
        pk.originalCurHP = Math.max(1, Math.min(Math.round(pk.rawStats.hp * Number(spec.hpPct) / 100), pk.rawStats.hp));
    }
    return { pokemon: pk };
}

// 招式 -> @smogon 的 Move。
// 按名字传时用 PS 的招式数据（含 Body Press/Foul Play/Psyshock 属性替换、必定 CT、连击、鳃咬翻倍等专属逻辑）。
// 手传 power+category+type 时用惰性招式 + overrides 合成（此时没有招式专属逻辑）。
function toCalcMove(mv, leg) {
    var opts = {};
    if (leg.hits !== undefined && leg.hits !== null) opts.hits = parseInt(leg.hits, 10);
    if (leg.isCrit !== undefined) opts.isCrit = !!leg.isCrit;
    var m;
    if (mv.name) {
        m = new SMOGON.Move(PKLM_GEN, mv.name, opts);
        if (m.bp === undefined || m.bp === null) return { error: 'move not in PS dex: ' + mv.name };
        if (leg.power_multiplier !== undefined && leg.power_multiplier !== null) {
            // 手动 BP 倍率：覆盖 basePower（招式专属 BP 回调仍会在其基础上生效，如鳃咬翻倍）
            m.bp = mv.power * leg.power_multiplier;
        }
    } else {
        var o = { overrides: { basePower: mv.power, category: mv.category, type: mv.type } };
        if (opts.hits) o.hits = opts.hits;
        if (leg.isCrit !== undefined) o.isCrit = !!leg.isCrit;
        m = new SMOGON.Move(PKLM_GEN, 'Splash', o);
        if (leg.power_multiplier !== undefined && leg.power_multiplier !== null) {
            m.bp = mv.power * leg.power_multiplier;
        }
    }
    return { move: m };
}

// field：天气/场地 + 双方场地效果（光墙/反射壁/极光幕/帮助）
function toCalcField(f) {
    if (!f) f = {};
    var opts = {};
    var w = normalizeWeather(f.weather);
    if (w) opts.weather = w;
    var t = normalizeTerrain(f.terrain);
    if (t) opts.terrain = t;
    var aSide = {}, dSide = {};
    if (f.helpingHand) aSide.isHelpingHand = true;
    if (f.reflect) dSide.isReflect = true;
    if (f.lightScreen) dSide.isLightScreen = true;
    if (f.auroraVeil) dSide.isAuroraVeil = true;
    opts.attackerSide = aSide;
    opts.defenderSide = dSide;
    return new SMOGON.Field(opts);
}

// 「按修正项算」时不允许再传 extra（两者会重复计算）；返回已给的修正项名列表
var EXTRA_EXCLUSIVE_KEYS = ['ability', 'item', 'status', 'burn', 'field'];
function modifierFieldsGiven(leg) {
    var given = [];
    if (leg.attacker) {
        if (leg.attacker.ability) given.push('attacker.ability');
        if (leg.attacker.item) given.push('attacker.item');
        if (leg.attacker.status) given.push('attacker.status');
    }
    if (leg.defender) {
        if (leg.defender.ability) given.push('defender.ability');
        if (leg.defender.item) given.push('defender.item');
        if (leg.defender.status) given.push('defender.status');
    }
    if (leg.burn === true) given.push('burn');
    if (leg.field) {
        var f = leg.field;
        if (f.weather) given.push('field.weather');
        if (f.terrain) given.push('field.terrain');
        if (f.reflect) given.push('field.reflect');
        if (f.lightScreen) given.push('field.lightScreen');
        if (f.auroraVeil) given.push('field.auroraVeil');
        if (f.helpingHand) given.push('field.helpingHand');
    }
    return given;
}

// 名称是否被官方计算器认识（拼错会静默不生效，所以显式提醒）。
// 注意：用 Gen8 dex 的 get(id)，不要用 SMOGON.ABILITIES / SMOGON.ITEMS —— 那两个是**数组**（key 是下标），
// 直接按名字索引永远 miss（0.4.0 曾因此对每个特性/道具都误报「拼错、未生效」）。
var GEN8DEX = SMOGON.Generations.get(PKLM_GEN);
function psAbilityExists(name) {
    try { return !!GEN8DEX.abilities.get(SMOGON.toID(String(name))); } catch (e) { return true; }
}
function psItemExists(name) {
    try { return !!GEN8DEX.items.get(SMOGON.toID(String(name))); } catch (e) { return true; }
}
// 名字容错：LLM 偶尔把「同义/二选一」的两个名字塞成一个字符串，如特性 "Protean/Libero"
//（Cinderace 两种地区命名）→ 计算器不认。拆开逐个试，命中第一个能识别的就用它。
function normalizeDexName(v, existsFn) {
    if (typeof v !== 'string' || v.indexOf('/') < 0) return v;
    var parts = v.split('/');
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].replace(/^\s+|\s+$/g, '');
        if (p && existsFn(p)) return p;
    }
    return v;
}
// 归一化 + 一句「替换成了什么」的说明（没有替换则 note=null）
function normalizeWithNote(v, existsFn, label) {
    var n = normalizeDexName(v, existsFn);
    if (n !== v) return { name: n, note: label + ' "' + v + '" → applied "' + n + '" (only that part is in the calculator data)' };
    return { name: v, note: null };
}
// 计算器 rawDesc 里「实际生效」的修正项（供 LLM 核对输入是否被识别）
var RAWDESC_KEYS = ['attackerAbility', 'attackerItem', 'defenderAbility', 'defenderItem', 'weather', 'terrain', 'isReflect', 'isLightScreen', 'isAuroraVeil', 'isHelpingHand', 'isCritical', 'isBurned', 'attackBoost', 'defenseBoost', 'isSwitching'];
function psPickRawDesc(rd) {
    var o = {};
    if (!rd) return o;
    for (var i = 0; i < RAWDESC_KEYS.length; i++) {
        var k = RAWDESC_KEYS[i];
        var v = rd[k];
        if (v !== undefined && v !== null && v !== false && v !== 0 && v !== '') o[k] = v;
    }
    return o;
}

// 能力等级修正（对齐 @smogon getModifiedStat；显示用）
function modStat(v, b) {
    if (!b) return v;
    if (b > 0) return Math.floor(v * (2 + b) / 2);
    return Math.floor(v * 2 / (2 - b));
}
// 暴击时忽略「攻击方负向 / 防御方正向」等级
function critBoost(b, side, isCrit) {
    if (!isCrit) return b;
    if (side === 'atk' && b < 0) return 0;
    if (side === 'def' && b > 0) return 0;
    return b;
}

// ===== from_state：直接用「系统读到的场上参数」算，避免 LLM 手抄出错 =====
// 我方 = 硬数据（state.me 的 boosts/道具/特性/HP% + state.myStats 的等级/EV/IV/性格）；
// 对手 = 只能填「已暴露」的信息（特性 = 战报已证实的 abilityInferred、道具 = 道具消息暴露的 itemInferred），
//        EV/性格/等级不可知 → 留空并让 assumed 提示兜底。
// 显式传入的字段优先级最高（可以只覆盖某一项，例如 from_state 之外再点明 ability）。
var STATE_STATUS_MAP = { paralysis: 'par', sleep: 'slp', freeze: 'frz', burn: 'brn', poison: 'psn', toxic: 'tox', confusion: '' };
// state 里的 boosts 是**人类可读数组**（如 ["Def+3","SpA-3","SpD+3"]），要转成计算器要的 {def:3,spa:-3,spd:3}。
// （不转就会静默变成「没有强化」——辅助力量会按 20 BP 算。）
var STATE_BOOST_KEY = { Atk: 'atk', Def: 'def', SpA: 'spa', SpD: 'spd', Spe: 'spe' };
function parseStateBoosts(b) {
    if (!b) return null;
    if (!Array.isArray(b)) return b;          // 已经是对象就直接用
    var o = {};
    for (var i = 0; i < b.length; i++) {
        var m = String(b[i]).match(/^(Atk|Def|SpA|SpD|Spe)\s*([+-]\d+)$/);
        if (m) o[STATE_BOOST_KEY[m[1]]] = parseInt(m[2], 10);
    }
    return o;
}

// from_state 取值：'me' / 'opp'（场上）或 'me:<slot>' / 'opp:<slot>'（场下/指定队伍槽位 0-5）。
// 返回 {who:'me'|'opp'|null, slot:number|null}（slot=null 表示「当前场上」；who=null 表示**这一侧没写 from_state**，
// 不等于 me —— 见 applyStateToLeg 里的「缺失一侧默认取对侧」规则）。
function parseFromState(v, dfltWho) {
    if (v === true) return { who: dfltWho, slot: null };
    if (v === undefined || v === null || v === '') return { who: null, slot: null };
    var s = String(v);
    var idx = s.indexOf(':');
    if (idx >= 0) {
        var who = (s.substring(0, idx) === 'opp') ? 'opp' : 'me';
        var n = parseInt(s.substring(idx + 1), 10);
        return { who: who, slot: isNaN(n) ? null : n };
    }
    return { who: (s === 'opp' ? 'opp' : (s === 'me' ? 'me' : dfltWho)), slot: null };
}

// 取值优先级规则（0.4.5 起）：
//   系统**读得到**的字段 → 以系统为准（若覆盖了 LLM 手填的值，会在 inputs_used 里注明 OVERRIDES）；
//   系统**读不到**的字段（对手的 EV/IV/性格/等级、未解析出特性/道具）→ 保留 LLM 手填的值（LLM 可能从伤害反推出来）。
function takeFromState(out, src, key, val, fromState) {
    if (val === undefined || val === null) return;
    if (out[key] !== undefined && JSON.stringify(out[key]) !== JSON.stringify(val)) {
        src[key] = fromState + ' (OVERRIDES your value ' + JSON.stringify(out[key]) + ')';
    } else {
        src[key] = fromState;
    }
    out[key] = val;
}
// LLM 手填了、而系统读不到的字段 → 记一笔来源，明确告诉它「这是你自己填的，系统没覆盖」
function keepExplicit(out, src, key, note) {
    if (out[key] !== undefined) src[key] = 'your input' + (note ? ' (' + note + ')' : '');
}

// 对手「已暴露但未解析」时的提示文案
function unresolvedAbilityNote(o) {
    var pa = o.possibleAbilities || [];
    return 'NOT applied — still unresolved' + (pa.length
        ? ', candidates: ' + pa.join(' / ') + '. Pass `ability` explicitly if you have narrowed it down.'
        : '. Pass `ability` explicitly if you know it.');
}
// 对手 EV/IV/性格/等级：系统读不到 → 保留 LLM 手填（常用于「从伤害反推配置」）
function keepOppUnknown(out, src) {
    keepExplicit(out, src, 'ev', 'state cannot read opponent EVs');
    keepExplicit(out, src, 'iv', 'state cannot read opponent IVs');
    keepExplicit(out, src, 'nature', 'state cannot read opponent nature');
    keepExplicit(out, src, 'level', 'state cannot read opponent level');
    if (out.ev === undefined) src.ev = 'unknown for opponent (assumed 0) — pass `ev` if you deduced the spread';
    if (out.nature === undefined) src.nature = 'unknown for opponent (assumed neutral) — pass `nature` if you deduced it';
}

function applyFromState(state, spec, who, slot) {
    var out = {}, src = {};
    for (var k in spec) { if (k !== 'from_state') out[k] = spec[k]; }
    // 「场下」= 指定了非 0 的队伍槽位；场下宝可梦**没有能力等级**（换上即清零）
    var isBench = (slot !== null && !(who === 'me' && slot === 0));
    var where = who + (slot === null ? ' (active)' : ':' + slot + (isBench ? ' (bench)' : ' (active)'));

    if (who === 'opp') {
        if (isBench) {
            var oe = (state.oppTeam || [])[slot];
            if (!oe) {
                src.poke = 'NOT found — opponent team slot ' + slot + ' is out of range (0-5)';
            } else if (!oe.revealed || !oe.name) {
                src.poke = 'NOT applied — opponent slot ' + slot + ' has not been revealed yet';
                src.hpPct = 'NOT applied — unrevealed';
                src.ability = 'NOT applied — unrevealed';
                src.item = 'NOT applied — unrevealed';
            } else {
                takeFromState(out, src, 'poke', oe.name, 'state.oppTeam[' + slot + '].name (revealed bench)');
                if (oe.hpPct !== null && oe.hpPct !== undefined) takeFromState(out, src, 'hpPct', oe.hpPct, 'state.oppTeam[' + slot + '].hpPct');
                if (oe.status && STATE_STATUS_MAP[oe.status]) takeFromState(out, src, 'status', STATE_STATUS_MAP[oe.status], 'state.oppTeam[' + slot + '].status');
                if (oe.abilityInferred) takeFromState(out, src, 'ability', oe.abilityInferred, 'state.oppTeam[' + slot + '].abilityInferred (proved by log)');
                if (oe.itemInferred) takeFromState(out, src, 'item', oe.itemInferred, 'state.oppTeam[' + slot + '].itemInferred (revealed)');
                if (out.ability === undefined) src.ability = unresolvedAbilityNote(oe);
                if (out.item === undefined) src.item = 'NOT applied — item not revealed yet (pass `item` explicitly if known)';
                else if (!oe.itemInferred) src.item = 'your input (item not revealed yet)';
            }
            takeFromState(out, src, 'boosts', {}, 'bench pokemon: stat stages reset on switch-in');
            keepOppUnknown(out, src);
        } else {
            var o = state.opp || {};
            takeFromState(out, src, 'poke', o.name, 'state.opp.name');
            takeFromState(out, src, 'boosts', o.boosts ? parseStateBoosts(o.boosts) : null, 'state.opp.boosts');
            if (o.hpPct !== undefined && o.hpPct !== null) takeFromState(out, src, 'hpPct', o.hpPct, 'state.opp.hpPct');
            if (o.status && STATE_STATUS_MAP[o.status]) takeFromState(out, src, 'status', STATE_STATUS_MAP[o.status], 'state.opp.status');
            if (o.abilityInferred) takeFromState(out, src, 'ability', o.abilityInferred, 'state.opp.abilityInferred (proved by log)');
            if (o.itemInferred) takeFromState(out, src, 'item', o.itemInferred, 'state.opp.itemInferred (revealed)');
            if (out.ability === undefined) src.ability = unresolvedAbilityNote(o);
            else if (!o.abilityInferred) src.ability = 'your input (no confirmed ability in state)';
            if (out.item === undefined) src.item = 'NOT applied — item not revealed yet (pass `item` explicitly if known)';
            else if (!o.itemInferred) src.item = 'your input (item not revealed yet)';
            keepOppUnknown(out, src);
        }
    } else if (isBench) {
        var ms2 = null, arr2 = state.myStats || [];
        for (var i2 = 0; i2 < arr2.length; i2++) { if (Number(arr2[i2].slot) === slot) ms2 = arr2[i2]; }
        var be = null, bArr = state.bench || [];
        for (var b2 = 0; b2 < bArr.length; b2++) { if (Number(bArr[b2].slot) === slot) be = bArr[b2]; }
        if (ms2) {
            takeFromState(out, src, 'poke', ms2.name, 'state.myStats[' + slot + '].name (my bench)');
            if (ms2.level) takeFromState(out, src, 'level', ms2.level, 'state.myStats[' + slot + '].level');
            if (ms2.ev) takeFromState(out, src, 'ev', ms2.ev, 'state.myStats[' + slot + '].ev');
            if (ms2.iv) takeFromState(out, src, 'iv', ms2.iv, 'state.myStats[' + slot + '].iv');
            if (ms2.nature !== undefined && ms2.nature !== null) takeFromState(out, src, 'nature', ms2.nature, 'state.myStats[' + slot + '].nature');
        } else {
            src.poke = 'NOT found — no myStats entry for team slot ' + slot + ' (0-5; slot 0 is the active one)';
        }
        if (be) {
            if (be.hpPct !== null && be.hpPct !== undefined) takeFromState(out, src, 'hpPct', be.hpPct, 'state.bench[' + slot + '].hpPct');
            if (be.status && STATE_STATUS_MAP[be.status]) takeFromState(out, src, 'status', STATE_STATUS_MAP[be.status], 'state.bench[' + slot + '].status');
            if (be.ability) takeFromState(out, src, 'ability', be.ability, 'state.bench[' + slot + '].ability');
            if (be.item) takeFromState(out, src, 'item', be.item, 'state.bench[' + slot + '].item');
        } else {
            src.hpPct = 'NOT applied — this slot is not in state.bench (fainted/KO-ed or switch banned)';
            src.ability = out.ability === undefined ? 'NOT applied — not in state.bench' : 'your input';
            src.item = out.item === undefined ? 'NOT applied — not in state.bench' : 'your input';
        }
        takeFromState(out, src, 'boosts', {}, 'bench pokemon: stat stages reset on switch-in');
    } else {
        var me = state.me || {};
        var ms = null, arr = state.myStats || [];
        for (var i = 0; i < arr.length; i++) { if (String(arr[i].slot) === '0') ms = arr[i]; }
        if (!ms && arr.length) ms = arr[0];
        takeFromState(out, src, 'poke', me.name, 'state.me.name');
        if (ms) {
            if (ms.level) takeFromState(out, src, 'level', ms.level, 'state.myStats.level');
            if (ms.ev) takeFromState(out, src, 'ev', ms.ev, 'state.myStats.ev');
            if (ms.iv) takeFromState(out, src, 'iv', ms.iv, 'state.myStats.iv');
            if (ms.nature !== undefined && ms.nature !== null) takeFromState(out, src, 'nature', ms.nature, 'state.myStats.nature');
        }
        takeFromState(out, src, 'boosts', me.boosts ? parseStateBoosts(me.boosts) : null, 'state.me.boosts');
        if (me.hpPct !== undefined && me.hpPct !== null) takeFromState(out, src, 'hpPct', me.hpPct, 'state.me.hpPct');
        if (me.status && STATE_STATUS_MAP[me.status]) takeFromState(out, src, 'status', STATE_STATUS_MAP[me.status], 'state.me.status');
        takeFromState(out, src, 'ability', me.ability, 'state.me.ability');
        takeFromState(out, src, 'item', me.item, 'state.me.item');
        if (out.ability === undefined) src.ability = 'NOT applied — state has no ability for my active pokemon';
        if (out.item === undefined) src.item = 'NOT applied — state has no item (none held?)';
    }
    src.__where = where;
    return { spec: out, src: src };
}

// 「没写 from_state 的那一侧」：state 只补它没给的空缺，**不覆盖**它显式给的值。
// （它可能是另一只宝可梦/假设配置，被 state 的当前场上这一只顶掉就成了「自己打自己」）
function pklmNormName(x) {
    return String(x === undefined || x === null ? '' : x).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}
function keepExplicitSide(res, orig) {
    var origName = (orig.poke !== undefined && orig.poke !== null) ? orig.poke : orig.name;
    var stName = (res.spec.poke !== undefined && res.spec.poke !== null) ? res.spec.poke : res.spec.name;
    // 这一侧显式写的是**另一只**宝可梦 → 整侧不填（否则会把场上这只的道具/特性/HP% 安到它头上）
    if (origName && stName && pklmNormName(origName) !== pklmNormName(stName)) {
        var spec = {}, src = {};
        for (var k0 in orig) { if (k0 !== 'from_state') spec[k0] = orig[k0]; }
        src.__where = res.src.__where;
        src.__note = 'NOT filled from state — this side did not ask for from_state and names a different pokemon than the state\'s active one';
        for (var k1 in spec) src[k1] = 'your input (kept: names a different pokemon)';
        return { spec: spec, src: src };
    }
    for (var k in orig) {
        if (k === 'from_state') continue;
        if (orig[k] === undefined || orig[k] === null) continue;
        if (JSON.stringify(res.spec[k]) !== JSON.stringify(orig[k])) {
            res.src[k] = 'your input (kept — this side did not ask for from_state)';
        } else if (!res.src[k]) {
            res.src[k] = 'state (matches your input)';
        }
        res.spec[k] = orig[k];
    }
    return res;
}

// 用宝可梦名字反查它在 state 里的槽位（我方 myStats/bench 全量；对手只查已亮相的 oppTeam）。
// 用于纠正 `from_state:'me'`（=场上）+ 显式点名后备/别的宝可梦 这种写法。
function resolveSlotByName(st, who, name) {
    if (!st || !name) return null;
    var want = pklmNormName(name);
    if (!want) return null;
    if (who === 'me') {
        var arr = st.myStats || [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] && arr[i].name && pklmNormName(arr[i].name) === want) {
                return { slot: (arr[i].slot !== undefined ? arr[i].slot : i), from: 'state.myStats[' + (arr[i].slot !== undefined ? arr[i].slot : i) + '].name' };
            }
        }
    } else {
        var ot = st.oppTeam || [];
        for (var k = 0; k < ot.length; k++) {
            if (ot[k] && ot[k].name && ot[k].revealed !== false && pklmNormName(ot[k].name) === want) {
                return { slot: k, from: 'state.oppTeam[' + k + '].name (revealed)' };
            }
        }
    }
    return null;
}

// 把 state 的场上参数填进 leg（返回新 leg；不适用时原样返回）。同时把天气/场地/防守方双墙填进 field。
function applyStateToLeg(leg, ctx) {
    var st = (ctx && ctx.state) || null;
    var aSpec = (leg && leg.attacker) || {};
    var dSpec = (leg && leg.defender) || {};
    if (!aSpec.from_state && !dSpec.from_state) return leg;
    if (!st) {   // 没有 state（例如 run_js 沙箱里调用）→ 标记出来，让上层给明确报错
        var miss = {};
        for (var mk in leg) miss[mk] = leg[mk];
        miss._fromStateMissing = true;
        return miss;
    }
    var aReq = parseFromState(aSpec.from_state, 'me');
    var dReq = parseFromState(dSpec.from_state, 'opp');
    // 只有一侧写了 from_state 时，另一侧默认取「对侧」。**绝不能默认成 me**：
    // LLM 常写 {attacker:{poke:'Tapu Bulu'}, defender:{from_state:'me'}}（算「对手打我」），
    // 旧代码把缺失的攻击侧默认成 me → 用 state.me 静默覆盖掉它显式写的对手，
    // 结果算成「自己打自己」（实测 battle91 T1/T2：Tapu Bulu 木槌 → 变成 Scizor 木槌）。
    if (aReq.who === null && dReq.who !== null) aReq.who = (dReq.who === 'me' ? 'opp' : 'me');
    if (dReq.who === null && aReq.who !== null) dReq.who = (aReq.who === 'me' ? 'opp' : 'me');
    // 「from_state 写了场上一侧，却又显式点名另一只」→ 用名字反查槽位（battle93 T1：
    // 它写 {from_state:'me', poke:'Tapu Koko'} 想算「换上 Tapu Koko 打」，而 'me' 是**场上** Toxapex，
    // 名字被覆盖 → 算出 Toxapex 的招）。命中槽位就改用它，并把纠正过程记进 inputs_used。
    var slotFix = {};
    var aNamed = (aSpec.poke !== undefined && aSpec.poke !== null) ? aSpec.poke : aSpec.name;
    var dNamed = (dSpec.poke !== undefined && dSpec.poke !== null) ? dSpec.poke : dSpec.name;
    if (aReq.slot === null && aNamed) {
        var hitA = resolveSlotByName(st, aReq.who, aNamed);
        if (hitA && Number(hitA.slot) !== 0) { aReq.slot = Number(hitA.slot); slotFix.attacker = 'from_state "' + aReq.who + '" resolved by name "' + aNamed + '" → ' + aReq.who + ':' + aReq.slot + ' (' + hitA.from + ')'; }
    }
    if (dReq.slot === null && dNamed) {
        var hitD = resolveSlotByName(st, dReq.who, dNamed);
        if (hitD && Number(hitD.slot) !== 0) { dReq.slot = Number(hitD.slot); slotFix.defender = 'from_state "' + dReq.who + '" resolved by name "' + dNamed + '" → ' + dReq.who + ':' + dReq.slot + ' (' + hitD.from + ')'; }
    }
    var a = applyFromState(st, aSpec, aReq.who, aReq.slot);
    var d = applyFromState(st, dSpec, dReq.who, dReq.slot);
    // 没写 from_state 的那一侧（implied）：只补它没给的空缺，**不覆盖**它显式给的值
    //（否则它可能指定的是另一只宝可梦，会被 state 的场上这一只顶掉）
    if (aReq.who !== null && !aSpec.from_state) a = keepExplicitSide(a, aSpec);
    if (dReq.who !== null && !dSpec.from_state) d = keepExplicitSide(d, dSpec);

    var field = {};
    if (st.weather) field.weather = st.weather;
    if (st.terrain) field.terrain = st.terrain;
    // 减伤看的是「防守方那一侧」的双墙（防守方是场下也只是同一侧，看 side 不看 slot）
    var dScr = (st.screens && st.screens[dReq.who]) || [];
    for (var i = 0; i < dScr.length; i++) {
        if (dScr[i] === 'Reflect') field.reflect = true;
        else if (dScr[i] === 'Light Screen') field.lightScreen = true;
        else if (dScr[i] === 'Aurora Veil') field.auroraVeil = true;
    }
    if (leg.field) { for (var fk in leg.field) field[fk] = leg.field[fk]; }   // 显式给的优先

    var out = {};
    for (var k in leg) out[k] = leg[k];
    out.attacker = a.spec;
    out.defender = d.spec;
    out.field = field;
    out._fromState = {
        attacker_side: aReq.who + (aReq.slot === null ? ' (active)' : ':' + aReq.slot),
        defender_side: dReq.who + (dReq.slot === null ? ' (active)' : ':' + dReq.slot),
        attacker_asked: !!aSpec.from_state, defender_asked: !!dSpec.from_state,
        slot_resolved_by_name: (slotFix.attacker || slotFix.defender) ? slotFix : undefined,
        note: (!!aSpec.from_state && !!dSpec.from_state) ? undefined
            : ('the side without from_state was filled with the OPPOSITE side\'s state, and only where you left a field empty — your explicit values on it were kept'),
        attacker_src: a.src, defender_src: d.src,
        field_from_state: { weather: st.weather || null, terrain: st.terrain || null, defender_screens: dScr }
    };
    return out;
}

// from_state 填不出这一侧时（例如对手后备未亮相/槽位越界），把原因拼进错误里，避免只报 "unknown pokemon"
function fromStateHint(leg, side) {
    if (!leg || !leg._fromState) return '';
    var src = (side === 'attacker') ? leg._fromState.attacker_src : leg._fromState.defender_src;
    var where = (side === 'attacker') ? leg._fromState.attacker_side : leg._fromState.defender_side;
    if (!src || !src.poke) return '';
    return ' — from_state "' + where + '" could not fill this side: ' + src.poke + ' (pass the pokemon explicitly instead)';
}

// 单组伤害计算。
// 引擎 = 内嵌的官方计算器 @smogon/calc（vendor/，gen8），特性/道具/天气/场地/光墙/状态等修正全部由它算；
// 我们负责：入参解析（名字/编号/种族值/直接能力值）→ 填进计算器 → 把结果整成 PS 风格输出（desc/KO/notes）。
function calcOneLeg(leg, idx, ctx) {
    leg = applyStateToLeg(leg, ctx);
    if (leg._fromStateMissing) return { index: idx, error: 'from_state needs the live battle state, which is not available on this call path (e.g. run_js) — pass the pokemon/params explicitly instead' };
    var atk = resolvePokemonInput(leg.attacker);
    if (atk.error) return { index: idx, error: atk.error + fromStateHint(leg, 'attacker') };
    var def = resolvePokemonInput(leg.defender);
    if (def.error) return { index: idx, error: def.error + fromStateHint(leg, 'defender') };
    var mv = resolveMoveInput(leg.move);
    if (mv.error) return { index: idx, error: mv.error };

    if (mv.power === 0 || mv.category === 'Status') {
        return { index: idx, min: 0, max: 0, percent_min: 0, percent_max: 0, detail: { category: 'Status', note: 'non-damaging move' } };
    }

    var lv = leg.attacker.level || 100;
    var defLv = leg.defender.level || lv;
    var aNature = resolveNature(leg.attacker);
    var dNature = resolveNature(leg.defender);
    var notes = [];

    // ---- 暴击 ----
    // 调用方显式给 isCrit 优先；否则按数据自动判定「必定 CT」招式（crit_rate >= 6）
    var isCrit;
    if (leg.isCrit === true) { isCrit = true; notes.push('critical hit (explicit)'); }
    else if (leg.isCrit === false) { isCrit = false; }
    else if (mv.crit_rate >= CRIT_ALWAYS_RATE) { isCrit = true; notes.push('always-critical move (auto)'); }
    else { isCrit = false; }
    if (!isCrit && leg.isCrit === undefined && mv.crit_rate >= 1) notes.push('high critical-hit ratio (crit NOT assumed in this calc)');

    // ---- 鳃咬/电喙：先手（或目标本回合换入）威力翻倍 ----
    // 判定交给计算器（它按有效速度比），这里只记录 LLM 的显式意图说明；实际生效见下方 speed hint。
    if (MV_FIRST_DOUBLE[mv.num]) {
        if (leg.targetSwitchedIn === true) notes.push('Fishious Rend/Bolt Beak: BP doubled (target switched in this turn)');
        else if (leg.attackerMovesFirst === true) notes.push('Fishious Rend/Bolt Beak: BP doubled (attacker moves first)');
        else if (leg.attackerMovesFirst === false) notes.push('Fishious Rend/Bolt Beak: BP NOT doubled (attacker moves last)');
        else notes.push('Fishious Rend/Bolt Beak: BP doubling decided by effective Speed (must outspeed to double)');
    }
    if (leg.power_multiplier !== undefined && leg.power_multiplier !== null) {
        notes.push('BP x' + leg.power_multiplier + ' (manual override)');
    }

    // ---- 攻/防能力值（含属性替换招式；暴击时忽略攻击方负向 / 防御方正向等级）----
    var aStat, dStat;
    var aStatLabel, dStatLabel;
    var aAssumed = [], dAssumed = [];
    var aIdxUsed, dIdxUsed;
    var aEvSpec = leg.attacker, aEvNature = aNature;

    if (mv.num === MV_BODY_PRESS) {
        // 使用者 Def 当攻击值
        aStatLabel = 'Def'; aIdxUsed = 2;
        if (leg.attacker.def !== undefined && leg.attacker.def !== null) aStat = modStat(leg.attacker.def, critBoost(boostOf(leg.attacker.boosts, 'def'), 'def', isCrit));
        else {
            var aBoP = (isCrit && boostOf(leg.attacker.boosts, 'def') > 0) ? null : leg.attacker.boosts;
            aStat = effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, aBoP, 2);
            markAssumed(aAssumed, leg.attacker, true);
        }
    } else if (mv.num === MV_FOUL_PLAY) {
        // 目标 Atk 当攻击值
        aStatLabel = 'Atk'; aIdxUsed = 1;
        aEvSpec = leg.defender; aEvNature = dNature;
        if (leg.defender.atk !== undefined && leg.defender.atk !== null) aStat = modStat(leg.defender.atk, critBoost(boostOf(leg.defender.boosts, 'atk'), 'atk', isCrit));
        else {
            var aBoF = (isCrit && boostOf(leg.defender.boosts, 'atk') < 0) ? null : leg.defender.boosts;
            aStat = effectiveStat(def.baseStats, defLv, leg.defender.ev, leg.defender.iv, dNature, aBoF, 1);
            markAssumed(dAssumed, leg.defender, true);
        }
    } else if (mv.category === 'Special') {
        aStatLabel = 'SpA'; aIdxUsed = 3;
        if (leg.attacker.spa !== undefined && leg.attacker.spa !== null) aStat = modStat(leg.attacker.spa, critBoost(boostOf(leg.attacker.boosts, 'spa'), 'atk', isCrit));
        else {
            var aBoS = (isCrit && boostOf(leg.attacker.boosts, 'spa') < 0) ? null : leg.attacker.boosts;
            aStat = effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, aBoS, 3);
            markAssumed(aAssumed, leg.attacker, true);
        }
    } else {
        aStatLabel = 'Atk'; aIdxUsed = 1;
        if (leg.attacker.atk !== undefined && leg.attacker.atk !== null) aStat = modStat(leg.attacker.atk, critBoost(boostOf(leg.attacker.boosts, 'atk'), 'atk', isCrit));
        else {
            var aBoA = (isCrit && boostOf(leg.attacker.boosts, 'atk') < 0) ? null : leg.attacker.boosts;
            aStat = effectiveStat(atk.baseStats, lv, leg.attacker.ev, leg.attacker.iv, aNature, aBoA, 1);
            markAssumed(aAssumed, leg.attacker, true);
        }
    }

    // 防御值：Psyshock/Psystrike/Secret Sword 走 Def
    var hitsPhysical = !!MV_DEF_OVERRIDE[mv.num] || mv.category === 'Physical';
    if (hitsPhysical) {
        dStatLabel = 'Def'; dIdxUsed = 2;
        if (leg.defender.def !== undefined && leg.defender.def !== null) dStat = modStat(leg.defender.def, critBoost(boostOf(leg.defender.boosts, 'def'), 'def', isCrit));
        else {
            var dBoP = (isCrit && boostOf(leg.defender.boosts, 'def') > 0) ? null : leg.defender.boosts;
            dStat = effectiveStat(def.baseStats, defLv, leg.defender.ev, leg.defender.iv, dNature, dBoP, 2);
            markAssumed(dAssumed, leg.defender, true);
        }
    } else {
        dStatLabel = 'SpD'; dIdxUsed = 4;
        if (leg.defender.spd !== undefined && leg.defender.spd !== null) dStat = modStat(leg.defender.spd, critBoost(boostOf(leg.defender.boosts, 'spd'), 'def', isCrit));
        else {
            var dBoS = (isCrit && boostOf(leg.defender.boosts, 'spd') > 0) ? null : leg.defender.boosts;
            dStat = effectiveStat(def.baseStats, defLv, leg.defender.ev, leg.defender.iv, dNature, dBoS, 4);
            markAssumed(dAssumed, leg.defender, true);
        }
    }

    // ===== 交给官方计算器（@smogon/calc）：特性/道具/天气/场地/光墙/状态等修正全自动 =====
    var excl = modifierFieldsGiven(leg);
    if (leg.extra !== undefined && leg.extra !== null && excl.length) {
        return {
            index: idx,
            error: '`extra` cannot be combined with ' + excl.join(', ') +
                ' — pass EITHER the modifier inputs (ability / item / status / burn / field, which the calculator applies automatically) OR one manual `extra` multiplier, never both'
        };
    }

    var calcAtk = toCalcPokemon(leg.attacker);
    if (calcAtk.error) return { index: idx, error: 'attacker: ' + calcAtk.error };
    var calcDef = toCalcPokemon(leg.defender);
    if (calcDef.error) return { index: idx, error: 'defender: ' + calcDef.error };
    var calcMove = toCalcMove(mv, leg);
    if (calcMove.error) return { index: idx, error: calcMove.error };

    // 名称拼写提醒（计算器靠 PS 数据查表；拼错会静默不生效）。先做 "A/B" 这类二选一名字的归一化，
    // 替换过就说一句，替换后仍认不出才报「拼错」。
    var abA = (leg.attacker && leg.attacker.ability) ? normalizeWithNote(String(leg.attacker.ability), psAbilityExists, 'attacker ability') : null;
    var abD = (leg.defender && leg.defender.ability) ? normalizeWithNote(String(leg.defender.ability), psAbilityExists, 'defender ability') : null;
    var itA = (leg.attacker && leg.attacker.item) ? normalizeWithNote(String(leg.attacker.item), psItemExists, 'attacker item') : null;
    var itD = (leg.defender && leg.defender.item) ? normalizeWithNote(String(leg.defender.item), psItemExists, 'defender item') : null;
    if (abA && abA.note) notes.push(abA.note);
    if (abD && abD.note) notes.push(abD.note);
    if (itA && itA.note) notes.push(itA.note);
    if (itD && itD.note) notes.push(itD.note);
    if (abA && !psAbilityExists(abA.name)) notes.push('attacker ability "' + abA.name + '" not recognised by the calculator — check the spelling (nothing applied)');
    if (abD && !psAbilityExists(abD.name)) notes.push('defender ability "' + abD.name + '" not recognised by the calculator — check the spelling (nothing applied)');
    if (itA && !psItemExists(itA.name)) notes.push('attacker item "' + itA.name + '" not recognised by the calculator — check the spelling (nothing applied)');
    if (itD && !psItemExists(itD.name)) notes.push('defender item "' + itD.name + '" not recognised by the calculator — check the spelling (nothing applied)');
    // 天气/场地：名字不被识别时同样**静默不生效**（伤害照常返回，只是少了那一份修正）
    if (leg.field && leg.field.weather) {
        var normW = normalizeWeather(leg.field.weather);
        if (PS_WEATHER_NAMES.indexOf(normW) < 0) notes.push('field.weather "' + leg.field.weather + '" not recognised by the calculator (nothing applied) — use ' + PS_WEATHER_NAMES.join(' / '));
    }
    if (leg.field && leg.field.terrain) {
        var normT = normalizeTerrain(leg.field.terrain);
        if (PS_TERRAIN_NAMES.indexOf(normT) < 0) notes.push('field.terrain "' + leg.field.terrain + '" not recognised by the calculator (nothing applied) — use ' + PS_TERRAIN_NAMES.join(' / '));
    }

    // 防守方最大 HP 由计算器按种族值/EV 得出；没给 EV 就算「用了默认词条」
    if (leg.defender.hp === undefined || leg.defender.hp === null) markAssumed(dAssumed, leg.defender, false);
    // 灼伤：等价于攻击方 status='brn'（计算器内部会 ×0.5，且 CT 不豁免，Gen3+ 规则）
    if (leg.burn === true && !calcAtk.pokemon.status) calcAtk.pokemon.status = 'brn';

    // 鳃咬/电喙：显式指定先后手时，用临时速度差把意图传达给计算器（它内部只看有效速度比较）
    if (MV_FIRST_DOUBLE[mv.num]) {
        if (leg.targetSwitchedIn === true || leg.attackerMovesFirst === true) {
            calcAtk.pokemon.rawStats.spe = 9999; calcAtk.pokemon.stats.spe = 9999;
        } else if (leg.attackerMovesFirst === false) {
            calcDef.pokemon.rawStats.spe = 9999; calcDef.pokemon.stats.spe = 9999;
        }
    }

    var res;
    try {
        res = SMOGON.calculate(PKLM_GEN, calcAtk.pokemon, calcDef.pokemon, calcMove.move, toCalcField(leg.field));
    } catch (e) {
        return { index: idx, error: 'calc failed: ' + ((e && e.message) ? e.message : String(e)) };
    }
    var range = res.range();
    var min = range[0];
    var max = range[1];

    // 逐档伤害：连击招在 res.damage 里是「每次命中一个子数组」（各命中完全相同）；
    // **固定伤害招**（地球上投 Seismic Toss / 黑夜魔影 Night Shade = 使用者等级、龙之怒 Dragon Rage = 40、
    // 音爆 Sonic Boom = 20）计算器直接给一个**数字** —— 旧代码按数组处理（`res.damage.length` 为 undefined）
    // → perHit 空 → koVerdict 拿到空分布误报「guaranteed OHKO」（地球上投 100 伤害被判成必杀）
    var fixedDamage = (typeof res.damage === 'number');
    var perHit = [], hits = 1;
    if (fixedDamage) {
        perHit = [res.damage];
        hits = calcMove.move.hits || 1;
    } else if (res.damage && res.damage.length) {
        if (Array.isArray(res.damage[0])) { perHit = res.damage[0]; hits = res.damage.length; }
        else { perHit = res.damage; hits = calcMove.move.hits || 1; }
    }
    if (!hits || hits < 1) hits = 1;

    var defHp = calcDef.pokemon.rawStats.hp;
    var hpForKo = calcDef.pokemon.originalCurHP || defHp;
    var pctMin = defHp > 0 ? Math.floor(min * 100 / defHp) : 0;
    var pctMax = defHp > 0 ? Math.floor(max * 100 / defHp) : 0;
    // 实际威力（计算器算出的 BP，如鳃咬翻倍 170 / Low Kick 按体重）
    var bpShown = (res.rawDesc && res.rawDesc.moveBP) ? res.rawDesc.moveBP : calcMove.move.bp;
    var extra = (leg.extra !== undefined && leg.extra !== null) ? leg.extra : 1.0;
    // 手填 extra：计算器不认识任意 final multiplier，所以在它给出的 16 档上再乘一次
    //（等价于 @smogon 的 finalMod 应用：pokeRound(max(1, x * mod))）
    if (extra !== 1.0 && perHit.length) {
        var scaled = [];
        for (var ri = 0; ri < perHit.length; ri++) scaled.push(pokeRound(Math.max(1, perHit[ri] * extra)));
        perHit = scaled;
        min = perHit[0] * hits;
        max = perHit[perHit.length - 1] * hits;
    }
    var burnApplied = (calcAtk.pokemon.status === 'brn');
    var calcCrit = !!calcMove.move.isCrit;
    // 计算器真正识别并应用的修正项（传了却没出现在这里 = 名字没被识别）
    var applied = psPickRawDesc(res.rawDesc);
    // 没传特性时，计算器会用种族默认特性（PS 语义）——它若真的影响了伤害，必须让 LLM 知道
    if (!(leg.attacker && leg.attacker.ability) && applied.attackerAbility) {
        notes.push('no attacker ability given — the calculator applied the species DEFAULT ability "' + applied.attackerAbility + '", which changed the damage; pass the real ability and recompute if it differs');
    }
    if (!(leg.defender && leg.defender.ability) && applied.defenderAbility) {
        notes.push('no defender ability given — the calculator applied the species DEFAULT ability "' + applied.defenderAbility + '", which changed the damage; pass the real ability and recompute if it differs');
    }

    // 招式同时给了 name 与 power：name 优先，power 会被忽略 —— 数值不同就提示，避免误以为手动指定生效
    if (mv.name && leg.move.power !== undefined && leg.move.power !== null && Number(leg.move.power) !== mv.power) {
        notes.push('move.power (' + leg.move.power + ') was IGNORED because `name` is given — base power comes from the dex (' + mv.power + ' BP). For boost-scaling moves (Stored Power / Power Trip) the BP is computed from `boosts`, so pass `boosts`, not `power`.');
    }
    // 按「能力等级计数」算威力的招式：没传任何 boosts 会被严重低估（Stored Power 无强化就只有 20 BP）
    var BP_SCALING_SELF = { 'Stored Power': 1, 'Power Trip': 1 };
    var BP_SCALING_TARGET = { 'Punishment': 1 };
    if (mv.name && (BP_SCALING_SELF[mv.name] || BP_SCALING_TARGET[mv.name])) {
        var bSide = BP_SCALING_SELF[mv.name] ? leg.attacker : leg.defender;
        var anyBoost = false;
        if (bSide && bSide.boosts) { for (var bk in bSide.boosts) { if (parseInt(bSide.boosts[bk], 10)) { anyBoost = true; break; } } }
        if (!anyBoost) {
            notes.push(mv.name + ' scales its base power with ' + (BP_SCALING_SELF[mv.name] ? 'YOUR' : "the TARGET's") + ' stat stages (20 + 20 per positive stage) and you passed NO boosts, so it is computed at 20 BP. Pass `boosts` (e.g. {"def":3,"spd":3}) to get the real power.');
        }
    }
    if (mv.hit_range) notes.push('multi-hit move (2-5 times); damage below is PER HIT — pass hits to total it');
    if (hits > 1) notes.push('this is the TOTAL of ' + hits + ' hits');

    var atkName = atk.name || String(leg.attacker.poke || '?');
    var defName = def.name || String(leg.defender.poke || '?');

    // ---- 免疫 / 无效果 ----
    if (max === 0) {
        // 0 有两种含义：真的属性免疫，或**计算器算不出**这类招的伤害（固定伤害/依赖当前 HP）。
        // 用我们自己的克制表区分（防御方类型查不到时按老口径显示「免疫」）。
        var tmult = typeMultOf(mv.type, def.types);
        if (tmult !== null && tmult > 0) {
            notes.push('the calculator returned 0, but ' + (mv.name || 'this move') + ' is NOT type-immune against ' + defName + ' — its damage is fixed or depends on the current HP / on damage taken (Super Fang / Counter / Mirror Coat / Endeavor / Final Gambit / Psywave…), which the calculator cannot derive. Reason it manually from the current HP.');
            return {
                index: idx, min: 0, max: 0, percent_min: 0, percent_max: 0,
                desc: (mv.name || 'move') + ' vs. ' + defName + ': CANNOT be computed (fixed / current-HP-dependent damage) — reason it manually',
                ko: null,
                detail: {
                    attack_stat: aStat, defense_stat: dStat,
                    attack_stat_name: aStatLabel, defense_stat_name: dStatLabel,
                    defender_max_hp: defHp, type_mult: tmult, power: bpShown,
                    is_crit: calcCrit, applied: applied, notes: notes,
                    inputs_used: leg._fromState || undefined
                }
            };
        }
        if (mv.variable_power) notes.push('the calculator returned 0 for this fixed/HP-dependent move — a 0 here does NOT necessarily mean type immunity; reason it manually');
        return {
            index: idx, min: 0, max: 0, percent_min: 0, percent_max: 0,
            desc: (mv.name || 'move') + ' vs. ' + defName + ': no effect (immune, 0x)',
            ko: null,
            detail: {
                attack_stat: aStat, defense_stat: dStat,
                attack_stat_name: aStatLabel, defense_stat_name: dStatLabel,
                defender_max_hp: defHp, type_mult: 0, power: bpShown,
                is_crit: calcCrit, applied: applied, notes: notes,
                inputs_used: leg._fromState || undefined
            }
        };
    }

    // ---- KO 判定（对「当前剩余 HP」；没给就按满血）----
    var ko = koVerdict(perHit, hits, hpForKo);

    // ---- 默认词条警示（缺 EV/性格）----
    var assumed = (aAssumed.length > 0 || dAssumed.length > 0);
    if (assumed) {
        var parts = [];
        if (aAssumed.length) parts.push('attacker ' + aAssumed.join('/'));
        if (dAssumed.length) parts.push('defender ' + dAssumed.join('/'));
        notes.push('used DEFAULT values for ' + parts.join(', ') + ' (0 EV / neutral nature, IVs assumed 31) — if you know the real values, pass them and recompute');
    }
    // 图鉴里 power=1 的占位（48 招）：分三类说清楚，避免把**已经算对了的数**说成不可信
    if (mv.variable_power) {
        if (fixedDamage) {
            notes.push('FIXED-damage move: the calculator returned ' + min + ' directly (Seismic Toss / Night Shade = the USER LEVEL, Dragon Rage = 40, Sonic Boom = 20). Stats / EVs / boosts / ability / item do NOT change it — but type immunity still applies.');
        } else if (Array.isArray(res.damage)) {
            notes.push('this move\'s dex power is the placeholder 1; the calculator derived the real power from the situation (current HP / weight / stat stages), so the number above IS the computed result');
        } else {
            notes.push('this move\'s listed power (1) is a PLACEHOLDER and the calculator cannot derive it (depends on the current HP or on damage taken) — treat the number above as unreliable');
        }
    }

    // ---- PS 风格描述串（伤害值 + 场景 + KO 结论）----
    var fmt = function (v) { return defHp > 0 ? (Math.floor(v * 1000 / defHp) / 10) : 0; };
    var powerLabel = fixedDamage ? ('fixed ' + min + ' dmg') : ((bpShown !== undefined && bpShown !== null && bpShown !== 0) ? (bpShown + ' BP') : '? BP');
    var desc = evNatDesc(aEvSpec, aEvNature, aIdxUsed) + ' ' + aStatLabel + ' ' + atkName + ' ' + (mv.name || 'move') +
        ' (' + powerLabel + ') vs. ' + evNatDesc(leg.defender, dNature, 0) + ' HP / ' +
        evNatDesc(leg.defender, dNature, dIdxUsed) + ' ' + dStatLabel + ' ' + defName +
        ': ' + min + '-' + max + ' (' + fmt(min) + ' - ' + fmt(max) + '%)' + (ko ? ' -- ' + ko : '');

    return {
        index: idx,
        min: min,
        max: max,
        percent_min: pctMin,
        percent_max: pctMax,
        desc: desc,
        ko: ko,
        assumed: assumed,
        notes: notes,
        detail: {
            attack_stat: aStat,
            defense_stat: dStat,
            attack_stat_name: aStatLabel,
            defense_stat_name: dStatLabel,
            defender_max_hp: defHp,
            defender_current_hp: hpForKo,
            extra: extra,
            power: bpShown,
            hits: hits,
            is_crit: calcCrit,
            burn: burnApplied,
            assumed_fields: { attacker: aAssumed, defender: dAssumed },
            variable_power: !!mv.variable_power,
            fixed_damage: fixedDamage || undefined,
            per_hit_damage: perHit.slice(0, 4),
            applied: applied,
            inputs_used: leg._fromState || undefined
        }
    };
}

// calc_damage：最多 10 组，一次算完
function calcDamage(args, ctx) {
    if (!args.legs || !args.legs.length) return { error: 'legs required' };
    if (args.legs.length > 10) return { error: 'at most 10 legs allowed, got ' + args.legs.length };
    var out = [];
    for (var i = 0; i < args.legs.length; i++) {
        var legOut = calcOneLeg(args.legs[i], i, ctx);
        var cid = args.legs[i] ? args.legs[i].claim_id : null;
        if (cid !== undefined && cid !== null && cid !== '') {
            legOut.claim_verdict = attachClaimVerdict(ctx, cid, {
                percent_min: legOut.percent_min, percent_max: legOut.percent_max, ko: legOut.ko_verdict || legOut.ko
            });
        }
        out.push(legOut);
    }
    return { legs: out };
}

// ===== run_js 逃生舱：让 LLM 在沙箱里跑一小段同步 JS，覆盖没有现成 tool 的计算 =====
// 沙箱内可用：data（pokemon/moves/natures/typechart）、typeMul/effStat/resolvePokemon/resolveMove/calcDamage、print/console.log
// 限制：同步、无 require/process/fs、2s 超时、结果/输出各截 2000 字符。

function runJs(args, ctx) {
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

    // PP 相关 helper（PO 不提供对手的招式数据 —— 实测 team(opp).poke(i).move(j) 返回 num=0/PP=0，
    // 所以对手的「用过几次」由 po-script 计数、招式总 PP 来自 knowledge/moves.json）
    var oppTeam = (ctx && ctx.state && ctx.state.oppTeam) || [];
    function sbOppMoves(pokeName) {
        for (var i = 0; i < oppTeam.length; i++) {
            if (oppTeam[i] && oppTeam[i].name === pokeName) return oppTeam[i].moves || [];
        }
        return null;
    }
    function sbOppUsed(pokeName, moveName) {
        var ms = sbOppMoves(pokeName);
        if (!ms) return null;
        for (var i = 0; i < ms.length; i++) {
            if (ms[i].name === moveName) return ms[i].used || 0;
        }
        return null;
    }
    function sbMovePP(moveName) {
        var f = findMove(moveName);
        return (f && f.move && f.move.pp) ? f.move.pp : null;
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
        movePP: sbMovePP,
        oppMoves: sbOppMoves,
        oppUsed: sbOppUsed,
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
function calcStats(args, ctx) {
    if (!args.legs || !args.legs.length) return { error: 'legs required' };
    if (args.legs.length > 10) return { error: 'at most 10 legs allowed, got ' + args.legs.length };
    var out = [];
    for (var i = 0; i < args.legs.length; i++) {
        var legOut = calcOneStatLeg(args.legs[i], i);
        var cid = args.legs[i] ? args.legs[i].claim_id : null;
        if (cid !== undefined && cid !== null && cid !== '' && legOut && legOut.stats && legOut.stats.spe !== undefined) {
            legOut.claim_verdict = attachClaimVerdict(ctx, cid, { speed: legOut.stats.spe });
        }
        out.push(legOut);
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
    // 队伍当前状态（含已倒下）：myStats 只有数值，这里按 slot 补上 HP%/是否 KO，LLM 才知道自己还剩几只、谁已阵亡
    var teamBySlot = {};
    var myTeam = (state && state.myTeam) || [];
    for (var t = 0; t < myTeam.length; t++) {
        if (myTeam[t] && myTeam[t].slot !== undefined) teamBySlot[String(myTeam[t].slot)] = myTeam[t];
    }
    var out = [];
    for (var i = 0; i < myStats.length; i++) {
        var m = myStats[i];
        if (wanted && m.name !== wanted && String(m.slot) !== wanted) continue;
        var p = POKEMON.byNum[String(m.numRef)];
        if (!p && m.name) {
            var nk = POKEMON.byName[String(m.name).toLowerCase()];   // byName 的值是 byNum 的 key（字符串）
            if (nk) p = POKEMON.byNum[nk];
        }
        if (!p) {
            // PO 的 numRef 用高位编码形态：Raichu-Alola = 65562 = 0x1001A -> forme 1, num 26
            var baseNum = m.numRef & 0xFFFF;
            var forme = m.numRef >> 16;
            if (forme) p = POKEMON.byNum[baseNum + ':' + forme];
            if (!p) p = POKEMON.byNum[String(baseNum)];
        }
        if (!p) { out.push({ slot: m.slot, name: m.name, error: 'unknown numRef ' + m.numRef }); continue; }
        var nat = NATURES.byNum[String(m.nature)] || { buff: 0, debuff: 0 };
        var stats = {};
        for (var s = 0; s < 6; s++) {
            stats[STAT_NAMES[s]] = effectiveStat(p.baseStats, m.level, m.ev, m.iv, nat, null, s);
        }
        var entry = { slot: m.slot, name: m.name, level: m.level, nature: m.nature, stats: stats };
        var tm = teamBySlot[String(m.slot)];
        if (tm) {
            entry.hpPct = tm.hpPct;
            entry.ko = !!tm.ko;
            if (tm.status) entry.status = tm.status;
        }
        out.push(entry);
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
    '替身': 'substitute', 'substitute': 'substitute', 'sub': 'substitute',
    '速度': 'speed_read', '速度线': 'speed_read', '速度判断': 'speed_read', '行动顺序': 'speed_read', '出手顺序': 'speed_read',
    '先手': 'speed_read', '先制': 'speed_read', '优先度': 'speed_read', 'speed': 'speed_read', 'speed read': 'speed_read',
    'turn order': 'speed_read', 'priority': 'speed_read', '鳃咬': 'speed_read', '电喙': 'speed_read',
    'fishious rend': 'speed_read', 'bolt beak': 'speed_read',
    '天然': 'unaware', 'unaware': 'unaware', '无视能力等级': 'unaware', '无视强化': 'unaware', '无视能力变化': 'unaware',
    '辅助力量': 'unaware', 'stored power': 'unaware', 'storedpower': 'unaware',
    '嚣张': 'unaware', 'power trip': 'unaware', 'powertrip': 'unaware',
    '惩罚': 'unaware', 'punishment': 'unaware', 'boost scaling': 'unaware',
    '天气扣血': 'weather_chip', '沙暴伤害': 'weather_chip', '沙暴掉血': 'weather_chip', '天气伤害': 'weather_chip',
    '间接伤害': 'weather_chip', '魔法守护': 'weather_chip', '魔法防守': 'weather_chip',
    'magic guard': 'weather_chip', 'magicguard': 'weather_chip', 'weather chip': 'weather_chip'
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
    // 最大 PP（PS 数据；用于判断对手还能点几次这招——注意这不是剩余 PP，压力特性/PP Up 会让它偏）
    if (mv.pp) out.pp = mv.pp;
    // 附加效果数值（为 0 的字段不输出，避免噪音）
    if (mv.effect_chance) out.effect_chance = mv.effect_chance;   // 附加效果触发概率 %
    if (mv.flinch_chance) out.flinch_chance = mv.flinch_chance;   // 畏缩概率 %
    if (mv.healing) out.healing = mv.healing;                     // 回复/自损 %（负值=自损）
    if (mv.crit_rate) out.crit_rate = mv.crit_rate;               // 暴击等级（>=1 高暴击；6 = 必定暴击）
    if (mv.hits && mv.hits > 1) out.hits = mv.hits;               // 固定连击次数（伤害需乘算）
    if (mv.hit_range) out.hit_range = mv.hit_range;               // 浮动连击次数 [min,max]
    if (mv.variable_power) {                                      // power=1 占位（固定伤害/浮动威力/Z 招）
        out.variable_power = true;
        out.power_note = 'the listed power (1) is a PLACEHOLDER — this move deals fixed or HP-dependent damage; do not treat it as a real base power';
    }
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
        desc_en: a.desc_en || '',   // PO 中文描述有时较笼统（如魔法镜只写「随时处于魔装反射状态」），英文对战描述更具体（明确列出 Defog/Roar/Whirlwind 等）
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

// ===== get_pokemon_info：宝可梦图鉴（种族值/属性/可能特性/体重 + 学习面）=====
// 数据：pokemon.json（种族值/属性/体重/特性编号）+ abilities.json（特性编号->名称）+ learnsets.json（学习面，源 pokemon-showdown）
function resolvePokemonKey(poke) {
    if (poke === undefined || poke === null || poke === '') return null;
    var s = String(poke).trim();
    if (POKEMON.byNum[s] !== undefined) return s;
    var k1 = POKEMON.byName[s.toLowerCase()];   // 英文名（小写）
    if (k1 !== undefined && POKEMON.byNum[k1] !== undefined) return k1;
    var k2 = POKEMON.byName[s];                 // 中文名（原样）
    if (k2 !== undefined && POKEMON.byNum[k2] !== undefined) return k2;
    return null;
}

// 招式名/编号 -> MOVES 的 key（编号字符串）
function resolveMoveNum(mv) {
    var s = String(mv).trim();
    if (/^\d+$/.test(s) && MOVES[s]) return s;
    var lower = s.toLowerCase();
    for (var k in MOVES) {
        var m = MOVES[k];
        if ((m.name && m.name.toLowerCase() === lower) || (m.name_zh && m.name_zh === s)) return k;
    }
    return null;
}

function getPokemonInfo(args) {
    var poke = args.pokemon || args.poke;
    if (!poke) return { error: 'missing pokemon' };
    var key = resolvePokemonKey(poke);
    if (!key) return { error: 'unknown pokemon: ' + poke };
    var p = POKEMON.byNum[key];

    // 种族值：数组 -> 具名对象，附总和
    var baseStats = {};
    var bst = 0;
    for (var s = 0; s < STAT_NAMES.length; s++) {
        var v = (p.baseStats && p.baseStats[s] !== undefined) ? p.baseStats[s] : null;
        baseStats[STAT_NAMES[s]] = v;
        if (v) bst += v;
    }

    // 可能特性：编号 -> {id, name, name_zh}
    var abilities = [];
    if (p.abilities && p.abilities.length) {
        for (var a = 0; a < p.abilities.length; a++) {
            var ab = ABILITIES.byNum[String(p.abilities[a])];
            abilities.push({
                id: p.abilities[a],
                name: (ab && ab.name) || '(unknown)',
                name_zh: (ab && ab.name_zh) || ''
            });
        }
    }

    var out = {
        key: key,
        name: p.name_en,
        name_zh: p.name_zh || '',
        types: p.types || [],
        baseStats: baseStats,
        baseStatTotal: bst,
        weight: (p.weight !== undefined) ? p.weight : null,
        abilities: abilities
    };

    var list = LEARNSETS.byKey[key] || null;

    // 模式 a：校验指定招式是否可学
    if (args.moves && args.moves.length) {
        var checks = [];
        for (var i = 0; i < args.moves.length; i++) {
            var num = resolveMoveNum(args.moves[i]);
            var known = num ? MOVES[num] : null;
            checks.push({
                move: (known && known.name) || String(args.moves[i]),
                move_num: num ? Number(num) : null,
                can_learn: (num && list && list.indexOf(Number(num)) >= 0) ? true : false
            });
        }
        out.checks = checks;
        return out;
    }

    // 模式 b：显式请求才吐整份招式池（~90 条，避免默认膨胀上下文）
    if (args.full_movepool) {
        if (!list) return out;
        var movepool = [];
        for (var j = 0; j < list.length; j++) {
            var mm = MOVES[String(list[j])];
            if (mm) movepool.push(mm.name);
        }
        out.movepool = movepool;
        out.movepool_count = movepool.length;
        return out;
    }

    out.movepool_count = list ? list.length : 0;
    return out;
}

// ===== update_worklog：本轮工作暂存（覆盖式）。内容由 server 注入回 system，实现「始终在上下文」=====
function updateWorklog(args, ctx) {
    var text = (args && args.text) ? String(args.text) : '';
    if (ctx && typeof ctx.setWorklog === 'function') ctx.setWorklog(text);
    return { ok: true, chars: text.length };
}

// tool 执行器：根据 name 分发；ctx 含 state（供 get_battle_history 读取战报）+ notes（笔记存储）+ turn + setWorklog
function runTool(name, args, ctx) {
    if (name === 'get_type_matchup') return getTypeMatchup(args, ctx);
    if (name === 'calc_stat_boost') return calcStatBoost(args);
    if (name === 'get_battle_history') return getBattleHistory(args, ctx && ctx.state);
    if (name === 'save_observation') return saveObservation(args, ctx);
    if (name === 'save_strategy') return saveStrategy(args, ctx);
    if (name === 'simulate_turn') return simulateTurn(args, ctx);
    if (name === 'predict') return registerClaims(args, ctx);
    if (name === 'update_worklog') return updateWorklog(args, ctx);
    if (name === 'get_observation') return getObservation(args, ctx);
    if (name === 'get_strategy') return getStrategy(args, ctx);
    if (name === 'submit_feedback') return submitFeedback(args, ctx);
    if (name === 'calc_damage') return calcDamage(args, ctx);
    if (name === 'run_js') return runJs(args, ctx);
    if (name === 'calc_stats') return calcStats(args, ctx);
    if (name === 'get_my_stats') return getMyStats(args, ctx);
    if (name === 'battle_tips') return battleTips(args);
    if (name === 'get_knowledge') return getKnowledge(args);
    if (name === 'get_move_info') return getMoveInfo(args);
    if (name === 'get_ability_info') return getAbilityInfo(args);
    if (name === 'get_item_info') return getItemInfo(args);
    if (name === 'get_pokemon_info') return getPokemonInfo(args);
    return { error: 'unknown tool: ' + name };
}

module.exports = {
    TYPE_NAMES: TYPE_NAMES,
    CHART: CHART,
    typeIndex: typeIndex,
    TOOL_DEFS: TOOL_DEFS,
    runTool: runTool,
    newLedger: newLedger,
    actionGateCheck: actionGateCheck,
    moveAccuracy: moveAccuracy,
    moveCritStage: moveCritStage
};
