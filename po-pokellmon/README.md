# po-pokellmon — PO 服务型对战机器人（LLM 版）

PO（Pokemon Online）服务型对战机器人的 **LLM 决策版**。第一版移植 [PokeLLMon](https://github.com/mew980116/PokeLLMon)（arXiv 2402.01118）的实现方案。

> 背景：主对战脚本 [20201227.js](../20201227.js) 是非 LLM 的规则 AI，痛点在于定式模式易被对手预判针对。本目录是其 LLM 替代/辅助路线。未来若引入其它方案（如 hybrid 搜索、function calling），另建目录。

## 架构

```
PO QScript (po-script.js)                     Node 代理 (server.js)
─────────────────────────                    ─────────────────────
采集战场状态（sys 接口）   ──HTTP GET──▶     拼数字选项 prompt
  · 双方场上/后备                              · 历史回合（ICRL）
  · 招式名/类型/威力/PP/slot                   · 克制描述（KAG[Type]）
  · HP/Status                                 · 招式 Effect（KAG[Effect]）
  · 锁招检测（Choice 道具 4/5/6）              · 选项编号 1~N（招式+换人）
  · 天气/场地                                  ↓
                                             DeepSeek API
执行 battleCommand       ◀──slot JSON────    DS 返回 {"choice":N} → 映射回 slot
  · 直接按 slot 执行                          （数字方案消除招式名/宝可梦名歧义）
```

## 目录结构

```
po-pokellmon/
├── README.md            # 本文件
├── build-knowledge.js   # 从 movedata.json + data/ 构建 knowledge/*.json
├── server.js            # Node 代理：prompt 构建 + DeepSeek 决策 + 动作解析
├── po-script.js         # PO QScript：状态采集 + 动作执行（名字↔slot 映射）
├── data/                # 上游静态数据（借用 PokeLLMon 的 effect 描述）
│   ├── moves_effect.json    # 招式效果文字（key=招式名小写）
│   ├── ability_effect.json  # 特性效果文字
│   └── item_effect.json     # 道具效果文字
├── knowledge/           # build-knowledge 产物（git 跟踪）
│   ├── typechart.json   # 18x18 克制表
│   └── moves.json       # num → {name,power,category,effect}
└── logs/                # 决策日志（git 忽略，运行时产生）
    └── deepseek_YYYYMMDD_battle{id}.log   # JSONL：每次决策的队伍+战报+prompt+reply+action（按场次分文件）
```

## 日志（战报上下文摸底）

仅当账号为 `mew's` 时自动开启日志。每次 `/choice` 决策写入一行 JSONL 到 `logs/deepseek_YYYYMMDD_battle{id}.log`（按对战 ID 分文件，一天多场互不干扰），字段：

```json
{"ts":"...", "account":"mew's", "turn":1, "state":{...}, "prompt":"...", "reply":"...", "action":{...}}
```

- `state`：完整战场快照 —— `myTeam`（我方 6 只含 KO）、`bench`（可换）、`opp`+`oppSeen`（对手场上+已暴露后备）、`history`（近 5 回合战报文本）
- `prompt`：喂给 DeepSeek 的完整输入（含历史回合 + KAG 克制 + 招式 Effect）
- `reply`：DeepSeek 原始输出；`action`：解析后的动作

**技术摸底用法**：日志同时记录了「战报上下文（`state.history`）」和「DeepSeek 输入输出」，可事后对比：
1. 有/无历史回合时，DeepSeek 是否还会「持续用无效招式」（如对储水特性重复用水系）
2. `state.history` 截断窗口（当前 5 回合）是否足够支撑跨回合决策
3. KAG 克制描述（`prompt` 里的 `as defender` 行）是否真的影响了招式选择

## 知识库来源

| 数据 | 来源 | 说明 |
|---|---|---|
| 招式基础数据（num/power/category/name） | 项目 [movedata.json](../movedata.json) | PO 对齐，`num` 即 `sys.move(num)` 的编号 |
| 招式效果文字 | PokeLLMon `moves_effect.json` | 按 name 小写合并进 moves.json |
| 特性/道具效果文字 | PokeLLMon `ability_effect.json` / `item_effect.json` | 备用 |
| 属性克制表 | [20201227.js](../20201227.js) 的 `typechart()` | 18×18，硬编码进 build-knowledge |
| 宝可梦种族值/属性 | PO 运行时 `sys.pokeBaseStats` / `sys.pokeType1/2` | 不预构建，运行时采集 |

## 三策略映射（对应论文）

| PokeLLMon 策略 | 本目录实现 |
|---|---|
| ICRL（历史回合反馈） | `po-script.js` 采集近 N 回合文本，注入 prompt |
| KAG[Type]（克制描述） | `server.js` 用 typechart 预计算 `X as defender, WATER deal 2x...` |
| KAG[Effect]（招式效果） | `server.js` 查 `knowledge/moves.json` 的 effect 拼进招式行 |
| Consistent Action（SC 投票） | 后续版本（第一版先单次采样） |

## 版本管理

日志每行记录 `serverVersion` 和 `scriptVersion`，用于区分「这份日志是哪一版脚本产生的」，避免版本混用。

| 位置 | 常量 | 说明 |
|---|---|---|
| [server.js](server.js) | `SERVER_VERSION` | Node 代理版本 |
| [po-script.js](po-script.js) | `PKLM_VERSION` | PO 侧脚本版本 |

> 两个版本号**手动保持一致**，改代码时同步 bump。

**改动后 bump 流程**：

1. 改 `server.js` / `po-script.js` 代码
2. 同步 bump 两个 `*_VERSION` 常量（小改 +0.0.1，大改 +0.1.0）
3. 重启 server.js；PO 侧重新粘贴 po-script.js
4. 之后产生的日志即带新版本号，可与旧日志区分

**版本历史（changelog）**：

| 版本 | 变更 |
|---|---|
| 0.1.0 | 初始 PokeLLMon 移植：招式名/宝可梦名动作模式，KAG 克制 + Effect，ICRL 历史回合 |
| 0.2.0 | 数字选项方案：DS 返回 `{"choice":N}`，消除招式名/宝可梦名歧义 |
| 0.3.0 | 锁招 ban 重决策 + message 进日志 + 评测集（eval/）+ 版本记录 |
| 0.4.0 | 保底改 attackButton（挣扎）+ DeepSeek 思考模式（reasoning_effort=high）参数化 |
| 0.4.1 | fallback retry（2 次）+ 取消 max_tokens 限制 + 切回非思考模式（temperature 0.3） |
| 0.4.2 | 修复：error/非200 fallback 补记日志 + 超时 30s→8s + retry 2→1（避免偶发慢请求拖垮回合） |
| 0.4.3 | 修复：fallback 招式全不可用时转换人（强制换人死循环）+ 超时 8s→20s |
| 0.4.4 | 日志新增 `attemptLog`：每次 attempt 详情（耗时/结果/error/dummy ping） |
| 0.4.5 | **修复关键 bug**：非思考时 `reasoning_effort:'high'` 仍被发送导致实际开了思考模式（慢的根因），改为非思考时显式 `thinking:disabled` 且不带 reasoning_effort |
| 0.4.6 (server) / 0.4.2 (script) | 修复 4 项：① 对手剩余数改用 `status !== 31`（对齐主脚本 getPokeCount）② 历史伤害对手为百分比、我方为实际 HP ③ 历史补「当前回合」+ 注入能力等级 `Boosts`（避免重复诡计类状态招）④ 关闭 dummy ping（`DUMMY_PING_ENABLED=false`） |
| 0.4.3 (script) | ① 对手剩余数加 `numRef` 空槽位防御（未带满 6 只不误判）② `Opponent revealed moves` 改为按 `numRef` 区分，只显示当前场上这只已暴露的招式 |
| 0.4.7 (server) | 日志新增 `usage`（prompt/completion/total tokens）+ `totalMs`（含重试总耗时），attemptLog 每条也带 `usage` |
| 0.4.4 (script) | 修正：对手剩余数去掉 `numRef` 防御，仅用 `status !== 31`（对手未露面的宝可梦 `numRef` 可能为 0 但 `status`=0，numRef 判断会误排除） |
| 0.4.5 (script) | 影子模式（`/llm shadow`）：照发 DS 请求并记 log（state 带 `shadow:true`），但不执行 DS 指令、交回用户手动操作，用于对比人 vs DS 决策 |
| 0.4.8 (server) / 0.4.6 (script) | ① server 写日志时 `pushToView` 实时推送到可视化 view server（8093）② script 新增 `fullHistory`（完整战报，不限 5 条），供 tool 的 `get_battle_history` 读取 |
| 0.4.9 (server) | system prompt 改为共享 [prompts.js](prompts.js) 的 `BATTLE_TIPS`（移植 PokeLLMon 的 battle tips），tool 版（0.1.2）同步读取 |
| 0.4.10 (server) | ① 对手已露招式补「未知」凑满 4 槽位 ② 去掉 KAG[Type] 克制描述（与招式表重复）③ 变化招式（Power:0）不写克制关系 ④ 日志新增 `systemPrompt` 字段 |
| 0.4.7 (script) | 修复 `pklmStatusName` 状态编号映射：1=麻痹/4=烧伤（之前写反，对齐 board-standalone.js 与主脚本 status===1 减速语义） |
| 0.5.0 (script) | 战报保存完整性：补全 onMiss/onAvoid/onStatusDamage/onSendBack/onEffectiveness/onAttackFailing/onCriticalHit/onMajorStatusChange/onStatusOver/onFlinch；onMoveMessage/onItemMessage/onAbilityMessage 用 PO 侧读 `*_message.txt` 把「消息编号」解码成文本（含 %s/%f/%m/%i/%t/%a/%q/%st/%p 占位符替换，`part` 选变体）。需把 4 个消息表文件复制到 PO 根目录 |
| 0.5.1 (script) | 对战启动时（onTierNotification）扫描 4 个消息表文件依赖，缺失则 `print` 提示（预热缓存 + 缺失告警），不再静默 |
| 0.5.2 (script) | 修复：① onMajorStatusChange 跳过 status 31（濒死已由 onKo 记录，消除 "is now status 31" 冗余）② onDamageDone 带宝可梦名（"opposing 泥巴鱼 lost 67%." / "You 西狮海壬 lost 146 HP."） |
| 0.5.3 (script) | 调试工具：新增 `/eval`（执行任意 JS 观察状态）+ `/llm cb`（回调探针，print onMoveMessage/onItemMessage/onAbilityMessage/onMajorStatusChange/onStatusOver/onStatusDamage/onEffectiveness 原始参数），用于定位 stat 变化等消息来源 |
| 0.5.4 (script) | mew's 账号自动启用改为默认影子模式（只记 log 不执行 DS 指令），需执行时手动 `/llm on` |
| 0.5.5 (script) | 修复 shadow 模式不生效根因（pklmAutoEnable 在 pklmShadowMode 声明前调用，var 提升导致 true 被 false 覆盖，改为仅靠 onTierNotification 触发）；mew's 默认开回调探针（调试专用账号） |
| 0.5.6 (script) | 新增正式执行账号「木偶」析构万理的发条公主 自动启用 LLM 决策（非 shadow、不开探针、开日志） |
| 0.4.11 (server) / 0.5.7 (script) | 对手 bench 详情进 prompt：移除「Opponent has N pokemons left」，改为 current pokemon 下展示后备槽位 [Name,HP%,status]/[Name,fainted]/[unknown]（PO 侧新增 oppTeam 采集；board 同步补 bench status） |
| 0.4.12 (server) | bench 未亮相占位符 unknown → ???（避免与未知图腾 Unown 混淆） |
| 0.4.13 (server) / 0.5.8 (script) | ① switch 选项带上后备宝可梦 4 招 ② 修复 ability message 的 %a 特性名解析（改用 other 参数，对手特性未公开也能拿到名字） |
| 0.2.0 (tool server) / 0.5.9 (script) | LLM 笔记 tool：新增 save/get_observation + save/get_strategy（跨回合记忆）；prompt 默认注入对手场上观察 + 最近 2 回合思路；opp.fainted 提示对手会换人；MAX_TOOL_ROUNDS 5→10 |
| 0.2.1 (tool server) / 0.5.10 (script) | 对战结束（onBattleEnd）通知 server 追加 LLM 笔记汇总到 log 末尾（/summary 端点，type:summary 行） |
| 0.2.2 (tool server) | SYSTEM_PROMPT 显式引导使用笔记 tool（save_observation/save_strategy） |
| 0.2.3 (tool server) | ① system prompt 加环境说明（Gen 8 单打，无 Mega/Z/极巨化/钛晶化）② save_observation 支持 append 参数（覆写/追加都允许） |
| 0.2.4 (tool server) | 新增 submit_feedback tool + system prompt 引导 LLM 反馈「想要的 tool」（记到 log 末尾 summary.notes.feedback，收集需求用） |
| 0.2.5 (tool) / 0.5.11 (script) / 0.4.14 (main) | state 加 weather/terrain 字段（读 battle.data.field，天气特性如 Drizzle 触发消息不走 onAbilityMessage，改用直读）+ prompt 显示 Weather/Terrain |
| 0.2.6 (tool) / 0.5.12 (script) / 0.4.15 (main) | state 加 myHazards/oppHazards（入场陷阱：隐形岩/地钉/毒钉/虫网，读 battle.data.field.zone）+ prompt 显示双方陷阱 |
| 0.2.7 (tool) / 0.5.13 (script) / 0.4.16 (main) | 我方宝可梦（场上+后备）采集 ability/item 进 state，prompt 显示 Ability/Item 名字 |
| 0.5.14 (script) | ① 修复 weather/terrain 编号映射（原 pklmWeatherName 1=Rain 2=Sun 4=Hail 全反、pklmTerrainName 四个全错，对齐 board-standalone.js 正确版）② 战报每回合末追加场况快照 `[Weather:.., Terrain:.., You:.., Opp:..]`（能力等级 + 天气场地，弥补 PO 无通用 stat 回调、天气特性不走 onAbilityMessage 的缺口） |
| 0.5.15 (script) | 临时 probe：onTierNotification / onClauseActivated 打印参数 typeof + 值，实测确认 tier/clause 是数字掩码还是字符串（为 clause 提示进 prompt 做准备） |
| 0.4.17 (main) / 0.5.16 (script) / 0.3.5 (tool) | clause 提示进 prompt：实测客户端脚本拿不到 clause 掩码（sys.getClauses 等均 undefined），按「平台对战默认条款」固定写死 Sleep Clause + Self-KO Clause + Species Clause 进 BATTLE_TIPS；移除临时 probe |
| 0.5.17 (script) / 0.3.6 (tool) | 新增速度评估 tool 两件套：① `calc_stats`（LLM 自定名/种族值+ev/iv/nature/boosts 算指定项能力值，legs≤10）② `get_my_stats`（读我方实际宝可梦无加成六维，PO 侧新增 pklmCollectMyStats 采集 ev/iv/nature/level 进 state.myStats）；system prompt 引导用二者做速度对比 |
| 0.5.18 (script) / 0.3.7 (tool) | ① 断线节流：webCall 失败记录时间戳，2 秒内不再重发（避免断线时 onChoiceCancellation 快速循环刷屏/触发 antidos）② system prompt 加速度线笔记规范（save_observation 统一格式 `Speed:<当前>(<配置>)|<强化招>+<档>:<强化后>|<参照>:<速度>`），让 LLM 跨回合记速度线而非重算 |
| 0.3.8 (tool) | system prompt 显式要求：每回合决策前回顾上一回合战报，推断速度观察（谁先手/强化降速/麻痹/顺风/围巾线索）并 save_observation 记笔记，保持速度线最新 |
| 0.5.19 (script) | 新增无人值守 BOT 账号「[Lv0.吧服BOT]清分少女」：自动开启 LLM 决策（非 shadow）+ 静默模式（PO 窗口无任何脚本输出，日志仍写文件）；pklmPrint/pklmCb 加 pklmSilent 开关 |
| 0.5.20 (script) | ① 清分少女改为不写日志（pklmLogEnabled 不开启）② 战斗结束 7 秒后自动 battle.close()（对齐主脚本无人值守逻辑）③ PKLM_URL 从 8091（主 server）改指 8092（tool server，正式部署路线） |
| 0.3.0 (tool) | 新增 `calc_damage` tool：标准宝可梦伤害公式（最多 10 组 leg，返回 0.85x/1.0x 随机档伤害 + 防守方 HP 百分比 + detail）。新增 `po-pokellmon-tool/build-knowledge.js` 生成 `pokemon.json`（种族值/属性/中英文名索引）、`natures.json`（性格 buff/debuff）、`moves.json`（含招式 type + 中文名）。system prompt 引导 LLM 算伤后与战报实际伤害对比、异常（≈2x 差）提交 submit_feedback |
| 0.3.1 (tool) | 新增 `run_js` 逃生舱 tool：LLM 可在 `vm` 沙箱跑一段同步 JS 覆盖无现成 tool 的计算（暴露 data/typeMul/effStat/resolvePokemon/resolveMove/calcDamage + print/console.log）。限制：同步、无 require/process/fs、2s 超时、结果/输出截 2000 字符 |
| 0.3.2 (tool) | 修复 run_js 沙箱 2 个 bug：① `effStat` 签名从 7 参数简化为 `effStat(baseStat, boost?, level?)`（LLM 原 7 参数签名用错得 NaN，被迫手写公式）② `print`/`console.log` 改 `arguments` 全量拼接（原只收单参数丢输出）。新增 [test-tools.js](../po-pokellmon-tool/test-tools.js) 回归测试（验证 LLM 调用 get_type_matchup/calc_damage/run_js）。调参：`MAX_TOOL_ROUNDS` 10→15、`TIMEOUT_MS` 180s→240s |
| 0.3.3 (tool) | prompt 的天气/场地/双方陷阱改为固定加载：无则写 `None`（原「有才加载」，缺失时 LLM 可能误以为信息没提供而非「无」） |
| 0.3.4 (tool) | 单次 DeepSeek 请求失败加重试阶梯：第1次失败等2s、第2次等5s、第3次等10s且降级 no think，再失败才 fallback（重试不消耗 tool 轮数预算） |

## 使用方法

1. 构建知识库：`node po-pokellmon/build-knowledge.js`
2. 设 key 并启动代理：`$env:DEEPSEEK_API_KEY="sk-..." ; node po-pokellmon/server.js`
3. 把 `po-pokellmon/po-script.js` 全文贴进 PO 的 battle script 窗口，开战。
4. （可选，战报细节解码）把消息表文件复制到 PO 根目录（与 `movedata.json` 同级）：`po-data/moves/move_message.txt`、`po-data/items/item_messages.txt`、`po-data/items/berry_messages.txt`、`po-data/abilities/ability_messages.txt`。缺文件时 onMoveMessage/onItemMessage/onAbilityMessage 静默降级，其余战报回调不受影响。

详见 [TODO.md](../TODO.md) 的「项目战略 / 长期目标」与「DeepSeek 接入」章节。
