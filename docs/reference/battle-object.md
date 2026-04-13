# Battle 对象参考文档

本文档记录了从宝可梦战斗AI系统运行环境中读取到的battle对象的属性和方法。

## Battle 对象属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `me` | 0 | 我方玩家标识符 |
| `opp` | 1 | 对方玩家标识符 |
| `id` | 21479 | 对战ID |
| `isbattle` | true | 是否在对战中 |
| `data` | ProxyDataContainer(name = "") | 对战数据容器，包含对战相关的详细数据 |
| `windowTitle` | 与千早爱音战斗中 | 对战窗口标题 |
| `width` | 1227 | 窗口宽度 |
| `height` | 656 | 窗口高度 |
| `x` | 257 | 窗口X坐标 |
| `y` | 258 | 窗口Y坐标 |
| `visible` | true | 窗口是否可见 |
| `isActiveWindow` | true | 是否为活动窗口 |
| `objectName` | | 对象名称 |
| `modal` | false | 是否为模态窗口 |
| `enabled` | true | 是否启用 |

## Battle 对象方法

### 1. 对战操作相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `battleCommand(int, BattleChoice)` | 发送对战指令 | 执行对战操作，如攻击、交换等 |
| `battleMessage(int, QString)` | 显示对战消息 | 输出对战相关信息 |
| `player(int)` | 获取玩家信息 | 获取我方玩家数据 |
| `opponent(int)` | 获取对手信息 | 获取对方玩家数据 |
| `forfeit()` | 认输 | 结束对战并认输 |
| `forfeit(int)` | 认输 | 结束对战并认输 |
| `offerTie()` | 提议平局 | 向对方提议平局 |
| `offerTie(int)` | 提议平局 | 向对方提议平局 |
| `sendMessage()` | 发送消息 | 发送对战消息 |

### 2. 宝可梦选择相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `switchClicked(int)` | 交换宝可梦 | 处理宝可梦交换操作 |
| `attackClicked(int)` | 选择攻击 | 处理技能选择操作 |
| `zmoveClicked(bool)` | 选择Z招式 | 处理Z招式使用操作 |
| `targetChosen(int)` | 选择目标 | 处理技能目标选择 |
| `switchToPokeZone()` | 切换到宝可梦区域 | 打开宝可梦选择界面 |
| `sendRearrangedTeam()` | 发送重排队伍 | 发送重新排列后的队伍 |
| `changeAttackText(int)` | 改变攻击文本 | 更新攻击按钮的文本 |

### 3. 窗口管理相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `show()` | 显示窗口 | 显示对战窗口 |
| `hide()` | 隐藏窗口 | 隐藏对战窗口 |
| `close()` | 关闭窗口 | 关闭对战窗口 |
| `showMinimized()` | 最小化窗口 | 最小化对战窗口 |
| `showMaximized()` | 最大化窗口 | 最大化对战窗口 |
| `showFullScreen()` | 全屏显示 | 全屏显示对战窗口 |
| `showNormal()` | 正常显示 | 以正常大小显示对战窗口 |
| `raise()` | 提升窗口 | 将窗口置于顶层 |
| `lower()` | 降低窗口 | 将窗口置于底层 |
| `clickClose()` | 点击关闭 | 模拟点击关闭按钮 |

### 4. 音频相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `playCry(int)` | 播放宝可梦叫声 | 播放指定宝可梦的叫声 |
| `changeCryVolume(int)` | 改变叫声音量 | 调整宝可梦叫声的音量 |
| `changeMusicVolume(int)` | 改变音乐音量 | 调整对战音乐的音量 |
| `musicPlayStop()` | 停止音乐 | 停止对战音乐 |
| `criesPlayStop()` | 停止叫声 | 停止宝可梦叫声 |
| `enqueueMusic()` | 加入音乐队列 | 将音乐加入播放队列 |

### 5. 其他方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `delay(qlonglong)` | 延迟 | 延迟执行操作 |
| `delay()` | 延迟 | 延迟执行操作 |
| `undelay()` | 取消延迟 | 取消延迟操作 |
| `openCalc()` | 打开计算器 | 打开伤害计算器 |
| `ignoreSpectators()` | 忽略旁观者 | 忽略对战旁观者 |
| `alwaysOnTopChanged(bool)` | 总是置顶变更 | 更改窗口总是置顶状态 |
| `alwaysOnTopChanged(bool, bool)` | 总是置顶变更 | 更改窗口总是置顶状态 |
| `attackButton()` | 获取攻击按钮 | 获取攻击按钮对象 |
| `emitCancel()` | 发出取消信号 | 取消当前操作 |
| `nullQuestion()` | 空问题 | 处理空问题 |
| `questionButtonClicked(QAbstractButton*)` | 问题按钮点击 | 处理问题按钮点击事件 |
| `closedBW(int)` | 关闭对战窗口 | 关闭对战窗口并处理相关事件 |
| `onDisconnection()` | 断开连接 | 处理断开连接事件 |
| `itemActivated(QListWidgetItem*)` | 项目激活 | 处理列表项目激活事件 |

### 6. Qt对象相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |
| `setEnabled(bool)` | 设置启用状态 | 启用或禁用对象 |
| `setDisabled(bool)` | 设置禁用状态 | 禁用或启用对象 |
| `setWindowModified(bool)` | 设置窗口修改状态 | 标记窗口是否被修改 |
| `setWindowTitle(QString)` | 设置窗口标题 | 更改窗口标题 |
| `setStyleSheet(QString)` | 设置样式表 | 更改窗口样式 |
| `setFocus()` | 设置焦点 | 使窗口获得焦点 |
| `update()` | 更新窗口 | 刷新窗口显示 |
| `repaint()` | 重绘窗口 | 强制重绘窗口 |
| `setVisible(bool)` | 设置可见性 | 显示或隐藏窗口 |
| `setHidden(bool)` | 设置隐藏性 | 隐藏或显示窗口 |
| `customContextMenuRequested(QPoint)` | 自定义上下文菜单请求 | 处理右键菜单请求 |
| `updateMicroFocus()` | 更新微焦点 | 更新输入焦点 |
| `grab()` | 抓取窗口 | 抓取窗口内容 |
| `grab(QRect)` | 抓取窗口区域 | 抓取窗口指定区域 |

## 读取方法

```javascript
// 读取battle对象的所有属性
for(var prop in battle){if(battle.hasOwnProperty(prop)){print(prop+": "+battle[prop]);}}
```

### 遍历battle.data对象

```javascript
// 读取battle.data对象的所有属性
for(var prop in battle.data){if(battle.data.hasOwnProperty(prop)){print("data."+prop+": "+battle.data[prop]);}}
```

## battle.data 对象

battle.data是一个FieldProxy对象，包含了对战相关的详细数据。它是战斗AI获取对战信息的重要来源，通过它可以访问到对战中的各种数据。

### battle.data 属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `field` | FieldProxy(name = "") | 对战场地数据 |

### battle.data 方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `team(int)` | 获取队伍信息 | 获取指定玩家的队伍数据 |
| `avatar(int)` | 获取头像信息 | 获取指定玩家的头像数据 |
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

### 可能包含的信息类型

- 宝可梦信息：双方宝可梦的详细数据，包括等级、技能、特性、道具等
- 对战状态：当前对战的状态，如回合数、天气、场地效果等
- 玩家信息：双方玩家的信息，如队伍配置、剩余宝可梦等
- 战斗记录：对战过程中的各种事件记录
- 场地信息：对战场地的状态和效果

通过遍历battle.data对象及其子对象，开发者可以获取到更详细的对战信息，为战斗AI的决策提供依据。

### battle.data.field 对象

battle.data.field是一个FieldProxy对象，包含了对战场地相关的信息。

#### battle.data.field 属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `weather` | 0 | 天气状态（0可能表示无天气） |
| `terrain` | 1072064102 | 场地状态 |

#### battle.data.field 方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `poke(int)` | 获取宝可梦信息 | 获取指定位置的宝可梦数据 |
| `zone(int)` | 获取区域信息 | 获取指定区域的数据 |
| `weatherChanged()` | 天气变化事件 | 监听天气变化 |
| `terrainChanged()` | 场地变化事件 | 监听场地变化 |
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

### battle.data.field.poke 对象

battle.data.field.poke是一个返回PokeProxy对象的方法，用于获取指定位置的宝可梦信息。

#### battle.data.field.poke 属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `onTheField` | true | 是否在场上 |
| `substitute` | false | 是否有替身 |
| `showing` | true | 是否显示 |
| `alternateSprite` | 0 | 替代 sprite 索引 |
| `pokemon` | PokeProxy(name = "") | 宝可梦详细数据 |

#### battle.data.field.poke 方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `statUp(int, int)` | 提升能力值 | 提升指定能力值的等级 |
| `statDown(int, int)` | 降低能力值 | 降低指定能力值的等级 |
| `gen()` | 获取世代 | 获取宝可梦的世代 |
| `statBoost(int)` | 获取能力值提升 | 获取指定能力值的提升等级 |
| `stat(int)` | 获取能力值 | 获取指定能力值的当前值 |
| `minStat(int)` | 获取最小能力值 | 获取指定能力值的最小值 |
| `maxStat(int)` | 获取最大能力值 | 获取指定能力值的最大值 |
| `type1()` | 获取第一属性 | 获取宝可梦的第一属性 |
| `type2()` | 获取第二属性 | 获取宝可梦的第二属性 |
| `onTheFieldChanged()` | 场上状态变化事件 | 监听宝可梦场上状态变化 |
| `substituteChanged()` | 替身状态变化事件 | 监听宝可梦替身状态变化 |
| `showingChanged()` | 显示状态变化事件 | 监听宝可梦显示状态变化 |
| `alternateSpriteChanged()` | 替代 sprite 变化事件 | 监听宝可梦替代 sprite 变化 |
| `pokemonChanged()` | 宝可梦变化事件 | 监听宝可梦数据变化 |
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

### battle.data.field.poke(0).pokemon 对象

battle.data.field.poke(0).pokemon是一个PokeProxy对象，包含了宝可梦的详细信息。

#### battle.data.field.poke(0).pokemon 属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `nick` | Cobalion | 宝可梦昵称 |
| `pokeName` | 勾帕路翁 | 宝可梦中文名称 |
| `status` | 0 | 状态异常（0表示正常） |
| `num` | QVariant(Pokemon::uniqueId) | 宝可梦唯一ID |
| `shiny` | false | 是否为闪光宝可梦 |
| `gender` | 0 | 性别（0可能表示无性别） |
| `level` | 66 | 宝可梦等级 |
| `numRef` | 638 | 宝可梦图鉴编号 |
| `ability` | 0 | 特性编号 |
| `life` | 235 | 当前HP |
| `lifePercent` | 100 | 当前HP百分比 |
| `totalLife` | 235 | 总HP |
| `happiness` | 254 | 亲密度 |
| `item` | 8015 | 携带道具编号 |
| `nature` | 3 | 性格编号 |
| `hiddenPower` | 11 | 隐藏 power 类型 |

#### battle.data.field.poke(0).pokemon 方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `ko()` | 宝可梦昏厥 | 检查宝可梦是否昏厥 |
| `basestat(int)` | 获取种族值 | 获取指定属性的种族值 |
| `iv(int)` | 获取个体值 | 获取指定属性的个体值 |
| `ev(int)` | 获取努力值 | 获取指定属性的努力值 |
| `move(int)` | 获取技能 | 获取指定位置的技能 |
| `isKoed()` | 检查是否昏厥 | 检查宝可梦是否昏厥 |
| `numChanged()` | 编号变化事件 | 监听宝可梦编号变化 |
| `abilityChanged()` | 特性变化事件 | 监听宝可梦特性变化 |
| `statusChanged()` | 状态变化事件 | 监听宝可梦状态变化 |
| `pokemonReset()` | 宝可梦重置 | 重置宝可梦状态 |
| `lifeChanged()` | 生命值变化事件 | 监听宝可梦生命值变化 |
| `itemChanged()` | 道具变化事件 | 监听宝可梦道具变化 |
| `totalLifeChanged()` | 总生命值变化事件 | 监听宝可梦总生命值变化 |
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

### battle.data.field.poke(0).pokemon.move 对象

battle.data.field.poke(0).pokemon.move是一个返回MoveProxy对象的方法，用于获取指定位置的技能信息。

#### battle.data.field.poke(0).pokemon.move 属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `PP` | 56 | 当前PP值 |
| `totalPP` | 56 | 总PP值 |
| `num` | 232 | 技能编号 |

#### battle.data.field.poke(0).pokemon.move 方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `numChanged()` | 技能编号变化事件 | 监听技能编号变化 |
| `PPChanged()` | PP值变化事件 | 监听技能PP值变化 |
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

### battle.data.field.zone 对象

battle.data.field.zone是一个返回ZoneProxy对象的方法，用于获取指定位置的对战区域信息。

#### battle.data.field.zone 属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `spikesLevel` | 0 | 尖刺等级 |
| `toxicSpikesLevel` | 0 | 毒尖刺等级 |
| `stealthRocks` | false | 是否有隐形岩 |
| `stickyWeb` | false | 是否有黏黏网 |

#### battle.data.field.zone 方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `spikesChanged()` | 尖刺变化事件 | 监听尖刺状态变化 |
| `tspikesChanged()` | 毒尖刺变化事件 | 监听毒尖刺状态变化 |
| `rocksChanged()` | 隐形岩变化事件 | 监听隐形岩状态变化 |
| `stickyWebChanged()` | 黏黏网变化事件 | 监听黏黏网状态变化 |
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

## 注意事项

- 本文档基于实际运行环境中读取的结果，不同环境可能会有所差异
- 某些属性和方法可能需要特定的权限或条件才能访问
- 在使用这些属性和方法时，请注意兼容性问题，避免使用现代JavaScript特性
- battle对象是宝可梦战斗AI系统中与对战直接相关的核心对象，提供了执行对战操作的接口
- 对战操作相关方法（如battleCommand、player、opponent等）是战斗AI与对战系统交互的关键
- 宝可梦选择相关方法（如switchClicked、attackClicked等）用于处理宝可梦和技能的选择
- 窗口管理和音频相关方法主要用于控制对战窗口的显示和声音效果

## 后续工作

- 进一步探索battle对象的对战操作相关方法的具体用法
- 记录更多与战斗AI决策相关的battle对象方法的使用案例
- 分析这些方法在战斗AI对战决策过程中的应用场景
- 整理battle对象方法的参数和返回值的详细说明
- 编写battle对象方法的使用示例，帮助开发者更好地理解和使用这些方法
- 探索battle.data对象的结构和功能，了解其包含的对战数据
- 深入研究battle.data.field对象的属性和方法，获取对战场地相关信息
- 分析battle.data.team(int)方法的返回值结构，了解队伍数据的组织方式
- 探索battle.data.avatar(int)方法的返回值，了解头像相关信息
- 研究battle.data.field.poke(int)方法的返回值结构，获取宝可梦详细数据
- 探索battle.data.field.poke(int).pokemon对象的属性和方法，获取宝可梦的详细信息
- 探索battle.data.field.poke(int).pokemon.move(int)方法的返回值，了解宝可梦技能信息
- 深入研究battle.data.field.zone(int)方法的返回值，了解对战区域的陷阱和状态信息
- 分析weather和terrain属性的含义和可能的取值范围
- 整理battle.data.field.zone对象的属性和方法，分析其在战斗中的影响

