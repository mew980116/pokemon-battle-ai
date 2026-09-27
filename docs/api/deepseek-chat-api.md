# DeepSeek Chat Completions API 参考

> 官方文档：<https://api-docs.deepseek.com/zh-cn/api/create-chat-completion>
> 用于 po-pokellmon（`server.js` 的 `callDeepSeek`）调用的外部 API。

## 接口地址

```
POST https://api.deepseek.com/chat/completions
```

- Content-Type: `application/json`
- 认证：`Authorization: Bearer <DEEPSEEK_API_KEY>`

## 关键请求参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `messages` | object[] | 消息列表（system/user/assistant/tool） |
| `model` | string | `deepseek-v4-flash` / `deepseek-v4-pro` |
| `thinking` | object | `{"type":"enabled"/"disabled"}`，**默认 enabled** |
| `reasoning_effort` | string | `none` / `low` / `high` / `max`（`none` 关闭思考，`low`/`high`/`max` 开启+强度递增，默认 `high`；兼容：minimal→low，medium/xhigh→high） |
| `max_tokens` | integer | 输出 token 上限（null = 不限制） |
| `response_format` | object | `{"type":"json_object"}` 强制 JSON |
| `temperature` | number | 0~2，**默认 1**（仅非思考模式生效） |
| `top_p` | number | 0~1，默认 1 |
| `stream` | boolean | 是否流式 |

## 关键响应字段

| 字段 | 说明 |
|---|---|
| `choices[0].message.content` | 最终答案 |
| `choices[0].message.reasoning_content` | 思维链（仅思考模式） |
| `choices[0].finish_reason` | `stop` / `length` / `content_filter` / ... |
| `usage.completion_tokens` | 输出 token 数 |

## 踩坑记录（实测总结）

1. **`thinking` 默认是 `enabled`** —— 不显式设 `disabled` 会走思考模式，慢且耗 token。

2. **`finish_reason="length"` 意味着 content 被截断** —— 思考链把 `max_tokens` 耗尽时，最终答案 `content` 会空。这是之前"空 content → fallback"的根因。解决：`max_tokens` 设 null（取消限制）或关思考模式。

3. **思考模式不支持 `temperature`** —— 设了不报错但不生效。

4. **`reasoning_effort` 有四档 `none` / `low` / `high` / `max`** —— 文档标注 `none` 关闭思考、`low` 是轻度思考（独立档）。但**实测 `none` 并不关闭思考**（见第 7 条）。

5. **JSON 模式要求 prompt 里指示输出 JSON** —— 否则模型可能生成空白直到 token 上限（表现为"卡住"）。我们的 prompt 末尾 constraint 已包含 JSON 指示。

6. **实测结论（5 场景 × 2 次）**：非思考模式（thinking disabled + temperature 0.3）比思考模式优 —— 0.78s/次、6 token、100% 非空；思考 high 30s/次、上千 token。这与 PokeLLMon 论文"CoT 对对战决策有害"的结论一致。

7. **`reasoning_effort=none` 不会关闭思考（实测）** —— 配合 `thinking.type=enabled` 时，none 实测 41.8s/次（和 high 相当），说明 `thinking.type` 优先级高于 `reasoning_effort`。要真正关思考必须 `thinking.type=disabled`。四档耗时实测：low 24s < none 41.8s ≈ high 44s < max 178s+（max 还出现 ECONNRESET 连接重置，不实用）。

## 模型现状（2026-09）

| 模型名 | 状态 |
|---|---|
| `deepseek-v4-flash` | 当前用，最新路由到 V4.1 Flash |
| `deepseek-v4-pro` | 更强（贵 ~3 倍） |
| `deepseek-chat` / `deepseek-reasoner` | 已弃用（2026-07-24） |
