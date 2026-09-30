# Debug Session: PS Sandrone Chat

Status: [OPEN]
Session: ps-sandrone-chat

## Symptom
桑多涅 Node 客户端看似运行，但 PS 账号显示 offline，无法确认是否登录，也无法向 III.Columbina 私聊。

## Hypotheses
1. WebSocket 地址或服务器节点不可达。
2. WebSocket 建立后没有触发/暴露连接事件，客户端缺少超时诊断。
3. 已收到登录挑战，但 assertion 登录请求失败。
4. 已登录，但私聊发送时机或协议命令不正确。

## Evidence
待采集。

## Constraints
- 先只增加运行时观测，不修改业务逻辑。
- 获取运行证据后再决定最小修复。
