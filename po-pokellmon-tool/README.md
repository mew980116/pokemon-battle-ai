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

**tool**（[tools.js](tools.js)，22 个；当前暴露 20 个 —— `update_worklog` 与 `predict` 已关）：

*战场 / 笔记*

- `get_battle_history(start_turn?, end_turn?)` —— 读取过往战报（按回合范围，不传则全文；数据来自 PO 侧 `state.fullHistory`）
- `save_observation(pokemon, text, append?)` —— 记录/覆盖（append=true 追加）对某只对手宝可梦的观察
- `save_strategy(text, turn?)` —— 记录当前回合的战略思路
- `get_observation(pokemon?)` —— 读观察（不传返回全部）
- `get_strategy(turn?)` —— 读思路（不传返回全部）
- `update_worklog(text)` —— 本轮工作暂存（覆盖式），server 每轮注入回 system。**当前已屏蔽**（server.js `ENABLE_WORKLOG=false`：不暴露给模型、WORKFLOW 不提、system 不注入）。屏蔽依据（battle93/94/95 实测）：约 28% 的 tool 轮次被它独占一次 LLM 往返（从不与其他 tool 合并），且 LLM 把它当思考通道的替代品，中段常写成千字内心独白、夹带未清洗的 thinking / DSML 残留。改回 `true` 即恢复
- `submit_feedback(text)` —— 反馈「想要的 tool」/ 报告伤害计算异常
- `resolve_choice(choice)` —— 把「你准备答的编号」翻成它**实际会执行的动作**，并和 `save_strategy` 声明的 `action` 比一下，回 `MATCH` / `MISMATCH`（MISMATCH 时直接给出正确编号）。动机：动作列表的编号（**先数招式、再数换人**）与「队伍槽位号」是两套编号，`{"choice":5}` 不一定是你想要的那只（见下 0.7.0）
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
- **「特性造成的免疫」不能只特判 Wonder Guard（tool 0.8.10，把 0.8.9 的修法泛化）**
  - 起因（用户问「这些特性是否被破格类特性/招式无视有没有表述」）：查这条时实测发现，**同一族的免疫全都被我们写错**——旧代码只看属性倍率，于是把「特性把伤害归零」当成「算不出的固定伤害」：`地震 vs 洗衣机（Levitate）`、`喷射火焰 vs 火钢兽（Flash Fire）`、`冲浪 vs 水精灵（Water Absorb）`、`十万伏特 vs 雷精灵（Volt Absorb）`、`木槌 vs 玛力露丽（Sap Sipper）` —— **全部**印成 `CANNOT be computed (fixed / current-HP-dependent damage) — reason it manually`。0.8.9 只特判了 Wonder Guard。
  - 修：`max === 0` 且属性倍率 > 0 时，只要 `applied.defenderAbility` 有值，就是这个特性造成的免疫 → desc 写 `no effect — <Ability> (this ability blocks that move)`；note 里点名，并写明**穿透方式**（Mold Breaker / Teravolt / Turboblaze，或 Moongeist Beam / Sunsteel Strike / Photon Geyser / Light That Burns the Sky / Menacing Moonraze Maelstrom / Searing Sunraze Smash；对面持 **Ability Shield** 时不可穿透）。
  - **顺带核实计算器侧本来就是完整的**（无需改动）：`mechanics/gen789.js` 有 `attackerIgnoresAbility`（Mold Breaker / Teravolt / Turboblaze）、`moveIgnoresAbility`（七招）与「可被无视的特性」白名单（含 Wonder Guard / Levitate / Multiscale / Filter / Bulletproof / Soundproof…），并处理 **Ability Shield**。实测：破格 Excadrill 地震 vs 浮游洗衣机 = **318-374**（不带破格 = 0）；破格地震 vs 脱壳忍者（0.5x）= **157-186**（不带破格 = 0）；流星闪冲 vs 脱壳忍者（1x）= **315-372**；破格 + 对面持特性护罩 = **0**。
  - 回归：`test-calc-compare.js` 该段扩到 **7/7**（新增 Levitate / Flash Fire 两条）；`Super Fang`（真·算不出）仍走原分支（断言未变）；`test-sim-gate.js` 105/0。
- **种族 HP=1（脱壳忍者）与 Wonder Guard：两处口径修正（tool 0.8.9，A 类喂错信息）**
  - 先说探针结论（这两件事**本来就是对的**）：① HP 已经钉成 1 —— 计算器 `vendor/smogon-calc/stats.js` 里 `if (stat === 'hp') return base === 1 ? base : ...`，是**泛化实现**（按 `base === 1` 判，不写物种名），实测 `maxHP() = 1`；② Wonder Guard 也实现了 —— `vendor/smogon-calc/mechanics/gen3.js`：`defender.hasAbility('Wonder Guard') && typeEffectiveness <= 1` → 0，gen8 复用（实测 Ice Shard 1x → 0、Knock Off 2x → 374-444）。
  - **修的是我们这一层怎么报**：
  - ① **百分比爆炸**：`伤害 ÷ maxHP(=1)` 会印出 `37400%` 这种垃圾数。修：`defHp === 1` 时不报百分比 —— desc 写成 `374-444 (1 HP — any hit KOs)`，`percent_min/max` 归一到 100（于是 `simulate_turn` 的行是 `takes 100-100%` 而不是 37400%），另加一条 note 说明"这不是 HP 百分比，看 KO 结论"。
  - ② **给 0 伤害编错原因**：`desc()` 在脱壳忍者上会**抛异常**（`getKOChance` 里的 `damage[damage.length-1] === 0` 断言失败），旧兜底于是把 Wonder Guard 免疫说成 `NOT type-immune … its damage is fixed or depends on the current HP (Super Fang/Endeavor…)` —— 而同一段 `detail.applied` 里就写着 `"Wonder Guard"`。修：`max === 0` 时**先判 Wonder Guard**（读 `applied.defenderAbility` 与防守方特性），命中即返回 `no effect — Wonder Guard (only super-effective moves damage it)` + 明确 note。
  - ③ 顺带统一返回形状：三个 0 伤害分支的 `notes` / `species_note` 原来只塞在 `detail` 里（与正常路径不一致），现在也在顶层。
  - 回归：`test-calc-compare.js` 新增「种族 HP=1 + Wonder Guard」段 **5/5**（恶招 → 100/100 + KO；冰招 1x → 必须说 Wonder Guard 且**不得**出现 `NOT type-immune`；格斗 0x 同理；普通宝可梦仍是百分比；三种 0 伤害分支的 `notes` 在顶层）；其余分段不变（44/44 伤害一致、护栏 8/8、场地/天气 12/12、fixed_damage 5/5、特性 8/8、from_state 8/8+4/4、名字反查 3/3）。`test-sim-gate.js` 105/0、`test-species-alias.js` 18/0。
- **REPLACEMENT MODE 的速度对比要先把对手的强化算进去（tool 0.8.8，A 类实现缺陷：喂错信息）**
  - 起因（battle112 PO T13 实测，**模型自己抓出来的**）：对面 Mew 已 **+3 速**，候补行却仍旧给 Weavile 印 `spe 383 vs their range 131-229 → CLEARLY faster` —— 那段区间只是「种族值 + 满努力」，**不含强化/围巾/麻痹**（同一段 block 里我们自己还写着这句警告），却在下一行拿它下"你先手"的结论。模型原文：`a trap: the note's "clearly faster" ignores Mew's +3 Spe (~470-656), so Weavile does NOT outspeed`。
  - 后果：它因此**否决了 Weavile 的复仇线**（本该是"先制 Ice Shard 收残血"）转而选 Durant —— 那局恰好也合理，但这是运气，不是事实支持。
  - 修：读 `state.opp.boosts` 的 `Spe+N`，按等级倍率（正级 `(2+s)/2`、负级 `2/(2-s)`）把区间折成**强化后的真实区间**并写明；此时不再印 `CLEARLY faster`，改成 `still faster than that` / `SLOWER than that — do NOT assume you move first` / `inside that range`。block 另起一行 `⚠ … is CURRENTLY at Spe+3 … NOT the level-0 range above`。
  - 回归：`test-sim-gate.js` **105/0**（新增 3 条：Spe+3 时不得出现 `CLEARLY faster` 且必须写出强化区间；block 必须点明"不是 level-0 区间"；无强化时行为不变）；`test-species-alias.js` 18/0、`test-calc-compare.js`、`test-tools.js` 不变。
- **`replay.js` 汇总表按「同回合组内序号」配对（tool 0.8.7，无行为改动）**
  - 起因：battle108 **T7**（E005）复测时逐条输出是「替补决策 → `switch slot3`（正解）」，而汇总表两行都印成 `新动作 attack slot1`——**表自己跟自己的逐条结果矛盾**。
  - 根因：`oldE = chosen.find(x => x.turn === r.turn)` + `newE = newEntries.filter(x => x.turn === r.turn).pop()` 都是按 turn 取**单条**；同一回合有两条记录（「强制替补」+「换人后的正常回合」）时，两行都取到同一条。
  - 修：先按 turn 分组，再用**组内序号**配对；改后汇总表与逐条输出、`_r.js` 的输出一致。
  - **顺带改文档口径（用户 2026-09-22 纠正）**：案例状态**分两类** —— **A. harness / PO 侧的实现与对齐错误**（喂错信息、API 用错、读日志配错行）**修完即可结案**；**B. 能评测模型的 benchmark**（模型侧硬伤 + 引导维度 ③④⑤）**永久保留、不结案**，harness 的注意力机制一改就重跑整批（`benchmark.md` 清单表下已加「『状态』列读法」）。E005 是"两边都占"的例子：harness 侧已结、模型侧继续挂。
- **文档改名：案例库 / 错题集 → benchmark（0.8.6，无行为改动）**
  - `案例库.md` → **[benchmark.md](benchmark.md)**（总清单 + 正例对照）、`错题集.md` → **[benchmark-errors.md](benchmark-errors.md)**（已确诊错例）。
  - **定位修正（用户 2026-09-22）**：这些场景的用途**不是让模型对齐"标准答案"**，而是「在这些局面下，模型的决策最容易暴露它自己的硬伤，或者 harness 本身的问题」；正例只作**对照**（确认改动没把对的行为改坏）。
  - `benchmark.md` 顶部新增**清单表**（正例 5 / 错例 4 / 反面参照 3）+ **已知缺口**（battle106 T13/T15、battle108 T3/T7/T12 还没独立条目与 fixture；条目缺统一的"暴露哪类硬伤"标签；只有 E001/E004 有冻结 fixture）。
  - 引用同步更新：`TODO.md`、`po-pokellmon/README.md`、本 README、`tools.js`、`eval/run.js`。
- **删掉 `trajectory` 里那句倾向性建议（tool 0.8.5）**
  - 原句是 0.7.6 为 battle106 T13/T15 那种「怎么都死」的局面写的：`When your active is doomed either way, STAYING is normally better than switching it out — simulate both boards before you pick.` 但它的触发条件**只检查「留场那一支会倒」，没检查换人能不能救活它**。
  - 后果（benchmark-errors **E004** / battle111 T2）：那个局面恰恰是"换人能救"（Clefable 只吃 34-40%，换进去照样活着），这句话**说反了**，还把 `FREE replacement` 包装成倾向。三次复测的 sim 行里都带着它：**RT2b 自己推翻了它**（"clearly worse than the safe switch"）选了 Clefable ✓；**RT2c 顺着它**把 90% 的 Sand Rush Excadrill 送掉 ✗；RT2a 撞 120s 上限走 fallback。
  - 现在只留**事实 + 一个自查动作**：`… Whether that trade is worth it depends on whether a switch-in would SURVIVE the same hit: if one does, switching KEEPS this pokemon alive and still puts a fresh body on the field — check your switch rows before you decide.`
  - 回归：`test-sim-gate.js` 加两条断言（会倒的留场行**不得**出现 `normally better`；**必须**含 `check your switch rows`）。
- **回复手段识别补漏：`Pain Split` 归入 `healing` 分类（tool 0.8.4）**
  - 起因（用户问 battle111 里「他的配置里有哪些有回复招式的」）：`get_pokemon_info` 的 `notable_status_moves.healing` 靠 `moves.json` 的 `desc` 正则（`recovers|restores|heals` + `user`）分类，而 **Pain Split 的 desc 是「把双方 HP 加总后平分」→ 抓不到** ⇒ 洗衣机的回复手段只列出 `Rest`（对所有物种都成立，等于没有信号），漏掉了真正相关的 `Pain Split`。
  - 为什么这条要紧：battle111 T2 我们「垫伤害到半血 → 吃死水炮 → 拿免费替补收残血」的计划**正建立在「它不能回血」上**；而洗衣机当时是**剩饭已暴露 + 会 Pain Split**（模型自己在候选招里写了 Pain Split，是**我们这边**的工具漏了）。
  - 修：`roleOfStatusMoves` 的 healing 分支加一条显式名（`^pain split$`），并在注释里写明理由。实测：`Rotom-Wash → ["Rest","Pain Split"]`、`Tapu Fini → ["Rest","Aqua Ring"]`、`Excadrill → ["Rest"]`、`Clefable → [Soft-Boiled, Rest, Moonlight, Wish, Healing Wish, Life Dew]`、`Jirachi → [Rest, Wish, Healing Wish, Life Dew]`、`Zapdos → [Rest, Roost]`。
  - 回归：`test-species-alias.js` 18/18、`test-sim-gate.js` 100/0、`test-calc-compare.js` 全组不变。
- **PO 物种名 → PS/计算器名：常见形态别名表 + 两级回退（tool 0.8.3）**
  - 起因（battle111 T2 实测）：`simulate_turn { i_do: { switch: 5 } }` 换入 `Magearna-Original` 时整行 `mine: null` —— 报错 `incoming damage could not be computed (unknown pokemon: Magearna-Original …)`。候补的承伤数直接缺失 ⇒ 模型**少一个候选的成本数**。battle108 的 `Zarude-Aba`（我们自己的萨戮德整场无伤害数据）同源。
  - **全库审计**（`knowledge/pokemon.json` 1002 条 `name_en`）实测 **21 个**计算器认不出：`Aegislash`（PS 无裸名 → `Aegislash-Shield`）、`Alcremie-*` 8 种奶油（→ `Alcremie`）、`Blacephelon`（PO 拼写 → `Blacephalon`）、`Greninja-Unbonded`（→ `Greninja`）、`Meowstic-M`（→ `Meowstic`）、`Minior-*` 7 色（→ `Minior`）、`Zarude-Aba`（→ `Zarude`）、`Missingno`（**故意不映射**：不是真实物种）。
  - **顺带挖出一个「认得出但算错」的静默 bug**：PO 的裸 `Minior` 是**彗星形态**（60/60/100/60/100/60），PS 的裸 `Minior` 是**核心形态**（60/100/60/100/60/120）—— 旧代码按原名算出来的种族值是错的，且没有任何提示。修：`SPECIES_ALIAS` 显式映射 `Minior → Minior-Meteor`，并把**别名表放在「原名可用」判断之前**（显式意图压过猜测）。
  - **三个坑（都是实测踩出来的）**：① 别名表 key 必须用 `toID` 归一化 —— `toID('Zarude-Aba') = 'zarudeaba'`（**连字符被去掉**），不归一化则整张表永远 miss、只能靠"砍后缀"兜底（语义就错了）；② 别名表**不能放在"原名认得出就直接用"之后** —— 否则 `Minior` 这种"PS 认得出但语义相反"的条目永远进不去；③ 「砍末尾 `-形态名` 再试」必须留作**最后一级**（`Alcremie-CaramelSwirl` / `Meowstic-M` / `Minior-Blue` 全靠它）。
  - **另一层的缺口（与计算器无关）**：PO 状态里的形态名可能**不在我们自己的表里** —— `Magearna-Original` 计算器其实认，但我们的 `knowledge/pokemon.json` 只有 `Magearna`，于是卡在 `resolvePokemonInput` 的 `unknown pokemon` 上。修：同一套「砍后缀重查」+ 回 `name_note`。
  - **不许静默替换**：替换发生时显式说明 —— `calc_damage` 的 `notes` 里一句，`simulate_turn` 的行走 `row.species_note`（`applyLegNotes` 转发，与 `ev_note` / `item_note` 同一机制），文案写明"数字是拿基础物种算的"。
  - 回归：新增 `test-species-alias.js` **18/18**（全库审计只该剩 `Missingno` + 11 条具体映射 + calc 路径 + sim 换入路径 + "不得出现 unknown pokemon"）；`test-sim-gate.js` **100/0**、`test-calc-compare.js` 全组（含 from_state 8/8、场下 4/4）、`test-ability-table.js` PASS。
- **REPLACEMENT MODE 给事实（tool 0.8.2）**
  - 起因（battle108 复盘，用户点了三处）：**生产配置（flash+关思考）把"强制替补"当成"主动换入"来算代价** —— 它的原文是 `Mienshao OHKO'd by Body Slam — no`，于是选了 Sandaconda 挡、而不是用 Close Combat 直接收掉 Bouffalant。
  - **证据（强配置自己写出了那条事实）**：`flash+低推理` 与 `pro+关思考` 在同一个局面上都写了 "the faint happens in the **end-of-turn phase, so Bouffalant gets NO free hit now**" + "Mienshao 339 Spe — FASTER than anything Bouffalant can be … Close Combat is a **guaranteed OHKO** … **it never eats a hit and nets a KO**"。⇒ 不是"不会"，是**事实缺席 + 生产配置时做时不做**。
  - **做法（只给事实，不加限制）**：`tools.replacementFacts(state)` —— 仅在 `me.fainted`（REPLACEMENT MODE）时注入：
    ① **TIMING**：替补在**回合结束阶段**上场，对手已行动完 ⇒ **本回合不吃任何伤害、也不出手**；**主动换入**才吃招（"KO on entry"这个代价在此**不存在**）；
    ② 唯一成本 = 我方场地陷阱；③ 对手速度是**区间**（围巾/强化/顺风不在区间内）→ **只有候补自己的精确速度落在区间外**才能说"我先手"，重叠时两种顺序都会发生；④ 对手**已暴露招里有没有先制**单独写明；
    ⑤ 每个候补的行动行尾追加引擎算出的 `takes <最坏 X-Y% from <招>>`、`deals <A-B% with <招>> (<KO 判定>)`、`spe <我方精确值> vs their range <min-max> → CLEARLY faster / clearly slower / inside their range`。
  - **不限制操作**：不排序、不禁止、不参与判定 —— 选谁仍由模型按战术取舍（③ 那一手 flash+低推理 就是明知事实仍选 Jirachi 拖麻/怯，属合理取舍）。单测加 5 条断言（含一条"文案里不得出现 must pick / you should"），`test-sim-gate.js` 95 → **100 全绿**。
  - **顺带修一个静默 bug**：`calcOneLeg` 的 KO 字段叫 `ko` 而 `simulateTurn` 读的是 `ko_verdict`（未定义）⇒ `row.theirs.ko` 一直是空串。两处改成 `ko_verdict || ko`。
  - **口径**：`takes` **只扫对手已暴露的招**（未暴露的高威力招可能打得更重，文案里写明）；`deals` 用对手"未投资"的默认档，并**附 252 投入的锚点**（仅在两个值不同时给，避免免疫时刷出重复数字）。
- **回合号对齐 PO（tool 0.8.1 + script 0.6.28）**
  - 起因（用户 2026-09-21："你的日志也可以对齐回合号了吧"）：复盘时每次都要把我们的日志回合号手动 +1 才能对上 PO 窗口/战报。
  - 根因：**PO 在回合开始之前就收指令** —— `onBeginTurn(N)` 是在指令收集之后、回合结算开始时才触发，所以决策那一刻 `pklmCurrentTurn` 还是「最后一个已开始的回合」= PO 回合号 − 1（首回合是 0）。这也解释了为什么**日志里的战报文本（`Turn 11:`）本来就对**：那时 `onBeginTurn` 已触发。
  - 修法：script 侧只改**报告出去**的 `state.turn = pklmCurrentTurn + 1`（= 这个决策为了第几回合），并**新增显式标志 `state.firstDecision`**（`pklmCurrentTurn === 0`，即本局第一个决策）；回合内事件文本用的还是 `pklmCurrentTurn`，不动。tool 侧把「首回合」的两处特例（`turnCapMs` 放宽超时、首回合开思考）改走 `isFirstTurn(state)` = **优先看 `firstDecision`，没有该字段才退回 `turn === 0`** —— 这样老日志/老 fixture（battle96-t1 是 `turn:1`、battle98-T0 是 `turn:0`）行为**完全不变**，评测基线不被污染。
  - 已知代价：回合中段的强制替补（倒下后选人）被标成 N+1，与紧随其后的「下一回合指令」同号；两者靠 `me.fainted` / history 尾部区分。
- **simulate_turn：同先制度一律「正反手都算」，不再判谁快（0.8.0）**
  - 起因（用户 2026-09-21：**"只要是同先制度的操作你都算正反手吧…别直接 you move first 了"**）：battle106 T15 实测，sim 输出 `you move first (your spe 309 vs their 194-306)`，实际 Zarude 是**后手**死的 —— 对手 Roserade 全程先手、一点血没掉，一路 KO 掉 Basculin → Zarude → Vikavolt → Mew。唯一自洽解释是它带**专爱围巾**（306×1.5），而我们的速度上限只算到"252 速 + 正性格"（306）。
  - **系统性偏差**：速度对比的错法**只往一个方向错**（围巾 / 顺风 / 速度强化 / 麻痹我们看不见，对手不可能比我们算的更慢）⇒ "我先手白杀它" 这类结论会被单方面放大。既然速度只能给出"可能范围"，就不该用它定顺序。
  - **新规则**：① 先制度不同 → 顺序是硬事实（先制永远先出手），仍只算一种；② 同先制度 → **一律给 you-first / they-first 两块盘面**，`order` 里写明 `same priority → BOTH orders simulated (the speed comparison is NOT trusted…)`，速度区间降级为 `reference only`；`unknown[]` 里也写明「围巾/强化**不在**这个区间内，不能用来定顺序」。
  - `row.mine` 仍取最坏顺序；前缀文案由 `ORDER UNRESOLVED` 改成 `BOTH ORDERS SIMULATED (same priority …)`（"未定"是被动，现在这是主动策略）。
  - 回归：`test-sim-gate.js` 91 → **95 全绿**（新增：明显更快也给两种顺序、速度区间只作参考、unknown 声明围巾不在区间内、先制 vs 非先制仍是单一时序且明写 `priority 1 vs 0`）。
  - **★ 新基线（2026-09-21 晚更新）**：**PO script 0.6.28 + tool 0.8.2 + `deepseek-flash` + 低推理**（`POKELLMON_THINKING=1 POKELLMON_EFFORT=low`，端口 8092）。用户 2026-09-21 定："回归 flash+low"。原基线（flash+关思考）在 battle108 的**替补选择**上不可靠（② 1/3、③ 1/3），而 flash+low 在加事实前就能把 ② 做对、加事实后 ②③ 各一遍全对；代价是时延 26–62s（上限 120s）、成本 2.4×（0.050 元/决策）。**旧评测快照 `eval/results/G080-*` 是 flash+关思考 那一版，需重跑。**
  - **订正一处我判轻的地方（用户指出"aqua jet 可以赌 ct"）**：battle106 T14 我写成"Aqua Jet 45-54 < 73，局面本来也输了"——不对。**Aqua Jet 除了垫伤害还能赌会心**（CT 1.5x → 68-81，高骰过 73），而那一手只有 Aqua Jet 能落地（Basculin 295 比 Roserade 慢，Psychic Fangs 只有赢速度平局才落地），所以它是最优线，不是"没办法的选择"。0.8.0 正好把它选出来了。
  - **顺带暴露一个缺口（未做）**：sim 的 `crit_note` 只往"会心让分支更致命"（防守方向）说，而**我方的会心能把"2HKO"翻成"KO"**（进攻方向）—— 这种"差一点就能杀、可以赌 CT"的行，表里没有任何提示，只能靠模型自己想。
- **撤掉「换人必须先仿真留场」这条硬判据（0.7.8）**
  - 起因（用户 2026-09-21：**"最好别搞门禁，我感觉门禁会搞出 bug"**）：盘「哪些回合没有留场这个选项」时发现，0.7.6 那条规则的判据是把"我们以为合法的动作集合"写成了硬判据，而那个集合恰好是**已知有洞的那块**。
  - **真正的清单**（只有第 1 条现在能判）：① 我方场上已倒 → 回合结束强制替补，`me.fainted=true` ✅；② 我方自己用换场招（U-turn / Volt Switch / Flip Turn / Baton Pass / Teleport / Parting Shot）→ 招式结算后**在出招阶段内**换人；③ 我方**逃生按钮**被击中触发；④ 我方**危险回避** Wimp Out / Emergency Exit 触发。②③④ 的 `me.fainted` **都是 false**，而 `state.me.moves` 照样列出 4 个招（`pklmCollectMoves` 只按 PP>0 过滤）→ 判据一错，门禁自己就成了新 bug 源（模型选唯一合法的换人 → 连拒 2 次 → 烧两轮 → `gateUnmet` 放行；选招式 → 被 PO 拒 → 进 `bannedMoves`）。
  - **两条被排除的候选**（用户纠正）：**被拖下场**（吹飞 / 吼叫 / 龙尾 / 红牌）**不是决策点** —— PO 随机拉一只上来，我们脚本收不到"选人"的回合；`%e` 渲染的是结果不是 choice。**Emergency Exit** 那次没有 SendBack/SendOut 是**正常的**（当时对手只剩最后一只，无处可换），不是 PO 没实现。
  - **撤掉的理由（收益未证实 + 风险已证实）**：battle106 复测**生产配置 6/6 全对时门禁一次都没触发**（模型自己就把两块盘面仿真了），真正起效的是 ① 的 `trajectory` 那句确定性事实；而只要判据漏一类就凭空多一个拦死回合的 bug。
  - **改动**：`actionGateCheck` 删掉该分支（保留"没仿真过就不能下结论"）；`simulate_turn` / `save_strategy` 的描述里把"the gate requires both"改成建议（"strongly worth … that comparison is advice, not a rule"）。`trajectory` 字段本身**不动**（它仍是那句事实）。单测改写两条（只仿真换人 + 选已仿真过的换人 → **放行**；`save_strategy` 侧同样不要求留场线），删掉随规则一起失效的 REPLACEMENT MODE 那条。`test-sim-gate.js` 92 → **91 全绿**，`node --check` 通过。
  - **②的交互已定调（用户 2026-09-21："当然是用出了招式再换人，这是规则"）**：换人目标是在**招式结算之后**才选的，**不是**在选招时一并下发 `pokeSlot` ⇒ `pklmSendCommand` 只填 `attackSlot` 是**对的，不需要改**。代价换到我们这边：我方用换场招的回合会**多收到一次决策** —— 那一次的 choice 只有换人合法，但 `me.fainted=false`、`state.me.moves` 照列（`pklmCollectMoves` 只按 PP>0 过滤）→ prompt 会把非法招式列成可选项，模型点了就被 PO 拒、进 `bannedMoves`。这正是"给事实、不加拦"的适用场景：po-script 侧只要认出"我上一手是换场招"，就能在 prompt 里把这批招标成不可用。**未做**（等实战真遇到再补；不需要门禁参与）。
- **修复 0.7.6 门禁的潜在误拦：强制替补（REPLACEMENT MODE）跳过「必须仿真留场」（0.7.7）** —— ⚠ 这条规则已于 **0.7.8 整体撤掉**，本项仅作历史记录
  - 0.7.6 那条"声明换人前必须先仿真一条留场分支"用的是**机械判据**（ledger 里有 `move ...`），但**濒死后的强制替补**也表现为"换人"且**没有留场这个选项** → 会把合法的替补选择拦死。现在按 `state.me.fainted` 跳过（prompt 里对应 REPLACEMENT MODE 那一段）。单测补一条：`me.fainted=true` + 只仿真了换人分支 → 放行。`test-sim-gate.js` 91 → **92 全绿**。
  - 另记（教训）：**不要用 PowerShell 的 `Get-Content -Raw | -replace | Set-Content` 改这些源码** —— 这次顺手用它 bump 版本号，把 `server.js` 的中文注释写成乱码并弄出语法错误（`Get-Content` 默认按 ANSI 解码）。修法是 `git checkout -- server.js` 回滚后用编辑器改。源码改动一律用编辑器/Edit。
- **针对「不推演回合走势」的两条改动：sim 出 `trajectory` + 换人必须先仿真留场（0.7.6）** —— ⚠ 后半条已于 **0.7.8 撤掉**，`trajectory` 保留
  - 起因（battle106 T13/T14 复盘 + 用户指出"禁换必死是治标，根子是他不理解回合发展趋势"）：同一局面复测，生产配置（flash+关思考）**2 错 2 对**（抛硬币），而 flash+低推理 / pro+关思考都是 **4/4 对**，且推理里都主动写出了关键判断（"letting it faint gives me a **FREE replacement** … switching would make my switch-in eat a hit"）。⇒ 知识在、**推演不稳定**：模型能把"换 vs 留"各自算清，但**从没并排比过**——自由推理里"留场"被读成"白白损失一只"，而"主动换人"的代价（换入者当回合白吃一发 + 放弃免费替补）没被摆到眼前。
  - **① `simulate_turn` 新增 per-row `trajectory`（确定性给事实）**：当某一行的我方结局是「会倒 / 可能倒」（且我方动作是留场）时，该行多一个 `trajectory` 字段，写明：*我方这只本回合必倒 → 死亡会在结束阶段换来**免费替补**（换入者当回合不吃招）；若主动换人，换入者**当回合就吃这一发**、且放弃那次免费替补；两者都是死，通常留场更好*。只在"留场"行给出（换人行的对比交给门禁那条），对手换人导致我方毫发无伤的行**不给**（不误导）。
  - **② 门禁新增：声明换人时，本回合必须也仿真过至少一条「留场」分支**（`ledger.sims` 里要有 `move ...`）。纯机械校验（不解析任何自然语言）：换人 = 拿"换完的盘面"和"留场的盘面"比，只仿真换人分支等于**从没把两块盘面并排**。拒绝信息里直接给出该对比说明 + 已有的仿真清单。**不是"不许换"** —— 合法的挡招换人照样能过，只是必须先把留场那块盘面摆出来。
  - 回归：`test-sim-gate.js` 87 → **91 全绿**（新增/改写 5 条：只仿真换人分支→拒绝、补上留场→放行、会倒的留场行带 `trajectory` 且含 FREE replacement/NO hit/THIS turn、对手换人的行不给 trajectory、换人分支本身不给 trajectory）。`node --check` 通过。
  - 另记（与本次改动无关的历史问题）：`test-predict-gate.js` 有 **6 个长期失败** —— `tools.js` 里有两个同名 `actionGateCheck`（2 参数版在 710 行、3 参数版在 1488 行），后者把前者**遮蔽**了，那组测试实际打的是死代码。已用 `git stash` 前后对照确认（改动前同样 6 failed）。
- **模型/思考参数支持环境变量覆盖，可做 A/B 复测（0.7.5）**
  - 起因：battle106 的 T13/T14（我方场上必死时该"留场换免费替补"还是"主动换人"）在生产配置（flash + 关思考）下**复测 2 次给出相反动作**（样本 A 两回合都主动换人 ✗、样本 B 两回合都留场 ✓）→ 判断是"缺回合发展趋势推演"而非"不会"。为做配置对比，把思考/模型参数改成可用环境变量注入（**默认行为完全不变**）：
    ```
    POKELLMON_MODEL=deepseek-v4-flash  POKELLMON_THINKING=1  POKELLMON_EFFORT=low  POKELLMON_TOOL_PORT=8096  node server.js
    POKELLMON_MODEL=deepseek-v4-pro    POKELLMON_THINKING=0                        POKELLMON_TOOL_PORT=8095  node server.js
    ```
    （另外 `POKELLMON_FIRST_THINKING` / `POKELLMON_FIRST_EFFORT` 可覆盖首回合设置）
  - 用法：起多个不同配置的 server（不同端口、各自 `*>` 到独立日志），再用 `replay.js --url=http://127.0.0.1:<port> --tag=<标签>` 对同一批历史回合各跑几遍，比较动作一致率与耗时。
  - 首轮结果（battle106 的 turn 12/13，各 2 个样本）：**生产配置（flash+关思考）2 错 / 2 对**（抛硬币）；**flash+低推理 4/4 对**、**pro+关思考 4/4 对**，且新配置的推理里都出现了关键判断（"letting it faint gives me a **FREE replacement** … switching would make my switch-in eat a hit"）。代价是时延：新配置 38-120s，其中 2 次触到 120s 回合上限走了 `budget_exhausted` fallback（仍选对）。
- **自更新通道 `GET /pklm/version` + `GET /pklm/po-script.js`（0.7.4）**
  - 背景：PO 有运行期切换脚本的官方 API `sys.changeBattleScript`（`docs/reference/sys-object.md`），而 PO 脚本能 `sys.synchronousWebCall` 下载、`sys.writeToFile` 落盘 → 部署可以做成「PO 自己去拉仓库里的 `po-script.js` 并切过去」，**不用剪贴板、不用重启 PO**（对应 po-pokellmon 0.6.24 的 `pklmAutoUpdate`）。
  - 两个路由都从**仓库文件**现读现算：`/pklm/version` 返回从 `po-script.js` 里解析出的 `PKLM_VERSION`，`/pklm/po-script.js` 返回全文（附带 `X-PKLM-Version` 响应头）。**读不出/解析不出就返回 500** —— 不把垃圾内容发出去让脚本写进自己。
  - 服务本身只绑 `127.0.0.1`，所以这条通道天然只对本机可见。实测：`/pklm/version` → `0.6.24`，`/pklm/po-script.js` → 91142 bytes。
- **我方道具改用「消息证实值」(itemProved) 兜底（0.7.3）**
  - 背景：po-script 0.6.14 起，我方道具的**两条直读路都不可用**（`team(me).poke(0).item` 换进来的读不到；`field.poke(me).pokemon.item` 失去时不回退），只能靠 `onMoveMessage` 的 msg 132 旁证。state 因此新增 `me.itemProved` / `me.itemProvedSrc`。
  - prompt 的 `Item:` 于是分三支：**直读有值** → 正常写；**直读空、有旁证** → `Item:<名字> [PROVED by a swap message: <src> — the direct read returned nothing, this is what it actually obtained]`；**两者都空** → 保留 0.7.1 的 STALE 警告。
  - `calc_damage` 的 `from_state` 同步：`state.me.item` 为空时改用 `me.itemProved` 并在 `inputs_used` 注明来源 —— 否则「刚用 Trick 换到 Choice Specs」会被算成**没道具**（速度和伤害一起算错）。
- **修「一次坏 tool 调用把整个 server 带走」（0.7.2，真 bug）**
  - 实测（2026-09-21 battle100）：`simulate_turn` → `toCalcPokemon` 用了一个**计算器里没有的物种**构造 `new SMOGON.Pokemon(...)`。`@smogon/calc` 对未知物种**不报错**，而是崩在 `calcStat` 读 `undefined.hp` → `uncaughtException` → `process.exit(1)` → **8092 直接死**。后果链：PO 侧 `webCall` 连续失败 → 判「server 不可用」→ 认输（battle100 卡在 re-decide，下一局 3 次失败直接 forfeit）。
  - **修两层**：① `toCalcPokemon` 构造前先查 `GEN8DEX.species.get(toID(name))`，拿不到 `baseStats` 就返回明确的 `error`（附带物种名）；构造本身也包 try/catch。② server 的 tool 分发**整段包 try/catch** —— tool 抛异常只回一条 `{error: 'the tool crashed: …'}` 给模型，不再让它带走进程（同时写 `crash.log` 的 `toolThrew` 行便于定位）。
  - **教训**：`process.exit(1)` 的 uncaughtException 兜底对"服务型 BOT"太狠 —— 任何一处未捕获异常都会变成一次判负。以后新 tool 一律要在分发层有兜底。
- **`checks` 的语义写死成「未验证假设」+ 我方道具为空时不再沉默（0.7.1）**
  - **动机**（battle99 T20，见 [benchmark-errors.md](benchmark-errors.md) E003）：模型在 `checks` 里写了「verify Ninetales moves first vs Barra (**Scarf present**)」，**同一回合的正文却把它当既成事实**用了（"My Scarf gives 448 Spe > Barra 408 → I move first"），而 `state.me.item` 从 T16 起就是空的 —— 直接送掉 Ninetales。
  - `checks` 字段的 tool 描述改为「UNVERIFIED HYPOTHESES … 用**战报里能不能看到**来表述（check if the log shows …）」，并明确：**同回合不得把 check 当已证实前提**；凡是当前 prompt 已经写了的东西（我方道具/能力等级/HP、对手已亮招式）必须读 prompt，不能读自己的旧笔记。
  - 重新注入时的表头同样改成「**these are UNVERIFIED HYPOTHESES, not facts**」。
  - prompt 里我方道具为**空**时不再什么都不写，改成显式警告 `Item:(none / nothing readable — 早前回合的道具结论已 STALE：打落 / Trick / Switcheroo / 消耗都会清掉这个字段)`。
- **`resolve_choice` tool + 修「门禁按数组下标找招」的真 bug（0.7.0）**
  - **编号 ≠ 槽位**（battle99 T1 实测）：prompt 的 `Available actions` 列表是**先数招式、再数换人**，和队伍槽位号是两套编号。模型 strategy 写 `action=switch 5`（Escavalier）、散文也说 "Escavalier is the clear play"，却输出 `{"choice":5}` —— 列表第 5 项是 **Slurpuff**（它把槽位号当成了序号；正确答案应是 9 = 4 个招 + 第 5 个后备）。结果换上来的不是它推理的那只，而门禁没拦。
  - 新增 `resolve_choice(choice)`：把编号翻成**实际会执行的动作**并与 `save_strategy` 声明的 `action` 比对 → `MATCH` / `MISMATCH`（MISMATCH 时直接把「你声明的那个动作是第几号」告诉它）。已写进 WORKFLOW 第 5 步（答之前先确认）。
  - **同时修一个真 bug**（battle99 T7 两个症状都出现）：`actionGateCheck` 原本用 `moves[action.attackSlot]` 当**数组下标**查招式，但 `attackSlot` 是条目的 **`slot` 字段**。平时 `slot === 下标` 所以看不出；一旦有招被 PO 拒（`bannedMoves` 非空，数组被过滤、slot 保留原值，如 `[Iron Head(1), Close Combat(2), Knock Off(3)]`）就错位：**slot 越界 → `need=null` → 门禁静默放行**（T7 重决策那次它 `rounds=1`、1 秒、零仿真、无 strategy 就出答案，本该拦下）；**slot 在范围内但 ≠ 下标 → 门禁去查另一只招** → 错拦到打满 2 次 `gateUnmet` 放行。现按 `slot` 查。
  - 编号映射收成**单一来源** `tools.choiceToAction()`（`server.parseAction` 与 `resolve_choice` 共用），避免"自检结果"和"实际执行"再次分叉。
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
