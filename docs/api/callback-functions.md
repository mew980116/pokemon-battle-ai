# 系统回调函数参考

本文件详细说明宝可梦战斗AI系统中使用的系统回调函数，这些函数在 `20201227.js` 文件的3397行到末尾定义。

## 回调函数列表

### 1. `onBeginTurn(turn)`
- **功能**：在每个回合开始时调用
- **参数**：
  - `turn`：当前回合数（Number）
- **作用**：记录回合开始信息，重置上一回合的事件记录

### 2. `onMiss(spot)`
- **功能**：当攻击未命中时调用
- **参数**：
  - `spot`：发出攻击的一方（battle.me 或 battle.opp）
- **作用**：处理攻击未命中的情况

### 3. `onAvoid(spot)`
- **功能**：当宝可梦避开攻击时调用
- **参数**：
  - `spot`：避开攻击的宝可梦（battle.me 或 battle.opp）
- **作用**：处理宝可梦避开攻击的情况

### 4. `onStatusDamage(spot, status)`
- **功能**：当宝可梦因状态异常受到伤害时调用
- **参数**：
  - `spot`：受到伤害的宝可梦（battle.me 或 battle.opp）
  - `status`：状态异常类型（Number，6表示混乱）
- **作用**：处理状态异常造成的伤害

### 5. `onKo(spot)`
- **功能**：当宝可梦被击倒时调用
- **参数**：
  - `spot`：被击倒的宝可梦（battle.me 或 battle.opp）
- **作用**：处理宝可梦被击倒的情况，输出相关信息

### 6. `onUseAttack(spot, attack)`
- **功能**：当宝可梦使用攻击技能时调用
- **参数**：
  - `spot`：使用技能的宝可梦（battle.me 或 battle.opp）
  - `attack`：使用的技能编号（Number）
- **作用**：记录使用的技能，分析对手的技能使用情况

### 7. `onSendBack(spot)`
- **功能**：当宝可梦被收回时调用
- **参数**：
  - `spot`：被收回的宝可梦（battle.me 或 battle.opp）
- **作用**：记录宝可梦被收回的情况

### 8. `onSendOut(spot, prevIndex)`
- **功能**：当宝可梦被派出时调用
- **参数**：
  - `spot`：被派出的宝可梦（battle.me 或 battle.opp）
  - `prevIndex`：之前的宝可梦索引（Number，0-5，表示队伍中的位置）
- **作用**：处理宝可梦派出的情况，加载新派出宝可梦的信息

### 9. `onItemMessage(spot, item, part, foe, berry, other)`
- **功能**：当宝可梦使用道具时调用
- **参数**：
  - `spot`：使用道具的宝可梦（battle.me 或 battle.opp）
  - `item`：道具消息编号（Number）
  - `part`：消息部分（Number，用于区分同一消息编号下的不同情况）
  - `foe`：是否是对手使用（Boolean）
  - `berry`：树果编号（Number）
  - `other`：其他信息（Number）
- **作用**：分析道具使用情况，记录对手的道具信息

### 10. `onMoveMessage(spot, move, part, type, foe, other, q)`
- **功能**：当技能使用产生消息时调用
- **参数**：
  - `spot`：使用技能的宝可梦（battle.me 或 battle.opp）
  - `move`：技能消息编号（Number）
  - `part`：消息部分（Number）
  - `type`：消息类型（Number，可能表示属性变化）
  - `foe`：是否是对手使用（Boolean）
  - `other`：其他信息（Number）
  - `q`：额外参数（Number）
- **作用**：分析技能使用的消息，获取技能效果信息

### 11. `onAbilityMessage(spot, ab, part, type, foe, other)`
- **功能**：当特性触发产生消息时调用
- **参数**：
  - `spot`：特性触发的宝可梦（battle.me 或 battle.opp）
  - `ab`：特性消息编号（Number）
  - `part`：消息部分（Number）
  - `type`：消息类型（Number，可能表示属性变化）
  - `foe`：是否是对手的特性（Boolean）
  - `other`：其他信息（Number）
- **作用**：分析特性触发的情况，获取对手的特性信息

### 12. `onTierNotification(tier)`
- **功能**：当接收到对战分级通知时调用
- **参数**：
  - `tier`：对战分级（String）
- **作用**：初始化对战信息，重置对战记忆

### 13. `onClauseActivated(clause)`
- **功能**：当对战规则被激活时调用
- **参数**：
  - `clause`：规则编号（Number，0-9，对应不同的对战规则）
- **作用**：处理规则激活的情况，记录超时等异常情况

### 14. `onEffectiveness(spot, effectiveness)`
- **功能**：当技能效果产生时调用
- **参数**：
  - `spot`：技能目标（battle.me 或 battle.opp）
  - `effectiveness`：效果倍率（Number，0表示无效，2表示效果不好（包括1/2和1/4伤害），4表示正常效果（1倍伤害），8表示效果很好（包括2倍和4倍伤害））
- **作用**：处理技能效果的情况，记录技能是否失败

### 15. `onAttackFailing(spot, silent)`
- **功能**：当攻击失败时调用
- **参数**：
  - `spot`：攻击目标（battle.me 或 battle.opp）
  - `silent`：是否静默失败（Boolean）
- **作用**：处理攻击失败的情况，记录技能是否失败

### 16. `onBattleEnd(result, winner)`
- **功能**：当对战结束时调用
- **参数**：
  - `result`：对战结果（String，"win"表示胜利，"tie"表示平局）
  - `winner`：获胜者（battle.me 或 battle.opp）
- **作用**：处理对战结束的情况，设置定时器关闭对战窗口

### 17. `onDamageDone(spot, damage)`
- **功能**：当宝可梦受到伤害时调用
- **参数**：
  - `spot`：受到伤害的宝可梦（battle.me 或 battle.opp）
  - `damage`：受到的伤害值（Number，如果是我方则为HP数值，对方则为HP百分比）
- **作用**：记录伤害信息，分析对手的伤害情况，输出伤害信息

### 18. `onOfferChoice(player, choice)`
- **功能**：当系统提供选择时调用
- **参数**：
  - `player`：选择的玩家（battle.me 或 battle.opp）
  - `choice`：选择类型（可能为undefined，表示实际回调没有传入这个参数）
- **作用**：处理系统提供的选择，分析战场情况，准备对战决策

### 19. `onChoiceSelection(player)`
- **功能**：当需要进行对战决策时调用
- **参数**：
  - `player`：选择的玩家（battle.me 或 battle.opp）
- **作用**：执行对战决策，调用attemptCommand函数进行实际的命令执行

### 20. `onCriticalHit(spot)`
- **功能**：当攻击造成会心一击时调用
- **参数**：
  - `spot`：受到会心一击的宝可梦（battle.me 或 battle.opp）
- **作用**：记录会心一击情况，分析速度关系

### 21. `onChoiceCancellation(player)`
- **功能**：当选择被取消时调用
- **参数**：
  - `player`：选择被取消的玩家（battle.me 或 battle.opp）
- **作用**：重新调用onChoiceSelection函数

### 22. `onDrawRequest(player)`
- **功能**：当请求平局时调用
- **参数**：
  - `player`：请求平局的玩家（battle.me 或 battle.opp）
- **作用**：调用onChoiceCancelled函数

### 23. `onChoiceCancelled(player)`
- **功能**：当选择被取消时调用
- **参数**：
  - `player`：选择被取消的玩家（battle.me 或 battle.opp）
- **作用**：切换useAI变量的状态

### 24. `onMajorStatusChange(spot, status, multipleTurns, silent)`
- **功能**：当宝可梦状态发生重大变化时调用
- **参数**：
  - `spot`：状态变化的宝可梦（battle.me 或 battle.opp）
  - `status`：状态类型（Number）
  - `multipleTurns`：是否是多回合状态（Boolean）
  - `silent`：是否静默变化（Boolean）
- **作用**：处理状态变化，记录特殊状态信息

### 25. `onStatusOver(spot, status)`
- **功能**：当宝可梦状态结束时调用
- **参数**：
  - `spot`：状态结束的宝可梦（battle.me 或 battle.opp）
  - `status`：状态类型（Number）
- **作用**：处理状态结束，更新特殊状态信息

### 26. `onFlinch(spot)`
- **功能**：当宝可梦畏缩时调用
- **参数**：
  - `spot`：畏缩的宝可梦（battle.me 或 battle.opp）
- **作用**：处理宝可梦畏缩情况

### 27. `onPlayerMessage(player, message)`
- **功能**：当玩家发送消息时调用
- **参数**：
  - `player`：发送消息的玩家（battle.me 或 battle.opp）
  - `message`：消息内容（String）
- **作用**：处理玩家消息，执行特定命令（如annoy、debug、eval等）

### 28. `onReconnect(player)`
- **功能**：当玩家重新连接时调用
- **参数**：
  - `player`：重新连接的玩家（battle.me 或 battle.opp）
- **作用**：处理重新连接情况，重置相关信息

## 回调函数的执行流程

1. **对战开始**：`onTierNotification` 被调用，初始化对战信息
2. **回合开始**：`onBeginTurn` 被调用，记录回合开始信息
3. **对战过程**：
   - `onUseAttack`：记录技能使用
   - `onMoveMessage`：分析技能效果
   - `onAbilityMessage`：分析特性效果
   - `onDamageDone`：记录伤害信息
   - `onMiss`/`onAvoid`：处理未命中/避开情况
   - `onStatusDamage`：处理状态异常伤害
   - `onKo`：处理宝可梦被击倒情况
   - `onCriticalHit`：处理会心一击情况
   - `onFlinch`：处理畏缩情况
   - `onMajorStatusChange`：处理状态变化
   - `onStatusOver`：处理状态结束
4. **宝可梦交换**：
   - `onSendBack`：记录宝可梦被收回
   - `onSendOut`：处理新宝可梦派出
5. **道具使用**：`onItemMessage` 分析道具使用
6. **规则激活**：`onClauseActivated` 处理规则激活
7. **攻击效果**：`onEffectiveness`/`onAttackFailing` 处理攻击效果
8. **选择决策**：
   - `onOfferChoice`：分析战场情况，准备决策
   - `onChoiceSelection`：执行对战决策
   - `onChoiceCancellation`/`onChoiceCancelled`：处理选择取消
9. **对战结束**：`onBattleEnd` 处理对战结束
10. **其他事件**：
    - `onDrawRequest`：处理平局请求
    - `onPlayerMessage`：处理玩家消息
    - `onReconnect`：处理重新连接

## 注意事项

- 所有回调函数都需要检查 `useAI` 变量，确保只有在AI启用时才执行相关逻辑
- 所有回调函数都需要检查 `battleEnd` 变量，确保在对战结束后不再执行相关逻辑
- 回调函数中的 `spot` 参数通常表示宝可梦的位置，使用 `battle.me` 和 `battle.opp` 来区分自己和对手
- 消息编号（如item、move、ab）不是实际的道具/技能/特性编号，而是消息类型编号，需要通过分析来确定具体的道具/技能/特性