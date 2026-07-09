# PO 对战看板

实时展示 Pokemon-Online (PO) 对战状态的看板。**纯看板（不含 AI 决策）**，用于直播/视频背景或对战观摩。手动打或观战时显示双方场上/场下、状态、能力等级、招式、天气场地等。

## 架构

```
PO battle script (board-standalone.js)
  回调采集状态 → sys.webCall POST(state=<json>) ─┐
                                                  ▼
                                   Node 服务 (server.js, 零依赖)
                                   ├─ POST /state   解析 form 存内存最新状态
                                   ├─ GET  /events  SSE 推送（新连接补发最新）
                                   └─ GET  /        静态托管 index.html
                                                  ▼
                                   浏览器 (index.html)
                                   EventSource 收状态 → render() 渲染
                                   连不上 / 无推送 → 播 demo 剧本
```

## 文件

| 文件 | 作用 |
|---|---|
| [board-standalone.js](board-standalone.js) | 纯看板 battle script，贴进 PO battle script 窗口（无 AI） |
| [server.js](server.js) | Node 零依赖服务（POST /state + SSE /events + 静态托管） |
| [index.html](index.html) | 看板前端（4 区布局 + 19 帧 demo 剧本 + EventSource 接 live） |
| [archive/](archive/) | 早期 webCall 可用性验证脚本（verify-server / verify-battle + 终端输出），已被取代，留作参考 |

## 用法

1. **起 Node 服务**：
   ```
   node board/server.js
   ```
   默认监听 `http://127.0.0.1:8080`，看到 `Waiting for PO state pushes...` 即就绪。

2. **PO 根目录**放 `movedata.json`（用于招式威力显示；没有也能用，威力显示 0）。

3. **PO battle script 窗口**：贴 `board-standalone.js` 全文，启用脚本。

4. **浏览器**开 `http://127.0.0.1:8080/`。

5. **开一场对战**（手动打或观战）→ 看板从 demo 切 `LIVE · 实时`，随对战刷新。

## 看板布局

```
┌────────────── PO 占位 21:9 ──────────────┐ ┌── 信息区 ──┐
│  （直播时 OBS 叠加 PO 窗口于此）          │ │ Turn·天气·场地│
│                                          │ │ 1区 对手6只   │
│                                          │ │ 2区 对手场上   │
│                                          │ │ 3区 我方场上   │
│                                          │ │ 4区 我方6只   │
└──────────────────────────────────────────┘ └────────────┘
```

- **1区** 对手 6 只：HP% + 异常状态（卡片背景色，实机风格）
- **2区** 对手场上：HP% + 异常 + 能力等级（Atk/Def/SpA/SpD/Spe/Acc/Eva 固定一行）+ 等级 + 属性
- **3区** 我方场上：HP/总HP + 异常 + 能力等级 + 等级 + 属性 + 4 招式（属性/PP）
- **4区** 我方 6 只：HP% + 异常 + 4 招式
- **顶栏** Turn + Weather + Terrain

异常状态色：烧伤橙、中毒紫、麻痹黄、睡眠蓝、冰冻浅蓝。KO 红色调划线。对手 HP 只显百分比（PO 不给具体值）；对手后备未露面显 `???`。

## 数据契约

`board-standalone.js` 推送的 state 结构 = `index.html` 渲染期望：

```
{
  turn, weather, terrain,
  me: {
    active: { name, level, types[], hp, maxHp, hpPct, status, boosts{atk,def,spa,spd,spe,acc,eva}, ability, item, moves[{name,type,power,pp,maxPp}] },
    bench: [ {name,level,types,hp,maxHp,hpPct,status,ko,moves[]} ×5 ],
    hazards: { stealthRocks, spikes, toxicSpikes, stickyWeb }
  },
  opp: {
    active: { name, level, types[], hpPct, status, boosts{}, ability, item, moves },  // 仅 HP%，无 hp/maxHp
    bench: [ {name, revealed, ko, hpPct} ×5 ],   // 未露面 name=null
    hazards: { ... }
  },
  battleLog: [],      // 预留（未来战报流）
  aiDecision: null    // 预留（未来 AI 决策链）
}
```

## 联调验证点（真实 PO 推送时确认）

1. **对手后备可见性**：PO 是否暴露 `battle.data.team(battle.opp).poke(i).numRef`。不暴露则对手后备全 `???`。standalone 没自带 `/eval`，验证需临时加 `print_s(...)`。
2. **对手场上槽位**：假设 `team(opp).poke(0)`=场上（同主脚本 `poke()` 约定），联调确认。
3. **中文编码**：PO webCall 推中文 state，看 Node 控制台/看板是否乱码。若乱码，`board-standalone.js` 的 `pushBoard` 改用 `encodeURIComponent(JSON.stringify(state))`。
4. **招式 totalPP**：`tpoke(i).move(i).totalPP` 是否可靠。不可靠则 `maxPp=pp`（低 PP 高亮失真）。
5. **terrain 编号**：`1=electric 2=grassy 3=misty 4=psychic`（已从主脚本威力计算确认，见 [20201227_v1.3.1.js:2447-2451](../20201227_v1.3.1.js#L2447-L2451)）。

## 约束

- `board-standalone.js` 是 QScript pre-ES6（`var`/`function`/字符串拼接/`for` 循环，无箭头/模板/`let`/`const`/`forEach`）。
- 只读采集，不写引擎状态；每只精灵/每字段独立 `try/catch`，失败填占位不崩。
- 不含 AI 决策：`onOfferChoice`/`onChoiceSelection` 空，PO 让你在客户端界面手动选招。
- `boardEnabled=false` 可关推送（文件顶部配置）。
- 节流 250ms，关键回调（回合/换人/KO/状态/结束）force 必推。

## 历史

`archive/` 里的 verify 脚本验证了关键前提：`sys.webCall` 在 battle 回调里可用、异步不阻塞、args 以 `application/x-www-form-urlencoded` 发送（见 `archive/verify-battle-terminal.txt`，一场 24 回合对战全部 POST 到达）。这决定了整体架构走 webCall 而非写文件轮询。
