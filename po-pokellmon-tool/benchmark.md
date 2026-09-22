# LLM 决策 Benchmark

> **用途不是「让模型对齐标准答案」，而是：这些局面下模型的决策最容易暴露它自己的硬伤（或 harness 本身的问题）。**
> 所以每条都该带两样东西：**可复现**（fixture 或 replay 命令）+ **该看的信号**（最终动作，以及 action 文本里那几个关键判据）。
> 「打得对」的回合留在这里只作**对照** —— 用来确认改动没把对的行为改坏，**不是**要模型去模仿某一步棋。
> 已确诊的错例、根因与修法见 [benchmark-errors.md](benchmark-errors.md)。

## 清单（截至 2026-09-22：正例 6 条 + 错例 5 条 + 反面参照 3 条）

| # | 场景（暴露什么） | 类型 | 来源 | 状态 |
|---|---|---|---|---|
| P001 | 从「它只加了 Def」推出该打特攻端 | 正例 | battle99 T12 | 保留（对照） |
| P002 | 晴天把 Overheat 推进 KO 区间 | 正例 | battle99 T14 | 保留 |
| P003 | 无法输出时，用换人决定「谁挨这一刀」 | 正例 | battle99 T7 | 保留 |
| P004 | 补位阶段不吃招 → 满血反手 OHKO | 正例 | battle99 T9 | 保留 |
| P005 | 用两个 EV 锚点得出「它打不动我」 | 正例 | battle99 T4 | 保留 |
| P006 | **留场炮灰换免费替补**（"该留场"的正向靶，与 E004 同一对判断） | 正例靶 | battle106 T13 / T15 | 实战那次错、0.7.8 起改对；0.8.5 回归 2/2 ✓；fixture ✓ |
| — | T1 / T19 / T20 | 反面参照 | battle99 | 见 E003 |
| E001 | 雨天把**火系**换入者判成「水系中性」→ 满血围巾被雨炮一击必杀 | 错例 | battle96 T1 | 已被 `simulate_turn` 的信息效应覆盖（C1→C3） |
| E002 | 被锁招后连点 8 次赌会心 | 错例？ | battle99 | **结案：不是错题，放过** |
| E003 | 把自己标「待验证」的假设（围巾→先手）当既成事实 → 白送 Ninetales | 错例 | battle99 T20 | 根因待探针定性 |
| E004 | 把「换人」先验当被动，用 90% 的沙暴核心去换 20% 净伤害 | 错例 | battle111 T2 | **已修（0.8.5）+ 原样复测 3/3** ✓ fixture ✓ |
| E005 | **强制替补「选谁」+ 主动换人的代价**（三处同源：白送 free sub / 选人保守 / 上了又换下） | 错例 | battle108 T2 / T7 / T12 | 部分已修（0.8.2）；T7 的"选谁"待 0.8.5 复测；fixture ✓ |

**已知缺口**（现在没有、但按用途该有）：

1. **条目缺统一的「这个场景暴露的是哪一类硬伤」标签** —— 按 benchmark 的定位这应该是第一属性（目前只有部分条目带 `标签` 字段）。可能的分类：*速度/顺序*、*伤害档位（乐观/保守）*、*回合发展趋势（主动换人 vs 留场）*、*状态与信息的陈旧/复活*、*harness 自身的表述*（如 E004 那句被删掉的倾向建议）。
2. **T7 的"替补选谁"没在 0.8.5 之后复测**（证据停在 0.8.2 时代的 2/3）。
3. **「同 turn 第二条记录」没有覆盖**：`replay.js` 只跑同 turn 的第一条，像 E005 里"上了又换下"、battle111 T12#1 这类要单独处理。
4. **还没有一个 benchmark runner**：fixture 一共 11 个（`eval/fixtures/`）—— 本 benchmark 相关的 7 个：battle96-t1（E001）、battle111-t2（E004）、battle106-t13 / t15（P006）、battle108-t2 / t7 / t12（E005）；另有 4 个更早的评测 fixture：battle98-t0 / t1、CTRL93-T4、CTRL94-T2。但只有 `eval/run.js` 能做"单 fixture 采样 N 次"，**没有"一次跑完 + 按断言判定"的入口**。

## 来源

battle99（2026-09-21，用户 vs LLM；script 0.6.11 / tool 0.6.3 / `deepseek-v4-flash`）。
30 个决策，中位 20s、平均 22s、最长 70s（T0 开思考），**0 次 fallback / 0 次撞 120s 上限**。
日志：[logs/deepseek_tool_20260921_battle99.log](logs/deepseek_tool_20260921_battle99.log)（文件名不在 git 里，本地 logs/ 目录）。

结局：最后一回合我方只剩 11% Escavalier，对手剩 Barraskewda 100% + Rillaboom 64%（局面已丢）。
用户评价：「**压力也不小（我抓了很多机会强化），总的来说他处理得还行**」—— 本文件里的正例即从中挑出。

---

## P001 — 从「它只加了 Def」推出该打特攻端（T12）

**局面**：Sandaconda（满血）vs Necrozma（满血，`Def+4`，麻痹）。Necrozma 已连点两次 Iron Defense。

**决策**：换 Accelgor（Choice Specs，特攻手）。

**LLM 原文**：

> Sandaconda Stone Edge only **8-9% into Def+4** (Prism Armor) — chipping is useless and lets it set up more. Switch to Accelgor: cost = forfeit turn, Accelgor eats the hit (~62-81% if it attacks, survives; 0% if it keeps boosting), no hazards on my side. **GAIN** = Accelgor (389 Spe, outspeeds even unparalyzed) Bug Buzz does **75-88% to Necrozma — a 2HKO through Prism Armor, and Necrozma's SpD is NOT boosted (only Def)**. This is my cleanest Necrozma answer; waiting lets Stored Power grow with Calm Mind and KO. … Steadier line = keep attacking, but that only chips, so switching is better here. … Falsifier: Necrozma uses Photon Geyser/Psychic — **Accelgor still survives at ~25-38% and outspeeds to 2HKO**.

**为什么算好**

1. 用实测数字（Stone Edge 只 8-9%）判定「继续点招 = 没意义」，而不是「反正有招就点」。
2. **识破 boost 只在 Def 端** → 换成特攻手打另一端，这是它整局最关键的一次换人。
3. 换人的成本/收益都写全：放弃回合 + 换入者吃一招（且给了伤害区间）+ 无陷阱；收益是「2HKO 并能超速」。
4. 给了 falsifier，而且 falsifier 场景下结论不翻转（仍存活且能超速）。

**回归点**：面对「只加了一侧防御/特防」的对手，是否会切到另一端；换人论证是否包含成本、收益、falsifier。

---

## P002 — 晴天把 Overheat 推进 KO 区间（T14 补位 → 下一回合秒杀）

**局面**：Accelgor 被 `+4Def/+1SpA` 的 Necrozma（41%）打死后补位。它自己的判断是「**I cannot win a damage race**」——Necrozma 的 Stored Power 秒杀我方每一只（Ninetales 133-157%、Sandaconda 135-159%、Slurpuff 119-140%）。

**决策**：换 **Ninetales**（Choice Scarf / Drought）。

**LLM 原文**：

> (R1) FORCED replacement — opponent gets NO action this turn … No pokemon survives it and none can KO Necrozma from 41%. I cannot win a damage race.
> (R2) … Ninetales(100%, Choice Scarf, unrevealed) **is fastest** (Scarf 299→~448 >> paralyzed Necrozma ~142) and is my **ONLY Memento user**.
> (R3) PICK: switch 4 = Ninetales. Next turn use **Memento** (100% acc, user faints, target Atk −2 & SpA −2): Necrozma SpA +1 → −1, crushing Stored Power … **This converts a game-losing sweeper into a harmless bulky wall.**

**实际发生**：换入即触发 Drought 开晴天 → 晴天把 Overheat 从 27-32% 抬到 **41-48%**，正好进 KO 区间 → 直接秒掉 Necrozma（下一回合对手已换成 Persian-Alola）。

**为什么算好**

1. 补位阶段正确判定「对手不额外行动」。
2. 选人有两条独立理由（最快 + 唯一 Memento），并准备了「打不动就 Memento 削 SpA」的备用线。
3. 最终是**晴天增幅**把伤害推过 KO 线 —— 说明「天气已在 state 里」时天气机制是被正确利用的（对照：TODO 里 T19 的盲区只在「换入那一刻看不到即将生效的天气」）。

**回归点**：补位时是否考虑换入者能带来的被动收益（天气 / 威吓 / Memento 这类牺牲技）。

---

## P003 — 无法输出时，用换人决定「谁挨这一刀」（T7 第三次重决策，64s）

**局面**：Escavalier 专爱锁 Megahorn，PO 连续拒绝 Megahorn / Knock Off / Iron Head，剩下的 Close Combat 对 Ghost **无效**；对手 Polteageist 42%、`+2SpA/+2Spe`（524 速）。

**决策**：换 Runerigus（当炮灰）。

**LLM 原文**：

> (4) MY OPTIONS: **Escavalier is Choiced and its attacks were REJECTED**; only Close Combat offered but it has **NO EFFECT on Ghost, so staying = zero damage**. No mon outspeeds 524-speed Polteageist and I have no priority, so **I cannot damage or revenge it this turn**. Cost of switching = forfeit turn + switch-in eats the hit; since I can't damage it regardless, **the only gain is choosing WHICH mon absorbs the hit**. I sacrifice the least valuable mon (Runerigus: slow Choiced Ghost/Ground) to keep the healthy team for Rillaboom(64%par) and Necrozma. I am behind — a boosted 524-speed sweeper I can't touch this turn. **Steadier line: none that damages it.** (5) MOST LIKELY: Shadow Ball; my reply sac Runerigus. **Falsifier: if it uses a status move, Runerigus survives.** (6) … **DANGER: each following turn it KOs one mon; I need Megahorn once disable expires to break it.**

**为什么算好**

1. 明确算出「留场 = 零伤害」，而不是「还有一招可点就点」。
2. 把自己正确降级为「只能选谁吃这一刀」，并给出牺牲对象的理由（最不值钱的那只）。
3. 如实写了 falsifier 和后续危险（每回合被换掉一只），没有粉饰。
4. 这正是 SYSTEM_PROMPT 要求的行为：「如果每个选项都要丢这只，就选最有价值的那条线，而不是把队伍拖着去救它」。

**回归点**：被锁招且唯一可选项无效时，是否识别为「零输出」并考虑换人；炮灰选择是否给出「为什么是它」。

---

## P004 — 补位阶段不吃招 → 换来满血反手 OHKO（T9）

**局面**：Runerigus 被 `+2SpA` Polteageist 的 Shadow Ball 秒杀（Ghost vs Ground/Ghost = **2x**）。

**决策**：换 Escavalier（满血，Choice Band），下一回合 Knock Off 反杀。

**LLM 原文**：

> (R1) Runerigus fainted to Polteageist's +2 SpA Shadow Ball (**Ghost vs Ground/Ghost = 2x, confirmed**). This is a **FORCED replacement in the end-of-turn phase — Polteageist gets NO extra action, so the switch-in arrives UNHARMED** (no entry hazards on my side).
> (R2) Escavalier [slot 2]: comes in free at 100% (no hazards). Next turn it can Knock Off — **153-180% on Polteageist = guaranteed OHKO**.

下一回合：

> **Confirmed Dark 2x vs Ghost.** Staying with Escavalier, Knock Off is the only line with upside — it is a guaranteed OHKO on Polteageist (153-180%) while all my switch-ins die to the +2 Shadow Ball (120-135%+) for nothing.

**为什么算好**

1. 正确使用补位阶段语义：不吃招、无陷阱 → 可以放心把脆皮满血怪换上来。
2. **主动查表确认 Dark 2x vs Ghost**，而不是凭记忆（对应 SYSTEM_PROMPT 的 VERIFY 步）。
3. 选人标准是「换上来能不能立刻产生收益（反手 OHKO）」，不是「谁更肉」。

**回归点**：补位时是否按「换入者能否立即产生收益」选人；关键倍率是否查表而非凭记忆。

---

## P005 — 用两个 EV 锚点得出「它打不动我」（T4）

**局面**：Escavalier（Choice Band，麻痹）vs Roserade（100%）。

**决策**：留场 Megahorn。

**LLM 原文**：

> (1) ATTACK? Yes, Roserade will very likely attack or set hazards. Its **Poison STAB is USELESS vs Escavalier (Sludge Bomb = 0%, proved by calc)**. Grass STAB (Energy Ball/Giga Drain) does only **13-15% at 0 SpA, ~30% at 252 SpA**. … Confidence it cannot KO Escavalier: very high.

**为什么算好**：这正是 0.6.0「对手 EV 默认值必须给出两个锚点」想达到的行为 —— **两个值都读，按最坏的那个下结论**（252 SpA 也只有 ~30%，所以「它打不动我」这个结论不依赖对手配速）。同一局 T11/T12 也用了同样口径（"Stone Edge only 8-9% into Def+4"）。

**回归点**：凡是对手当攻击方，结论是否在**最坏锚点**下依然成立（而不是引用 0EV 那个乐观值）。

---

## 反面参照（同一局，另见）

- **T1**：strategy 写 `action=switch 5`（Escavalier）、散文也说 Escavalier，最终却输出 `{"choice":5}` = 列表第 5 项 = **Slurpuff**（编号 ≠ 槽位）。已由 tool 0.7.0 的 `resolve_choice` 覆盖。
- **T19 / T20**：T19 的「换 Ninetales 开晴天」被 `simulate_turn` 漏算入场特性（Drought）后的数字否掉（TODO 已记）；T20 把一条自己标为待验证的假设（围巾 → 先手）当成事实用，速度判断落空、白送 Ninetales（见 [benchmark-errors.md](benchmark-errors.md) E003，根因待探针定性）。

---

## 复核后移出

- **battle111 T2**（Excadrill 对 Rotom-Wash 点岩崩）：曾以「招式面只剩一招能打时选中它」记入本库（P006），**经复核判断错在"打法"而不是"招式"** —— 岩崩本身没错，但**留场就是送**：拿 90% 的 Sand Rush Excadrill 换对手净 20%（毛 26% − 剩饭 6%），而换 Clefable/Magearna（吃 34-43%、回手 31-41%、一只有回复一只可起势）能同时保住它。已移入 [benchmark-errors.md](benchmark-errors.md) **E004**（含 fixture `eval/fixtures/battle111-t2.json`）。
  **可保留的那半条**：面对「浮游免疫 + 抵抗」的对手，**挑出唯一中性招**这个行为仍然是对的（浮游让地震 0x、Iron Head 只 0.5x、剑舞无伤害 ⇒ 岩崩是四招里唯一中性），只是它**不该在这回合发生**（该换人）。

---

## P006 — 留场炮灰换免费替补（battle106 T13/T15；**实战那次错、新代码改对**）

**为什么它在 benchmark 里**：它是「**留场 vs 主动换人**」这对判断的**正向靶**，与 [benchmark-errors.md](benchmark-errors.md) 的 E004（battle111 T2）正好是同一对判断的反面。0.7.6 的 `trajectory` 事实句就是为它写的；0.8.5 删掉那句里的**倾向性**之后，这里**没有回退**（2/2 通过）。

**fixture**：[eval/fixtures/battle106-t13.json](eval/fixtures/battle106-t13.json)、[eval/fixtures/battle106-t15.json](eval/fixtures/battle106-t15.json)
⚠ battle106 跑的是 script 0.6.27（旧编号）⇒ **日志回合号 = PO 回合号 − 1**（log T13 = PO T14、log T15 = PO T16）。

**局面**
- T13：Tsareena 27% 对 Roserade 28%（对手全场先手、能一回合清场），我方剩下的多是渣血炮灰。
- T15：Basculin 已倒（`me.fainted=true`）⇒ **强制替补**，同 turn 还有第二条记录（替补之后的下一回合指令）。

**期望**
- T13：**留场出招** —— 把渣血炮灰喂掉，换回来的是**免费替补**（换入者当回合不吃招）；主动换人反而让换入者当回合就吃一发。
- T15：**必须选人**（`switch slot4`）；紧随的下一回合按仿真出招。

**实战（错的那半）**：T13 = `switch slot5`（主动换人 ✗）；T15 = `switch slot4` ✓。
**复测（0.7.8 起）**：T13 变成留场（`attack slot3` / `attack slot1`）✓；T15 + 下一手也对 ✓。

**回归命令**

```
node replay.js logs/deepseek_tool_20260921_battle106.log 13 15 --url=http://127.0.0.1:8092
```

**断言**：T13 **不得**是 `switch`；T15 的强制替补**必须是 `switch`**（历史复测里稳定选到 `slot4`）。


