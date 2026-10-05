# Upstream Foul Play 校准入口

## 角色划分

- `8095` 不再运行 `live_reference_server.py`。
- 原版 Foul Play 由 `platform/ps/upstream_runner.py` 直接导入
  `D:\Other\ai\foul-play` 的 `run.py`、`PSWebsocketClient`、`Battle`、
  `battle_modifier` 和 `find_best_move`。
- `8093` 仍然是 translated reference，只接收 adapter 产生的
  `battle-state/v1`，不发送动作。
- `8094` 仍然是 DualView，负责实际动作。

因此，`8095` 的正确含义是原版 Foul Play runner，不是一个
`POST /choice` HTTP 决策服务。原版 Foul Play 的输入是 PS WebSocket
原始协议，不应为了复用 HTTP 接口而改成 `state -> choice`。

## 启动 8095 校准对局

先确认 `8093` 已启动：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8093/health
```

启动一局：

```powershell
Set-Location D:\Other\ai\pokemon-battle-ai
pwsh -File .\platform\ps\run-upstream.ps1 -RunCount 1
```

启动连续三局：

```powershell
pwsh -File .\platform\ps\run-upstream.ps1 -RunCount 3
```

脚本默认连接测试私服：

```text
ws://218.244.153.64:8000/showdown/websocket
```

如私服地址发生变化，使用 `-WsUrl` 覆盖。

## 输出

每次运行会在
`D:\Other\ai\pokemon-battle-experiments\dual-view-v0\upstream-YYYYMMDD-HHmmss`
下保存：

- `upstream-protocol.jsonl`：去除 `challstr` 后的原始 PS WebSocket 帧；
- `upstream-comparison.jsonl`：原版动作、8093 translated reference 动作、
  同一回合的 adapter state 和 parity 诊断；
- `upstream-run.log`：runner 日志。

原版动作会实际发送到 PS。8093 的动作只用于 shadow comparison，不会发送。

## 校准解释

同一场景比较必须以相同的 `battle id + rqid` 为键。动作一致率只是
行为差异指标，不是转译正确率。转译正确率要看：

1. 当前 active Pokemon；
2. 当前 HP 和 fainted 状态；
3. 已公开 status 和 boosts；
4. 我方 request 中的 move、PP、disabled；
5. weather、terrain、side condition；
6. 8093 的动作是否能由这些状态差异解释。

原版 Foul Play 的 Random Battle 搜索会根据已揭示信息动态决定 sampled
battle 数量和每个样本的搜索时间；8093 当前仍是独立的 translated
reference 配置。因此即使 parity 完全通过，动作也不保证逐回合完全相同。
