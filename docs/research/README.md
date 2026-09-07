# 文献知识库

存放与宝可梦 AI / LLM 对战相关的论文、文献及其笔记。

## 论文列表

- **PokeLLMon: A Human-Parity Agent for Pokémon Battles with Large Language Models**
  - 文件：`2402.01118v3.pdf`
  - 主题：LLM 实体 agent 打宝可梦对战（Pokémon Showdown），三大策略：In-context RL / 知识增强生成 KAG / 一致性动作生成
  - 来源：arXiv 2402.01118（Georgia Tech，2024）
  - 解读：[PokeLLMon_2402.01118_论文解读.md](./PokeLLMon_2402.01118_论文解读.md)
  - 与项目关联：与 DeepSeek 接入（`deepseek-bridge/`）同构，KAG 抗幻觉 / Self-Consistency 稳决策 / 文本反馈在线学习均可借鉴

## 添加方式

1. 把 PDF 放进本目录（文件名建议带年份，如 `2024_pokemon_llm_battle.pdf`）。
2. 在下方「论文列表」登记一条：

```markdown
- **标题**：xxx
  - 文件：`xxx.pdf`
  - 主题：xxx（如 LLM 对战决策、agent 架构、function calling 等）
  - 来源：arXiv / 会议 / 其他
  - 与项目关联：xxx（如：DeepSeek 接入的 prompt 设计 / tool 调用方案参考）
```
