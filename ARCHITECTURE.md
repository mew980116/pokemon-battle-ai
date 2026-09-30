# 当前系统架构与测试规划

本文档描述当前以 **PO / Pokémon Showdown（PS）双平台 + 多决策 provider** 为核心的架构。
代码实现细节以当前源码为准；历史实验和旧路线仍保留在 `TODO.md` 与各目录 README 中。

## 1. 当前目标

近期目标不是只验证一个 LLM 对局，而是建立一套可重复的 PS 测试环境：

1. 在一台服务器上运行 PS 私服。
2. 同一台服务器上运行一个自动对战客户端（LLM、random 或其他 provider）。
3. 用户自己的电脑通过浏览器或 PS 客户端连接该私服，作为人工对手。
4. 逐步覆盖以下对战矩阵：
   - LLM vs random
   - LLM vs foul-play
   - LLM vs 人工
   - LLM A vs LLM B
   - LLM / random / foul-play 等多种 provider 互战
   - LLM 参加官方 PS rating 对战

其中 `random` 已经可以作为链路 smoke test；`foul-play` 尚未接入当前 provider 路由。

## 2. 总体数据流

```text
                 人工浏览器 / PS 客户端
                         │
                         │ PS WebSocket
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ Pokémon Showdown Server                                      │
│ 私服：server-ip:8000                                         │
│ 官服：sim3.psim.us                                           │
└──────────────────────────────────────────────────────────────┘
                         ▲
                         │ PS WebSocket
                         │
                 platform/ps/client.js
                         │
                 adapter.js 解析 PS request
                         │
                 battle-state/v1
                         │
                 decision-bridge.js
                         │ HTTP POST JSON
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ po-pokellmon-tool/server.js                                  │
│                                                              │
│ decision-router.js                                            │
│   ├── random：从合法 actions 中随机选择                       │
│   ├── llm：prompt + tools + LLM                               │
│   ├── rules：预留                                           │
│   └── foul-play：待接入                                       │
│                                                              │
│ decision-contract.js：state / action 合法性契约               │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
                 PS action /choose ...
```

PO 平台使用同一个决策服务，但采集端不同：

```text
PO battle/sys API
    -> po-pokellmon/po-script.js
    -> battle-state/v1
    -> po-pokellmon-tool/server.js
    -> choice
    -> PO sys.offerChoice / 对战脚本
```

## 3. 目录职责

| 目录 / 文件 | 职责 |
|---|---|
| `po-pokellmon/po-script.js` | PO 侧状态采集、PO 命令执行 |
| `po-pokellmon-tool/server.js` | 统一决策服务入口，提供 `/choice`、`/health` |
| `po-pokellmon-tool/decision-contract.js` | `battle-state/v1` 和合法动作候选定义 |
| `po-pokellmon-tool/decision-router.js` | 根据账号/provider 选择 `random`、`llm` 等决策方式 |
| `po-pokellmon-tool/tools.js` | LLM 可调用的确定性计算和知识工具 |
| `platform/ps/client.js` | PS WebSocket 登录、挑战、收取 request、发送 action |
| `platform/ps/adapter.js` | PS 协议和 request 转换为统一状态/动作 |
| `platform/ps/decision-bridge.js` | PS request 调用决策服务并提交合法动作 |
| `platform/ps/run-shadow.js` | PS 自动客户端入口，支持真实执行和 shadow |
| `platform/ps/local-server/` | PS 私服安装、自打自和复现脚本 |
| `po-pokellmon-view/` | 对局和 LLM 决策日志查看 |

## 4. 部署拓扑

### 4.1 服务器上的 PS 私服 + 自动客户端，用户电脑人工对战

这是近期主要目标。

```text
服务器
├── Pokémon Showdown 私服 :8000
├── 自动客户端：platform/ps/run-shadow.js
├── 决策服务：po-pokellmon-tool/server.js :8092
└── 可选 viewer：po-pokellmon-view/server.js :8093

用户电脑
└── 浏览器访问 http://服务器IP:8000/
    或其他 PS 客户端连接服务器IP:8000
```

服务器上的自动客户端通过：

```text
PS_WS_URL=ws://127.0.0.1:8000/showdown/websocket
```

用户电脑通过浏览器访问服务器的 PS HTTP 端口，进入同一个私服房间并挑战自动客户端。

安全要求：

- 当前私服开发配置包含 `noguestsecurity`，只能放在可信内网或 VPN 中。
- PS worker 可能监听 `0.0.0.0`，必须用防火墙限制来源 IP。
- 不要把带 `noguestsecurity` 的私服直接暴露到公网。
- `PS_SKIP_LOGIN=1` 只用于私服，官服必须使用正常账号登录。

### 4.2 本机双客户端自打自

用于快速回归：

```text
PS 私服
├── Random / LLM client A
└── Random / LLM client B
```

推荐先跑 `random vs random`，再跑 `random vs llm`。

### 4.3 官方 PS rating

官方 rating 对战只需要启动自动客户端，不启动本地 PS 私服：

```text
platform/ps/run-shadow.js
    -> 官方登录服 / 对战服
    -> PS_SEARCH_FORMAT=gen8randombattle
    -> /search <format>
```

注意：

- 需要真实 PS 账号、密码和合法的官方登录流程。
- 同 IP 双号 rating 不能作为本地自打自方案。
- rating 会改变账号分数，必须单独使用测试账号。
- 应先使用 `PS_SHADOW=1` 或非 rating challenge 做验证。

## 5. 决策路由

决策服务接收统一状态，重点字段包括：

- `platform`：`po` 或 `ps`
- `account`：当前自动客户端账号
- `actions`：平台已经确认合法的动作候选
- `capabilities`：平台能力和执行能力
- `providerHint`：兼容旧客户端的提示

路由优先级：

1. `decision-routing.json` 中的账号映射
2. 客户端 `providerHint`（`allowClientHint=true` 时）
3. 默认 provider

当前 provider：

| Provider | 状态 | 说明 |
|---|---|---|
| `random` | 可用 | 只从平台给出的合法动作中随机选择 |
| `llm` | 可用但依赖 credential | 当前走 `po-pokellmon-tool` 的 prompt/tool 链路 |
| `rules` | 预留 | 旧 PO 规则 AI 还没有包装成统一服务 |
| `foul-play` | 未接入 | 需要 PS 客户端或 server-side adapter |

`/choice` 推荐使用：

```text
POST /choice
Content-Type: application/json
Body: battle state JSON
```

旧版 GET ` /choice?state=...` 仍保留兼容，但不适合长对局，因为 URL 会随 history 增长。

## 6. 测试矩阵与验收标准

| 阶段 | 对战组合 | 运行位置 | 验收 |
|---|---|---|---|
| P0 | random vs random | 私服 / 本机 | 对局能创建、出招、结束，无非法 action |
| P1 | random vs LLM | 私服 / 本机 | LLM 请求、合法 action、fallback、日志完整 |
| P2 | LLM vs 人工 | 服务器私服 + 用户电脑 | 人工能从浏览器进入并完成挑战 |
| P3 | LLM A vs LLM B | 私服 | 两个账号可独立配置模型/profile/provider |
| P4 | LLM vs foul-play | 私服 | foul-play 能通过统一动作边界提交决策 |
| P5 | LLM vs random / foul-play 批量评测 | 私服 | 可重复运行、保存对局和统计结果 |
| P6 | LLM official rating | 官服 | 独立测试账号正常登录、search、完成 rating 对战 |

每个测试至少保存：

- PS 房间 ID
- 双方账号和 provider
- format / ruleset
- 每回合 state、候选 actions、最终 action
- fallback、错误和耗时
- 最终胜负和断线原因

## 7. 相关文档

- [根目录 README](README.md)：项目入口和文档索引
- [po-pokellmon-tool README](po-pokellmon-tool/README.md)：决策服务、LLM/tool、PO/PS 接入
- [PS 私服 README](platform/ps/local-server/README.md)：私服安装、启动、自打自
- [TODO](TODO.md)：当前阶段、测试矩阵和未完成事项

