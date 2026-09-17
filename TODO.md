# 待办工作

> 本文档根据实测笔记 [docs/reference/battle-object.md](docs/reference/battle-object.md) 等文件现状重新整理。原 TODO 中"数据探索"的 10 项已大部分完成，这里按 **已完成 / 本地可做 / 需 PO 环境 / 长期重构** 四类重排。

---

## 项目战略 / 长期目标

> 背景：PokeLLMon（论文实现）与 foul-play 均基于 Pokémon Showdown；本项目当前在 Pokémon Online（PO）做接口与 AI 响应验证，未来迁移 Showdown（PS）。

**两条最终产品线**：

1. **PO 服务型对战机器人**
   - 路线 A（有 LLM）：低成本、可私部（甚至本地部署）的小参数 LLM
   - 路线 B（无 LLM）：继续优化现有主脚本 [20201227.js](20201227.js) 的规则 AI
2. **PS 宝可梦对战竞技 AI**：结合强大 LLM + 算法（搜索 / 伤害计算）

**可复用资产**（调研结论，详见 [docs/research/](docs/research/)）：

- [PokeLLMon](https://github.com/mew980116/PokeLLMon)（已 fork）：prompt 模板库、KAG 知识库 JSON（typechart / 招式 Effect / 特性 / 图鉴）、状态→文本转换、ICRL / SC 实现 → **初期合入 PO 侧**
- [foul-play](https://github.com/mew980116/foul-play)：Showdown 搜索式 AI（基于 poke-engine 树搜索）→ 无 LLM 路线 / PS 竞技参考
- [poke-engine](https://github.com/mew980116/poke-engine)：Rust 战斗搜索引擎（expectiminimax / MCTS / 伤害计算）→ hybrid 预计算参考
- 本地 [20201227.js](20201227.js)：PO 主脚本，规则 AI 基线，路线 B 的持续优化对象

**分阶段路线**：

1. 短期（PO 验证）：DeepSeek 决策链路 + 场况注入 + KAG 克制 / Effect（见下「DeepSeek 接入」）
2. 中期：PO 服务化机器人（双路线并行）
3. 长期：迁移 PS，做竞技 AI

---

## 已完成（从旧 TODO 中划掉）

- [x] 探索 `battle` 对象及其顶层属性（`me` / `opp` / `id` / `data` 等）→ [docs/reference/battle-object.md](docs/reference/battle-object.md)
- [x] 探索 `battle.data.field` 结构（`weather` / `terrain` 属性，`poke(int)` / `zone(int)` 方法）
- [x] 探索 `battle.data.field.poke(int)` 结构（`onTheField` / `substitute` / `pokemon` 等属性，`stat` / `statBoost` / `type1` 等方法）
- [x] 探索 `pokemon` 对象（16 个属性：`nick` / `pokeName` / `status` / `num` / `level` / `life` / `ability` / `item` / `nature` / `hiddenPower` 等）
- [x] 探索 `pokemon.move(int)` 结构（`PP` / `totalPP` / `num`）
- [x] 探索 `battle.data.field.zone(int)` 结构（`spikesLevel` / `toxicSpikesLevel` / `stealthRocks` / `stickyWeb`）
- [x] 探索 `sys` 对象 → [docs/reference/sys-object.md](docs/reference/sys-object.md)
- [x] 探索 `client` 对象 → [docs/reference/client-object.md](docs/reference/client-object.md)
- [x] 实战采样一整局对战日志 → [test/battleLog.md](test/battleLog.md)
- [x] 回调函数参考文档初版 → [docs/api/callback-functions.md](docs/api/callback-functions.md)

---

## 本地可做（纯文档 / 代码整理，不依赖 PO 运行时）

### 1. 字段语义映射（优先级最高）

实测拿到了字段的整数值，但还没映射到人类可读的含义。梳理清楚这些之后，AI 决策代码才能摆脱"魔法数字"。

- [ ] `battle.data.field.weather`：`0` 表示无，其他取值（晴天 / 雨天 / 沙暴 / 冰雹 / ...）待确认编号
- [ ] `battle.data.field.terrain`：实测值 `1072064102`，含义待解码（疑似位标记或内部指针）
- [ ] `pokemon.status`：`0 = 正常`，其他状态异常编号 → 结合 `onMajorStatusChange` 回调中的 `status` 参数映射
- [ ] `pokemon.ability`（实测 `0`）→ 特性编号对照表
- [ ] `pokemon.item`（实测 `8015`）→ 道具编号对照表
- [ ] `pokemon.nature`（实测 `3`）→ 25 种性格对照
- [ ] `pokemon.hiddenPower`（实测 `11`）→ 隐藏属性类型对照
- [ ] 基于 [move_data_reference/move_message.txt](move_data_reference/move_message.txt) 解码 `onMoveMessage(spot, move, part, ...)` 中的 `move` / `part` 参数

### 2. 文档完善

- [ ] 合并 [docs/api/battle-object.md](docs/api/battle-object.md)（框架文档，含虚构 API 如 `getFieldState()`）与 [docs/reference/battle-object.md](docs/reference/battle-object.md)（实测笔记）—— 保留实测为准
- [ ] 补充 `battle.battleCommand` / `attackClicked` / `switchClicked` / `targetChosen` 的参数含义与调用示例
- [ ] 分析 `battle.data.field.zone` 各字段（尖刺等）对战术决策的影响
- [ ] 更新 [README.md](README.md)，反映当前项目进展

### 3. 代码整理（[20201227.js](20201227.js)）

- [ ] 继续补中文注释，重点覆盖核心函数：`typechart` / `calcBaseStats` / `statsCalcFromBase` / `calcStatWhenBoost`
- [ ] 梳理 `20201227.js` 内部逻辑分块的边界，为未来模块化做准备（**只标注边界，不拆文件** —— 拆分后无法在本地验证）
- [ ] **内存泄漏排查（短期不动，待实测确认根因）**：服务久了内存爆、PO 挂掉的疑似根源——① 每个 battle window 顶层 `loadJsonData("movedata.json")`（[L1396](20201227.js#L1396)）重复 parse ~1MB 对象树，window 关闭后若 PO 不释放 QScript 引擎则每场残留一份；② 大量 `sys.setTimer` 闭包持有整个脚本作用域（`battle`/`foeInformation`/`moveDataObj`）。脚本内部无随场次无限增长的数据结构（`foeInformation.pokemon` 固定 6 槽位、`previousTurnEventRecord` 每回合 reset）。**根因判断需实测**：连打 10 场看 PO 进程内存是否回落；若根因是 PO 不释放 QScript 引擎，脚本侧优化杯水车薪，真正该做的是服务型 BOT 定期重启 PO。附带小 bug：`loadJsonData` 里 `sys.getFileContent(file)` 被调用两次（[L1380-L1382](20201227.js#L1380-L1382)），可顺手修。

### 4. 已知 bug / 疑似遗迹（本地可确认，改动需验证）

> 以下问题在逆向分析中发现，可在本地修改，但效果需实战验证。参见 [docs/analysis/decision-logic.md](docs/analysis/decision-logic.md)。

- [ ] **`getGoodForSwitch` L1495：`indexOf()` 缺少参数** → 永远返回 -1，某个类型克制分支从不生效；需确认正确参数后修复
- [ ] **`getGoodForSwitch` L1519：条件与 L1518 相同** → 疑似应为 `> 2`（倍率克制额外惩罚），与 L1518 的 `> 1` 重复导致第二段无效
- [ ] **Path 3 速度判断三段重复（L3089-3103）** → 三段几乎相同的速度检查互相覆盖，实际行为偏向最后一段；需人工走读确认预期行为后合并

### 5. v1.1.1 待办（基于 softmax 设计复盘）

> 核心原则修正：服务型 BOT 的随机性应建立在"期望收益接近的合理动作之间"，而非"信息少时盲目发散"。对手 bench 未亮相时不读空气，对手有明确换入收益时才启动混合评分。

- [x] **softmax 候选集改为基于 `finalScore` 过滤（已实施 v1.1.1）**：两轮遍历改造；第一遍计算所有 finalScore，第二遍用 `finalScore >= maxFinalScore * threshold` 过滤；threshold 通过 T 对应：T≤0.8→0.85，T≤1.5→0.75，T≤2.5→0.65，T>2.5→0.55

- [x] **残局 T 衰减（已实施 v1.1.1）**：`switchesList.length + 1 ≤ 2` → smT×0.30，≤3 → smT×0.45；case 1 武道熊师残局场景下 T 从 2.0 降至 0.60，毒击直接被 threshold 过滤

- [x] **专爱系道具 T cap（已实施 v1.1.1）**：item∈[4,5,6] 且 switchesList 为空时 smT 强制 ≤ 0.6，防止锁招状态下仍走随机分叉

- [ ] **UT/VS/Flip Turn 加 KO 保护**：当前 `finalScore *= (1 + switchP * 0.008)` 在有明确 KO 招时可能出现"明明能杀却急速折返"。建议：若候选中存在满足先手斩杀条件的招式，则 UT/VS 的 `finalScore` 不得超过该 KO 招的 0.95 倍（cap，不减成零）；若 UT/VS 本身也能 KO 则不受此限制。UT/VS 的正确定位是"伤害 + 节奏" 复合价值，switchP 加成体现的是换人时转场收益上升，而不是弥补低伤害

- [ ] **对 `switchP=0`（bench 全未亮相）的文档澄清**：当前代码行为正确，但文档应明确区分两类"未知"：① 已知 bench 存在可分析换入概率（switchP 由 `estimateFoeSwitchProb` 计算）；② bench 完全未亮相无法定位（switchP=0，不读空气）。服务型 BOT 的随机性来源是"对手在几个合理选择间不可预测"，而非"我不了解对手所以乱打"。更新 [docs/v1.1-battle-logic.md](docs/v1.1-battle-logic.md) 第 4 节和第 5.1 节对比表

- [ ] **当前免疫但打换入强的招（hard read candidate，v1.2+）**：例如对手场上飞行系免疫地震，但已知 bench 有火钢——点地震属于 hard read。触发条件要极严：switchP ≥ 75 + 已知 bench 对该招伤害高 + 当前局面不危急 + 无更稳的 UT/VS 可用。不与普通 softmax 合并，单独以很低概率（如 `hardReadScore = incomingScore * 0.6`）加入候选，且 cap 不得超过最高稳定招。等 v1.1 实战日志稳定后再做

### 5.5 未合入的决策优化方向（中期，需深入研究）

- [ ] **变化招纳入 softmax（基础）**：当前改动 D 只覆盖攻击招，变化招（强化 / 撒钉 / 睡眠等）仍走原有确定性逻辑；对服务型 BOT 而言，变化招的选用时机也值得随机化——需先分析变化招的 `rejected` 控制流再设计
- [ ] **变化招纳入 softmax（foeSwitchP 联动）**：`movepow=0` 的变化招在 foeSwitchP 高时可能有换人收益——例如对手可能换入时布岩钉/地钉收益更高，或对手换入后弱点可被撒毒/催眠命中。当前 v1.1 仅对 446/191 特判 stratPow，其余变化招完全不参与。后续可按"假定换入目标"评估变化招的收益（岩钉用属性倍率估算 bench 的入场伤害，状态招用 bench 的特性/类型推断命中收益），并将 stratPow 动态化而非固定为 70/40/18。依赖 `estimateFoeSwitchProb` 扩展，需先完成基础变化招接入再做
- [ ] **Path 2 对手强化后换人逻辑复查**：L3107 在对手强化 >2 时以 2/3 概率拒绝换人；进到 Path 2 意味着只有中等候选，被对手 setup 后可能直接被秒——目前判定为"保守合理"但未验证，实战后若反复出现"中等候选换上即被秒"则需重新评估
- [x] **softmax 触发率过低问题（已修复，v1.1）**：原阈值模型（75/85/90%）只覆盖近等势场景，已改为温度参数真 softmax（改动 D v2），所有 `movepow > 0` 的招式全量参与加权采样，温度 T 基于局面紧迫度而非 pool。新增 `estimateFoeSwitchProb()` + bench 混合评分 + UT/VS 加成 + 岩钉战略分。参见 `feedback/v1.0/case 1.md`
- [ ] **getFoeThreatToMe()：AI 自身受威胁评估**：当前 `getOpponentDecisionPool` 只量化对手选择空间，缺少 AI 自身风险维度——对手能一击打死时，随机化选次优招代价极高。拟新建 `getFoeThreatToMe()` 函数（返回 0-100）作为 pool 的负项，因子包括：速度对比（对手确定/可能更快）、对手进攻强化等级、我方当前 HP 比例、**已亮相招式中对我有效的**（只用已知信息，不做属性推断——对手不一定带本系招，且可能带覆盖招，纯属性推断不可靠）。参见 `docs/analysis/battle-relationships.md`
- [ ] **softmax 候选评分纳入命中率**：当前 softmax 的 `smScores` 直接使用 `movepow`，而 `movepow` 里命中率只作为控制流阈值（`damagePercent * accurcy > 0.5`），不影响权重。这导致同等 movepow 的 70% 命中招与 100% 命中招被等同对待。即便对手决策空间大，人类也倾向于选高命中招——建议改为 `smScores[i] = floor(movepow[i] * accurcy / 100)`，让低命中招在权重上自然处于劣势。需确认 `accurcy` 在插入点处是否可访问（当前在主循环内部，softmax 在循环外，需要存到循环外变量或重新计算）
- [ ] **`getOpponentDecisionPool` 扩展影响范围**：当前 pool 只用于改动 B（自损惩罚系数）和改动 D（softmax 候选集宽度），但它对更多决策环节都有潜在的调优价值，包括但不限于：
  - 先手斩杀阈值（pool 低时对手被逼死角，是否应降低斩杀阈值？）
  - 优先度招式（截击 / 影子偷袭等）的使用时机
  - 变化招的接受概率（pool 高时更倾向搏一把撒钉 / 催眠）
  - 换人路径的 `choosetime` 门槛（pool 高时可以更早触发换人评估）
  - 保护 / 替身的使用意愿（pool 高时对手不可预测，保护价值更高）
  - 需系统梳理 `attemptCommand` 里所有带随机数的判断点，逐一评估是否值得接入 pool
- [ ] **对手专爱锁招推断用于换人 counter 选择**（来自 case 1 R7）：已知对手持有专爱头带/眼镜/围巾 + 本回合使用过某招（或上回合已锁定）时，换人评估应以该锁定招为假定来袭招式，而非扫全部已知招式。具体：在 `getGoodForSwitch` 的类型威胁评估中，若 `foePoke.item in [4,5,6]` 且已记录使用过的招式，只计算该招式的属性威胁，不做宽泛的"所有招式最大威胁"估算
- [ ] **对手最后一只时战略招 stratPow 归零**（来自 case 2 R19）：对手场上只剩最后一只宝可梦（无 bench 可换入）时，布隐形岩/地钉没有实质收益（无换入目标）。当前代码仅检查岩钉是否已布，不检查对手剩余数量。修改：在 stratPow 赋值逻辑中追加条件 `&&（对手 bench 存活数 > 0）`；对手存活数可从对手 switchesList 等价结构读取
- [ ] **UT/VS 先后手判断影响换入候选评估**（来自 case 2 R4）：先手使用 UT/VS/Flip Turn 时，换入宝可梦将在本回合直接承受对手攻击——换入候选应满足防御要求；后手使用时对手已出完招，换入宝可梦只需满足下回合进攻要求。建议：先手场景下对 UT/VS 的 finalScore 加入对候选 bench 防御能力的评估权重；后手场景维持现有逻辑（仅攻击评分）。速度对比可复用已有的速度判断逻辑
- [ ] **附加效果按场面条件动态估值**（来自 case 2 R14）：当前 movepow 不区分附加效果在当前场面的实际价值——高速旋转+1 速在我方确定快过对手时收益为 0，提升攻防的招式在特定能力段同理。建议对带附加效果的招式（速度提升/攻防强化/恢复）在计算 movepow 或 finalScore 时引入场面条件修正系数；实施前需先梳理 movepow 里已有的附加效果处理位置
- [ ] **我方能力下降后主循环换人误判修复**（来自 case 1 R12）：流星群/过热等自损 SpAtk 后，若当前宝可梦仍可 OHKO 对手（`dropFoeHp * 2 > foeRemainingHp`），主循环不应因"我方输出下降"触发换人评估。根因在 `getMoveDamage` 用下降后的攻击力估算后续伤害，导致 `movepow` 偏低从而换人路径被激活。临时方案：在换人触发条件中增加"本回合出招可 KO 对手"豁免
- [ ] **属性盲点无法 KO 时降低招式权重**（来自 case 1 R1）：对手类型信息不足（`pokeNum=0` 或只见过 1 招）时，带属性盲点的招式（如对幽灵/地面免疫系的近身战/地震）若无法确认 KO，其 finalScore 应乘以惩罚系数（建议 0.5-0.7）。依赖已有的类型已知度判断逻辑；免疫判断需结合 `typechart()` + 已知 `type1/type2`（未知属性时跳过惩罚）
- [ ] **清场特性持有者 KO 招 finalScore 加成**（来自 case 1 R1）：特性为异兽提升（ability=39）或黑暗绒毛（ability=???）等击倒对手后能力提升的宝可梦，KO 对手的招式在当前回合价值更高（击倒后强化）。建议：在 finalScore 计算时若 `damagePct >= foeHpPct`（可 KO），对该类特性持有者追加 ×1.2 系数；特性编号待实战确认
- [ ] **百变怪/变身宝可梦特殊伤害估算**（来自 case 2 R1/R19）：变身类宝可梦（百变怪 num=132，或使用变身招后）的攻击/防御等于目标宝可梦，但 HP 保持自身；当前 `getMoveDamage` 直接用 `calcBaseStats` 读原始种族值，会大幅低估变身后的伤害和耐久。建议：检测 `fpoke.pokemon.num === 132` 或变身状态标记，改用目标宝可梦种族值计算，同时保留自身 HP

### 5.6 v1.3 统一 softmax 决策架构（大版本主题，基于 v1.1.2 实测 + 作者愿景）

> 核心问题（v1.1.2 case3-2/case1-14/case2-12/case4 共同根因）：当前决策是「阶段1 主循环确定性 break + 阶段2 softmax 纯伤害旁路」两套割裂逻辑。落入 softmax 时只剩伤害对比，先制/命中率/附加效果/变化招全部丢失。控制流详见 [docs/analysis/attemptCommand-control-flow.md](docs/analysis/attemptCommand-control-flow.md)。
>
> 愿景：把所有动作选择统一进 softmax，`finalScore` 从「纯伤害」升级为「综合行动价值」，所有合理动作在同一尺度加权采样——这是服务型 BOT「防被读穿」的终极形态。v1.2 的 `commandDecided` 标志是过渡止血件，本架构落地后移除。
>
> 实施前必读：等 v1.2 实战反馈回来，用真实日志校准下面各层的权重映射（拍脑袋定值不如实战数据）。

- [ ] **L1 全攻击招入池**：4 个攻击招全部进 softmax，不再靠主循环 break 旁路。先制斩杀等确定性决策改用「极高权重 finalScore」表达（必杀就几乎必选），而非 break 跳过。移除 commandDecided 标志
- [ ] **L2 变化招入池**：变化招按 `getStatusMoveEffectiveForCurrentFoe` 的适应度（0-4）映射成 finalScore 权重，与攻击招同池竞争。修掉「适应度3却用不出」（case1-14羽栖/case2-12寄生种子/case4鬼火）。配套：日志输出「哪个变化招适应度是几」（当前只打印数值不带招名，case2-12/checklist 第2条诉求）
- [ ] **L3 权重修正项**：finalScore 纳入命中率（×accuracy/100，checklist 第4条）、附加效果（提速/烧伤/斩杀先制等按场面条件加成）。变化招适应度还要看「自身受威胁程度」（case4-1 隐形岩在快倒地时仍给适应度4不合理）
- [ ] **L4 换人入池**：换人候选也算 finalScore（standard 映射），与出招同池竞争采样，统一「换不换 + 换谁 + 出什么招」为一次采样。这是最难的一层，依赖 L1-L3 稳定后再做

### 5.7 v1.1.2 实测其他待办（非 softmax 架构）

- [ ] **开局输出我方阵容与队伍参数**（checklist 第1条）：调试模式下开局打印我方 6 只的种族值/招式/道具概要，方便人工核对 AI 阵容分析是否合理
- [ ] **换人失败 → 推断对手特性**（case2-4）：换人指令被拦截（如对手磁力/踩影/沙穴）时记录对手对应特性，供后续决策利用
- [ ] **伏特替换/急速折返 后再换人 的开局逻辑**（case1 开局）：我方先手且持 UT/VS 时，先打一发再换人比直接换人多收益
- [ ] **伤害评估系统性偏高校准**（case2-13）：实测 damagePercent≈0.20 实际仅 16%，伤害公式偏乐观，需校准
- [ ] **高耐久无输出墙的换入价值**（case2 托戈德玛尔）：standard 已能识别（电钢4倍抗飞行给高分），但因无输出招被 attemptSwitch 的 goodAttackSwitch 排除。改动F 的 standard 主导选择应已部分缓解，需实战确认

### 5.8 对手「可能但未确认」免疫特性的规避过严（待 v1.2 上线后做，独立改动）

> 用户反馈（基于 v1.0，各版本通用）：卡璞哞哞（草+妖精）面对玛力露丽（水+妖精）不用草系招、改用格斗招，结果输掉。
>
> **根因**：`calcMoveDamageBuff`（L2414-2423）对「可能但未确认」的免疫特性一律把 `initbuf` 归零。`getPossibleAbility`（L1373）在特性未被实战观测确定前返回该种族**全部**可能特性。玛力露丽种族特性含食草(25)，于是 L2417 `defPossibleAbility.indexOf(25) !== -1 && 草系倍率<2 → initbuf=0` 触发，草系招被完全归零——哪怕食草只是三选一可能性（玛力露丽实战绝大多数是大力士，尤其腹鼓配置）。
>
> **更深的博弈问题**：当不点该招就完全无法处理对手时（卡璞哞哞不点草系打不动玛力露丽），规避免疫特性 = 主动放弃唯一解。此时赌对面不是免疫特性反而期望胜率更高。
>
> **现状细分（两个方向相反的问题并存）**：
> - **A 类·单特性免疫，规避过严**：L2416 飘浮→地面、L2417 食草→草、L2419 引火→火，结构是单特性 `defPossibleAbility.indexOf(X) !== -1` → 只要 X 是该种族可能特性之一就归零。**食草问题（玛力露丽）就出在 L2417**，确定过严。
> - **B 类·L2418/2420 的 `&&` 疑似 bug**：L2418 水系免疫写成 `indexOf(11)!=-1 && indexOf(87)!=-1 && indexOf(114)!=-1`（三特性**同时**在列表），L2420 电系同理 `12 && 31 && 78`。一只宝可梦最多 3 特性，这三个又是不同的免疫特性，几乎不可能同时拥有 → **该条件几乎永不触发，水系/电系免疫特性实际几乎从不被规避**。直觉上应是「任一免疫特性在列表即归零」（用 `||`）。但**未确认**：① 11/87/114/12/31/78 的准确含义（无特性对照表，编号是从上下文推测）；② 原作者是否另有意图。**做这个改动前先解码特性编号**（见本地可做 1. 字段语义映射的特性对照表任务），确认后再决定 `&&`→`||`。
>
> **方案（已定调：折扣 + 唯一解不归零组合）**：
> - A 类单特性免疫：从「归零」改为「乘折扣系数（建议 0.4）」。
> - B 类：先确认编号与意图；若确属 bug 则改 `||`，同样用折扣而非归零（修 bug 又不过严）。
> - **唯一解保护**：若该招打折扣后仍是我方对当前对手的最高 movepow 招（即归零它就无招可打），则不打折扣、按正常伤害算——主动赌对面不是免疫特性。
> - 特性已被实战确认（`info.ability !== -1`，getPossibleAbility 只返回 1 个）时维持归零——确认是免疫特性就别白打。
>
> **实施注意**：calcMoveDamageBuff 是 getMoveDamage 的子调用，折扣会同时影响主循环和 softmax 的 movepow。「唯一解保护」需要在调用点（getMoveDamage 内）判断该 slot 是否为全队/全招最高，或在 calcMoveDamageBuff 外层做二次判断。需先理清调用链再动手。
> 特性编号待确认（无对照表，下列为上下文推测）：25=食草 26=飘浮 18=引火 11=储水 87=引水 114=干燥皮肤 12=蓄电 31=避雷 78=电气引擎。

### 5.9 v1.3 已实施 + 衍生待办（基于 feedback/v1.2 case+report）

**已实施（v1.3）**：

- [x] **改动 I**：被迫/KO 换人纳入高 standard 候选（修 case4-R8/case7-R2 换人送死；passive 时合并全体 standard 接近最高的墙，主动换人不变）
- [x] **改动 M**：softmax 溢出折减 + 命中率（有效伤害=1.10内全额+溢出×0.1，再×命中率；修 case4 水炮/冲浪）
- [x] **改动 K**：softmax 先制度建模（速度劣势分层为主+先制斩杀/对手能秒我放大；突袭×0.3；修 case7-R3）
- [x] **改动 J**：softmax 上下位招剔除（同属性严格支配）
- [x] **改动 L**：softmax 自损 debuff 招非首选剔除

**v1.3 衍生 / 未做（后续版本）**：

- [ ] **伤害估算 ±5% 偏差校准**：实测伤害与 AI 预估有约 ±5% 偏差，疑来自对手耐久估算（case7 观测38%估33%、连续重算数值漂移）。A/B 两招调同一耐久故相对比较稳，但绝对值影响斩杀线判断。可探索"用实战观测伤害在线回归修正对手耐久"。v1.3 用溢出 1.10 阈值规避其对溢出判断的影响，但根因未解。
- [ ] **finalScore 完整加权模型（远期，统一架构终态）**：把 smFinal 从当前的"有效伤害×命中×先制系数"升级为显式加权和：`w1·期望有效伤害占比 + w2·伤害溢出(负) + w3·命中率 + w4·buff/debuff + w5·先制出手概率(速度差) + ...`。J/L 的"支配剔除"届时改为按各因子综合判定；K 的突袭降权归位为 w5+w2。与 5.6 的 L1-L4 统一架构合并推进。
- [ ] **report 暴露的剥削点（人类视角，防被读穿）**：① setup 后不衔接输出（report4 龙舞+替身死循环）② 进场即换的可预测循环（report5 音波龙/具甲武者反复进退）③ 撞墙硬刚守住（report4 垒磊石撞青铜钟）。这些是人类反复看穿剥削的点，优先级高。
- [ ] **连击招伤害 / 混乱自伤记录 bug（case6/case2）**：钢拳双击伤害体感高估（虽 times=5 用 3.168 系数，仍偏高待核）；飞膝踢把对手混乱自伤并入招式伤害记录。

### 5.10 v1.3.1 已实施 + v1.4 待办（基于 feedback/v1.3 case1/case2）

**已实施（v1.3.1 patch）**：

- [x] **改动1**：KO 换人走 passive 路径（`attemptSwitch(false)`→`true`），触发改动I，修 KO 换人选 standard 最低送死（case1-R6/case2-R6 致命）
- [x] **改动2**：被动换人纯 standard 候选，去掉 goodAttackSwitch 无条件纳入（修铁螯龙虾-130 进候选池）
- [x] **改动3**：standard 虚高缓解小改——①L1752 indexOf 死代码修复 ②耐久加分收紧(+30→+18,0.3→0.22) ③输出过低惩罚(<0.18 罚-30,<0.30 罚-15)
- [x] **改动4**：回退改动J（误删伏特替换），保留改动L与第二遍守卫

**v1.4 待办（结构性重构）**：

- [ ] **问题5：威胁评估未露本系招式**：getFoeThreatToMe 的 B 因子 bestDmg 只算已亮相攻击招，对手只露1招时忽视本系招威胁（case2-R6 藏玛然特只露巨兽弹，忽视格斗本近身战4x，铁螯龙虾被换上送死）。方案：露招时补"未露属性的本系"，按露招数衰减（露1招×0.8/露2招×0.5/露3招×0.2）。并入 v1.4 getSwitchStandard 重构（防御评估也统一考虑未露本系）。
- [ ] **问题3 结构性：getSwitchStandard 复用 getFoeDamageToMe**：当前防御评估用手写耐久公式+属性循环+抵抗加分（L1749-1803），与 getFoeThreatToMe 用的 getFoeDamageToMe 是两套体系、量纲不一致且有 bug。重构为：防御部分改用 getFoeDamageToMe（对手打候选伤害比例→映射加减分）+ 加完整输出维度（候选打对手），删手写耐久公式+抵抗加分虚高项。standard 变防御+输出综合分。呼应 finalScore 加权模型愿景（5.9）。
- [ ] **问题6：threat 算法优化**：threat 与 bestDmg 量纲关系（A速度+B伤害独立累加，我方先手时威胁压低）后续专门讨论，可能拆成"秒杀威胁/消耗威胁"两分量或重新设计因子权重。

### 5.11 天气/场地编号核查 + analysePossibleSpeed bug（v1.4，看板联调时发现）

> 来源：board 看板联调反馈"晴天显雨天"，核查主脚本 weather 编号时发现。

**已确认（无需再查）**：
- weather 编号在主脚本三处逻辑（威力加成 L2435-2440 / 提速特性 L1450-1456 / 招式判断 L2099-2100）一致：`2=雨 4=晴 3=沙暴 1=冰雹 5=大日照 6=大雨`。board-standalone.js 的 boardWeatherName 已据此修正（原 2/4 搞反）。**主脚本 weather 判断没反**。
- terrain 编号 `1=electric 2=grassy 3=misty 4=psychic`（L2447-2451 威力加成确认）。

**待办**：

- [ ] **bug 修复：analysePossibleSpeed L1290 `var weather = turnMemory.memory.terrain`** → 应为 `.weather`。当前 weather 变量读成 terrain 值，导致 L1300-1306 / 1320-1326 / 1335-1341 所有天气特性（雨速/叶绿素/拨沙/雪走）速度修正判断失效（拿 terrain 值比 weather 编号，几乎不匹配）。影响对手速度区间推断，漏算天气特性加速。对照 getPossibleSpeed L1447 `weather = battle.data.field.weather` 是对的。
- [ ] **核查特性编号 33/34/146/221/212**：从"提速特性配对应天气"自洽性反推为 33=雨速 / 34=叶绿素 / 146=拨沙 / 221=雪走 / 212=冲浪之尾，但无特性对照表实证。PO 里 `/eval sys.ability(33)` 等打名字确认。顺便补特性编号对照表（见本地可做 1. 字段语义映射）。
- [ ] **核查天气/场地相关招式编号**：L2099-2107 招 240/241/258/201/588/593/599/633/635 在对应天气/场地失效，确认招名与机制一致（240=日光束 weather2雨无效、241=打雷 weather4晴低命中等已自洽，其余待核）。
- [ ] **status 编号 3=冰冻 的实证**：1=麻 2=睡 4=烧 5=毒 31=KO 有特性/招式证据，3=冰冻是排除法推断（L1822 与 2 并列），联调时确认。

### 6. Sacrifice play（长期探索，暂不做）

> 需要跨回合状态记忆，无法在单回合决策框架内实现，工程量大。

- [ ] 在 `getGoodForSwitch` 里新增"当前宝可梦无用度"评分：HP < 30% 且 PP 耗尽 / 类型覆盖冗余的宝可梦得高分，视为候选炮灰
- [ ] 主循环新增"当前宝可梦是否比场下候选更适合作为炮灰"的判断逻辑
- [ ] 增加跨回合标记 `pendingRoyalEntry`：本回合决定送炮灰，下回合知道要换王牌上来收掉

---

## v1.0 已合入改动的实战验证（需 PO 环境）

> 改动 A/B/D 的参数均为经验估算，需要实战数据来校准。

- [ ] 跑 ≥50 局并收集 `print_s` 日志，统计以下指标：
  - 自损招（流星群 / 过热等）的使用频次是否合理（改动 B）
  - 对手攻击强化 ≥2 后 AI 换人率变化（改动 A）
  - softmax 候选数分布（candidates=1 / 2 / 3+ 的各自比例）（改动 D）
- [ ] 根据实战结果调整改动 B 系数（当前 0.60 / 0.70 / 0.85）——若流星群出现过少则上调，过多则下调
- [ ] 根据实战结果调整改动 D 阈值（当前 75 / 85 / 90）——若 AI 出招仍可预测则降阈值扩宽候选集
- [ ] 验证 `getOpponentDecisionPool` 返回值分布是否合理（是否存在长期为 0 或长期满 100 的情况）

---

## 需要 PO 运行环境才能推进

> 必须在 PO 客户端挂 [test_callbacks.js](test_callbacks.js) 实战才能完成。在本地无法做。

- [ ] 探索 `battle.data.team(int)` 返回值结构（队伍数据组织方式）
- [ ] 探索 `battle.data.avatar(int)` 返回值
- [ ] 验证 `battle.battleCommand` / `switchClicked` / `attackClicked` 的实际调用效果与参数约束
- [ ] 扩展 [test/battleLog.md](test/battleLog.md) 采样：覆盖更多场景（天气 / 场地变更、多段技、状态异常、濒死强制交换、Mega 演化、Z 招式、动态 Max 等）
- [ ] 实战中验证 [20201227.js](20201227.js) AI 的判定正确性，记录回归点

---

## DeepSeek 接入（LLM 决策，deepseek-bridge/）

> 用 DeepSeek 代替/辅助现有 `attemptCommand()` 决策。链路：PO QScript → 本地 Node 代理 [deepseek-bridge/server.js](deepseek-bridge/server.js) → DeepSeek API。测试脚本 [deepseek-bridge/deepseek-test.js](deepseek-bridge/deepseek-test.js)。

**已完成**：

- [x] 连通性验证：PO ↔ 代理 ↔ DeepSeek 往返（dummy 请求）
- [x] 最小决策闭环：DeepSeek 返回 attack/switch 指令，PO 用 `battle.battleCommand` 执行（attack 与 switch 执行链路均已验证）

**待办**：

- [ ] 场况注入 prompt：采集双方场上/后备/招式（名称/属性/威力/PP）/HP/能力等级/天气场地，拼进 prompt 让 DeepSeek 基于局势决策
- [ ] hybrid 预计算：PO 侧复用 `attemptCommand` 里的 `getMoveDamage` / `getBestSwitchList` 等，把每个可用招式的伤害分布、克制倍率、换人评估算好，作为结构化数据注入 prompt（而非让 DeepSeek 动态重算）
- [ ] 合入主脚本 `20201227.js` 的 `onChoiceSelection`，与现有 `attemptCommand()` 做成开关切换，脱离独立测试脚本
- [ ] 异步化防超时：用 `sys.webCall` 异步回调替代 `synchronousWebCall`，避免 DeepSeek 延迟阻塞 Qt 事件循环 / 触碰回合计时
- [ ] **战报历史注入（最终形态）**：把对战已进行的回合战报（谁用了什么招、伤害、换人、KO、状态变化）解析成结构化上下文，随每回合状态一起注入 prompt，让 DeepSeek 具备跨回合记忆 / 长程决策能力（对应 PokeLLMon 的 in-context RL 文本反馈思路，见 docs/research）
- [ ] **未来形态（远期）· function calling / tool**：把伤害计算等确定性函数包装成 tool 供 DeepSeek 在决策前动态调用（coding 工具那种 agent 模式）。需自建 harness（tool 执行器 + 多轮往返 + 状态管理 + 超时），或把纯函数移植到 Node 代理侧预计算。当前环境 QScript 只能 webCall/同步 GET 且阻塞事件循环，手搓 harness 代价高，**先走 hybrid 预计算注入 prompt 路线**，待链路成熟后再评估是否值得做真 function calling

---

## po-pokellmon（PokeLLMon 路线，LLM 决策）

> 移植 PokeLLMon 方案的正式 LLM 决策实现。代码在 [po-pokellmon/](po-pokellmon/)：服务端 [server.js](po-pokellmon/server.js)、PO 侧 [po-script.js](po-pokellmon/po-script.js)。

**当前状态**：底座完成 —— LLM 正确配置（非思考 `thinking:disabled`、temperature 0.3、数字选项方案、日志含 token 用量与总耗时）。

**后续 3 条基础路线**：

1. **无思考模式**：当前基准，能用但未必强于主脚本 [20201227.js](20201227.js)。最终目标是做对战 bot 服务，需持续优化 prompt / 场况注入质量。
2. **思考 + hybrid 预计算**：思考模式 + PO 侧复用主脚本的伤害/换人评估，把结构化结果注入 prompt。用时消耗大、易超时，仅适合不开计时器的对战里测 LLM 能力上限。
3. **思考 + tool**：思考模式 + function calling/tool（伤害计算等确定性函数）。同样耗时长，仅实验用途。

**动态路由（生产方向，待 1/2/3 全跑通后再看）**：在 无LLM / 1 / 2 / 3 之间按局面动态路由，平衡用时与水平。

- [ ] **服务版 LLM 完全失败降级为非 LLM 规则 AI**：多次 retry 完全 fallback 后，退化为主脚本 [20201227.js](20201227.js) 那样的非 LLM 运行——在 PO 侧本地计算伤害/换人/出招，不依赖 server / DeepSeek。目的是服务版在 DeepSeek 不可用 / 断网时仍能持续对战，不卡死、不摆烂（复用主脚本 `attemptCommand` 那一套评估逻辑作为兜底决策器）。
  - **主脚本那套是完整规则 AI，理论上能独立打完一整局**（不依赖 server/LLM），所以降级后不是「等死」，而是切到一条可持续的决策路径，可以撑到终局。
  - **降级期间持续重试连接 server**：进入兜底模式后不放弃 LLM 路线，每回合（或按间隔）探测 server 是否恢复（如轻量 `/health` 或直接重发 `/choice`）；一旦恢复则切回 LLM 决策。降级是「可逆的降级」，而非一次性判死。
  - 实现要点：兜底决策器与 LLM 决策器做成可切换的双路；server 恢复检测要轻量、有节流（避免断线时又触发 antidos）；与现有的「断线节流」「连续失败认输」逻辑联动——降级优先于认输（先试着用规则 AI 撑下去，认输是最后手段）。

**tool 模式长期 TODO**：

- [ ] 🔴 **【高优先级】对战主脑切 `deepseek-v4-pro`（待实测对比后定）**：实测（2026-09-16）确认 `deepseek-v4-pro` 端点可用、**未被路由到 flash**（响应 `model:deepseek-v4-pro`）；开 thinking + tool 多轮时**不回传 reasoning_content 不报错**（两场景均 200），故切换**无需**改 [server.js](po-pokellmon-tool/server.js) 的 reasoning_content 回传逻辑。附带发现：回传 reasoning_content 提升 prompt cache 命中（cached_tokens 384 vs 256、miss 41 vs 169），属可选优化。落地：`MODEL`→`deepseek-v4-pro`（建议提成 env `POKELLMON_MODEL` 可一键回 flash），thinking 从 `low` 起步——Pro-max 在多轮 tool（MAX_TOOL_ROUNDS=15）下可能逼近 240s 超时，先 low 测延迟再决定是否按「关键回合（换人/残局/强化手判断）升 high/max」分级。切后实测对比 Flash/Pro 的决策质量 + 延迟再定。
  - 背景：Flash 强「工具/agent 执行」（DeepSWE 74.2 > Pro 62.7）弱「闭卷深想」（HLE 36.8 < Pro 42.7）；对战主脑瓶颈是「决策浅/缺全局意识」而非工具执行，故倾向 Pro。R1 无资源 + 工具调用弱，不作主脑。

- [ ] 🔴 **【高优先级】单回合超时导致断联认输（已定位，待改）**：实测最近两场（battle43/44）都出现「打到一半 parse error → 认输」，根因是**部分回合 tool 调用过多、单回合耗时 114~146s**，超过 PO 的 `sys.synchronousWebCall` 超时 → 返回空 → `JSON.parse` 崩 → 连续 3 次失败（跨度>15s）→ 认输。server 侧**无任何 DeepSeek 报错**（grep 无 `[choice] fail/error`），纯 PO↔server 超时。修复方向：① server 加**单回合总时长上限**（如 60~90s，到点直接返回兜底动作，不再继续 tool loop）② 或 `MAX_TOOL_ROUNDS` 15→5~6 硬封顶。待确认后改（涉及决策行为）。

- [x] **允许 LLM 读写对战观察（memory）**：已完成 —— `save_observation` / `get_observation` / `save_strategy` / `get_strategy` 四个 tool 已实现并运行。后续持续完善：看 LLM 还可以观察什么、记什么（如对手操作倾向/习惯、常见先读模式等），按需扩展笔记字段或新增观察维度。

- [x] **战术思路 tool（可无限扩充的战术知识库，避免 system prompt 膨胀）**（已做 battle_tips 基础：10 组队战术 + random_battle_playbook，可继续扩充条目）：把宝可梦对战的战术思路/打法套路做成可调用 tool，LLM 决策前按需查，而不是全塞进 system prompt（prompt 太长会稀释重点、增加 token 成本）。设计方向：一个 `get_tactic(name)` 或分类的 `list_tactics()` + `get_tactic(name)`，内容用结构化文本描述「触发条件 + 做法 + 目的 + 风险」。可塞的战术清单（持续扩充）：
  - 多换一击杀高威胁（牺牲换人节奏，换取先手击杀对手核心威胁）
  - 炮灰（送掉无用/低价值宝可梦，换取无伤换入王牌）
  - 下钉逼换（撒隐形岩/地钉/毒钉施压，逼对手换人被钉子惩罚）
  - U-Turn/Volt Switch/Flip Turn 转场（打一发 + 免费换人，保持节奏）
  - 先读 hard read（预判对手换入/守住，打针对招）
  - stall 消耗（通过回复/钉子/状态/属性盾慢慢磨血）
  - setup sweep（强化后推队）
  - 耗 PP（压力特性/替身耗招，把对手核心招 PP 耗尽）
  - 替保毒（替身 + 守住 + 剧毒，磨血拖回合）
  - 联防（队伍间属性抗性互补，反复换人分摊伤害）
  - …（持续扩充）
  - **战术条目必含字段**：① **Gen 适用度**——注明该战术在哪个世代强/弱（部分老战术如替保毒在 Gen5+ 因机制变化/快节奏被削弱，写入时须标注「Gen N 环境适用度」）② **案例**——举一个具体宝可梦怎么打（如「烈咬陆鲨 替保毒：替身躲技能→剧毒磨血→守住回 PP」）③ **代表性宝可梦/特性/招式**——列出该战术的典型载体（如耗 PP 常用压力特性、替保毒常用剧毒+守住+替身、联防常用钢盾+飞行盾等）。
  - 实现要点：战术描述要写成「什么时候该用、怎么用、什么时候别用」的可操作文本，而非泛泛而谈；与评估依据 tool（伤害/速度/克制）分工——评估 tool 给「事实」，战术 tool 给「思路」，决策权仍留给 LLM。战术库数据建议放 `po-pokellmon-tool/knowledge/tactics.json`（结构化，含 gen/案例/代表宝可梦字段），build 或手写维护。

- [ ] **评估依据 tool（移植+改造主脚本的评估逻辑）**：不做「返回结论」的决策 tool（会让 LLM 变传声筒），而是做「返回理由」的评估 tool，把主脚本里「为什么加/扣分、变化招适应度理由、属性/特性免疫、状态互斥」等确定性规则知识喂给 LLM，决策权仍留给 LLM。候选方向：
  - `evaluate_move(slot)`：属性克制、是否被属性/特性免疫、能力等级修正（为什么打不打得动）
  - `evaluate_status_move(slot)`：变化招适应度 + 理由（对手毒系/已异常→剧毒无效；对手已强化→要抢先；我方残血→睡觉价值高）
  - `evaluate_switch(slot)`：换人候选依据（抗性能不能扛、会不会被秒、输出够不够）
  - 优先级：硬事实（属性克制/免疫/状态互斥/招式效果）→ 半硬评估（伤害/速度/先手）→ 经验系数（最后）
  - 前置：种族值数据文件（`calc_damage` 需要）。具体实现等确定方向后再做。
  - **开工前先评估**：对战到底需要哪些 tool（数据→tool 映射见 [po-data/README.md](po-data/README.md)），列清单后再动手写 build 脚本，避免盲目堆 tool。
  - **初版 tool 清单（评估后暂定 3 个）**：
    1. **先后手评估**：双方招式先制度一致时判断先后手可能情况；并提示双方先制招式、改变速度的特性/场地/状态（雨速/叶绿素/拨沙/冲浪之尾/麻痹降速/顺风等）。
    - **速度线相关触发/结算顺序（待实证，先记待定）**：除「同优先度技能按速度」外，还有若干跟速度相关的触发顺序需确认，当前 logs 无对应战报数据，待后续实战采样：
      - **入场/首发特性发动顺序**（威吓、天气特性、场地特性等）：理论上多个特性同时触发时按速度从高到低；PO 战报只记录威吓（已实证「换入 → 特性 → 技能」顺序，如 "Krookodile intimidates Rotom-Heat!"），但 logs 仅单方换入场景，无法实证「多个特性按速度」；天气/场地特性触发消息不走 onAbilityMessage（只能读 battle.data.field 结果）。
      - **灭亡之歌（Perish Song）倒计时到 0 的倒下先后**：是否按速度？logs 中 perish 出现 0 次，无数据，待实测。
      - **回合末结算顺序**（天气伤害/场地/状态伤害/剩饭/灭亡倒计时等）涉及双方时是否按速度——待实证。
      - **换人优先于所有技能**：换人先发生，然后技能按速度（已从威吓战报实证）。
    - **HP 比例取整规则（待确认）**：替身消耗 1/4 已确认向下取整（floor，如 404 HP → 101 HP 替身）；待确认腹鼓（Belly Drum）消耗 1/2、树果回复（如文柚果 1/4）等 HP 比例计算的取整方向（预期都是向下取整 floor，需按官方规则/实战确认）。
    2. **场上 pm 对场上 pm 用招评估**：评估我方场上 pm 对对手场上 pm 用某招式的效果，含伤害类（伤害范围/克制/命中）和变化类（强化/状态/场地）。
    3. **场上 pm 对换上 pm 用招评估**：假定一方换人时评估，我方招式对对手换入 pm 的效果；换入方无能力等级（stats 清零），且需接受入场结算（隐形岩/地钉/毒钉等）。
    4. ✅ **特性/道具/招式详情查询**（已做 get_ability_info/get_item_info/get_move_info）：`get_ability_info(name)` / `get_item_info(name)` / `get_move_info(name)` 返回特性/道具/招式具体效果文本（prompt 已放名字，详情按需查，供 LLM 判断免疫/强化/先制等机制）。依赖 po-data 的 `ability_desc.txt` / `item_effects*.txt` / `move_description.txt`（或 `move_effect.txt`）解析成 knowledge JSON（与 `po-pokellmon-tool/build-knowledge.js` 同源）。
    - **特性知识库按官方规则（PS），读取按 PO**：PO 会把效果相近的特性合并（实测 `17 Immunity/Pastel Veil`、`164 Teravolt`（Turboblaze 被并入，无独立编号）等），但官方规则里它们是不同特性。`get_ability_info` 的**描述/效果文本按官方规则（PS）写、区分合并的特性**；**特性读取/编号仍按 PO**（对接 PO 的 `state.ability` 编号）。
    5. ✅ **move 的 tag 信息（不止 description）**（已做 get_move_info 暴露 tag）：招式除描述文字外还有 tag 类属性——声音类 `voice`、接触类 `touch`、铁拳 `ironFist`、鲁莽 `reckless`、强壮之颚 `strongJaw`、超级发射器 `megaLauncher`、先制 `priority` 等，已在 [movedata.json](movedata.json) 整理好。`get_move_info` 应一并暴露这些 tag（如「接触类会被鲨鱼皮/静电/火焰之躯反伤」「声音类被隔音免疫」），后续优先关注。
    6. 🟡 **特性推断（可能特性列表 + 触发/未触发提示）**（正向解析+入场反向排除已做，交 LLM 排除待做）：让 LLM 能读一只 PM 的**可能特性列表**（`pokes/ability1/2/3.txt` 给出每只 PM 的三个特性槽位），并重点标注「哪些特性触发后战报会有提示」（数据源 `abilities/ability_messages.txt`）。核心是**双向推断**：不仅「触发 → 确定是这个特性」，还有「未见触发 → 排除这个特性」（如对面未触发威吓→排除威吓；未触发静电→排除静电）。这比静态读特性文本更高阶，接入时让 LLM 在「已触发提示 vs 未触发提示」之间做排除式推断。
    - **已实现（po-script 0.6.0）**：正向解析（pklmAnalyseAbility 移植主脚本 switch-case）+ 入场必触发特性反向排除（17 个：威吓/天气/场地/下载/复制/察觉/压迫感/破格/不挠之剑/不屈之盾等，换入后没触发特性消息则从 possible 排除）。
    - **后续（交 LLM 排除）**：更复杂的反向排除（被攻击/回合末/免疫类特性「该触发但没触发」）系统硬编码做不彻底，后续通过 prompt 引导 LLM 用 get_ability_info 的 signal（触发时机+判断方式）自行排除，而不是系统全做。

- [ ] **招式观察对手配置的解析（打落/小偷/戏法 → 道具，烦恼种子/扮演/特性交换 → 特性）**：有些招式能主动暴露对手配置：打落（Knock Off）/小偷（Thief）/抢夺（Covet）拍落或偷取对手道具（move_message.txt `%s knocked off %f's %i`），戏法/掉包交换道具；烦恼种子（Worry Seed）/胃液（Gastro Acid）消除特性，扮演（Role Play）/特性交换（Skill Swap）复制/交换特性（走 onAbilityMessage）。价值：比被动等道具/特性自己触发更主动、确定。① 先修/确认 `%i` 道具名占位符替换方向（pklmMsgCtx 的 i 用 spot 的道具，但打落消息 %i 是目标 %f 的道具，方向可能反，需实测）② 后续做道具/特性正向解析存 state（opp.itemInferred，类似 ability 正向解析）。

- [ ] **评估是否引入 @smogon/calc（PS 官方伤害计算器）**：Pokemon Showdown 官方 damage calc 用的 TypeScript 库（npm 包 @smogon/calc），功能全（含道具/特性/天气/场地/状态/暴击等所有修正）。当前 calc_damage 是简化版（标准公式 + extra 系数手动补修正），够用。若后续发现简化版在复杂场景算不准，评估引入 @smogon/calc 或参考其公式补全。注意：TS 库需 npm install + 转译，QScript/Node proxy 环境接入成本高，非必要不引入。

- [ ] **主脚本 20201227.js 伤害计算对齐 @smogon/calc（等 tool 侧验证后再做）**：tool 侧 calc_damage 已对齐（0.3.37：随机系数→STAB(4096定点)→克制(pokeRound)→extra，6 用例与 @smogon/calc 一致）。主脚本 getMoveDamage 有两处差异：① **随机系数顺序反**——movepow[i]（L2427）算出的是「最大伤害」（1.0x，先 base→克制→STAB 连续乘），别处用 `maxpow * 0.85`（L1042/L1285）算最小伤害；正确应「先随机系数(85-100) 再 STAB 再克制」② **取整方式**——主脚本纯浮点连续乘（无逐步 floor/pokeRound），正确应逐步 floor（随机向下取整、STAB 五舍六入 pokeRound、克制向下取整）。对齐需改 L2427 base damage 公式（`(2*level+10)/250` 等价 `(2*level/5+2)/50`，但 buff 里 atk/def 未逐步 floor）+ 后续克制/STAB/修正链 + getPossibleDamage/analyseCurrentDamage 的 `maxpow*0.85`。注意：主脚本是评分用估算、精度要求低于 tool，可先对齐顺序，逐步 floor 视收益再决定。

- [ ] **calc_damage 补全特性/道具/天气/场地等修正（对齐 @smogon，后续做）**：当前已对齐基础公式 + 能力等级 + extra（0.3.38，20 用例）。尚未自动算：① 特性/道具能力值修正（大力士/瑜伽之力/专爱头带/眼镜/太阳之力/毅力/活力/蹲守/水泡等）——现靠 LLM 用 atk/spa 直接值绕过 ② 天气/场地加成（晴火×1.5、电场×1.3 等）③ 光墙/反射壁/极光幕 ④ 击中要害 ⑤ 防守减伤特性（厚脂肪/毛茸茸/多重鳞片/坚硬岩石等）。方向：先评估哪些 LLM 常用且 extra 补不准，再决定补进 calc_damage 还是继续靠 extra/直接值。可参考 @smogon/calc 的 calculateAtModsSMSSSV / calculateFinalModsSMSSSV（已装 C:\temp-calc\node_modules）。

- [x] **calc_damage/calc_stats 支持形态宝可梦（forme≠0）**（已修 0.3.41）：`resolvePokemonInput` 用 `POKEMON.byName[name.toLowerCase()]` 反查，`buildPokemon` 改为收录基础形态 + 合法形态（按 pokemons.txt 的 tag 排除 Mega 'M' / 极巨化 'G'），key 用 `num:forme`（基础形态仍 `num` 兼容），形态缺 type1 时继承基础形态。现已支持 Rotom-Wash / Landorus-Therian / Deoxys-Attack / Giratina-Origin / 洛托姆各形态等（真实种族值）。

- [ ] **smogon 生态资源（暂记，看情况做）**：① **Usage Stats**（各分级使用率/配招/道具/特性/努力分布，作对手配置先验）——随机队向暂缓，等适配 PS 组队对战再说 ② **@pkmn/data / @pkmn/dex**（PS 完整数据层，补学习面/招式效果等）③ **pokemon-showdown 引擎**（MCTS/rollout 搜索，工程量大，短期不需要）④ **Smogon Analysis/Dex**（标准配招/counter/check 分析，可做 get_set_analysis tool）。

**已实证**：

- 挣扎保底（全 ban 后 `attackButton()`）不会导致卡死，兜底有效。
- PO 无通用 stat 变化回调：剑舞/近身战/冥想等通用 stat 升降不通过 `onMoveMessage` 暴露（`move_message.txt` 里 `rose/fell/sharply` 只有诅咒/装饰/树果/Octolock 等写死的特定招式），战报文本缺「Attack rose sharply / Defense fell」；但 `boosts` 字段（`statBoost` 快照）正确反映能力等级，LLM 可通过 history（用了什么招）+ boosts（能力值）关联推断。**结论：不硬补文本，靠 `boosts` 字段即可**。

**待办（观察项，暂不实施，等再打几把看表现）**：

- [x] **战报保存完整性（基于回调 function 补全战报细节）**：当前 po-script.js 只记 `onUseAttack`/`onDamageDone`/`onKo`/`onSendOut`，大量效果信息丢失。需把以下回调补进 `pklmTurnLog`（进而进 history/fullHistory，供 tool 的 `get_battle_history` 读取），让战报能完整还原「有效/无效/招式效果/状态变化」：
  - `onEffectiveness`（有效 / 效果绝佳 / 效果不好 / 无效）
  - `onAttackFailing`（攻击失败）
  - `onMiss` / `onAvoid`（未命中 / 被避开）
  - `onCriticalHit`（会心一击）
  - `onMoveMessage`（招式效果消息，如「对手被浸水，属性变水」）
  - `onMajorStatusChange` / `onStatusOver`（状态变化 / 结束，如浸水、烧伤、中毒、麻痹）
  - `onStatusDamage`（状态异常伤害，如烧伤/中毒扣血）
  - `onFlinch`（畏缩）
  - `onItemMessage` / `onAbilityMessage`（道具 / 特性触发）
  - 映射备注：`onEffectiveness` 取值 `0`=无效 / `2`=效果不好(1/2) / `4`=正常(1x) / `8`=效果绝佳（2x 与 4x 都传 8；PO 通常不传 `1`/`16`，但需兼容 `1`=1/4、`16`=4x）；status 编号 `1`=麻痹 / `2`=睡眠 / `3`=冰冻 / `4`=烧伤 / `5`=中毒 / `6`=混乱 / `31`=KO（见 [board-standalone.js](../board/board-standalone.js) `boardStatusName`）

- [ ] **战报细节度持续扩充（状态效果体系持续补全）**：已完成的战报保存完整性（上方 [x]）解决了基础回调，浸水/剧毒/挡路这类「改属性 + 状态」体系已经能通过 `onMoveMessage` / `onMajorStatusChange` 记进 history（如「对手被浸水，属性变为水」）。本项转为**持续扩充**：后续按需补进更多效果类回调 / 消息解码覆盖（如浸水、挡路、再来一次、再来一次等未覆盖的效果文本），目标是让战报能完整还原「有效/无效/招式效果/状态变化」。每当发现「LLM 重复用无效招」或「看不到某个状态」时，回来补一条对应的战报细节。

- **强化后误换人（丢强化 + 白挨一击）**：暗黑酋雷姆龙之舞后（`Atk+1 Spe+1`）HP 剩 1%，DS 却选换人而非进攻（此时冰锥 2x 克制 + Atk+1 + 速度+1 应先手）。暴露几个通用问题：
  - 换人代价被忽视：换入宝可梦会白吃对手一击，prompt 未体现；
  - 强化损失被忽视：换人清空 Atk/Spe 强化，DS 未理解「换人 = 白费强化」；
  - 先手判断缺失：有 `Spe+1` 但 prompt 无速度对比，DS 无法判断是否先手；
  - 濒死信号过强：`HP 1%` 触发过度保守换人。
  - 方向：换人选项追加「换人代价 / 强化损失」提示 + 注入速度对比 + 预设评估「强化后应进攻利用，换人白费强化」。

---

## 长期重构（低优先，需重新评估收益）

- [ ] 将 [20201227.js](20201227.js) 核心逻辑迁移到 [src/core/battleAI.js](src/core/battleAI.js)（目前只有骨架）
  - **注意**：Node.js 环境下没有 `battle` / `sys` 对象，迁移后也无法脱离 PO 独立运行。如果迁移目的只是"代码整洁"，建议先保持单文件但加强注释分块；真正拆分前应先明确能带来什么好处（单元测试？离线回放？）
- [ ] 按 [docs/architecture/modular-ai-architecture.md](docs/architecture/modular-ai-architecture.md) 的 5 模块方案拆分（游戏规则 / 信息收集 / 信息推理 / 推算 / 决策）
