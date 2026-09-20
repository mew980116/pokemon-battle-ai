# po-pokellmon-tool（路线 3：思考 + tool）

移植 PokeLLMon 的第三条基础路线：**思考模式 + function calling / tool**。
把主脚本 [20201227_v1.3.1.js](../20201227_v1.3.1.js) 里的确定性计算封装成 tool，供 DeepSeek 在决策前动态调用（类似 coding agent 的 tool 模式）。

## 与 po-pokellmon（路线 1）的关系

| | po-pokellmon（无思考） | po-pokellmon-tool（本目录） |
|---|---|---|
| 模型 | `deepseek-v4-flash` | `deepseek-v4-flash`（0.6.3 起；`POKELLMON_MODEL=deepseek-v4-pro` 可改回） |
| 思考模式 | `thinking:disabled` | 默认 `disabled`；仅首回合（turn 0）单独开 `reasoning_effort:low` |
| 超时 | 20s | 单请求硬墙钟 240s + 整回合上限 120s（首回合 180s） |
| max_tokens | null | null（不限制） |
| tool | 无 | 有（function calling，19 个） |
| 端口 | 8091 | 8092 |
| 定位 | 服务（快、稳） | 实验（测 LLM 能力上限，需 no timeout） |

## 当前实现

**harness**（[server.js](server.js)）已跑通 function calling 多轮 loop：

1. 接收 PO 采集的 `state` → 拼 prompt + `tools` 定义
2. 调 DeepSeek（默认无思考；首回合开 low 思考 + tool）
3. 若返回 `tool_calls` → 执行 tool → 结果追加进 messages → 再调（最多 `MAX_TOOL_ROUNDS=35` 轮）
4. 直到返回最终 `{"choice":N}` → 解析成 slot 动作

**tool**（[tools.js](tools.js)，20 个；当前暴露 19 个）：

*战场 / 笔记*

- `get_battle_history(start_turn?, end_turn?)` —— 读取过往战报（按回合范围，不传则全文；数据来自 PO 侧 `state.fullHistory`）
- `save_observation(pokemon, text, append?)` —— 记录/覆盖（append=true 追加）对某只对手宝可梦的观察
- `save_strategy(text, turn?)` —— 记录当前回合的战略思路
- `get_observation(pokemon?)` —— 读观察（不传返回全部）
- `get_strategy(turn?)` —— 读思路（不传返回全部）
- `update_worklog(text)` —— 本轮工作暂存（覆盖式），server 每轮注入回 system。**当前已屏蔽**（server.js `ENABLE_WORKLOG=false`：不暴露给模型、WORKFLOW 不提、system 不注入）。屏蔽依据（battle93/94/95 实测）：约 28% 的 tool 轮次被它独占一次 LLM 往返（从不与其他 tool 合并），且 LLM 把它当思考通道的替代品，中段常写成千字内心独白、夹带未清洗的 thinking / DSML 残留。改回 `true` 即恢复
- `submit_feedback(text)` —— 反馈「想要的 tool」/ 报告伤害计算异常
- `predict(claims)` —— **幻觉门禁的入口**（见下节）：先写下你打算依赖的数字（`expects`：`"22-26%"` / `"survives"` / `"2x"` / `"I move first"`），再用 `calc_damage` / `get_type_matchup` / `calc_stats` 带 `claim_id` 去裁决，结果回 `MATCH` / `MISMATCH`

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

## 幻觉门禁（Rule 1 + Rule 4，`ENABLE_PREDICT_GATE`）

**只禁「说了没验」和「说的与算的不一致」，不评价决策好坏、不判断该不该赌。** 开关与说明见 `server.js` 顶部。

**当前机制（0.5.0 起）＝ `simulate_turn`**：分支由 LLM 指名（`i_do` + `opp_does` 最多 8），服务端只算不排序；`save_strategy` 必须带 `action`/`branch`/`outcome` 且与仿真一致；最终答案前要求被选中的动作已被仿真过。**允许炮灰**——如实写 `faints` 即可通过。下面 Rule 1/4 描述的 `predict`/`claim` 握手是 0.4.14-0.4.15 的旧路径，**已默认关闭**（`ENABLE_PREDICT_CLAIMS=false`，实测太脆：模型常忘带 `claim_id` → claim 永远 unresolved → 在拒绝里打转）。

- **Rule 1（必须验）**：`predict` 登记过的每条预测都必须被工具裁决过；`save_strategy` 在存在「未裁决」或「完全没登记」时**返回 error 拒绝提交**。最终答案前还有一道**动作层**检查：你选中的动作必须挂着一个已 `MATCH` 的 claim，覆盖**它将放到场上的那只**（换人=换入者 `on_slot=<slot>`，攻击=场上那只 `on_slot=0`）。
- **Rule 4（数字一致）**：裁决时 server 自动比对「它预测的」与「工具算出的」，不一致记 `MISMATCH`，同样拒绝提交。解析不出预测内容时**一律放行并标 note**（宁可不拦也不误伤多跑轮次）；`MISMATCH` 必须把计划改成与计算一致才能通过。
- 防死锁：同一回合最多打回 `MAX_GATE_REJECTIONS=2` 次，超限放行并在日志标 `gateUnmet`。
- 账本（`predict` 登记了什么、每条 MATCH/MISMATCH）随每回合写进日志的 `ledger` 字段，便于事后统计。

**0.5.1 追加（都是"只提醒不拦"或"把不确定摆出来"）**：

- **速度重叠 → 正反两种情况都仿**：我方速度落在对手可能区间内时，不再输出一个 `unknown`，而是给出 `cases[]`（`you first` / `they first` 各一行，含"先手方若直接打死对手则对手不还手"）。`row.mine` 取**最坏的那个顺序**，保持门禁保守。先制度不同则只有一个确定情况。
- **最坏分支强提醒**：`save_strategy` 若声明了一个**不是最坏**的分支，仍放行（允许赌），但在返回里把最坏分支的数字直接摆出来，要求 `text` 明说赌的是哪条。
- **倍率词窄正则警告**：`text` 里出现「属性名 + 倍率词」而本回合**完全没查过** `get_type_matchup` → 返回 `warning`（不拦）+ `multiplierMentions` 计数（供统计命中率）。
- **对手假设一致性（结构化，不碰文本）**：同一只对手在同一回合内用了不同的 `assume` → 标注 `assumption_conflict`（不拦）。这是"对想否掉的选项用进攻型、对想选的选项用防御型"的机械检出。
- **命中率（0.5.2）**：`simulate_turn` 现在给每条分支标出双方招式的**命中率**（含天气修正：雨 → Hurricane/Thunder 必中；晴 → 50%；冰雹/雪 → Blizzard 必中），命中率 <100% 时额外写一条 **miss 分支**（"20% 落空 → 你吃 0%"）。`faints` 仍按"命中"取最坏情况（保守），落空只作为独立提示。改变命中的特性（Hustle / Compound Eyes / No Guard / Sand Veil…）**不建模**，写进 `unknown`。`moveAccuracy(name, weather)` 已导出供评测复用。
- **会心（0.5.3）**：**不把 crit 展开成分支**（会指数爆炸），但每行附 `crit_note` 说明"上面的数字**不含会心**"，并给出该招的会心率（Gen7+ 表：0→**1/24**、1→1/8、2→1/2、≥3/必会心招→必定）。同时提醒"会心只会让分支更致命、不会更安全，所以余量薄的要当更薄看"。附加效果（烧伤/麻痹/畏缩/降能力）同样不建模，写进 `unknown`。
- **模型边界声明（0.5.4）**：`simulate_turn` 现在返回顶层 `model_scope` —— **只承诺"伤害与生存"**。已建模：伤害、克制、天气/场地、场上已有陷阱/双墙、换人阶段顺序、先制度、命中率（含天气）、我方精确能力值。**未建模**：变化招效果、异常状态、能力等级、会心、附加效果、回合末残余、换入陷阱、特性/道具触发。配套：变化招标 `status_move` + `status_move_note`（**"0% 不等于安全"，且不能据以声明 `survives`**）；我方/对手有异常状态时标 `status_condition_note`；`unknown[]` 逐条列出未建模项。
  - 已知缺口实测（2026-09-20）：Toxic/Sleep Powder/Stealth Rock/Recover/Calm Mind 全部退化成 `0% in → 100% left`；我方麻痹速度未×0.5、烧伤物攻未减半、**睡眠仍会"先手打出去"**（硬错）——这些现在**只标注不建模**，因为下一步打算整体换成 PS 引擎（见 TODO）。
- **可能性空间补全（0.5.6 / 0.5.7 收窄为按属性聚合）**：`simulate_turn` 顶层返回 `possibility_space.uncovered_threat_types` —— 从**对手学得到的攻击招**里，把**你没列进 `opp_does`、但会打掉你 ≥25% 血**的招**按招式属性聚合成几类**，每类给：`how_many`（该类有几个够格的招）、`worst_move`/`worst_dmg`/`worst_faints`、`weakest_dmg`（该类里**最轻**的那个也打多少）。
  - **为什么按属性聚合、而不是列招名清单**（用户指正 2026-09-20：「大嘴鸥也真不太会带气象球吧」）：列具体招名会把"可能性"伪装成"候选清单"（实测 `Weather Ball` 是那种会上榜但基本没人带的招）。可执行的事实是"**这一类里任何一个落下来会怎样**"，与它带哪个无关。note 里写死"NOT a prediction"。
  - 为配合聚合，**运行时变属性的招按实际属性归桶**（`effectiveMoveType`：雨天 Weather Ball → Water；Terrain Pulse 按场地；Judgment / Hidden Power / Nature Power 等依赖道具/IV 的**跳过并计数声明**）。不加这一步，雨天的 Weather Ball 会让 "Normal" 桶虚高成 126-149%。
  - 实测（E001 局面，只列 Hydro Pump/Scald/Hurricane）：`Water how_many=7 最坏 Weather Ball 126-149% 必杀 最轻 54%` + `Normal how_many=3 最坏 Hyper Beam 41-49%` → **"被水招命中就死"这个结论不依赖它记得哪个水招**。
  - **不违反"不建合理招表"的约束**：纯逻辑推导（学习面 ∩ 伤害计算），不含配置频率猜测。
- **隐性威胁放在图鉴层，不放进仿真（0.5.8）**：`get_pokemon_info` 每次返回都带 `notable_status_moves` —— 该物种学得到的**变化招**，按角色自动归类（`self_setup` / `hazards` / `healing` / `blocking` / `status_inflict`），归类按 `moves.json` 的 `desc` 文本正则做，**不建人工配置表**。
  - **分工理由（用户 2026-09-20）**：变化招在 `simulate_turn` 里只会显示 `0%`（我们已把变化招从"可能性空间补全"里明确排除），所以"它可能剑舞/冥想"这种**物种级知识必须在查图鉴时给**，塞进单回合表只会污染它。
  - 实测分类：`Diggersby → self_setup:[Swords Dance, Bulk Up, Work Up] + Spikes`；`Aromatisse → [Calm Mind, Nasty Plot]`；`Claydol → [Cosmic Power, Iron Defense, Calm Mind] + Stealth Rock`；`Blissey → [Soft-Boiled, Sing, Thunder Wave, Toxic]`。
  - tool 描述里也加了一句：**"状态招永远不会出现在 simulate_turn 里，所以只看伤害表会低估带强化招的对手"**。
- **DeepSeek 请求必须压「硬墙钟」超时（0.6.1，真 bug）**：原来只有 `req.setTimeout(TIMEOUT_MS)`——那是**空闲超时**（socket idle），连接上只要有零星保活/分块流量就**永远不触发**。
  - 实测（2026-09-20 battle98 T11）：`api.deepseek.com`（117.185.125.154）的连接从 23:42:00 建起到 23:51:24 **仍 Established（564s）**，240s 空闲超时没掐，PO 侧 `sys.synchronousWebCall` 一直阻塞，面板停在「实时 503s 思考中…」。
  - 现在另加一个 `setTimeout` 硬墙钟 deadline（同一时长，`done()` 保证 cb 只回调一次、`res.on('error')` 也接住）。PO 侧兜底：**单次失败→`pklmFallbackAttack()`**，连续 3 次且跨度 >15s 才会认输。
- **模型改回 `deepseek-v4-flash`（0.6.3）**：这个场景是「计算量极大 + 幻觉高发」，pro 的深想收益主要体现在先读（读心）上，但门禁压幻觉的同时也把这类发挥空间压掉了 —— 不值得。实测 flash 同样支持 `thinking:{type:'enabled'}` + `reasoning_effort`（返回 `reasoning_content`），首回合思考不受影响。改回 pro：`$env:POKELLMON_MODEL="deepseek-v4-pro"`。
- **整回合时长上限（0.6.2）**：单请求硬超时管不住"一个回合跑很多轮"，battle98 T11 实测整回合 663s（9 轮里 2 个"无 tool 的纯生成轮"各占 ~300s）。
  - `MAX_TURN_MS = 120000`（首回合 `MAX_TURN_MS_T0 = 180000`，因为 T0 是唯一开思考的回合、实测最坏 118s）。到点走 `finalizeNoThink('turn_deadline')`，如实标 `gateBypassed = true`。
  - 选 120s 的依据（当前架构 battle93-98，n=137）：中位 36s、平均 54s，**>120s 只有 5%**（7 个，都是轮数最多的最难回合）。
  - `TURN_DEADLINE` 同时被 `callDeepSeek` 用来把单请求硬超时夹成 `min(TIMEOUT_MS, 剩余预算)`；`attempt()` 里**剩余预算 <15s 不再重试**，直接 `fallbackAction(state,'budget_exhausted')`——否则"超时后重试 3 次"最坏会撑到 3×240s。
  - 配套落盘字段：`fallbackReason`（之前只记 `fallback: true`，看不出是 parse_failed / error / budget_exhausted）与 `dsRequests`（含重试的请求数）。
- **默认值的偏向必须给出来（0.6.0）**：两类"默认值会给出自信的错误数字"的情况，不再让模型自己猜：
  - `item_note`：**打落（Knock Off）/ 灵骚（Poltergeist）** 这类「目标持道具会改变威力」的招，**目标道具未知时两个值都给**（`if the target holds an item` / `if it holds none`）；道具已知时只给一个（由 `sideItemKnown` 判定，并去掉两个值相同的冗余情况）。
  - `ev_note` + `mine.hp_after_max_investment`：**对手当攻击方**且本回合没传 `assume` 时，除默认 0EV 外**再给一个「252 + 升性格」锚点**，并把 `faints` **保守化**（两个锚点里更坏的算）。
  - **动机（battle98-T0/T1 实测）**：默认 0EV 在「它打我」的方向上是**低估**的——Amoonguss 打 Crawdaunt `0EV 95-113%` vs `252SpA+Modest 135-160%`，会把「必杀」读成「有几率活」；而打落漏掉道具加成（`70-83%` vs `105-124%`）会把 OHKO 读成打不死。**两者方向相反、会部分抵消**，所以单看默认值既不是上界也不是下界——必须把两个值都摆出来。
- **顺序未定必须写明（0.5.9）**：`row.mine.summary` 在「速度区间重叠、两种顺序都仿」时会在最前面加 `ORDER UNRESOLVED (both simulated — do NOT assume you move first)` 并逐顺序列出（`[by order: you first = … | they first = …]`）。
  - 修的原因（实测 battle98-T0）：两种顺序的 HP 结果相同时，summary 只显示其中一个 case 的 `you first → …`，**会被读成"我先手"**（同一行的 `order` 字段其实写着 UNRESOLVED，但 summary 更显眼）。
- `simulate_turn` 还会校验 `i_do` 的招式**确实是当前场上这只会的**。

**单测**（不花 LLM 费用，直接打账本逻辑，用 battle96 T1 的真实 state）：

```
node po-pokellmon-tool/test-predict-gate.js
```

覆盖：未登记 / 未验算 / 已冲突三种拒绝路径，改正后放行，动作层匹配，
以及两类真实幻觉——「Rotom-Heat 只吃 22-26%」（实为 137-162% 必杀）与「Hurricane 对 Fairy 是 2x」（实为 1x）。

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
