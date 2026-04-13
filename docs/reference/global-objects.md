# 全局对象参考文档

本文档记录了从宝可梦战斗AI系统运行环境中读取到的全局对象、函数和变量。

## 全局对象

### 1. 系统函数

| 函数名 | 描述 |
|-------|------|
| `print()` | 打印函数，用于输出信息到控制台 |
| `gc()` | 垃圾回收函数 |
| `version()` | 版本函数，返回系统版本信息 |

### 2. 核心对象

| 对象名 | 类型 | 描述 |
|-------|------|------|
| `sys` | ScriptEngine | 系统引擎对象，包含系统相关功能 |
| `client` | Client | 客户端对象，包含客户端相关功能 |
| `Qt` | Object | Qt框架对象，包含Qt相关功能 |
| `global` | Object | 全局对象本身 |
| `battle` | BattleWindow | 对战窗口对象，包含对战相关功能 |
| `script` | Object | 脚本对象，包含所有回调函数 |

#### script 对象的回调函数

script 对象包含以下回调函数：

| 回调函数 | 参数 | 描述 |
|---------|------|------|
| `onBeginTurn` | turn | 回合开始时调用 |
| `onMiss` | spot | 攻击未命中时调用 |
| `onAvoid` | spot | 攻击被避开时调用 |
| `onStatusDamage` | spot, status | 状态异常造成伤害时调用 |
| `onKo` | spot | 宝可梦被击倒时调用 |
| `onUseAttack` | spot, attack | 宝可梦使用技能时调用 |
| `onSendBack` | spot | 宝可梦被收回时调用 |
| `onSendOut` | spot, prevIndex | 宝可梦被派出时调用 |
| `onItemMessage` | spot, item, part, foe, berry, other | 道具使用时调用 |
| `onMoveMessage` | spot, move, part, type, foe, other, q | 技能使用产生消息时调用 |
| `onAbilityMessage` | spot, ab, part, type, foe, other | 特性触发时调用 |
| `onTierNotification` | tier | 接收到对战分级通知时调用 |
| `onClauseActivated` | clause | 规则激活时调用 |
| `onEffectiveness` | spot, effectiveness | 技能效果产生时调用 |
| `onAttackFailing` | spot, silent | 攻击失败时调用 |
| `onBattleEnd` | result, winner | 对战结束时调用 |
| `onDamageDone` | spot, damage | 宝可梦受到伤害时调用 |
| `onOfferChoice` | player, choice | 系统提供选择时调用 |
| `onChoiceSelection` | player | 需要进行对战决策时调用 |
| `onCriticalHit` | spot | 攻击造成会心一击时调用 |
| `onChoiceCancellation` | player | 选择被取消时调用 |
| `onDrawRequest` | player | 请求平局时调用 |
| `onChoiceCancelled` | player | 选择已被取消时调用 |
| `onMajorStatusChange` | spot, status, multipleTurns, silent | 宝可梦状态发生重大变化时调用 |
| `onStatusOver` | spot, status | 宝可梦状态结束时调用 |
| `onFlinch` | spot | 宝可梦畏缩时调用 |
| `onPlayerMessage` | player, message | 玩家发送消息时调用，包含/eval命令处理 |
| `onReconnect` | player | 玩家重新连接时调用 |

### 3. 全局变量

| 变量名 | 值 | 描述 |
|-------|-----|------|
| `useAI` | true | 是否使用AI |
| `battleEnd` | false | 对战是否结束 |
| `srcname` | "Test Battle" | 脚本名称 |
| `canCloseWindow` | false | 是否可以关闭窗口 |

### 4. 自定义函数

| 函数名 | 描述 |
|-------|------|
| `print_s(message)` | 测试消息打印函数，输出带[TEST]前缀的消息 |
| `send(message)` | 发送消息函数，输出带[SEND]前缀的消息 |
| `nick(spot)` | 宝可梦昵称函数，根据位置返回不同的昵称 |

## 读取方法

### 读取全局对象
```javascript
for(var prop in global){if(global.hasOwnProperty(prop)){print(prop+": "+global[prop]);}}
```

### 读取特定对象
```javascript
// 读取sys对象
for(var prop in sys){if(sys.hasOwnProperty(prop)){print(prop+": "+sys[prop]);}}

// 读取client对象
for(var prop in client){if(client.hasOwnProperty(prop)){print(prop+": "+client[prop]);}}

// 读取Qt对象
for(var prop in Qt){if(Qt.hasOwnProperty(prop)){print(prop+": "+Qt[prop]);}}

// 读取battle对象
for(var prop in battle){if(battle.hasOwnProperty(prop)){print(prop+": "+battle[prop]);}}

// 读取script对象
for(var prop in script){if(script.hasOwnProperty(prop)){print(prop+": "+script[prop]);}}
```

## 注意事项

- 本文档基于实际运行环境中读取的结果，不同环境可能会有所差异
- 某些对象可能包含更多未列出的属性和方法，需要根据实际情况进行探索
- 在使用这些对象和函数时，请注意兼容性问题，避免使用现代JavaScript特性

## 后续工作

- 进一步探索sys、client、Qt、battle和script对象的具体属性和方法
- 记录更多与对战相关的全局对象和函数
- 分析这些对象在战斗AI中的应用场景
