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

## 性能（2026-09-22 修：整站卡到不可用）

日志目录在**网络盘**（`\\smartstorage`），实测单次文件操作 ~170ms。原来踩了两个坑：

- `listLogFiles()` 用 `readdirSync` + 每个文件一个 `statSync`（共 **243 个**）**同步**扫目录 → 一次 `/api/battles` 要 30–60s，期间事件循环被占死，连读本地 `index.html` 都被拖到 **77s**；
- 前端 `index.html` 每 **4 秒**轮询一次 `/api/battles` → 请求堆积，服务再也空不出来（进程累计 CPU 1296s）。

现在：

- 全链路改**异步**（`fs.readdir` / `fs.stat` / `fs.readFile`），stat 走 24 并发池（冷扫 ~1.5s，且不再阻塞事件循环）；目录列表缓存 15s、解析结果按 `(file+mtime+size)` 缓存（最多留 3 份）；
- 前端轮询 4s → **15s**，且上一次请求未返回时跳过这一轮（不堆积）。**进行中的回合走 SSE `/events`**，不依赖这个轮询；
- `/api/battle` 支持 **`?light=1`**（前端默认用）：丢掉前端从不读的 `ledger`（占 ~20%）与**每条都完全相同**的 `systemPrompt`（只留第一条，前端用第一条兜底）→ 体积约 **−28%**。

实测（battle112，1.73MB）：`/` 81s → **0.13s**；`/api/battles` 34–61s → **1.5s 冷 / 36ms 缓存**；`/api/battle?light=1` 32s → **0.19s**。

**以后改这里的规矩**：这条路径上**不要用任何 `*Sync` API**，也不要把前端轮询间隔调小。
