---
name: po-client-ops
description: Operate the local Pokemon Online client via UI automation — paste/verify the battle script, start a battle with /challengeai, close battle windows, reconnect. Use when asked to 贴/换 po 脚本, 开一局对战, 关对战窗口, 重连 PO. Not for editing the script source.
---

# PO 客户端操作（Pokemon Online）

用 computer-use 驱动本机的 PO 客户端完成四种操作：**改脚本 / 开对战 / 关对战窗 / 重连**。

## 前置：定位进程与窗口

- 工具通道：`server_name: "ide_mcp.config.ext.computer-use"`。既有的写法是在 Exec 里 `await tools.xxx()`，**但实测 Exec 会返回空结果** → 直接用 `run_mcp` 调工具更稳（见「通用坑」）。
- **动手前先确认没锁屏**（见第 1 节第 0 步）：锁屏时剪贴板与键鼠全废，且症状会伪装成「已成功」。
- 找 PO：`list_apps()` → 形如 `PO [pid=26740, app_id={...}\Pokemon Online\Pokemon-Online.exe]`。
- UIA 的 `windowId` 就是 Win32 HWND；**每次全量刷新（`disableDiff: true`）后 `element_id` 会重新编号** → 不要跨观察复用 id，动作后重新取一次。
- 观察默认 `disableScreenshot: true`（语义树够用）；只有要读编辑器里的可见文字/确认视觉状态时才开截图（`disableScreenshot: false` + `image(state)`）。
- **Qt 菜单栏的特殊点**：`click` 顶层 `menu-item "Plugins"` 后会弹出一个**独立的 popup window**（`menu "..." windowId=...`），子项要在这个 popup 里点；直接对顶层菜单项用 `perform_action expand` 会失败。

## 1. 改脚本（把仓库的 `po-pokellmon/po-script.js` 贴进 Battle scripts）

**先看这个流程图**，三个「假成功」的坑都在里面（下方有详细步骤）：

```
0. 探锁屏 ──▶ 1. 设剪贴板 ──▶ 2. 菜单开 Script Window / Battle scripts
   ▲ 锁屏就停，先让对方解锁              │
                                        ▼
   5. OK ──◀── 4. 核对（UI 树 / 哨兵）──◀── 3. 右键点编辑器拿焦点 → Ctrl+A → Ctrl+V
                  ✗ 不一致 → 回第 2 步重来
```

### 0. 先探「是不是锁屏了」（不做这步会白跑一整轮）

锁屏时**剪贴板拿不到、键鼠也送不进去**，但症状会伪装成「脚本没生效」。两种探法：

- `get_app_state` 的返回里若出现 **`Current get_app_state target window is not the focused window. The focused window pid is NNNN (LockApp.exe).`** → 就是锁屏（截图会是 Windows 锁屏壁纸）。
- 或直接试探剪贴板：`Set-Clipboard -Value x` 报 `Requested Clipboard operation did not succeed`、`clip.exe` 报 `Access is denied` → 同样是锁屏（连试 3 次一致即可判定，别当偶发）。

→ 命中就**停下让用户解锁屏幕**，不要继续点菜单（点不动，还会把菜单点开又关掉）。

### 1. 把脚本放进剪贴板

- 先看 `po-pokellmon/po-script.js` 的 `PKLM_VERSION`（这个值会随日志记录，用来确认到底跑的是哪版）。
- `powershell -File .trae/skills/po-client-ops/scripts/set-po-script-clipboard.ps1 -Path po-pokellmon/po-script.js`（**必须显式 UTF-8**，见「通用坑」；脚本会打印 `file_version` / `clip_version` / `has_mojibake`，`clipboard_chars` 必须等于 `file_chars`）。

### 2. 打开脚本窗口

菜单：`Plugins` → popup 里的 `Script Window` → 对话框里点 **`Battle scripts`** 页签。
（`Plugins` 点不动 / popup 不出现，多半是第 0 步的锁屏，或 popup 是独立 window，子项要在 popup 里点。）

### 3. 贴：**先右键点编辑器拿键盘焦点**，再 `Ctrl+A` `Ctrl+V`

- 目标元素是 `edit [set_value,set_focus]`（脚本编辑框）。
- ⚠️ **必须先右键点一下编辑器**，看到编辑框里出现光标，再发 `Ctrl+A` / `Ctrl+V`。左键点/不点都可能**拿不到键盘焦点**，这时两个键会全部落空 —— 表面流程走完了，实际内容没变（这是最坑的一种「假成功」）。
- 粘贴后内容很长，确认滚动条位置/首行有变化再继续。

### 4. 核对：**不能只读剪贴板**（会假阳性）

剪贴板里的内容**是你自己刚塞进去的**，所以「剪贴板里有新版」只证明第 1 步成功，**不证明贴进去了**。两个可靠的核对面：

- **A. 读完整 UI 树**（首选）：`get_app_state` 带 `disableDiff: true`、`max_depths` 给大一点（编辑器的 `val=` 里就是全文），在返回内容里找 `PKLM_VERSION`。
- **B. 哨兵法**：先把剪贴板设成一个哨兵值（如 `Set-Clipboard -Value "SENTINEL-$(Get-Random)"`），再在编辑器里 `Ctrl+A` `Ctrl+C`，然后 `Get-Clipboard -Raw`：
  - 仍是哨兵值 → **Ctrl+C 没生效**（= 焦点没拿到，回第 3 步）；
  - 变成了脚本内容 → 粘贴成功，再用 `verify-po-script-clipboard.ps1` 核对 `pklm_version` / `has_mojibake=False` / `looks_like_po_script=True`。

### 5. 点 `OK`

对话框关闭即已绑定并落盘（PO 取脚本求值的完成值当回调表，所以贴完必须整段替换、不要手改）。

### 6. 收尾与最终确认

- 可选但推荐：重新打开 Script Window 再复制一次核对（确认落盘的是新版）。
- 收尾用 `Cancel` 关掉对话框（避免多余的重写）。
- **终极判据**：打一局后看 `po-pokellmon-tool/logs/deepseek_tool_<yyyymmdd>_battle<N>.log` 里的 `scriptVersion` / `serverVersion` 字段 —— 这两个是「实际跑的是哪版」的唯一可信来源。
  - 但**更早、更省事**的判据是 §1.5 那个落盘的 `battlescripts.js`：点完 OK 就能读，不用等打一局。

## 1.5 两个「不用看界面就能拿到的判据」（2026-09-21 发现，优先用这两个）

PO 把两样东西落到磁盘上，都能直接读文件 —— **比剪贴板 / UI 树可靠得多**：

| 文件 | 路径 | 用途 |
|---|---|---|
| **落盘的 battle script** | `C:\Users\85145\AppData\Local\Dreambelievers\Pokemon-Online\Scripts\battlescripts.js` | PO **启动时加载**、Script Window 点 OK 后落盘 → 读它 grep `PKLM_VERSION` 就是「PO 当前真正跑的版本」，**这才是权威判据**（剪贴板只能证明第 1 步、UI 树要读全文） |
| **PO 原版战报** | `C:\Users\85145\Documents\Pokemon Online\Logs\Battle Logs\<日期>\<A> vs <B> at HHhMM.html` | **对局结束时**落盘（实测 battle104 09h08 开打 → 文件 mtime 9:20:33）。含 `class="MoveMessage"` / `"ItemMessage"` 等**分类**和 PO 自己渲染好的完整句子（`%i` 之类占位符 PO 自己填对）→ 复盘/验证直接读，**不需要让对方贴** |

- 路径来源：`SettingsPlugin\settings.ini` 里的 `logs_directory=`（本机 = `C:/Users/85145/Documents/Pokemon Online/Logs/`）、`SaveLogs=true`；脚本目录来自 PO 脚本 API 的 `sys.scriptsFolder`。
- ⚠️ 两点限制：① 战报 HTML **只在结束时**写 → 不能当实时状态源；② 它**不含脚本 `print()` 的内容**（我们打窗口的东西不会进去）→ 需要自己的落盘通道（见下）。
- ⛔ **agent 不能直接写 PO 的脚本文件**（2026-09-21 实测）：Trae 沙箱只允许**读**工作区外的路径，写 `C:\Users\85145\AppData\Local\Dreambelievers\...` 会报 `TRAE Sandbox Error: hit restricted / Not allow operate files`（`requirements_approval` 也不解除）。要用这条路得先在 Settings → Permission & Approval → Custom Configuration 放行该目录。**读**任意路径是允许的（`settings.ini` / `battlescripts.js` / `Logs/*.html` 都能读）。
- 💡 **首选新路（待验证）**：PO 脚本 API 自带 `sys.changeBattleScript(QString)`（更改对战脚本）、`sys.getScript()`、`sys.scriptsChanged(QString)` → 可以让 **PO 自己**拉取并切换脚本：脚本里有 `sys.synchronousWebCall(url)`（下载）+ `sys.writeToFile()`（落盘），所以中间态**只需要一次人工动作**（往聊天框打一行 `/eval ...`，或先贴一次带自更新的版本），之后部署可全自动 —— 既不用剪贴板，也不用重启登录。验证手段：脚本顶层会往 `Scripts\pklm-load.log` 追加一行 `… loaded PKLM_VERSION=x.y.z`（0.6.23 起）→ 读这个文件就知道「PO 现在加载的是哪版」。
- ⚠️ 重启 PO 自己也要 GUI（登录/选服务器要人手点）→ 锁屏时**做不了**重启类操作；只有文件读写、进程查询与 kill 不需要 GUI。
- **我们脚本自己的落盘**：po-script 0.6.22 (script) 起，消息渲染探针（`/llm probe`）会**同时** `print` 到窗口并 `sys.appendToFile` 到 `Scripts\pklm-msg-probe.log`（每局开头清空、写一行表头带脚本版本与局号）。于是验证流程可以做到**零人工**：PO 文本读 HTML + 我们的原始参数/渲染结果读 probe 文件 + state/history 读 `po-pokellmon-tool/logs/deepseek_tool_*.log`，三份自己对齐。

## 2. 开对战

- 主窗口（`window "口袋吧测试服务器 - Pokemon Online"`）底部的聊天 `edit`：`click` → `Ctrl+A` → `type_text "/challengeai"` → `press_key enter`。
- 核对：主窗口聊天出现 `battle between <我方账号> and <对手> started.`，并弹出新窗口 `"Battling against <对手>"`。
- 确认脚本真在决策：`po-pokellmon-tool/logs/deepseek_tool_<yyyymmdd>_battle<N>.log` 是否在增长（或 8092 控制台出现 `[choice]`）。
- 若聊天出现「当前BOT繁忙，请在 N 秒后再尝试挑战」，等过冷却重发即可。

## 3. 关对战窗口

- 取 `window "Battling against ..."` **那一行的 `id=`（窗口根元素）**，然后
  `perform_action` + `{ action: "window_close" }`。
- 兜底：点窗口标题栏的 `button "关闭"`。
- ⚠️ **对局进行中关窗等于离开/认输** → 只在「该局已结束（聊天里已有 won/lost/forfeited）」或「明确要放弃这一局」时关；不确定就先问。
- 关掉后重新观察，确认 `window "Battling against ..."` 已不在窗口列表。

## 4. 重连

- 判断掉线：主窗口标题/聊天出现断线提示；或对局中脚本侧触发 `onReconnect`（= 我方重连）。
- **优先等自动重连**（PO 用保存的密码自动重连）。
- 手动触发（择一）：
  - **客户端脚本**：Script Window → **`Client scripts`** 页签 → 写入 `client.reconnect();` → OK（`client.reconnect()` 见 `docs/reference/client-object.md`；同族还有 `setReconnectPass` / `onReconnectFailure`）。
  - **重启客户端（最可靠）**：`launch_app { app: "PO" }` → 启动界面选服务器 → Connect。
- ⚠️ 重启客户端后 **battle script 会被重置，必须重贴**（回到第 1 节整节）；重连后也建议跑一次第 1 节第 4 步核对 `PKLM_VERSION`。
- 设计如此：对局中掉线时 po-script 的 `onReconnect` 会 `battleEnd = true` 并 30s 后认输，别指望它续打。

## 通用坑（都是实机踩过的）

- **锁屏时什么都做不了**：终端进程拿不到剪贴板（`Set-Clipboard` 报 `Requested Clipboard operation did not succeed`、`clip.exe` 报 `Access is denied`），GUI 点击/输入也送不进去 → 先让对方解锁屏幕（判定见第 1 节第 0 步）。**这个坑最恶劣的地方是它伪装成「脚本已更新」**：流程全走完、没报错，但内容一个字没变。
- **「剪贴板里有新版」≠「脚本已更新」**：剪贴板是你自己塞的，读剪贴板核对是假阳性。以编辑器 UI 树 / 哨兵法核对为准（见第 1 节第 4 步）。
- **Ctrl+A / Ctrl+V 会静默落空**：Qt 编辑器不先右键点一下拿焦点，快捷键不生效。凡是「点了也贴了但版本没变」，第一反应就是焦点。
- **computer-use 的调用通道**：本仓库既有的写法是在 Exec 里 `await tools.xxx()`，但**实测 Exec 会返回空结果**（`The MCP server responded with: []`）→ 遇到就直接用 `run_mcp` 调 `server_name: "ide_mcp.config.ext.computer-use"` 下的工具（`list_apps` / `get_app_state` / `click` / `press_key` / `set_value` 等），别在 Exec 上反复试。
- **读文件要用 UTF-8**：`Get-Content -Raw` 在这台机器上是 Windows PowerShell 5.1，默认按系统 ANSI(GBK) 解码 → 中文全变 `鈥?` 之类的乱码。用 `[System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)`（两个 helper 脚本已封装）。
- 别用 C 风格三元 `?:`（PS 5.1 不支持，会 ParserError）——用 `if/else`。
- 别用 Notepad 做剪贴板中转：它会被 Trae 沙箱拦掉状态文件后退出。剪贴板直接用 PowerShell。
- 脚本改完要**重贴才生效**；`PKLM_VERSION`（脚本）/`SERVER_VERSION`（8092）是判断「当前到底跑哪版」的唯一可信来源 —— **改完脚本记得同时重启 8092**（`SERVER_VERSION` 也在 `deepseek_tool_*.log` 里一起记录）。
