---
name: po-client-ops
description: Operate the local Pokemon Online client via UI automation — paste/verify the battle script, start a battle with /challengeai, close battle windows, reconnect. Use when asked to 贴/换 po 脚本, 开一局对战, 关对战窗口, 重连 PO. Not for editing the script source.
---

# PO 客户端操作（Pokemon Online）

用 computer-use 驱动本机的 PO 客户端完成四种操作：**改脚本 / 开对战 / 关对战窗 / 重连**。

## 前置：定位进程与窗口

- 一律用 `server_name: "ide_mcp.config.ext.computer-use"`，先在 Exec 里定义 `cu()` 助手再调用。
- 找 PO：`list_apps()` → 形如 `PO [pid=26740, app_id={...}\Pokemon Online\Pokemon-Online.exe]`。
- UIA 的 `windowId` 就是 Win32 HWND；**每次全量刷新（`disableDiff: true`）后 `element_id` 会重新编号** → 不要跨观察复用 id，动作后重新取一次。
- 观察默认 `disableScreenshot: true`（语义树够用）；只有要读编辑器里的可见文字/确认视觉状态时才开截图（`disableScreenshot: false` + `image(state)`）。
- **Qt 菜单栏的特殊点**：`click` 顶层 `menu-item "Plugins"` 后会弹出一个**独立的 popup window**（`menu "..." windowId=...`），子项要在这个 popup 里点；直接对顶层菜单项用 `perform_action expand` 会失败。

## 1. 改脚本（把仓库的 `po-pokellmon/po-script.js` 贴进 Battle scripts）

1. 先看 `po-pokellmon/po-script.js` 的 `PKLM_VERSION`（这个值会随日志记录，用来确认到底跑的是哪版）。
2. 放进剪贴板（**必须显式 UTF-8**，见「通用坑」）：
   `powershell -File .trae/skills/po-client-ops/scripts/set-po-script-clipboard.ps1 -Path po-pokellmon/po-script.js`
3. 菜单：`Plugins` → popup 里的 `Script Window` → 对话框里点 **`Battle scripts`** 页签 → 点编辑器（`edit [set_value,set_focus]`）→ `Ctrl+A` → `Ctrl+V`。
4. **核对（关键一步）**：编辑器里 `Ctrl+A` `Ctrl+C`，再跑
   `powershell -File .trae/skills/po-client-ops/scripts/verify-po-script-clipboard.ps1`
   → 打印的 `pklm_version` 必须是预期版本、`has_mojibake=False`、`looks_like_po_script=True`。
5. 点 **`OK`**（对话框关闭即已绑定并落盘）。
6. 可选但推荐：重新打开 Script Window 再复制一次核对（确认落盘的是新版）。
7. 收尾时用 `Cancel` 关掉对话框（避免多余的重写）。

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
- ⚠️ 重启客户端后 **battle script 会被重置，必须重贴**（回到第 1 节）；重连后也建议跑一次第 1.4 步核对 `PKLM_VERSION`。
- 设计如此：对局中掉线时 po-script 的 `onReconnect` 会 `battleEnd = true` 并 30s 后认输，别指望它续打。

## 通用坑（都是实机踩过的）

- **锁屏时什么都做不了**：终端进程拿不到剪贴板（`Set-Clipboard` / `clip.exe` 报 `Access is denied`），GUI 点击/输入也送不进去 → 先让对方解锁屏幕。
- **读文件要用 UTF-8**：`Get-Content -Raw` 在这台机器上是 Windows PowerShell 5.1，默认按系统 ANSI(GBK) 解码 → 中文全变 `鈥?` 之类的乱码。用 `[System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)`（两个 helper 脚本已封装）。
- 别用 C 风格三元 `?:`（PS 5.1 不支持，会 ParserError）——用 `if/else`。
- 别用 Notepad 做剪贴板中转：它会被 Trae 沙箱拦掉状态文件后退出。剪贴板直接用 PowerShell。
- 脚本改完要**重贴才生效**；`PKLM_VERSION`（脚本）/`SERVER_VERSION`（8092）是判断「当前到底跑哪版」的唯一可信来源。
