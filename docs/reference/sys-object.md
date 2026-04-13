# Sys 对象参考文档

本文档记录了从宝可梦战斗AI系统运行环境中读取到的sys对象的属性和方法。

## Sys 对象属性

| 属性名 | 值 | 描述 |
|-------|-----|------|
| `objectName` | | 对象名称 |
| `scriptsFolder` | C:/Users/85145/AppData/Local/Dreambelievers/Pokemon-Online/Scripts/ | 脚本文件夹路径 |

## Sys 对象方法

### 1. 宝可梦数据相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `pokeType1(int)` | 获取宝可梦的第一属性 | 分析宝可梦属性克制关系 |
| `pokeType1(int, int)` | 获取指定世代宝可梦的第一属性 | 分析不同世代宝可梦的属性 |
| `pokeType2(int)` | 获取宝可梦的第二属性 | 分析宝可梦属性克制关系 |
| `pokeType2(int, int)` | 获取指定世代宝可梦的第二属性 | 分析不同世代宝可梦的属性 |
| `type(int)` | 获取属性名称 | 用于显示和分析 |
| `typeNum(QString)` | 获取属性编号 | 用于属性计算 |
| `pokemon(int)` | 获取宝可梦名称 | 用于显示和分析 |
| `pokeNum(QString)` | 获取宝可梦编号 | 用于数据查询 |
| `move(int)` | 获取技能名称 | 用于显示和分析 |
| `moveNum(QString)` | 获取技能编号 | 用于数据查询 |
| `moveType(int)` | 获取技能属性 | 分析技能克制关系 |
| `moveType(int, int)` | 获取指定世代技能的属性 | 分析不同世代技能的属性 |
| `item(int)` | 获取道具名称 | 分析道具效果 |
| `itemNum(QString)` | 获取道具编号 | 用于数据查询 |
| `nature(int)` | 获取性格名称 | 分析性格对属性的影响 |
| `natureNum(QString)` | 获取性格编号 | 用于数据查询 |
| `ability(int)` | 获取特性名称 | 分析特性效果 |
| `abilityNum(QString)` | 获取特性编号 | 用于数据查询 |
| `gender(int)` | 获取性别名称 | 分析性别对战斗的影响 |
| `genderNum(QString)` | 获取性别编号 | 用于数据查询 |
| `pokeAbility(int, int, int)` | 获取宝可梦的特性 | 分析宝可梦特性 |
| `pokeAbility(int, int)` | 获取宝可梦的特性 | 分析宝可梦特性 |
| `baseStats(int, int, int)` | 获取宝可梦种族值 | 计算宝可梦能力值 |
| `baseStats(int, int)` | 获取宝可梦种族值 | 计算宝可梦能力值 |
| `pokeBaseStats(int, int)` | 获取宝可梦种族值 | 计算宝可梦能力值 |
| `pokeBaseStats(int)` | 获取宝可梦种族值 | 计算宝可梦能力值 |

### 2. 脚本管理相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `changeBattleScript(QString)` | 更改对战脚本 | 切换不同的战斗AI |
| `changeScript(QString)` | 更改脚本 | 切换脚本 |
| `changeScript(QString, bool)` | 更改脚本 | 切换脚本 |
| `getScript()` | 获取当前脚本 | 用于调试和分析 |
| `scriptsChanged(QString)` | 脚本变更事件 | 监听脚本变化 |
| `setMoogleScripts()` | 设置Moogle脚本 | 配置Moogle脚本 |

### 3. 输出与界面相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `print(QScriptContext*, QScriptEngine*)` | 打印信息 | 输出调试信息 |
| `clearChat()` | 清空聊天 | 清理聊天窗口 |
| `htmlEscape(QString)` | HTML转义 | 处理HTML内容 |
| `beep()` | 发出蜂鸣声 | 提醒用户 |
| `playSound(QString)` | 播放声音 | 播放音效 |
| `validColor(QString)` | 验证颜色 | 检查颜色有效性 |
| `hexColor(QString)` | 获取十六进制颜色 | 处理颜色值 |

### 4. 定时器相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `setTimer(QScriptValue, int, bool)` | 设置定时器 | 用于延时执行任务 |
| `unsetTimer(int)` | 取消定时器 | 停止定时任务 |
| `unsetAllTimers()` | 取消所有定时器 | 停止所有定时任务 |
| `stopTimer(int)` | 停止定时器 | 停止指定定时器 |
| `callLater(QString, int)` | 延时调用函数 | 用于异步操作 |
| `callQuickly(QString, int)` | 快速调用函数 | 用于快速执行任务 |
| `quickCall(QScriptValue, int)` | 快速调用函数 | 用于快速执行任务 |
| `delayedCall(QScriptValue, int)` | 延时调用函数 | 用于异步操作 |
| `intervalTimer(QString, int)` | 间隔定时器 | 用于周期性任务 |
| `intervalCall(QScriptValue, int)` | 间隔调用函数 | 用于周期性任务 |

### 5. 文件系统相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `getFileContent(QString)` | 获取文件内容 | 读取配置和数据文件 |
| `writeToFile(QString, QString)` | 写入文件 | 保存数据和配置 |
| `appendToFile(QString, QString)` | 追加文件内容 | 记录日志 |
| `deleteFile(QString)` | 删除文件 | 删除文件 |
| `fileExists(QString)` | 检查文件是否存在 | 验证文件路径 |
| `makeDir(QString)` | 创建目录 | 创建文件夹 |
| `removeDir(QString)` | 删除目录 | 删除文件夹 |
| `getCurrentDir()` | 获取当前目录 | 用于路径计算 |
| `filesForDirectory(QString)` | 获取目录中的文件 | 列出目录文件 |
| `dirsForDirectory(QString)` | 获取目录中的子目录 | 列出子目录 |
| `zip(QString, QString)` | 压缩文件 | 压缩文件 |
| `extractZip(QString, QString)` | 解压文件 | 解压文件 |
| `extractZip(QString)` | 解压文件 | 解压文件 |

### 6. 存储相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `saveVal(QString, QVariant)` | 保存值 | 存储配置数据 |
| `removeVal(QString)` | 删除值 | 删除配置数据 |
| `getVal(QString)` | 获取值 | 读取配置数据 |
| `getValKeys()` | 获取所有键 | 列出所有配置键 |
| `saveRegVal(QString, QVariant)` | 保存注册表值 | 存储系统配置 |
| `removeRegVal(QString)` | 删除注册表值 | 删除系统配置 |
| `getRegVal(QString)` | 获取注册表值 | 读取系统配置 |
| `getRegKeys()` | 获取所有注册表键 | 列出所有系统配置键 |

### 7. 网络相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `webCall(QString, QScriptValue)` | 网络调用 | 发送HTTP请求 |
| `webCall(QString, QScriptValue, QScriptValue)` | 网络调用 | 发送HTTP请求 |
| `synchronousWebCall(QString)` | 同步网络调用 | 同步发送HTTP请求 |
| `synchronousWebCall(QString, QScriptValue)` | 同步网络调用 | 同步发送HTTP请求 |
| `hostName(QString, QScriptValue)` | 获取主机名 | 解析主机名 |

### 8. 安全与系统相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `sha1(QString)` | SHA1哈希 | 计算哈希值 |
| `md4(QString)` | MD4哈希 | 计算哈希值 |
| `md5(QString)` | MD5哈希 | 计算哈希值 |
| `isSafeScripts()` | 检查脚本安全性 | 验证脚本安全 |
| `showingWarnings()` | 检查是否显示警告 | 检查警告设置 |
| `os()` | 获取操作系统 | 检查系统环境 |
| `version()` | 获取系统版本 | 用于版本兼容性检查 |
| `rand(int, int)` | 生成随机数 | 用于随机决策 |
| `time()` | 获取当前时间 | 用于计时和排序 |
| `eval()` | 执行JavaScript代码 | 用于动态执行代码 |
| `backtrace()` | 获取调用栈 | 用于调试 |
| `stopEvent()` | 停止事件 | 中断事件处理 |

### 9. Qt对象相关方法

| 方法名 | 描述 | 用途 |
|-------|------|------|
| `destroyed()` | 对象销毁事件 | 监听对象销毁 |
| `destroyed(QObject*)` | 对象销毁事件 | 监听对象销毁 |
| `objectNameChanged(QString)` | 对象名称变更事件 | 监听对象名称变化 |
| `deleteLater()` | 延迟删除对象 | 安全删除对象 |

## 读取方法

```javascript
// 读取sys对象的所有属性
for(var prop in sys){if(sys.hasOwnProperty(prop)){print(prop+": "+sys[prop]);}}
```

## 注意事项

- 本文档基于实际运行环境中读取的结果，不同环境可能会有所差异
- 某些属性和方法可能需要特定的权限或条件才能访问
- 在使用这些属性和方法时，请注意兼容性问题，避免使用现代JavaScript特性
- sys对象是宝可梦战斗AI系统中最核心的对象之一，提供了大量与宝可梦对战相关的功能
- 宝可梦数据相关方法（如pokeType1、moveType等）是战斗AI分析对战局势的基础
- 文件系统相关方法（如getFileContent、writeToFile等）用于读取和保存对战数据
- 定时器相关方法（如setTimer、delayedCall等）用于管理对战中的时间相关任务

## 后续工作

- 进一步探索sys对象的宝可梦数据相关方法的具体用法
- 记录更多与战斗AI相关的sys对象方法的使用案例
- 分析这些方法在战斗AI决策过程中的应用场景
- 整理sys对象方法的参数和返回值的详细说明
- 编写sys对象方法的使用示例，帮助开发者更好地理解和使用这些方法
