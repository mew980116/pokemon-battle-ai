# po-pokellmon-tool（路线 3：思考 + tool）

移植 PokeLLMon 的第三条基础路线：**思考模式 + function calling / tool**。
把主脚本 [20201227_v1.3.1.js](../20201227_v1.3.1.js) 里的确定性计算封装成 tool，供 DeepSeek 在决策前动态调用（类似 coding agent 的 tool 模式）。

## 与 po-pokellmon（路线 1）的关系

| | po-pokellmon（无思考） | po-pokellmon-tool（本目录） |
|---|---|---|
| 思考模式 | `thinking:disabled` | 默认 `disabled`；仅首回合（turn 0）单独开 `reasoning_effort:low` |
| 超时 | 20s | 240s（放宽，tool 多轮往返慢） |
| max_tokens | null | null（不限制） |
| tool | 无 | 有（function calling，19 个） |
| 端口 | 8091 | 8092 |
| 定位 | 服务（快、稳） | 实验（测 LLM 能力上限，需 no timeout） |

## 当前实现

**harness**（[server.js](server.js)）已跑通 function calling 多轮 loop：

1. 接收 PO 采集的 `state` → 拼 prompt + `tools` 定义
2. 调 DeepSeek（默认无思考；首回合开 low 思考 + tool）
3. 若返回 `tool_calls` → 执行 tool → 结果追加进 messages → 再调（最多 `MAX_TOOL_ROUNDS=25` 轮）
4. 直到返回最终 `{"choice":N}` → 解析成 slot 动作

**tool**（[tools.js](tools.js)，19 个；当前暴露 18 个）：

*战场 / 笔记*

- `get_battle_history(start_turn?, end_turn?)` —— 读取过往战报（按回合范围，不传则全文；数据来自 PO 侧 `state.fullHistory`）
- `save_observation(pokemon, text, append?)` —— 记录/覆盖（append=true 追加）对某只对手宝可梦的观察
- `save_strategy(text, turn?)` —— 记录当前回合的战略思路
- `get_observation(pokemon?)` —— 读观察（不传返回全部）
- `get_strategy(turn?)` —— 读思路（不传返回全部）
- `update_worklog(text)` —— 本轮工作暂存（覆盖式），server 每轮注入回 system。**当前已屏蔽**（server.js `ENABLE_WORKLOG=false`：不暴露给模型、WORKFLOW 不提、system 不注入）。屏蔽依据（battle93/94/95 实测）：约 28% 的 tool 轮次被它独占一次 LLM 往返（从不与其他 tool 合并），且 LLM 把它当思考通道的替代品，中段常写成千字内心独白、夹带未清洗的 thinking / DSML 残留。改回 `true` 即恢复
- `submit_feedback(text)` —— 反馈「想要的 tool」/ 报告伤害计算异常

*确定计算*

- `get_type_matchup(attack_type, defend_types)` —— 类型克制倍率（移植 `typechart`）
- `calc_stat_boost(base_stat, boost)` —— 能力等级修正（移植 `calcStatWhenBoost`）
- `calc_damage(legs)` —— 伤害计算：最多 10 组（攻击方/防守方/招式），返回 0.85x/1.0x 随机档伤害 + 防守方 HP 百分比 + detail（攻击/防御能力值、STAB、克制倍率）。基础计算器，不含道具/特性/天气/场地/烧伤/暴击等自动加成，用 `extra` 系数手动补
- `calc_stats(legs)` —— 能力值计算：最多 10 组（名/种族值 + ev/iv/nature/boosts），返回指定项（或全六维）能力值，含性格与能力等级修正。用于速度评估/能力估算
- `get_my_stats(poke?)` —— 读我方实际宝可梦的无加成六维（真实 ev/iv/nature/level，PO 侧采集进 state.myStats）；不传 poke 返回全队
- `run_js(code)` —— 逃生舱：LLM 在 `vm` 沙箱跑一段同步 JS，覆盖无现成 tool 的计算（如速度对比、批量伤害、自定义评分）。沙箱暴露 `data`（pokemon/moves/natures/typechart）、`typeMul`/`effStat`/`resolvePokemon`/`resolveMove`/`calcDamage` helper、`print`/`console.log` 输出；最后表达式值作为 `result` 返回。限制：同步、无 require/process/fs、2s 超时、结果/输出各截 2000 字符

*知识查询*

- `battle_tips(names)` —— 查战术/策略 tips（组队战术 + 决策方法论 + 通用单打战略层，summary/detail 双层；一次最多 10 个名称）
- `get_knowledge(topics)` —— 查客观对战机制与规则（换人/异常状态/天气/场地/地面/替身/毒菱等）
- `get_move_info(move)` —— 招式详情：威力/命中/分类/属性/先制度 + 精简对战效果 desc + 附加概率/畏缩/回复自损/暴击等级 + tag（接触/声音/拳/咬/波导/反伤）
- `get_ability_info(ability)` —— 特性描述 + 战报触发提示（时机/是否有消息/如何从战报推断）+ 合并特性提示
- `get_item_info(item)` —— 道具描述与效果
- `get_pokemon_info(pokemon, moves?, full_movepool?)` —— **图鉴**：种族值（具名 + 总和）/ 属性 / 可能特性（静态）/ 体重；传 `moves` 逐条校验 `can_learn`（对手用出学习面外招式 = 伪装/误判），`full_movepool:true` 才返回整份招式池

最后 2 回合战报显式贴进 prompt；更早的战报由 DS 按需调 `get_battle_history` 读取（省 token）。

## 知识库（build-knowledge.js）

运行 `node po-pokellmon-tool/build-knowledge.js` 生成 `knowledge/`（git 跟踪）：

| 产物 | 来源 | 内容 |
|---|---|---|
| `pokemon.json` | `po-data/pokes/{pokemons,stats,type1,type2,weight,ability1-3}.txt` + `zh-cn/db/pokes/pokemons.txt` | `num` / `num:forme` → `{baseStats, types, weight, abilities(编号), name_en, name_zh}` + 中英文名反向索引 |
| `natures.json` | `zh-cn/db/natures/nature.txt` + 硬编码 buff/debuff | `num → {name_en, name_zh, buff, debuff}` + 中英文名反向索引 |
| `moves.json` | `movedata.json` + `po-data/moves/8G/*.txt` + `zh-cn/db/moves/moves.txt` | `num → {name, name_zh, power, accuracy, category, type, priority, tags, desc(精简对战效果), effect_chance, flinch_chance, healing, crit_rate}` |
| `abilities.json` | `po-data/abilities/*` + `zh-cn/.../abilities.txt` | `num → {name, name_zh, desc_zh, desc_en, has_msg, merged}` + 反向索引 + `deleted`（PO 已删特性） |
| `items.json` | `po-data/items/*` + zh-cn 中文名 | `num → {name, name_zh, desc_zh, desc_en, has_msg}` + 反向索引 |
| `learnsets.json` | `pokemon-showdown` 的 learnsets+pokedex（**按 Gen8 及更早来源过滤**、并合并 prevo/baseSpecies）**∪** `po-data/pokes/all_moves.txt` | `{byKey: key → [招式编号...]}`，key 与 `pokemon.json` 一致；**两边取并集**（PS 是 Gen9 数据、缺 Gen8 专属途径如蛋招；PO 文件有缺项），missed 0 |

收录基础形态 + 合法形态（排除 Mega `M` / 极巨化 `G`）：key 为 `num`（基础）或 `num:forme`（形态）；形态缺属性/体重/特性条目时**按槽位继承**基础形态。

另：`ability_signals.json`（特性触发提示）、`tactics.json`（战术 tips）、`mechanics.json`（客观机制）为**手工维护**，不由 build-knowledge.js 生成。

## 下一步（未实现）

`calc_damage` 仍是基础计算器，后续可扩展：

1. **自动加成**：道具/特性/天气/场地/烧伤/暴击等目前需 LLM 手动填 `extra` 系数，后续可逐个自动识别（读 state 里的 ability/item/weather/terrain）。
2. **换人/变化招评估 tool**：见 [TODO.md](../TODO.md) 的「评估依据 tool」清单。

## 使用方法

1. 启动（复用 po-pokellmon 的 apikey.txt）：

```powershell
$env:DEEPSEEK_API_KEY="sk-..."   # 或直接复用 ../po-pokellmon/apikey.txt
node po-pokellmon-tool/server.js
```

2. PO 侧脚本：复制 [po-pokellmon/po-script.js](../po-pokellmon/po-script.js)，把 `PKLM_URL` 改成 `http://127.0.0.1:8092`，贴进 PO 对战脚本窗口。

3. 对战内 `/llm on` 开启（或账号 mew's 自动开）。建议用 `/llm shadow` 影子模式先观察 DS 的 tool 调用与决策质量。

## 版本管理

- [server.js](server.js) `SERVER_VERSION`、[tools.js](tools.js) 无独立版本号（随 server 记录）
- 改代码后 bump `SERVER_VERSION` + 更新本 README，并 git commit（见仓库根 [CLAUDE.md](../CLAUDE.md) 规范）
