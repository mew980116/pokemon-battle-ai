# po-data（PO 数据文件）

存放 Pokémon Online 的数据文件，供 po-pokellmon 路线的两个待办读取：

1. **战报保存完整性**：需要回调参数的含义映射（如 `onMoveMessage` 的 `move`/`part` 编号 → 招式效果文本，`onMajorStatusChange` 的 `status` 编号 → 异常状态名）。
2. **评估依据 tool**：需要静态数据 —— 种族值（`sys.pokeBaseStats` 的数据源）、特性/道具效果、招式效果等。

## 已放入的关键数据文件

| 数据 | 文件 | 用途 |
|---|---|---|
| 种族值 | `pokes/stats.txt` | `calc_damage` 的 `sys.pokeBaseStats` 数据源 |
| 宝可梦属性 | `pokes/type1.txt` / `type2.txt` | 属性类型 |
| 宝可梦特性 | `pokes/ability1.txt` / `ability2.txt` / `ability3.txt` | 特性槽位 |
| 宝可梦体重 | `pokes/weight.txt` | 重量类招式 |
| 招式列表 | `moves/moves.txt` | 招式名/编号 |
| 招式消息 | `moves/move_message.txt` | `onMoveMessage` 的编号 → 效果文本 |
| 招式效果/描述 | `moves/move_effect.txt` / `move_description.txt` | 招式效果知识 |
| 特性 | `abilities/abilities.txt` / `ability_desc.txt` / `ability_battledesc.txt` / `ability_effects_*G.txt` / `ability_messages.txt` | 特性列表/描述/效果/消息 |
| 道具 | `items/items.txt` / `item_effects.txt` / `item_messages.txt` | 道具列表/效果/消息 |
| 状态 | `status/status.txt` / `stats.txt` | 异常状态/能力 |

## 数据 → tool 映射

po-data 是未来「评估依据 tool」（`po-pokellmon-tool/` 路线）的静态知识库来源。映射如下：

| tool（候选） | 依赖的 po-data 数据 |
|---|---|
| `calc_damage`（伤害计算） | `pokes/stats.txt`（种族值）+ `pokes/type1/2.txt`（属性）+ `pokes/weight.txt`（重量招）+ `moves/8G/*.txt`（威力/命中/分类/属性/先制）+ `zh-cn/db/natures/nature.txt`（性格）+ `items/`（道具加成）+ `abilities/`（特性加成） |
| `evaluate_move`（出招评估：克制/免疫/能力修正） | 属性克制（typechart）+ `moves/`（招式数值）+ `abilities/`（特性免疫） |
| `evaluate_status_move`（变化招适应度） | `moves/move_effect.txt` + `move_description.txt`（招式效果）+ `status/`（状态互斥） |
| `evaluate_switch`（换人评估） | `pokes/stats.txt` + `pokes/type*.txt` + `pokes/ability*.txt`（种族/属性/特性）+ `moves/`（输出评估） |

> 消息表 `*_message.txt` 不映射到 tool，已由 `po-pokellmon/po-script.js` 做战报解码（战报保存完整性）。
>
> **下一步**：先评估「对战到底需要哪些 tool」，列出清单后再开工写 build 脚本，避免盲目堆 tool。

## 说明

- 目录里还有大量 `.png` 图片（道具/树果图标），这些是 PO 客户端资源，**不进 git、也不用于开发**，后续可加 .gitignore 排除。
- 数据量大（图片 + 文本），git 策略留到数据处理时再定。
