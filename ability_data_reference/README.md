# 特性数据资料（ability_data_reference）

> 存放宝可梦**特性（ability）**的原始资料，供整理特性编号对照表、核对 AI 决策逻辑用。
> 与招式资料目录 [move_data_reference/](../move_data_reference/) 平级、同性质。

## 用途

`20201227_v1.2.js` 用整数特性编号判断免疫/加成（如 `getPossibleAbility` 返回的编号、`calcMoveDamageBuff` 里 `defPossibleAbility.indexOf(25)` 判食草）。但代码里这些编号是**裸数字魔法值**，缺人类可读的对照。本目录补上这层资料。

直接相关的待办：

- TODO「本地可做 1. 字段语义映射」的特性编号对照表
- TODO 5.8 免疫特性规避（食草 25 / 飘浮 26 等编号需在此确认）

## 建议包含的资料

- **编号 → 名称对照**：特性整数编号 ↔ 中文/英文名（核心，解 5.8 的前置依赖）
- **特性效果说明**：免疫类（食草/飘浮/储水…）、加成类、触发条件
- 哪些宝可梦拥有该特性（用于判断"可能特性列表"是否合理）

## 格式约定

- 原始资料文件命名用小写 + 下划线，ASCII（如 `ability_names.txt`、`ability_effects.txt`），与 move_data_reference 风格一致。
- 若整理成代码可查的 JSON，放仓库顶层（与 `movedata.json` 平级），不放本目录——本目录只放**原始/参考资料**。
