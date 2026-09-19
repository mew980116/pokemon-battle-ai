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
                    checks: { type: 'string', description: 'Assumptions your later turns must verify against the battle log, written as tests (e.g. "verify X hits harder than I assumed, refuted if <40%"; "check whether X is really faster"). The most recent TWO turns\' checks are merged into later prompts; drop ones already resolved.' }
                },
                required: ['text', 'scene', 'checks']
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

// 记录当前回合的战略思路（默认用当前 turn；可显式指定 turn）
// 存成 {text, scene, checks}：text = 本回合推演（不回灌）；scene = 预设的下次决策场面（回灌 1 条，用于与实况对比）；
// checks = 留给后续回合核对的待验证假设（回灌最近 2 条）
function saveStrategy(args, ctx) {
    if (!args.text) return { error: 'text required' };
    if (!args.scene) return { error: 'scene required (the board you expect at your next decision)' };
    if (!args.checks) return { error: 'checks required (the assumptions your later turns should verify against the battle log)' };
    var notes = ctx && ctx.notes;
    if (!notes) return { error: 'no notes store' };
    if (!notes.turns) notes.turns = {};
    var t = (args.turn !== undefined && args.turn !== null) ? parseInt(args.turn, 10) : (ctx.turn || 0);
    notes.turns[String(t)] = { text: String(args.text), scene: String(args.scene), checks: String(args.checks) };
    return { ok: true, turn: t };
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
    if (spec.ability) opts.ability = String(spec.ability);
    if (spec.item) opts.item = String(spec.item);
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

    // 名称拼写提醒（计算器靠 PS 数据查表；拼错会静默不生效）
    if (leg.attacker && leg.attacker.ability && !psAbilityExists(leg.attacker.ability)) notes.push('attacker ability "' + leg.attacker.ability + '" not recognised by the calculator — check the spelling (nothing applied)');
    if (leg.defender && leg.defender.ability && !psAbilityExists(leg.defender.ability)) notes.push('defender ability "' + leg.defender.ability + '" not recognised by the calculator — check the spelling (nothing applied)');
    if (leg.attacker && leg.attacker.item && !psItemExists(leg.attacker.item)) notes.push('attacker item "' + leg.attacker.item + '" not recognised by the calculator — check the spelling (nothing applied)');
    if (leg.defender && leg.defender.item && !psItemExists(leg.defender.item)) notes.push('defender item "' + leg.defender.item + '" not recognised by the calculator — check the spelling (nothing applied)');
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

    // 逐档伤害：连击招在 res.damage 里是「每次命中一个子数组」（各命中完全相同）
    var perHit = [], hits = 1;
    if (res.damage && res.damage.length) {
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
    // power=1 的占位威力
    if (mv.variable_power) {
        notes.push('this move\'s listed power (1) is a PLACEHOLDER — it deals fixed or HP-dependent damage; do NOT use the number below as its real power');
    }

    // ---- PS 风格描述串（伤害值 + 场景 + KO 结论）----
    var fmt = function (v) { return defHp > 0 ? (Math.floor(v * 1000 / defHp) / 10) : 0; };
    var desc = evNatDesc(aEvSpec, aEvNature, aIdxUsed) + ' ' + aStatLabel + ' ' + atkName + ' ' + (mv.name || 'move') +
        ' (' + bpShown + ' BP) vs. ' + evNatDesc(leg.defender, dNature, 0) + ' HP / ' +
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
        out.push(calcOneLeg(args.legs[i], i, ctx));
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
    if (name === 'get_type_matchup') return getTypeMatchup(args);
    if (name === 'calc_stat_boost') return calcStatBoost(args);
    if (name === 'get_battle_history') return getBattleHistory(args, ctx && ctx.state);
    if (name === 'save_observation') return saveObservation(args, ctx);
    if (name === 'save_strategy') return saveStrategy(args, ctx);
    if (name === 'update_worklog') return updateWorklog(args, ctx);
    if (name === 'get_observation') return getObservation(args, ctx);
    if (name === 'get_strategy') return getStrategy(args, ctx);
    if (name === 'submit_feedback') return submitFeedback(args, ctx);
    if (name === 'calc_damage') return calcDamage(args, ctx);
    if (name === 'run_js') return runJs(args, ctx);
    if (name === 'calc_stats') return calcStats(args);
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
    runTool: runTool
};
