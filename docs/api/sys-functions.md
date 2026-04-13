# sys 系统函数参考

本文件详细说明宝可梦战斗AI系统中使用的 `sys` 模块函数。

## 函数列表

### 1. `sys.pokeNum()`
- **功能**：根据宝可梦名称获取其编号
- **输入**：宝可梦的英文名称（String）
- **输出**：宝可梦的编号（Number）
- **示例**：`sys.pokeNum("Pikachu")` // 返回 25

### 2. `sys.appendToFile()`
- **功能**：向文件追加内容
- **输入**：
  - 参数1：要添加内容的文件名（String）
  - 参数2：要添加的内容（String）
- **输出**：可能是改动后的文件内容
- **示例**：`sys.appendToFile("buglog.txt", "20260412 100000 Error: Test bug")` // 在 buglog.txt 文件末尾添加内容

### 3. `sys.getFileContent()`
- **功能**：读取文件内容
- **输入**：文件名（String）
- **输出**：文件内容（String）
- **示例**：`sys.getFileContent('db/pokes/weight.txt')` // 返回文件内容

### 4. `sys.pokeBaseStats()`
- **功能**：获取宝可梦的基础属性
- **输入**：
  - 参数1：宝可梦编号（Number）
  - 参数2：世代（Number，8对应第8世代）
- **输出**：包含各项种族值的数组，通过 [stat] 索引获取特定属性值
  - 0：HP
  - 1：物攻
  - 2：物防
  - 3：特攻
  - 4：特防
  - 5：速度
- **示例**：`sys.pokeBaseStats(25, 8)[0]` // 获取皮卡丘的HP种族值

### 5. `sys.move()`
- **功能**：获取技能名称
- **输入**：招式编号（Number）
- **输出**：招式名称（英文，String）
- **示例**：`sys.move(50)` // 返回 "Thunder Shock"

### 6. `sys.pokemon()`
- **功能**：获取宝可梦名称
- **输入**：宝可梦编号（Number）
- **输出**：宝可梦名称（英文，String）
- **示例**：`sys.pokemon(25)` // 返回 "Pikachu"

### 7. `sys.pokeAbility()`
- **功能**：获取宝可梦的特性编号
- **输入**：
  - 参数1：宝可梦编号（Number）
  - 参数2：特性索引（0,1,2，Number）
  - 参数3：世代（0-8，Number）
- **输出**：特性编号（Number）
- **示例**：`sys.pokeAbility(25, 0, 8)` // 获取皮卡丘的第一个特性编号

### 8. `sys.ability()`
- **功能**：获取特性名称
- **输入**：特性编号（Number）
- **输出**：特性名称（英文，String）
- **示例**：`sys.ability(31)` // 返回 "Static"

### 9. `sys.setTimer()`
- **功能**：设置定时器
- **输入**：
  - 参数1：回调函数（callback）
  - 参数2：延迟时间（毫秒，Number）
  - 参数3：是否重复（Boolean）
- **输出**：定时器编号（Number）
- **注意**：callback 函数中不能使用 this 对象
- **示例**：`sys.setTimer(function() { console.log("Hello"); }, 1000, false)` // 1秒后执行回调

### 10. `sys.rand()`
- **功能**：生成范围内的随机整数
- **输入**：
  - 参数1：最小值（Number，可取到）
  - 参数2：最大值（Number，不会被取到）
- **输出**：随机整数（Number）
- **示例**：`sys.rand(0, 10)` // 返回 0-9 之间的随机整数

### 11. `sys.moveType()`
- **功能**：获取技能类型
- **输入**：招式编号（Number）
- **输出**：属性对应的编号（Number）
- **属性编号列表**：
  - 0：普通
  - 1：格斗
  - 2：飞行
  - 3：毒
  - 4：地面
  - 5：岩石
  - 6：虫
  - 7：鬼
  - 8：钢
  - 9：火
  - 10：水
  - 11：草
  - 12：电
  - 13：超能
  - 14：冰
  - 15：龙
  - 16：恶
  - 17：妖
  - 18：???
- **示例**：`sys.moveType(50)` // 获取 Thunder Shock 的属性编号（12，电）

### 12. `sys.pokeType1()`
- **功能**：获取宝可梦的第一属性
- **输入**：宝可梦编号（Number）
- **输出**：宝可梦的第一属性编号（Number）
- **示例**：`sys.pokeType1(25)` // 获取皮卡丘的第一属性编号（12，电）

### 13. `sys.pokeType2()`
- **功能**：获取宝可梦的第二属性
- **输入**：宝可梦编号（Number）
- **输出**：宝可梦的第二属性编号（Number）
  - 如果宝可梦有两个属性，返回第二个属性的编号
  - 如果宝可梦只有一个属性，返回18
- **示例**：`sys.pokeType2(25)` // 皮卡丘只有一个属性，返回18

### 14. `sys.writeToFile()`
- **功能**：写入文件内容
- **输入**：
  - 参数1：文件名（String）
  - 参数2：要写入的内容（String）
- **输出**：可能是改动后的文件内容
- **示例**：`sys.writeToFile("data.json", JSON.stringify({name: "Pikachu"}))` // 写入文件