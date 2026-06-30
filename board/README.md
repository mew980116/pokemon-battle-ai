# PO webCall 可用性验证

在定下看板架构前，先验证一件不确定的事：**PO 的 `sys.webCall` 能不能在 battle 回调里被调用、POST 数据能不能发出**。

- 能 → 正式架构走「PO 异步 POST → Node 服务 → SSE 推浏览器」，实时性好
- 不能 → 走「PO `writeToFile` → Node 静态托管 → 浏览器 500ms 轮询」，稳但稍慢

## 文件说明

| 文件 | 作用 |
|------|------|
| `verify-server.js` | Node 零依赖验证服务，监听 `127.0.0.1:8080`，把收到的每个请求的 method/url/content-type/body/解析结果全打印 |
| `verify-battle.js` | PO battle 验证脚本，在关键回调里调 `sys.webCall` 异步 POST；`/wctest` 聊天命令做同步 GET 基线 |
| `README.md` | 本文件 |

## 验证步骤

### 1. 启动 Node 服务（终端 1）

```
node board/verify-server.js
```

看到 `Listening on http://127.0.0.1:8080` 即就绪，终端保持开着。

### 2. PO 侧加载验证脚本

1. 打开 PO 的 battle script 窗口
2. 把 `verify-battle.js` 的全文**临时粘贴进去**（替换主 AI 脚本）
3. 启用脚本
4. **验证完务必切回 `20201227_v1.3.1.js`**——这个验证脚本不含 AI 逻辑，只是为了测 webCall

### 3. 开一场对战

随便进一场对战，正常打几个回合即可。关键回调触发时会向 Node 服务发 POST。

### 4.（可选）手动基线测试

在 PO 聊天框发送：

```
/wctest
```

这会从 client 上下文发一个同步 GET + 一个异步 POST，作为对照基线。

## 怎么读结果

看 Node 服务终端的输出：

| 现象 | 结论 |
|------|------|
| `/wctest` 后收到 `GET /health` + `POST /ping` | client 上下文 webCall 可用（基线） |
| 进对战后收到 `POST /ping`（event=onBeginTurn 等） | **battle 回调里 webCall 可用** ✅ 走实时方案 |
| 只有 `/wctest` 的请求，battle 回调 POST 没出现 | battle 回调里 webCall 不可用 → 走写文件方案 |
| `content-type` + `raw body` + `parsed (json/form)` | 判断 args 是 form-data 还是 JSON，定正式服务解析方式 |
| PO 侧 `[WCVERIFY] !! webCall threw: ...` | webCall 调用直接抛异常，记下 message |

## 三个关键观察点

1. **battle 回调的 POST 到没到** —— 最初的担忧，核心结论
2. **args 的序列化格式** —— `parsed (json)` 还是 `parsed (form)`，决定正式 Node 服务怎么解析 body
3. **PO 侧有没有打印 `[WEBCALL] done`** —— webCall 回调 script 是否执行（不影响推数据，但能确认 webCall 没静默失败）

## 验证完之后

把 Node 终端的输出贴回来，据此二选一定正式架构：

- **webCall 通** → PO 异步 POST → Node 服务接收 + SSE 推送 → 浏览器
- **webCall 不通** → PO `writeToFile(state.json)` → Node 静态托管 → 浏览器 500ms 轮询

Phase 1 看板目标：展示双方场上 HP / 能力等级 / 状态异常 / 场地天气 / 陷阱，注重可视化（直播/视频背景页用）。Phase 2 再加 AI 内部决策链（standard 评分 / softmax 候选 / threat），需改 AI 脚本暴露中间变量。
