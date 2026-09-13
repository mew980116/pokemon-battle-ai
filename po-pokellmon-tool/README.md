# po-pokellmon-tool（路线 3：思考 + tool）

移植 PokeLLMon 的第三条基础路线：**思考模式 + function calling / tool**。
把主脚本 [20201227_v1.3.1.js](../20201227_v1.3.1.js) 里的确定性计算封装成 tool，供 DeepSeek 在决策前动态调用（类似 coding agent 的 tool 模式）。

## 与 po-pokellmon（路线 1）的关系

| | po-pokellmon（无思考） | po-pokellmon-tool（本目录） |
|---|---|---|
| 思考模式 | `thinking:disabled` | `thinking:enabled`（reasoning_effort:low） |
| 超时 | 20s | 180s（放宽，tool 多轮往返慢） |
| max_tokens | null | null（不限制，思考链 + 最终答案） |
| tool | 无 | 有（function calling） |
| 端口 | 8091 | 8092 |
| 定位 | 服务（快、稳） | 实验（测 LLM 能力上限，需 no timeout） |

## 当前最小实现

**harness**（[server.js](server.js)）已跑通 function calling 多轮 loop：

1. 接收 PO 采集的 `state` → 拼 prompt + `tools` 定义
2. 调 DeepSeek（思考 low + tool）
3. 若返回 `tool_calls` → 执行 tool → 结果追加进 messages → 再调（最多 `MAX_TOOL_ROUNDS=5` 轮）
4. 直到返回最终 `{"choice":N}` → 解析成 slot 动作

**tool**（[tools.js](tools.js)）：

- `get_type_matchup(attack_type, defend_types)` —— 类型克制倍率（移植 `typechart`）
- `calc_stat_boost(base_stat, boost)` —— 能力等级修正（移植 `calcStatWhenBoost`）
- `get_battle_history(start_turn?, end_turn?)` —— 读取过往战报（按回合范围，不传则全文；数据来自 PO 侧 `state.fullHistory`）

最后 2 回合战报显式贴进 prompt；更早的战报由 DS 按需调 `get_battle_history` 读取（省 token）。

## 下一步（未实现）

**伤害计算 tool** —— 移植主脚本 `getMoveDamage`，是 tool 路线的核心价值（让 DS 决策前算伤害分布）。依赖：

1. **种族值数据**：`getMoveDamage` 用 `sys.pokeBaseStats(num, 8)` 读种族值，Node 侧需要一份种族值表（从 PO `db/pokes/` 导出，或用户本地 database 目录）。
2. **主脚本 `getMoveDamage` 的纯计算部分**：伤害公式 + `calcBaseStats` + 加成（道具/特性/能力等级/天气）。运行时数据（双方 HP、能力、已露招式）从 `state` 传入。

封装成 `calc_damage` tool 后，DS 就能在决策前对每个可用招式算伤害范围，代替现在"只给克制倍率"的粗糙信息。

## 使用方法

1. 启动（复用 po-pokellmon 的 apikey.txt）：

```powershell
$env:DEEPSEEK_API_KEY="sk-..."   # 或直接复用 ../po-pokellmon/apikey.txt
node po-pokellmon-tool/server.js
```

2. PO 侧脚本：复制 [po-pokellmon/po-script.js](../po-pokellmon/po-script.js)，把 `PKLM_URL` 改成 `http://127.0.0.1:8092`，贴进 PO 对战脚本窗口。

3. 对战内 `/llm on` 开启（或账号 mew's 自动开）。建议用 `/llm shadow` 影子模式先观察 DS 的 tool 调用与决策质量。

## 版本管理

- [server.js](server.js) `SERVER_VERSION`、[tools.js](tools.js) 无独立版本号（随 server 记录）
- 改代码后 bump `SERVER_VERSION` + 更新本 README，并 git commit（见仓库根 [CLAUDE.md](../CLAUDE.md) 规范）
