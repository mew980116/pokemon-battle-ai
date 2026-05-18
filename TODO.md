# 待办工作

> 本文档根据实测笔记 [docs/reference/battle-object.md](docs/reference/battle-object.md) 等文件现状重新整理。原 TODO 中"数据探索"的 10 项已大部分完成，这里按 **已完成 / 本地可做 / 需 PO 环境 / 长期重构** 四类重排。

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

### 4. 已知 bug / 疑似遗迹（本地可确认，改动需验证）

> 以下问题在逆向分析中发现，可在本地修改，但效果需实战验证。参见 [docs/analysis/decision-logic.md](docs/analysis/decision-logic.md)。

- [ ] **`getGoodForSwitch` L1495：`indexOf()` 缺少参数** → 永远返回 -1，某个类型克制分支从不生效；需确认正确参数后修复
- [ ] **`getGoodForSwitch` L1519：条件与 L1518 相同** → 疑似应为 `> 2`（倍率克制额外惩罚），与 L1518 的 `> 1` 重复导致第二段无效
- [ ] **Path 3 速度判断三段重复（L3089-3103）** → 三段几乎相同的速度检查互相覆盖，实际行为偏向最后一段；需人工走读确认预期行为后合并

### 5. v1.1.1 待办（基于 softmax 设计复盘）

> 核心原则修正：服务型 BOT 的随机性应建立在"期望收益接近的合理动作之间"，而非"信息少时盲目发散"。对手 bench 未亮相时不读空气，对手有明确换入收益时才启动混合评分。

- [ ] **softmax 候选集改为基于 `finalScore` 过滤**：当前全量 `movepow > 0` 参与的问题是真正低期望动作也进入采样；应改为 `finalScore >= maxFinalScore * threshold` 才入选，threshold 随局面动态调整：危机局（强化 ≥2 / 我方 HP<25%）= 0.85，普通局 = 0.70，高 switchP（>40）= 0.60，极高 switchP（>65）且有明确 bench = 0.55。关键：过滤基准必须是 `finalScore`（已混合当前+换入期望），不能用 `movepow_vs当前`，否则读换招在 switchP 高时仍会被错误过滤

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

## 长期重构（低优先，需重新评估收益）

- [ ] 将 [20201227.js](20201227.js) 核心逻辑迁移到 [src/core/battleAI.js](src/core/battleAI.js)（目前只有骨架）
  - **注意**：Node.js 环境下没有 `battle` / `sys` 对象，迁移后也无法脱离 PO 独立运行。如果迁移目的只是"代码整洁"，建议先保持单文件但加强注释分块；真正拆分前应先明确能带来什么好处（单元测试？离线回放？）
- [ ] 按 [docs/architecture/modular-ai-architecture.md](docs/architecture/modular-ai-architecture.md) 的 5 模块方案拆分（游戏规则 / 信息收集 / 信息推理 / 推算 / 决策）
