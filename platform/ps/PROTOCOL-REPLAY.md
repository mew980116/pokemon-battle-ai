# PS protocol replay

`protocol-replay.js` 是不连接 WebSocket 的确定性 PS battle replay 入口。
它复用 `adapter.parseProtocol()` 和 `adapter.BattleSession`，用于在进入
DualViewState 之前验证协议事件到 battle state 的转换。

## 支持的输入

- 原始 PS protocol 文本，支持以 `>battle-...` 开头的 room header；
- benchmark 的单行 JSON 记录，其中包含 `protocol` 数组；
- JSON 数组；
- JSONL protocol log，其中每行是：
  `{"type":"protocol","data":{"room":"...","event":{...}}}`。

benchmark 当前保存的是规范化事件，request 的完整 JSON 只有在输入日志中存在时
才能恢复。需要验证本方私有 request 时，应使用原始客户端日志或包含完整
`request` 字段的回放文件。

## 用法

```powershell
node platform\ps\protocol-replay.js input.txt
node platform\ps\protocol-replay.js matches-row.json --json --snapshots
node platform\ps\protocol-replay.js client-log.jsonl --room battle-gen9randombattle-1
```

默认输出最终状态摘要。`--json` 输出机器可读摘要，`--snapshots` 增加 request、
turn 和 battle end 节点的状态快照，`--out` 将结果写入文件。

## 测试

```powershell
node platform\ps\test-protocol-replay.js
node platform\ps\test-ps-adapter.js
node platform\ps\test-ps-client.js
node platform\ps\test-decision-bridge.js
```

该 replayer 不会发送命令、不登录 PS、不修改 benchmark 数据，也不会把 replay
状态直接当作 Foul Play 的私有完整状态。后续 DualViewState 应在此 replay 入口
之上分别维护 public view、self private view 和 opponent belief view。
