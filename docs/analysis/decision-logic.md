# 决策层代码逆向分析

> 本文档基于 [20201227.js](../../20201227.js) 的实际代码，逆向还原各模块的原始设计意图。
> 目的是在修改代码前理解已有逻辑，避免盲目改动破坏作者的实战调优结果。

---

## 1. `getMoveDamage`（L2219-2612）

### 1.1 函数签名与调用点

```js
function getMoveDamage(pokeSlot, enabledAttackSlot)
```

**调用者**：
- L1471 / 1579 / 1599 / 1611 / 1623 / 1664 / 1677 / 1690：换人评分函数（`getBestSwitchList` / `getGoodSwitchList` / `getGoodForSwitch` 内部）
- L2710：`attemptCommand` 主决策，传入 `pokeSlot=0`（当前出战宝可梦）

### 1.2 两条路径的区别

| | `pokeSlot = 0`（当前出战）| `pokeSlot > 0`（换入候选） |
|---|---|---|
| 宝可梦对象 | `fpoke(battle.me).pokemon`（实时数据） | `tpoke(pokeSlot)`（队伍数据） |
| stat 来源 | `fpoke(battle.me).stat()`（包含能力等级加成） | 推算的基础值（理论最优）|
| `enabledAttackSlot` | 传入参数（主循环提供） | 自动推算（PP > 0 的全部招式）|
| 意图 | 做出招决策 | 评估该候选换入后的攻击潜力 |

### 1.3 伤害基础公式（L2427）

```js
movepow[i] = (2 * pokemon.level + 10) / 250 * movebasepow * buff + 2
```

`buff` 综合了我方能力等级（atk/spa）和对手能力等级（def/spd）的修正乘数。
这是第五代伤害公式的简化形式——**不是精确值**，是用于招式排序的相对估计。

### 1.4 修正项清单（按计算顺序）

| 行号范围 | 修正内容 | 说明 |
|---|---|---|
| 2428-2429 | × 类型相性（0.25~4.0） | 对手已知属性；可被特性 ID=113 忽略 |
| 2431-2434 | × STAB（1.5× 或 2.0×） | 我方属性与招式属性相同；特性 ID=91 固定 2.0× |
| 2436-2445 | × 天气修正（0.5~1.5 或归零） | 晴/雨/沙/冰/刮风；含特定招式特殊处理（日光束等）|
| 2449-2456 | × 场地修正（0.5~2.0） | 草/电/心灵/迷雾场地；须配合 `isOnLand()` 判断 |
| 2457-2461 | × 0.5（壁垒） | 对方有光墙/反射壁/极光幕时；特性 ID=151 无视 |
| 2463-2501 | × 特性加成（1.2~2.0） | 覆盖 20+ 个特性；音速破/拳头强化/铁拳等 |
| 2546-2557 | × 精准度（≤1.0） | 非必中招式按命中率折扣 |

**对手防御估计**（L2290-2293）：  
`buff` 的分母使用对手 `minStat() × 1.1 + 31`（悲观估计，防止高估伤害）。
特定宝可梦（神兽等）改用 `maxStat()`。

### 1.5 归零例外补丁

| 行号 | 条件 | 归零逻辑 | 推测原意图 |
|---|---|---|---|
| 2560 | 类型免疫 | `movepow[i] = 0` | 无法造成伤害 |
| 2563-2570 | 对手特性防守（共 12 个特性 ID） | `= 0` | 特性免疫（飘浮、魔法防守等）|
| 2580 | movenum=138 且对手未睡 | `= 0` | 噩梦（仅对睡眠目标有效） |
| 2584-2586 | movenum ∈ [120,153,828] 且我方 HP > 70% | `= 0` | 自杀技（反击/大爆炸等），血量不低不用 |
| 2595 | movenum ∈ [136, 26] 且对手有多只 + sys.rand(0,3)=0 | `= 0` | 道具（136=对场地招？/26=???），多敌时 1/3 概率压制 |
| 2596 | movenum === 387 | `= 0` | 无条件禁用；推测是某个特定场景下的 bug 补丁 |

### 1.6 自损招式的处理（核心发现）

**原逻辑中完全没有自损惩罚**。

流星群（ID=434）、过热（ID=315）等特攻 -2 招式，
在 `getMoveDamage` 里与普通招式完全相同——只计算对对手的伤害，副作用被忽视。

这直接导致 AI 的招式选择产生两种结果：
- 若流星群是伤害最高招 → `maxmove` 指向它，但在主循环里只有满足某些条件（L2818 段）才不会因过早被"继续"跳过
- 若对手有防御克制或其他原因导致流星群伤害反而低 → 根本不选

> **改动 B 的插入位置**：在 `if (movepow[i] > maxmovepow)` 之前（L2619 之前），
> 对 SELF_SPATK_DROP_2 等列表里的招式做惩罚折扣，且仅在无法 OHKO 时触发。

### 1.7 返回值

```js
res = {
  maxmove:    number  // enabledAttackSlot 中伤害最高招式的下标（0-3）
  maxmovepow: number  // 该招式的 movepow 值
  movepow:    Array   // 所有可用招式的 movepow 数组（与 enabledAttackSlot 等长）
}
```

---

## 2. 换人三档路径（L3040-3160）

> 换人评估发生在每次主循环迭代的**攻击招评估之后**，共三档级联 if-else-if。

### 2.1 三档对比

| | Path 1 (bestSwitchList) | Path 2 (goodSwitchList) | Path 3 (goodForSwitch) |
|---|---|---|---|
| **前提** | `bestSwitchList.length > 0` | `goodSwitchList.length > 0` 或 (`goodForSwitch.length > 1` 且 50%概率) | `goodForSwitch.length > 0` 且 50% 概率 |
| **触发轮数** | `choosetime >= length * 1` | `choosetime >= length * 2` | `choosetime >= length * 3` |
| **保守程度** | 最激进 | 中等 | 最保守 |
| **特点** | 有明显属性/伤害优势候选 | 有一定优势候选 | 场下无强势选手 |

**三档是互斥的 else-if**：进到哪档，说明比它高的档都没有候选。
- 进到 Path 1 → 场下有强势换入（`standard > 100`）
- 进到 Path 2 → 场下无强势，但有中等换入（`50 < standard ≤ 100`）
- 进到 Path 3 → 场下连中等换入都没有

### 2.2 Path 1 条件链详解

**速度判断块（L3044-3048）——只在"我比对手慢"时触发**：
```js
if (我方 stat(5) < 对手最大可能速度) {
    if (对手属性克制我方) rejected = false;        // 有抗性 → 换
    if (先制之爪/先手缘 且满血) rejected = true;   // 可以先手，不必换
    if (我方 HP < 30%) rejected = true;            // 入场伤害风险高，不换
}
```
**原意**：速度优势时可以先出手打，不急着换；速度劣势时才需要换有抗性的。

**输出与弱化判断块（L3050-3058）**：
```js
if (我方被弱化 && 最强招 < 80% 对手HP) rejected = false;   // 被弱化 + 输出不足 → 换
else if (最强招 < 60% 对手HP) rejected = false;             // 纯粹输出不足 → 换
```

**替身保护（L3059）**：
```js
if (我方有替身 && sys.rand(0,3)) rejected = true;  // 有替身时 2/3 概率不换（替身是昂贵资产）
```

**对手强化判断（L3060-3061）**：
```js
if (对手各项强化总和 > 2 && sys.rand(0,3)) rejected = true;   // 对手多项强化 + 2/3 概率不换
if (对手特防+防御 或 回避强化 > 3) rejected = true;            // 对手物防/特防/回避极高 → 硬拒换
```

> **这里的逻辑有讨论余地**（参见第 6 节）

### 2.3 Path 2 条件链详解

整体与 Path 1 相同，但各个阈值**更保守**：
- 血量门槛从 < 30% 提高到 < 40%（更倾向不换）
- 输出不足门槛从 60% 降到 40%（要更弱才换）
- 鼓励换人的概率也引入随机化（不再确定接受）
- 新增：当前招伤害 > 60% 时倾向不换；替补伤害 < 35% 时倾向不换

对手强化判断与 Path 1 相同（L3082-3084）。

> **实战注意**：Path 2 里场下已经是"中等候选"而非强势选手，对方 setup 后这些候选可能被秒，
> 所以比 Path 1 更保守合理——这不是 bug。

### 2.4 Path 3 条件链详解

**速度判断块（L3089-3103）**：出现了三段几乎重复的速度检查，条件微有不同：
- 第一段：我慢 + 克制倍数 > **2** → 换（要求更高）
- 第二段：我慢 + 克制倍数 > **1**（即对手最小速度下我也慢时）→ 换
- 第三段：与第一段重复，克制要求降回 > 1

> **[疑似 bug / 遗迹]** 三段重复，推测是多次修补叠加，最终效果是两段相互覆盖，实际行为偏向"第三段"。

对手强化判断（L3116-3118）：
```js
if (对手强化总和 > 1) rejected = true;   // 强化门槛从 >2 降到 >1，更容易触发
```

这是**硬拒**（无随机性），配合 Path 3 的"场下没强势选手"语义：
**对手有任何进攻强化 + 场下没有威胁对手的候选 → 不换（避免白白送人给对方刷经验）**

这条逻辑经过讨论确认为**正确的设计**，不是 bug。

### 2.5 换人路径之外的特殊逻辑

| 块 | 位置 | 逻辑 |
|---|---|---|
| **再生力换人** | L3125-3135 | 特性 144（再生力）的宝可梦换下回 1/3 HP，因此比普通宝可梦更倾向换人 |
| **入场伤害硬拒** | L3137-3144 | 计算隐身岩/钉子伤害后，若换上去的 HP 会降为 0 → 强制取消换人 |
| **必须换人** | L3145-3159 | `myInformation.needSwitch` 标记 或 我方能力等级过低 → 强制换 |
| **伏特替换优先** | L3160-3165 | 即使 switchFlag=true，若当前招是 369/521/838/600（伏特替换/急速折返类）→ 仍可出招换人 |

---

## 3. `attemptCommand` 主决策循环（L2627-L3494+）

### 3.1 函数前置检查（L2627-L2714）

```
→ 对战已结束? → return
→ 我方已 KO && 有替补? → attemptSwitch(false) return
→ 所有招禁用 && 有替补? → attemptSwitch(true) return
→ 只有 < 2 招能用 && 无替补/禁换? → 强制出最强招 return
→ 初始化招式列表（按伤害降序排列）
→ 调用 getMoveDamage(0) 得到当前出战宝可梦的招式评分
→ 计算三档换人列表 (bestSwitchList / goodSwitchList / goodForSwitch)
→ foeMaxHp = sys.rand(minStat(0), maxStat(0)+1)  ← 随机估计！
→ maxDamagePercent = maxmovepow / foeMaxHp
```

### 3.2 主循环结构（L2761）

```js
while ((rejected && choosetime < 30) || choosetime < enabledAttackSlot.length * 4) {
    choosetime++;
    // ...
}
```

**选招策略**（L2771-2776）：
- `choosetime < length * 3`：按顺序循环选取（保证每招至少被评估到）
- `choosetime >= length * 3`：改为随机选取（引入随机性）

这是保证所有招式都被考虑 + 后期引入随机化的组合设计。

### 3.3 单次迭代的 rejected 控制流

每次迭代从 `rejected = true`（重置于 L2881）出发，经过多层条件叠加来决定是否接受该招式：

```
基础检查（威力极低 → continue，永不接受）
    ↓
特殊招式分支：
  ├─ 解冻招 + 我方冻结 → break（立即使用）
  ├─ 蓄力招 → 持 Z 晶时才放宽
  ├─ 副作用/硬直招 → 复杂评估（HP 门槛 + 随机）
  └─ 替身/画皮破防 → 按威力判断
    ↓
攻击招评估（rejected 重置为 true）：
  ├─ 先手斩杀（我比对手快 + 伤害 > HP）→ rejected = false
  ├─ 优先度技斩杀 → rejected = false
  ├─ 后手斩杀（对手 HP < 50% + 伤害 > 130%）→ rejected = false
  ├─ 伏特替换/急速折返（需要换人时）→ rejected = false
  ├─ 普通出招（伤害足够 + 条件满足）→ rejected = false
  └─ 变化招（有效度 ret >= 3）→ rejected = false
    ↓
若 !rejected && choosetime 足够 → break（确定出招）
否则继续下一轮
```

### 3.4 确定出招的条件（break 点）

| 段 | break 条件 | 含义 |
|---|---|---|
| 解冻招 | 直接 break | 我方冻结时立即用 |
| 自杀技 | `!rejected && choosetime >= length * 2` | 确认斩杀 + 不急于第一轮 |
| 攻击招通用 | `!rejected && choosetime >= length * 3` | 最强招伤害足够 + 已轮遍一圈 |
| 变化招 ret=4 | `!rejected && sys.rand(0,2)` 后立即 break | 极效变化招快速接受 |
| 换人 switchFlag | `!rejected && ...` 后设 switchFlag → break | 已决定换人 |

### 3.5 "可预测"问题的根源

`maxmove` 是对伤害数组做 argmax 后返回的，**同等分值时永远取第一个**（L2619 `>` 而非 `>=`）。

主循环的**顺序遍历阶段**（choosetime < length*3）优先按伤害排序遍历，所以：
- 前几轮的 `usemove` 是固定的（顺序相同）
- 若第一个满足条件的招式直接 break → 每次同局面同选择

`foeMaxHp` 用随机值（`sys.rand(minStat, maxStat+1)`）而非确定值，这实际上引入了一些不确定性——但只影响"伤害是否达到某百分比"的阈值判断，不影响 `maxmove` 的选取。

> **改动 D 的插入位置**：在 while 循环退出后、`sendCommand` 之前（约 L3492-3494），
> 收集所有通过阈值的候选，做 softmax 采样，替代"第一个通过的就 break"的逻辑。

### 3.6 关键标量汇总

| 变量 | 计算方式 | 用途 |
|---|---|---|
| `maxmovepow` | `getMoveDamage(0)` 返回 | 当前出战宝可梦最强招的原始分 |
| `maxDamagePercent` | `maxmovepow / foeMaxHp` | 判断"打得死 / 打不死"的门槛比较 |
| `power` | `movepow[indexOf(usemove)]` | 本迭代选中招式的伤害分 |
| `damagePercent` | `power / foeMaxHp` | 配合 `accurcy` 做概率伤害期望 |
| `foeMaxHp` | `sys.rand(minStat(0), maxStat(0)+1)` | 对手 HP 的随机估计（不是实际 HP）|

---

## 4. `getGoodForSwitch` 评分逻辑（L1479-1564）

### 4.1 standard 分数组成

**基础分**：25（L1490）

| 因子 | 分数范围 | 触发条件 | 说明 |
|---|---|---|---|
| 类型克制（我方被克） | -50 / -20 / -5 | 对手属性克制候选者（区分是否也克制现役） | 权重最高 |
| 类型抗性（我方抗） | +5 / +30 | 候选者抵抗对手主/副属性 | |
| 类型免疫 | +30 | 候选者免疫对手属性 | |
| 入场伤害估算 | -30 / +30 | 基于对手 Atk/SpA vs 候选者 Def/SpD | 对手能打超 50% 扣，打不到 30% 加 |
| 对手强化 | -20 / -15 | 对手 Atk/SpA 强化等级 > 0 / > 1 | 强化后换人更危险 |
| 隐身岩/钉子 | -30 | 我方场地有隐身岩且候选者弱岩石 2× | |
| 候选者 HP | +20 / -30 | HP > 70% 加，< 40% 扣 | |
| 候选者状态异常 | -20 | 中毒/烧伤等 | |
| 对手已异常 | +50 | 对手中毒/烧伤 | |
| 对手为特殊宝可梦 | +50 | ID ∈ [235, 113, 242, 480]（治愈/白金兽？）| |

### 4.2 三档阈值

```js
if (standard > 100) ret1.push(slot);   // bestSwitchList 的候选
if (standard > 50)  ret2.push(slot);   // goodSwitchList 的候选
// goodForSwitch = 函数返回值（ret1 优先，否则 ret2）
```

基础分 25 + 较好属性相性（约 +30~+50）可达 55+，所以"正常的属性克制换入"通常在 goodSwitchList。
要进 bestSwitchList 需要多个加分因素叠加（属性克制 + 对手已中毒 + HP 健康等）。

### 4.3 已知的代码问题

| 行号 | 问题 | 说明 |
|---|---|---|
| L1495 | `indexOf()` 缺少参数 | 永远返回 -1，某类型克制分支不生效 |
| L1519 | 条件与 L1518 完全相同 | 应为 `> 2` 而非 `> 1`，推测应做倍率克制额外惩罚 |

### 4.4 sacrifice play 扩展点

现有评分只有"威胁对手的能力"（`standard`），没有"我方这只的牺牲价值"（如剩余 HP、招式 PP、对其他对手的价值）。

要实现"送炮灰→换王牌"需要：
1. 对队伍成员额外打"剩余战略价值"分（HP 低、PP 低、类型覆盖冗余的评低分）
2. 跨回合记忆（本回合选定炮灰，下回合知道要换王牌）—— 当前是单回合独立决策，没有这种机制

---

## 5. 三类剥削模式的原逻辑盲点

### 5.1 被 counter 换入

对手看到 AI 的出招后，换入抵抗型宝可梦。原逻辑在 `attemptCommand` 里没有"预测对手会换人"的判断——出招是基于"对手保持场上当前宝可梦"的假设。

直接改善手段：无（需要博弈论或对手换人预测）。
间接手段：softmax 随机化出招 → 对手难以稳定预判 AI 出哪招 → counter 换入的胜算降低。

### 5.2 可预测性根源

1. `getMoveDamage` 的 argmax 是确定的（同输入同输出）
2. 主循环顺序遍历阶段的招式顺序固定（按伤害降序）
3. 因此：同局面 → `maxmove` 相同 → 循环第一轮就 break → 每次选同一招

`foeMaxHp` 的随机化实际上在"能不能 KO"的判断上引入了波动，但不影响招式选择的顺序。

### 5.3 自损招式被埋没的路径

以流星群为例，在主循环里它的处理路径是：

1. 第一轮顺序遍历到它时，`power = movepow[流星群槽]`
2. 若流星群是 `maxmove`（伤害最高），进入"普通出招"分支
3. 普通出招分支中（L3002-3010）有多个 `if (usemove === maxmove && ...) rejected = false`
4. 若满足条件（伤害 > 50% + sys.rand(0,2)=1） → rejected=false → break → 选中流星群

**问题不是"被直接压制"**，而是：
- 如果 `choosetime` 较小时这些条件刚好不满足，流星群被跳过
- 下一轮碰到伤害第二高的招式，该招满足了条件 → break → 选了次优招
- 流星群这一轮再也没机会被重新考虑（循环已 break）

加上没有副作用惩罚，结果是：在伤害领先不明显时，第一个满足条件的招（不一定是流星群）被选中。

---

## 6. 候选修改方案

### 6.1 改动 A（收缩版）：Path 1 加一行 `foeAtkBoost` 鼓励换人

**位置**：Path 1 的替身保护行之后（L3059 后）

```js
// 对手攻击类强化 >= 2 且我方打不死时，鼓励换（场下有强势候选的前提下）
var foeAtkBoost = fpoke(battle.opp).statBoost(1) + fpoke(battle.opp).statBoost(3) + fpoke(battle.opp).statBoost(5);
if (foeAtkBoost >= 2 && maxDamagePercent < 0.9) rejected = false;
```

**理由**：
- Path 1 意味着场下有 `standard > 100` 的强势候选，换过去安全
- `foeAtkBoost >= 2` 对应"至少 +1 攻 +1 速"或"+2 攻"的威胁
- `maxDamagePercent < 0.9` 确保打不死才换，能 OHKO 就继续打

**不扩展到 Path 2/3 的原因**：
- Path 2 的中等候选可能被对手 setup 后秒 → 硬规则判不准，交给 softmax
- Path 3 没有威胁候选 → L3141 的硬拒是正确兜底

### 6.2 改动 B：自损招式惩罚

**位置**：`getMoveDamage` 内，`if (movepow[i] > maxmovepow)` 之前（L2619 前）

```js
if (pokeSlot === 0 && movepow[i] > 0) {
    // dropFoeHp 使用 minStat(0) 乐观估计，对手最薄皮时判能 OHKO
    var dropFoeHp = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife
                    * fpoke(battle.opp).minStat(0);
    var dropCanKO = movepow[i] >= dropFoeHp;
    if (!dropCanKO) {
        if (SELF_SPATK_DROP_2.indexOf(movenum) !== -1) movepow[i] *= 0.70;   // 特攻 -2
        else if (SELF_ATK_DROP_MOVES.indexOf(movenum) !== -1) movepow[i] *= 0.80;  // 攻击 -1 防御 -1
        else if (SELF_DEF_DROP_MOVES.indexOf(movenum) !== -1) movepow[i] *= 0.85;  // 防御 -1 特防 -1
    }
}
```

**关键决策**：
- `minStat(0)` 乐观估计（对手最薄皮），避免过度悲观抑制流星群使用
- 系数 0.70/0.80/0.85 暂定，实战后根据招式使用频率调整
- `pokeSlot === 0` 守卫：换入候选的评分不扣（我们想知道它进来后最大输出潜力，副作用是进场之后的事）

### 6.3 改动 D：招式选择 softmax 采样

**位置**：while 循环退出后、`sendCommand` 之前（约 L3492）

设计原则：
1. 收集所有"通过阈值的候选"及其 `movepow` 分
2. 找出最优集（`movepow > max * 0.85`）
3. 对最优集做 softmax 采样，温度参数 T（初定 T = foeMaxHp / 10，与 movepow 量纲匹配）
4. 若最优集只有 1 个候选 → 与原逻辑等价（不改变结果）
5. 只用 `sys.rand` 手写 softmax，不引入新依赖

> **待讨论**：T 的取值、最优集的门槛（0.85 是否合适）、softmax 是否覆盖变化招决策

### 6.4 sacrifice play（长期探索，本轮不做）

实现路径：
1. 在 `getGoodForSwitch` 里新增"牺牲价值"评分（HP < 30% 且无 PP 的加高分）
2. 主循环新增"当前宝可梦是否比场下候选更适合作为炮灰"的判断
3. 增加跨回合状态（`pendingRoyalEntry` 标记下回合要换王牌）

这需要修改多个函数 + 引入跨回合记忆，工程量大，且无法在本地验证（需 PO 运行时）。

---

## 7. 实施顺序与注意事项

**顺序**：A → B → D（B 独立，A 依赖了解换人逻辑，D 影响面最大）

**QScript 约束**：
- 只用 `var` / `function` / `indexOf` / `for`
- 不用箭头函数、模板字符串、`let`/`const`、`forEach`
- 调试用 `print_s()`，不用 `console.log`

**回归保证**：
- 对无副作用招式（地震 89、十万伏特 85 等），改动 B 路径不触发，`movepow[i]` 结果完全不变
- 改动 A 只在 `bestSwitchList.length > 0` 时触发，其他路径不变
