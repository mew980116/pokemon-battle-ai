# battle 对象参考

`battle` 对象是宝可梦战斗AI系统中的核心对象，用于控制当前对战的窗口行为、对战指令以及获取对战中的数据。

## 主要功能

1. **控制对战窗口行为**
2. **执行对战指令**
3. **获取对战中的实时数据**
4. **管理对战状态**

## 常用属性

### 1. `battle.me`
- **类型**：对象
- **描述**：当前玩家的对战信息
- **包含属性**：
  - `pokemon`：当前活跃的宝可梦信息
  - `team`：玩家的队伍信息
  - `status`：玩家的状态信息

### 2. `battle.opp`
- **类型**：对象
- **描述**：对手的对战信息
- **包含属性**：
  - `pokemon`：对手当前活跃的宝可梦信息
  - `team`：对手的队伍信息
  - `status`：对手的状态信息

### 3. `battle.turn`
- **类型**：Number
- **描述**：当前对战的回合数

### 4. `battle.weather`
- **类型**：Number
- **描述**：当前的天气状态

### 5. `battle.field`
- **类型**：Number
- **描述**：当前的场地状态

## 常用方法

### 1. `battle.battleCommand(id, choice)`
- **功能**：执行对战指令
- **参数**：
  - `id`：指令ID
  - `choice`：选择的动作
- **返回值**：无
- **示例**：`battle.battleCommand(1, 0)` // 执行攻击指令

### 2. `battle.getFieldState()`
- **功能**：获取当前场地状态
- **参数**：无
- **返回值**：场地状态对象

### 3. `battle.getWeatherState()`
- **功能**：获取当前天气状态
- **参数**：无
- **返回值**：天气状态对象

### 4. `battle.getTeamInfo()`
- **功能**：获取队伍信息
- **参数**：无
- **返回值**：队伍信息对象

## 使用示例

```javascript
// 执行攻击指令
sys.setTimer(function () {
    battle.battleCommand(id, choice);
    canCloseWindow = true;
}, 1000, 0);

// 获取对手宝可梦信息
var foePokemon = fpoke(battle.opp).pokemon;
var foeLevel = foePokemon.level;
var foeHP = foePokemon.life / foePokemon.totalLife;

// 检查对手是否被击倒
if (fpoke(battle.opp).pokemon.isKoed()) {
    // 处理对手被击倒的情况
}
```

## 注意事项

- `battle` 对象是系统提供的全局对象，不需要手动创建
- 对战指令的具体参数和值需要参考系统文档
- 部分方法可能需要特定的权限或条件才能调用