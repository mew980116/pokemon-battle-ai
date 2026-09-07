# PokeLLMon 论文解读（arXiv 2402.01118）

> 与本文档配套的论文原文：[2402.01118v3.pdf](./2402.01118v3.pdf)（本地，已 gitignore）
> 在线：<https://arxiv.org/abs/2402.01118> · 代码/可玩日志：<https://github.com/git-disl/PokeLLMon>

## 基本信息

| 项 | 内容 |
|---|---|
| 标题 | PokeLLMon: A Human-Parity Agent for Pokémon Battles with Large Language Models |
| 作者 | Sihao Hu, Tiansheng Huang, Ling Liu（Georgia Tech） |
| 年份 | 2024（v3: 2024-04） |
| 平台 | Pokémon Showdown |
| 定位 | 首个在战术对战游戏中达到"人类水平"的 LLM 实体 agent |

## 核心贡献：三大策略

### 1. In-context Reinforcement Learning（上下文强化学习）
把每一回合战斗产生的**文本反馈**当作即时"奖励"，喂回给 LLM，让策略在战斗过程中**在线迭代**，无需离线训练。作者称之为"just-in-time decision making"。

### 2. Knowledge-Augmented Generation（知识增强生成，KAG）
用外部知识（宝可梦图鉴 / Bulbapedia 式的招式·特性·属性说明）做检索增强，**对抗幻觉**（hallucination）。典型实现之一是 **KAG[Type]**：检索属性克制关系，避免模型记错属性。

### 3. Consistent Action Generation（一致性动作生成）
通过 **Self-Consistency（多次采样投票，如 k=3）** 生成稳定动作，**抑制"恐慌换人"（panic switching）**——即面对强敌时反复无脑换人想逃跑的现象。

## 关键实验发现

- **裸 LLM 很弱**：GPT-4 直接打一个启发式 bot 只有 **26% 胜率**，而人类玩家是 **60%**。差距主要来自两类失败模式：
  - **幻觉**：在属性劣势下派出宝可梦、持续使用无效招式（记错属性克制 / 招式效果）。
  - **恐慌换人**：面对强敌时陷入反复换人的不稳定循环。
- **三大策略叠加后**：天梯（Ladder）**49% 胜率**，邀请赛 **56% 胜率**，达到接近人类水平。
- **Chain-of-Thought（CoT）反而有害**：显式推理链会增加不稳定行为、提高连续换人率、加剧 panic switching。
- **Self-Consistency 有效**：投票采样抑制 erratic 换人、稳定选择。

## 与本项目的关联（DeepSeek 接入 pokemon-battle-ai）

本仓库正在做的事与 PokeLLMon 高度同构：把战场状态转成文本 → 喂 LLM → 返回 attack/switch 动作 → 由引擎执行。这篇论文的结论几乎可以直接映射过来：

| PokeLLMon 结论 | 对本项目的启示 |
|---|---|
| 幻觉是最大短板（属性克制/招式记错） | 当前我们的 `/choice` 只喂了状态，**没有喂属性克制表 / 招式效果**，DeepSeek 同样会凭记忆出错 → 应做 **KAG 式检索增强**（把 typechart 克制倍率、招式威力/属性注入 prompt） |
| KAG[Type] 检索属性克制显著提胜率 | 我们的 `20201227.js` 里已有现成的 `typechart()` 克制矩阵，可预计算每个招式对对手的克制倍率塞进 prompt（即 hybrid 预计算路线，见 TODO.md） |
| CoT 加剧 panic switching | 我们用的 `deepseek-v4-flash` 是推理模型（返回 `reasoning_content`），要注意**不要让显式思考链破坏动作稳定性**；当前 prompt 已经要求"只输出 JSON，不要解释" |
| Self-Consistency 稳定决策 | 可作为后续方向：同一局面采样多次投票，降低单次采样抖动（对应 `max_tokens` 足够 + 稳定输出约束） |
| 文本反馈做在线 RL | 我们已有 `onDamageDone`/`onUseAttack` 等回调能产生回合反馈，未来可把"上一招是否有效/被免疫/被克制"作为反馈注入下一回合 prompt，实现轻量在线学习 |

## 值得进一步读的细节（待补充）

- KAG 的完整检索链路（具体检索了哪些知识源、如何拼接）。
- In-context RL 的"四类文本反馈"具体定义（paperium 摘要提到 four text-based feedback types）。
- Self-Consistency 的采样次数与投票方式对胜率的消融结果。

（待用户后续补充战报解析后，可与本仓库 DeepSeek 实测对比验证。）
