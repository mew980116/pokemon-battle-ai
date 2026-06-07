# attemptCommand 决策主循环控制流地图

> **用途**：固化对 `20201227_v1.2.js` 决策核心的代码结构分析，避免每次改动前重啃 3900+ 行单体。
> **定位**：纯代码地图，只描述"代码是怎么组织的"（函数/行号/控制流/break 分类），**不含**决策改进观点。
> 决策问题的根因分析见 `feedback/v1.1.1/analysis.md`；各版本改动说明见 `docs/vX.X-battle-logic.md`。
> **行号基准**：`20201227_v1.2.js`（含改动 E/F/G/H）。改代码后行号会漂移，以函数名 + 锚点字符串定位为准。

---

## 0. 关键函数行号索引

| 函数 | 行号 | 职责 |
|------|------|------|
| `typechart(atk, def, special)` | 68 | 属性克制倍率（0/0.5/1/2） |
| `estimateFoeSwitchProb(slots, movepows)` | 250 | 估算对手换人概率（0-100）+ 预期换入 pokeNum |
| `getOpponentDecisionPool()` | 316 | 对手决策池（0-100），用于自损惩罚 + softmax 日志 |
| `getFoeDamageToMe(moveType, power, category)` | 1653 | **改动E** 对手某招对我方伤害比例 |
| `getFoeThreatToMe()` | 1670 | **改动E** 被秒风险（0-100） |
| `getSwitchStandard(slot)` | 1727 | **改动F** 单候选换入评分（原 getGoodForSwitch 循环体抽出） |
| `getGoodForSwitch()` | 1805 | 换入候选筛选（standard>50 入选），调 getSwitchStandard |
| `pickBySwitchStandard(candList, fallbackList)` | 1824 | **改动F** 按 standard 主导选换入目标 |
| `getBestSwitchList()` | 1850 | 最佳换入（standard>100 且能 OHKO 先手） |
| `getGoodSwitchList()` | 1875 | 良好换入（有属性优势） |
| `attemptSwitch(passive)` | 1926 | 被迫/KO 换人的执行（选谁换上） |
| `getStatusMoveEffectiveForCurrentFoe(moveNum)` | 2036 | 变化招适应度（0-4） |
| `CalcMoveDamWithoutDef(movenum)` | 2482 | **我方**招式威力（用 fpoke(battle.me).stat），不含对手防御 |
| `getMoveDamage(pokeSlot, slots)` | 2507 | 我方各招伤害评估，返回 {maxmove, maxmovepow, movepow[]} |
| `attemptCommand()` | 2951 | **主决策引擎**（见下） |

### foeInformation 对象内部方法（部分）

| 方法 | 行号 | 返回 |
|------|------|------|
| `getLastMove()` | 1505 | 对手当前宝可梦最后用的招（0=未知） |
| `getPokeCount()` | 1533 | 对手存活总数（status≠31，含场上） |
| `getPossibleSpeed(slot, boost, buf)` | 1415 | [最小速度, 最大速度] |
| `getCurrentPossibleDamage(movenum)` | 1443 | ⚠️ 实际算"**我方招打对手**"（注释 L1442 方向写反），非"对手打我方"；getFoeThreatToMe 不用它，改用 getFoeDamageToMe |

---

## 1. attemptCommand 两阶段架构（核心）

`attemptCommand`（L2951）决策分两个**互不共享逻辑**的阶段：

```
attemptCommand (L2951)
  │
  ├─ 初始化 / KO 强制换人 / getMoveDamage 伤害评估
  ├─ 换人三档列表构建 (L3032): bestSwitchList / goodSwitchList / goodForSwitch
  ├─ foeThreat = getFoeThreatToMe() (L3036, 改动E)
  │
  ├─ 【阶段1】主决策循环 while (L3095) ───────────────┐
  │     逐招检查特殊机制，命中即 commandDecided=true; break
  │     · 斩杀/先制/破替身/破画皮/变化招/换人/起死回生/Z招...
  │     · 唯一不标记的 break = 普通攻击招出口 (L3373) + 高伤害确认 (L3845)
  │                                                    │
  │     循环退出三种情况：                              │
  │       a. 确定性 break → commandDecided=true        │
  │       b. rejected 始终 true → if(rejected) 换人 (L3850 区)
  │       c. 普通招出口 break / 跑满 → 进阶段2          │
  ├──────────────────────────────────────────────────┘
  │
  ├─ if (rejected) { attemptSwitch(true); return; }   ← 所有招被拒→换人
  │
  ├─ 【阶段2】softmax (L3872 `if (!commandDecided)`)──┐  改动G: commandDecided 时整段跳过
  │     · 局面温度 T（残局/专爱/对手强化衰减）           │
  │     · finalScore = 纯伤害混合（无先制/命中率/附加效果）│
  │     · thresh 过滤（改动H: 对手剩1只→0.97）          │
  │     · 加权采样选 usemove                            │
  ├──────────────────────────────────────────────────┘ (L4010 闭合)
  │
  ├─ Mega / Z 招式标记 (L4012 区, 无论哪阶段都执行)
  └─ sendCommand (L4026)
```

**关键**：阶段1 有先制/命中率/斩杀判断；阶段2 只有伤害。改动 G 之前，阶段1 的确定性 break 出来后会被阶段2 用纯伤害覆盖（v1.1.2 case3-2 bug）。改动 G 用 `commandDecided` 标志让确定性决策跳过阶段2。

---

## 2. 主循环 break 点分类（改动 G 的依据）

主循环（L3095-L3849）内约 28 个未注释 break。分两类：

### 2.1 确定性决策 break（标记 commandDecided=true，跳过 softmax）

| 机制 | 锚点 / print_s |
|------|---------------|
| 解冻技能 | "进行解冻" (L3168 区) |
| 破替身 | "破替身技能生效" 前的 break |
| 破画皮(Mimikyu) | "破画皮技能生效" 前的 break |
| 先手斩杀 | "先手斩杀生效" (L3233) |
| 先手兑子(自杀技) | "先手兑子生效" |
| 先制斩杀(优先度招) | "先制斩杀生效" (L3268) ← case3-2 |
| 下马威/迎头一击 | 252/656 |
| 残血后手先制 | "残血后手先制技能输出生效" |
| 普通斩杀 | "斩杀技能生效" (L3305) |
| 伏特替换/急速折返换人 | 369/521/600/838 break |
| 变化招(ret≥3/4) | getStatusMoveEffectiveForCurrentFoe |
| 变化招(ret==2 终判) | break |
| 换人招(switchFlag) | "if (switchFlag)" (L3515) |
| 强化招(剑舞/龙舞等) | 输出不足强化 break |
| 反击招(报仇/恶意追击) | 68/243/368 |
| 起死回生/蛮力/双刃 | 175/179/283 |
| 豁命 | 515 |
| 接力棒 | 226 |
| 强制 Z 招 | 150/160/176/608/609 |

### 2.2 不标记的 break（交给 softmax 随机化）

| 出口 | 锚点 | 说明 |
|------|------|------|
| 普通攻击招出口 | `if (!rejected && (choosetime >= len*3 ...)) break` (L3373 区) | softmax 本该处理的"伤害接近的普通招" |
| 高伤害确认 | `damagePercent*accurcy/100 > 1.5` (L3845) | 超高伤害招，进 softmax 权重也最高 |

> 漏标记的后果：退化成 softmax 覆盖（=改动 G 之前的旧行为），不会更糟。

---

## 3. 换人三档路径（L3385-L3513）

三档互斥（if / else if / else if），门槛递减。每档内 `rejected=false` 即"鼓励换人"，`switchFlag=true` 触发最终换人（受 choosetime 门槛约束）。

| 档 | 进入条件 | 行号 | switchFlag 门槛 | 改动E 接入(被秒维度) |
|----|---------|------|----------------|---------------------|
| 第一档 bestSwitchList | `bestSwitchList.length > 0` | 3385 | choosetime≥len | `foeThreat>=55 && best非空` (L3410) |
| 第二档 goodSwitchList | `goodSwitchList.length>0 \|\| goodForSwitch.length>1 && rand` | 3414 | choosetime≥len*2 | `foeThreat>=65 && (good非空) && rand` (L3436) |
| 第三档 goodForSwitch | `goodForSwitch.length>0 && rand` | 3440 | choosetime≥len*3 | `foeThreat>=75 && goodForSwitch非空 && rand` (L3472) |

**各档 rejected=false 的原生维度**（改动E 之前）：①速度劣势+被克制 ②被弱化(statBoost总和负) ③输出不足(maxmovepow/foeMaxHp 低)。**无"对手能秒我"维度** → 改动E 补上。

**改动E 接入位置**：每档的"对手强化随机拒绝"安全阀**之后**、switchFlag 触发**之前**——使被秒维度可覆盖"对手强化时保守不换"。硬性前提：每档都带 `&& 候选列表非空`，空候选时威胁再高也不换。

---

## 4. attemptSwitch 选目标逻辑（L1926，被迫/KO 换人）

与主循环换人不同：attemptSwitch 是"已决定要换，选换谁上"。

```
attemptSwitch(passive)
  ├─ goodForSwitch = getGoodForSwitch()         // standard 防守候选
  ├─ goodAttackSwitch = []                        // 只看 maxmovepow(输出)+速度，不看 standard
  │     · 对手 KO 时无条件全入选
  │     · 否则按 maxmovepow > foeHp*1.3 + 速度 筛
  ├─ alternative = goodAttackSwitch ∩ goodForSwitch
  └─ 选 cswitch (改动F 改造):
        alternative 非空 → pickBySwitchStandard(alternative, [])
        否则 goodForSwitch → pickBySwitchStandard(goodForSwitch, [])
        否则 goodAttackSwitch → pickBySwitchStandard(goodAttackSwitch, switchesList)
        兜底 → pickBySwitchStandard(switchesList, [])  // 改动F: 救"最优候选分低进不了列表"
```

- `passive=true`：被 KO 后的被动换人，筛选条件更宽松。
- 改动F 之前：最终选择是在候选列表里 `sys.rand` 纯随机，丢弃 standard → 选错被克制目标（case4/5/6）。

---

## 5. getSwitchStandard 评分维度（L1727）

单候选换入评分，基准 25 分，叠加：

- 属性克制循环（j=0..17）：候选抗/免疫对手主属性 +，被克制 −
- 物理/特殊耐久（对手 maxStat vs 候选 basestat 防御）：能扛 +30，会被秒 −30
- 对手主属性克制候选：被克制 −50，4倍 −30 额外
- 对手高攻/高特攻 + 候选弱点：−30
- 对手已强化：−20/−35（除非候选有 Unaware 特性 +50）
- 候选 HP（>70% +20，<40% −30）、状态异常 −20
- 我方钉子场地：候选接地吃钉 −，毒系吸毒钉 +30
- 对手专爱锁招：候选抗该招 +20，免疫 +50

输出阈值：>100 进 bestSwitchList(ret1)，>50 进 goodForSwitch(ret2)。
被克制单次 2× 即 −50 → pickBySwitchStandard 的 `> -50` 剔除线据此设定。

---

## 6. softmax 段（阶段2，L3872-L4010）

```
if (!commandDecided) {              // 改动G: 确定性决策时整段跳过
  T 计算 (L3886 区):
    基础 2.0 → 对手强化×0.45/0.6/0.8 → 我方残血×0.55/0.75
            → 对手换人概率×1.25/1.1 → clamp[0.4,4.0]
            → 残局存活×0.30/0.45 (v1.1.1) → 专爱cap 0.6 (v1.1.1)
  第一遍: 各攻击招 finalScore = 伤害混合(打当前 vs 打预期换入) + UT/VS 加成
  thresh: T≤0.8→0.85 / ≤1.5→0.75 / ≤2.5→0.65 / else 0.55
          → 改动H: getPokeCount<=1 时强制 0.97
  floor = maxFinal * thresh
  第二遍: finalScore >= floor 的招入候选集
  采样: candidates==1 → 直接取(v1.1.2修复) / >1 → 加权随机
}
```

**finalScore 只含伤害**——无先制、命中率、附加效果、变化招（除岩钉/地钉特判）。这是 v1.3 统一架构要重构的核心（见 TODO）。

---

## 7. 已知陷阱（读码时注意）

- `getCurrentPossibleDamage`（L1443）注释方向写反，实际算"我方→对手"。
- `getGoodForSwitch` 的 standard 评分在 L1656 有 `indexOf()` 缺参 bug（恒返回 -1，某分支失效）——历史遗留，未修。
- 文件编码 UTF-8 with BOM（CLAUDE.md 写的 UTF-16 LE 已过时）。
- QScript 兼容：var/function/indexOf，无 ES6（文件内个别历史 const 是引擎容忍的遗留，新代码勿模仿）。
