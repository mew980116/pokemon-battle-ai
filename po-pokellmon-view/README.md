# po-pokellmon-view（LLM 对战可视化）

> 端口 **8093**。注意：本目录是「LLM 对战可视化 view」，与 [board/](../board/)（8080 的「纯看板，无 AI」）是**两个独立的东西**，别混淆。

读取 po-pokellmon / po-pokellmon-tool 的 JSONL 决策日志，做「对战界面 + 历史战报 + LLM 交互过程」的可视化回放。

## 用法

```powershell
node po-pokellmon-view/server.js
```

浏览器打开 `http://127.0.0.1:8093/`。

- 顶部下拉选择要回放的对战日志（自动区分 `NO-THINK` / `TOOL` 两种路线）
- 滑块 / 按钮导航到任意一条决策
- 左栏：该决策时刻的对战界面（双方场上 + 我方六只/后备招式 + 对手已露后备）
- 右栏：LLM 交互（决策 action / 回复原文 / 耗时 / token 消耗 / tool 调用）+ 历史战报 + 完整 prompt

## 数据来源

直接读磁盘上的日志文件，无实时推送（回放式）。数据契约 = po-pokellmon/server.js 的 `writeLog` 每行 JSON：

```json
{
  "turn": 1, "totalMs": 4936, "rounds": 2,
  "usage": { "total_tokens": 1831, "prompt_tokens": 1792, "completion_tokens": 39, "prompt_cache_hit_tokens": 1536 },
  "toolLog": [ { "round": 1, "calls": [ { "name": "get_type_matchup", "args": {...}, "result": {...} } ] } ],
  "fallback": false, "reply": "{\"choice\": 5}", "action": { "type": "switch", "pokeSlot": 2 },
  "state": { "me": {...}, "opp": {...}, "myTeam": [...], "bench": [...], "history": [...], "oppRemaining": 6 },
  "prompt": "..."
}
```

## 与 board 的区别

- board 是**实时 SSE 看板**（PO webCall 推状态），纯对战界面，不含 AI
- 本目录是**回放式**（读日志），重点在「LLM 怎么决策」——prompt / tool 调用 / token / 耗时
- 对战界面渲染适配 po-pokellmon 的 state 结构（`me`/`opp`/`myTeam`/`bench`/`oppSeen`），与 board 的 `me.active/bench` 不同

## 限制

- 对手后备 HP 在 PO 里是隐藏的，日志只有 `oppSeen`（名字）和 `oppRemaining`（数量），无 HP
- 对手场上只给 HP 百分比（PO 不暴露具体值）
