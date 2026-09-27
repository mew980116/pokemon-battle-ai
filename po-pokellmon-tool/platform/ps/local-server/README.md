# PS 本地自建服（自己打自己 / 观战 / 复盘）

把 [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) 的服务器跑在本机，用来**不受官方服限制地自打自、观战、复盘**。

## 为什么需要它

官方服（`sim3.psim.us`）上有三条硬限制，实测都撞过：

| 限制 | 证据 |
|---|---|
| 天梯**同 IP 不能互配** | `server/ladders.ts` 的 `matchmakingOK()`：`new Set(users.map(u => u.latestIp)).size !== users.length` 直接判不匹配 → 自己双号排位永远配不上 |
| 定向挑战被 **IP 级反垃圾** 半锁 | 报错 `Due to spam from your internet provider, you can't challenge others right now.`（身份显示为 `!` = Muted，来自 IP 的 dnsbl 判定） |
| 账号要 **autoconfirmed** 才能挑战/聊天 | 判定 = 注册满 7 天 **且** 赢过 1 场排位（登录服 `ntbb-session.lib.php`） |

本地服关掉这些（见下「服务端配置覆盖」）之后：可以随便自己打自己，也没有 7 天门槛。

## 一次性准备

```powershell
pwsh -File setup-server.ps1                    # 装到 $env:USERPROFILE\ps-sim
pwsh -File setup-server.ps1 -Dir D:\ps-sim     # 指定目录（放本机盘，别放网络盘）
pwsh -File setup-server.ps1 -Force             # 删掉重装
```

做四件事：`git clone --depth 1` → `npm install` → `node build`（esbuild 打包）→ 往本地服的 `config/config.js` 末尾追加开发用覆盖。

## 启动

```powershell
cd "$env:USERPROFILE\ps-sim"
node pokemon-showdown start --skip-build     # 这个终端一直开着；监听 8000
```

## 客户端侧开关（以下命令都在 `po-pokellmon-tool/` 下执行）

| 变量 | 说明 |
|---|---|
| `PS_WS_URL` | 指向本地服：`ws://127.0.0.1:8000/showdown/websocket` |
| `PS_SKIP_LOGIN` | `1` = 跳过官方登录服，收到 challstr 后直接 `/trn <名字>,0,`（要求服务端 `noguestsecurity`） |
| `PS_USERNAME` | 本地服上用的名字（两个客户端必须不同） |
| `PS_AUTO_ACCEPT` | `1` = 自动接受别人的挑战（自己发的那份不触发） |
| `PS_RIVAL` | 定向挑战谁；`none` / `off` = 不主动挑战，只等别人来 |
| `PS_CHALLENGE_FORMAT` | 挑战的分级（`gen8randombattle` / `gen9randombattle` / `gen8battlefactory` …） |
| `PS_DECISION` | `llm`（默认，走 8092 决策服务）\| `random`（本地随机合法动作，先验链路用） |
| `PS_SEARCH_FORMAT` | 走天梯匹配而不是定向挑战（本地服同样可用） |

## 自己打自己

```powershell
pwsh -File platform\ps\local-server\selfplay.ps1                      # 陪练 random + AI random（默认）
pwsh -File platform\ps\local-server\selfplay.ps1 -AIDecision llm      # AI 侧接 8092 决策服务
pwsh -File platform\ps\local-server\selfplay.ps1 -Format gen9randombattle
```

陪练侧固定 `random`（不烧 token），只有 AI 侧读 `PS_DECISION`。
`-AIDecision llm` 需要 8092 决策服务在跑：`node server.js`（在 `po-pokellmon-tool/` 下）。

## 看对局

1. **文本复盘**（离线、快）：

   ```powershell
   node platform\ps\review-battle.js battle-gen9randombattle-68 | Out-File logs\review-68.txt
   ```

   输出 = PS 协议战报（自动去掉两个客户端各写一份造成的重复）+ 每回合决策摘要（动作 / 是否兜底 / 耗时 / token / tool 调用）。

2. **可视化回放**（像观战：左对战场面，右 LLM 交互）：

   ```powershell
   node po-pokellmon-view\server.js      # 8093；它本来就读 po-pokellmon-tool/logs
   ```

   浏览器开 http://127.0.0.1:8093/ → 下拉选那一局的 `deepseek_tool_*_battle<roomId>.log` → 用「下一条 ▶」步进（拖滑块不可靠）。
   左栏 = 双方场上/后备（属性色块、HP%）与对手剩余只数；右栏 = 决策动作 / 回复原文 / 耗时 / token / tool 调用明细 / 完整 prompt。

## 服务端配置覆盖

`setup-server.ps1` 往本地服的 `config/config.js` 末尾追加（**只用于本机开发服**）：

```js
exports.nothrottle = true;        // 关时间类限流（改名 / 挑战 / 排队）
exports.noipchecks = true;        // 关同 IP 检查（否则两个本地客户端仍无法互配）
exports.noguestsecurity = true;   // 允许 /trn <名字>（空 token）直接起名 —— 不需要登录服，关键
exports.backdoor = false;         // 不让官方 sysop 拿到本地控制台
```

## 已知坑

- **监听地址会被固定成 `0.0.0.0`**：PS master 的 network worker 用 `PM.env` 里的 `PSBINDADDR: Config.bindaddress || '0.0.0.0'` 覆盖，写 `Config.bindaddress = '127.0.0.1'` 不生效（实测 worker 日志与 `netstat` 都是 0.0.0.0）。本机开发够用，但**别在不信任的网络里开着**（同时开了 `noguestsecurity`）。
- **端口**：本地服 8000、决策服务 8092、viewer 8093。
- **曾经卡死对局的两个原因**（都已修，留作排障参考）：PS 的 `wait:true`（等对手出招）请求没有任何可选项，此时乱发 `/choose` 会被服务器拒绝；强制换人时可选的是**替补席的队伍槽位**，不是出战位下标。
- **PS 协议要点**：房间消息带 `>` 前缀；`team preview` 的 request 没有 active 标记；极巨化/钛晶化跟着分级 ruleset 走（`[Gen 8] Random Battle` 有极巨化；`[Gen 8] Battle Factory` 带 `Dynamax Clause` 所以没有；`[Gen 9] Battle Factory` 有钛晶化）。

## 从零复现整条链路

```powershell
# 1) 本地服（终端 A，一直开着）
pwsh -File po-pokellmon-tool\platform\ps\local-server\setup-server.ps1
cd "$env:USERPROFILE\ps-sim"; node pokemon-showdown start --skip-build

# 2) 决策服务（终端 B）—— 只有要 LLM 决策时才需要
node po-pokellmon-tool\server.js

# 3) 自打自（终端 C）
pwsh -File po-pokellmon-tool\platform\ps\local-server\selfplay.ps1 -AIDecision llm

# 4) 看对局（终端 D）→ 浏览器 http://127.0.0.1:8093/
node po-pokellmon-view\server.js
```
