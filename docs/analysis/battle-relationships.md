# 宝可梦对战关系术语与 BOT 设计映射

> 本文档梳理宝可梦对战语境中常见的"应对关系"术语，并给出 BOT 决策设计的对应建议。
> 这些概念是未来实现更精细换人评分、威胁评估和对手行为预测的理论基础。

---

## 1. 核心区分：Counter vs Check

最基础的两组对立，核心判断标准只有一个：**能不能安全换入？**

### Counter（稳定反制者）

> A 能多次安全换入 B 的主要招式，并稳定逼退、消耗、废掉或击败 B。

- 能吃下 B 的主要输出
- 不太怕 B 的常见覆盖招
- 能处理或不怕 B 的强化
- 可以回血、施异常、吼走、反杀或逼退

Counter 不一定要秒杀对方，稳定消耗也算。

### Check（条件性制衡者）

> A 可以在某些条件下压制、逼退或击杀 B，但未必能安全换入。

- A 比 B 快，可以直接秒
- A 有先制招，可以收残血
- A 满血可以吃一发然后反杀
- A 靠围巾或特殊道具超过 B

这些都是 check，但如果 B 先手，A 可能根本无法换入。

### 简明区别

| 关系 | 能否换入 B | 能否击败/限制 B | 稳定性 |
|------|-----------|---------------|--------|
| hard counter | 很安全 | 很稳定 | 极高 |
| soft counter | 大体能换，但怕部分配置 | 通常能限制 | 中等 |
| offensive check | 不一定 | 安全上场后能处理 | 中 |
| revenge killer | 通常不行 | 队友倒下后上场可杀 | 条件性 |

---

## 2. Counter 的细分

### Hard Counter

几乎不怕 B 的常见配置，可以反复换入，B 很难靠正常手段突破。

典型条件：免疫主攻属性 + 抗覆盖 + 有回复 + 能反制。

### Soft Counter

能换入，但不完全稳——怕 B 的某个覆盖招、强化、道具、状态或钉子消耗。

### Defensive Counter / Wall

偏受向的 counter，靠耐久、回复、异常处理 B，不依赖火力反杀。

- physical wall：物盾
- special wall：特盾
- utility counter：靠异常/挑衅/回复等工具应对

### Setup Counter / Hazer / Phazer

专门阻止强化推队。

| 手段 | 术语 |
|------|------|
| 黑雾、清除之烟 | hazer |
| 吼叫、吹飞、龙尾、巴投 | phazer |
| 天然特性挡强化 | setup stopper |
| 挑衅阻止变化招 | taunt check |

---

## 3. Check 的细分

### Offensive Check

不能稳定换入，但上场后能先手重创或击杀 B。

### Hard Check vs Soft Check

| 类型 | 说明 |
|------|------|
| hard check | 安全上场后稳定解决，条件容易满足 |
| soft check | 条件更苛刻——只有满血 / 只有 B 未强化 / 只有 B 残血时才能处理 |

### Revenge Killer

B 击杀队友后，A 上场击杀 B。常见条件：高速、围巾、先制、天气加速。

### Priority Check

靠先制招收掉 B，无需速度比较。

---

## 4. 其他重要术语

### Answer（泛称）

不严格区分 check/counter 时使用，意为"能应对 B"。BOT 设计里适合用作通用术语：

```js
hasAnswerTo(slot)
bestAnswerSlot
answerScore
```

### Pivot

不直接处理 B，而是安全上场后把节奏转给队友。手段：急速折返、伏特替换、威吓换人、再生力。

BOT 意义：**我能挡住 B，但打不动 B** → pivot 转场，让有输出能力的队友接上。

### Lure（诱杀配置）

A 表面上被 B 克制，实际带了专门针对 B 的覆盖招/道具。

对服务型 BOT 尤其重要：玩家会利用 BOT 的固定认知换入 counter，BOT 如果偶尔表现出 lure 行为，会大幅提升不可预测性。

### Wallbreaker

专门打穿受向宝可梦的高火力手。特点：强覆盖、挑衅、戏法、无视防守手段。

### Sweeper / Cleaner

- Sweeper：强化后尝试连续推队的宝可梦
- Cleaner：残局清理者，靠速度/先制收割残血队伍

BOT 判断"对手是否进入 sweeper 状态"非常重要，这时应该优先找 stopper/check，而不是正常轮换。

### Stopper

不一定能长期 counter 对方，但能阻止对方继续推队。比如靠先制收掉强化手、气腰反杀、百变怪复制、黑雾清强化。

### Crippler / Status Answer

靠电磁波、鬼火、剧毒、催眠、拍落、挑衅等让 B 失去原本功能。

### Trapper

靠追打/磁力困/踩影等限制 B 不能换走，然后处理 B。

---

## 5. Anti-xxx 是什么

Anti 强调"针对某类套路/角色/环境设计"，而非单独的对应关系。

| 术语 | 含义 |
|------|------|
| anti-lead | 专门打对方首发 |
| anti-meta | 针对当前环境热门宝可梦/构筑 |
| anti-stall | 专门打受队（挑衅、剧毒免疫、强化破盾） |
| anti-setup | 专门阻止强化（黑雾、天然、先制强收） |
| anti-hazard | 专门处理钉子（旋风、魔法外套） |
| anti-sweeper | 专门阻止清场（先制、天然、气腰） |

---

## 6. 对 BOT 设计的启示

### 6.1 换人评分应是多维度的

现有 `getGoodForSwitch` 的 `standard` 分只衡量"候选宝可梦对当前对手的威胁度"，缺少以下维度：

| 缺失维度 | 对应概念 |
|---------|---------|
| 能否安全换入 | counter vs check 的核心区分 |
| 换入后能否继续推队 | pivot value |
| 对手是否处于 sweeper 状态 | stopper 优先级 |
| 我方这只的"当前价值"与"炮灰价值" | sacrifice play |
| 换入后对方的最优反制 | 对手 counter 预测 |

### 6.2 应对关系不是单一标签

一只宝可梦对另一只往往同时持有多种关系。推荐 BOT 内部用多个分数而不是单一标签：

```js
switchInSafety       // 换入安全度（counter/check 的核心）
threatenScore        // 换入后对当前对手的威胁
stopSetupScore       // 阻止对手强化推队的能力
revengeKillScore     // 在队友倒下后击杀对手的能力
pivotValue           // 换入挡一下、转场给更优秀队友的价值
sacrificeValue       // 作为炮灰消耗对手资源的价值（配合 sacrifice play）
```

### 6.3 Lure 行为与服务型 BOT

玩家会学习 BOT 的换人模式，当 BOT 有"明显 counter"时玩家会换入反制。

引入少量 lure 行为（偶尔在"被认为会换"的局面继续留场+出覆盖招）可以打破玩家的固定预期，这本质上也是提高随机化的一个方向——只是在换人决策层而非出招层实现。

### 6.4 Sweeper 检测

当前 BOT 对"对手是否处于 sweeper 状态"的判断只依赖 `statBoost`（强化等级），但 sweeper 的威胁还来自：

- 对手速度是否已超过我方全队（需要先制才能处理）
- 对手是否已完成强化并进入清场节奏
- 我方场下是否有 stopper/priority check

这些是未来增强 `getGoodForSwitch` 威胁判断的方向。

---

## 7. 口诀

```
Counter：我能换上来挡你，然后处理你。
Check：我不一定能换上来，但能让你不敢留场或能杀你。
Revenge killer：你杀了我一个后，我上来杀你。
Lure：我装作被你挡，实际专门带东西杀你。
Anti：我这套配置就是针对你的体系/当前环境。
Answer：泛称，我有办法应对你。
Stopper：你正在推队，我能让你停下来。
Pivot：我能挡一下，然后把优势队友安全带上来。
Wallbreaker：你是盾，我专门来打穿你。
Sweeper：我已经强化好了，开始清场。
Cleaner：对方残血，我来收尾。
```
