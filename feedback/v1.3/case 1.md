Mew's与[Lv0.吧服BOT]清分少女的战斗开始了！

分级： BOT随机对战
模式：Singles
规则： 按照分级（计分）
规则： Sleep Clause
规则： Self-KO Clause
胜负分数变化： +16, -16

Mew's放出了大嘴鸥！
OnSendOut spot:0,prevIndex:0
[Lv0.吧服BOT]清分少女放出了哲尔尼亚斯！
OnSendOut spot:1,prevIndex:0
记录了哲尔尼亚斯
对手的哲尔尼亚斯正在释放妖精光环！
OnAbilityMessage spot:1,ability:103,part:0,type:17,foe:0,other:0
将记录哲尔尼亚斯的特性妖精气场
哲尔尼亚斯的特性是妖精气场
大嘴鸥的降雨特性引起了大雨！
将估算哲尔尼亚斯的速度
temptype:18
169
伊裴尔塔尔 standard:-75
铁螯龙虾 standard:-130
盖欧卡 standard:10
蕾冠王（骑黑马的样子） standard:-15
土地云 standard:-5
伊裴尔塔尔 standard:-75
铁螯龙虾 standard:-130
盖欧卡 standard:10
蕾冠王（骑黑马的样子） standard:-15
土地云 standard:-5
伊裴尔塔尔 standard:-75
铁螯龙虾 standard:-130
盖欧卡 standard:10
蕾冠王（骑黑马的样子） standard:-15
土地云 standard:-5
getFoeThreatToMe threat:40 bestDmg:0.37 spd:121vs[182,326]
me=100% foe=100% sw:best=0 good=0 for=0 pow=[热水:153.71921397379913,拍落:26.418120805369128,急速折返:18.88993288590604,羽栖:0]
热水:power 153.71921397379913 accurcy 100 damagePercent 0.38526118790425845
拍落:power 26.418120805369128 accurcy 100 damagePercent 0.06621082908613816
急速折返:power 18.88993288590604 accurcy 100 damagePercent 0.0473431901902407
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
rejected:I will switch!
伊裴尔塔尔 standard:-75
铁螯龙虾 standard:-130
盖欧卡 standard:10
蕾冠王（骑黑马的样子） standard:-15
土地云 standard:-5
好的交换选择：
好的防守选择：
好的攻击选择：2,4
改动I 被迫换人合并候选:2,3,4,5 bestStd:10
## 看起来合并候选不太好，铁螯龙虾应该不出现在候选列表里，直接用standard取代attack更好吧
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=4

开始回合1
Mew's收回了大嘴鸥！
OnSendBack spot:0
Mew's放出了蕾冠王（骑黑马的样子）！
OnSendOut spot:0,prevIndex:4

蕾冠王（骑黑马的样子）使得[Lv0.吧服BOT]清分少女的队伍紧张得吃不了树果了！
OnAbilityMessage spot:0,ability:102,part:0,type:0,foe:0,other:0
对手的哲尔尼亚斯使用了月亮之力！
OnUseAttack spot:1,attack:572
记录技能：月亮之力
蕾冠王（骑黑马的样子）失去了172HP！(50%的HP)
蕾冠王（骑黑马的样子）的特攻下降！

雨一直下。
将估算哲尔尼亚斯的速度
temptype:18
169
伊裴尔塔尔 standard:-45
铁螯龙虾 standard:-105
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
伊裴尔塔尔 standard:-45
铁螯龙虾 standard:-105
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
伊裴尔塔尔 standard:-45
铁螯龙虾 standard:-105
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
getFoeThreatToMe threat:14 bestDmg:0.59 spd:438vs[182,326]
me=49% foe=100% sw:best=0 good=0 for=0 pow=[星碎:249.38541484716154,精神冲击:171.5842953020134,吸取之吻:70.79039301310043,诡计:0]
星碎:power 249.38541484716154 accurcy 100 damagePercent 0.5746207715372386
精神冲击:power 171.5842953020134 accurcy 100 damagePercent 0.39535551912906314
吸取之吻:power 70.79039301310043 accurcy 100 damagePercent 0.16311150463848026
诡计:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
softmax: pool=76 T=2 alive=6 switchP=0(bench=0) thresh=0.65 floor=162 candidates=2 chosen=2(精神冲击) [星碎,精神冲击]=100,82
## 精神冲击伤害估算偏差大（估39实际25，不知道是不是跟招式特殊机制有关系，使用对面物防代替特防计算伤害）。而且0.57vs0.39伤害的精神冲击能有82权重是合理的吗（可能未来伤害模型关注1HKO/2HKO/NHKO比直接算伤害更有效？）
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合2
蕾冠王（骑黑马的样子）使用了精神冲击！
OnUseAttack spot:0,attack:473
记录技能：精神冲击
对手的哲尔尼亚斯失去了25%的HP！
精神冲击造成了25伤害
最大特耐：149925.36000000002
最小特耐：127436.55600000001
蕾冠王（骑黑马的样子）因为生命玉而受到了伤害！
OnItemMessage spot:0,item:21,part:0,berry:0,foe:0,other:0

对手的哲尔尼亚斯使用了电磁波！
OnUseAttack spot:1,attack:86
记录技能：电磁波
蕾冠王（骑黑马的样子）麻痹了！它可能无法行动！
onMajorStatusChage spot:0 status:1

雨一直下。
对手的哲尔尼亚斯的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
精神冲击造成了25伤害
最大特耐：149925.36000000002
最小特耐：127436.55600000001
将估算哲尔尼亚斯的速度
两技能先制相等，开始计算！
temptype:18
169
伊裴尔塔尔 standard:-45
铁螯龙虾 standard:-105
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
伊裴尔塔尔 standard:-45
铁螯龙虾 standard:-105
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
伊裴尔塔尔 standard:-45
铁螯龙虾 standard:-105
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
getFoeThreatToMe threat:36 bestDmg:0.59 spd:219vs[182,326]
me=39% foe=81% sw:best=0 good=0 for=0 pow=[星碎:249.38541484716154,精神冲击:171.5842953020134,吸取之吻:70.79039301310043,诡计:0]
星碎:power 249.38541484716154 accurcy 100 damagePercent 0.6112387618802979
精神冲击:power 171.5842953020134 accurcy 100 damagePercent 0.42054974338728773
吸取之吻:power 70.79039301310043 accurcy 100 damagePercent 0.1735058652281873
诡计:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
变化技能的适应度：2
softmax: pool=74 T=1.5 alive=6 switchP=0(bench=0) thresh=0.75 floor=187 candidates=1 chosen=0(星碎) [星碎]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合3
对手的哲尔尼亚斯使用了月亮之力！
OnUseAttack spot:1,attack:572
记录技能：月亮之力
蕾冠王（骑黑马的样子）失去了135HP！(39%的HP)
onMajorStatusChage spot:0 status:31
蕾冠王（骑黑马的样子）倒下了！
OnKo spot:0

雨一直下。
对手的哲尔尼亚斯的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
记录技能：星碎
将估算哲尔尼亚斯的速度
两技能先制相等，开始计算！
哲尔尼亚斯的最小基础速度是219
temptype:18
169
伊裴尔塔尔 standard:-65
铁螯龙虾 standard:-125
盖欧卡 standard:15
大嘴鸥 standard:-45
土地云 standard:-15
好的交换选择：
好的防守选择：
好的攻击选择：2,5
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=5
swtich because of ko
Mew's放出了土地云（化身形态）！ (土地云)
OnSendOut spot:0,prevIndex:5

将估算哲尔尼亚斯的速度
两技能先制相等，开始计算！
哲尔尼亚斯的最小基础速度是219
temptype:18
169
伊裴尔塔尔 standard:-70
铁螯龙虾 standard:-110
盖欧卡 standard:30
大嘴鸥 standard:-40
伊裴尔塔尔 standard:-70
铁螯龙虾 standard:-110
盖欧卡 standard:30
大嘴鸥 standard:-40
伊裴尔塔尔 standard:-70
铁螯龙虾 standard:-110
盖欧卡 standard:30
大嘴鸥 standard:-40
getFoeThreatToMe threat:15 bestDmg:0.76 spd:331vs[219,326]
me=100% foe=87% sw:best=0 good=0 for=0 pow=[污泥波:394.2674061135371,大地之力:215.69554585152838,真气弹:95.4313537117904,重力:0]
污泥波:power 394.2674061135371 accurcy 100 damagePercent 0.8665217716781035
大地之力:power 215.69554585152838 accurcy 100 damagePercent 0.4740561447286338
真气弹:power 95.4313537117904 accurcy 70 damagePercent 0.20973923892701185
重力:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
softmax: pool=74 T=2 alive=5 switchP=0(bench=0) thresh=0.65 floor=256 candidates=1 chosen=1(污泥波) [污泥波]=100
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合4
土地云（化身形态）使用了污泥波！
OnUseAttack spot:0,attack:482
记录技能：污泥波
这非常有效！
对手的哲尔尼亚斯失去了83%的HP！
污泥波造成了83伤害
最大特耐：106922.83855421688
最小特耐：90884.41277108435

对手的哲尔尼亚斯使用了月亮之力！
OnUseAttack spot:1,attack:572
记录技能：月亮之力
土地云（化身形态）失去了208HP！(65%的HP)

雨一直下。
对手的哲尔尼亚斯的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
污泥波造成了83伤害
最大特耐：106922.83855421688
最小特耐：90884.41277108435
将估算哲尔尼亚斯的速度
两技能先制相等，开始计算！
temptype:18
169
伊裴尔塔尔 standard:-70
铁螯龙虾 standard:-110
盖欧卡 standard:30
大嘴鸥 standard:-40
伊裴尔塔尔 standard:-70
铁螯龙虾 standard:-110
盖欧卡 standard:30
大嘴鸥 standard:-40
伊裴尔塔尔 standard:-70
铁螯龙虾 standard:-110
盖欧卡 standard:30
大嘴鸥 standard:-40
getFoeThreatToMe threat:30 bestDmg:0.76 spd:331vs[219,326]
me=34% foe=10% sw:best=0 good=0 for=0 pow=[污泥波:394.2674061135371,大地之力:215.69554585152838,真气弹:95.4313537117904,重力:0]
污泥波:power 394.2674061135371 accurcy 100 damagePercent 1.054190925437265
先手斩杀生效
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合5
土地云（化身形态）使用了污泥波！
OnUseAttack spot:0,attack:482
记录技能：污泥波
这非常有效！
对手的哲尔尼亚斯失去了10%的HP！
污泥波造成了10伤害
最大特耐：887459.56
最小特耐：754340.626
onMajorStatusChage spot:1 status:31
对手的哲尔尼亚斯倒下了！
OnKo spot:1

雨一直下。
[Lv0.吧服BOT]清分少女放出了藏玛然特（盾之王）！
OnSendOut spot:1,prevIndex:4
记录了藏玛然特（盾之王）

对手的藏玛然特（盾之王）的不屈之盾发动了！
OnAbilityMessage spot:1,ability:164,part:0,type:0,foe:0,other:0
将记录藏玛然特（盾之王）的特性
藏玛然特（盾之王）的特性是
对手的藏玛然特（盾之王）的防御提升！
污泥波造成了10伤害
使用的技能无威力，不进行计算！
将估算哲尔尼亚斯的速度
temptype:18
0
伊裴尔塔尔 standard:40
铁螯龙虾 standard:-60
盖欧卡 standard:110
大嘴鸥 standard:30
伊裴尔塔尔 standard:40
铁螯龙虾 standard:-60
盖欧卡 standard:110
大嘴鸥 standard:30
伊裴尔塔尔 standard:40
铁螯龙虾 standard:-60
盖欧卡 standard:110
大嘴鸥 standard:30
getFoeThreatToMe threat:43 bestDmg:0.57 spd:331vs[234,390]
me=34% foe=100% sw:best=0 good=0 for=1 pow=[大地之力:308.58251162790697,真气弹:272.5622325581395,污泥波:0,重力:0]
大地之力:power 308.58251162790697 accurcy 100 damagePercent 0.8595613137267604
真气弹:power 272.5622325581395 accurcy 70 damagePercent 0.7592262745352075
污泥波:power 0 accurcy 100 damagePercent 0
重力:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
softmax: pool=76 T=1.5 alive=5 switchP=7(bench=716) thresh=0.75 floor=231 candidates=1 chosen=0(大地之力) [大地之力]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合6
对手的藏玛然特（盾之王）使用了巨兽弹！
OnUseAttack spot:1,attack:782
记录技能：巨兽弹
土地云（化身形态）失去了111HP！(34%的HP)
onMajorStatusChage spot:0 status:31
土地云（化身形态）倒下了！
OnKo spot:0

雨一直下。
记录技能：大地之力
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
藏玛然特（盾之王）的最小基础速度是331
temptype:18
0
伊裴尔塔尔 standard:45
铁螯龙虾 standard:-75
盖欧卡 standard:95
大嘴鸥 standard:25
好的交换选择：
好的防守选择：3
好的攻击选择：2
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2
swtich because of ko
## 这不对啊，还是没有用standard，选了-75的铁螯龙虾，然后送了
Mew's放出了铁螯龙虾！
OnSendOut spot:0,prevIndex:2

将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
藏玛然特（盾之王）的最小基础速度是331
temptype:18
0
伊裴尔塔尔 standard:40
盖欧卡 standard:85
大嘴鸥 standard:55
伊裴尔塔尔 standard:40
盖欧卡 standard:85
大嘴鸥 standard:55
伊裴尔塔尔 standard:40
盖欧卡 standard:85
大嘴鸥 standard:55
getFoeThreatToMe threat:40 bestDmg:0.36 spd:103vs[331,390]
## 看起来是因为对面只露了钢系招式导致危险评估严重失真？目前对方招式没露全的情况下露1个就按照1个算，会忽视对手显而易见可能携带的本系招式的极高威胁，似乎应该在对手露招式时仍然考虑本系威胁，并给权重系数（比如对手露1招时本系招式威胁给出0.8倍，露2招时0.5倍，露3招时0.2倍）
me=100% foe=100% sw:best=0 good=0 for=2 pow=[蟹钳锤:306.6542655548428,水流喷射:126.26170622193713,拍落:100.71263630532394,掉包:0]
蟹钳锤:power 306.6542655548428 accurcy 90 damagePercent 0.9208836803448733
水流喷射:power 126.26170622193713 accurcy 100 damagePercent 0.37916428294876015
拍落:power 100.71263630532394 accurcy 100 damagePercent 0.30244034926523705
掉包:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
softmax: pool=75 T=2 alive=4 switchP=14(bench=716) thresh=0.65 floor=179 candidates=1 chosen=0(蟹钳锤) [蟹钳锤]=100
## 水流喷射有先制度加成，不过看起来还是因为严重低估对手威胁导致决策错误了
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合7
对手的藏玛然特（盾之王）使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
这非常有效！
铁螯龙虾失去了330HP！(100%的HP)
onMajorStatusChage spot:0 status:31
铁螯龙虾倒下了！
OnKo spot:0
对手的藏玛然特（盾之王）的防御下降！
对手的藏玛然特（盾之王）的特防下降！

雨一直下。
记录技能：蟹钳锤
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:45
盖欧卡 standard:95
大嘴鸥 standard:25
好的交换选择：3
好的防守选择：3
好的攻击选择：3
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=3
swtich because of ko
Mew's放出了盖欧卡！
OnSendOut spot:0,prevIndex:3

将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
getFoeThreatToMe threat:46 bestDmg:0.48 spd:216vs[331,390]
me=100% foe=100% sw:best=0 good=0 for=0 pow=[热水:230.6941228851291,冰冻光束:57.54853072128227,冥想:0,睡觉:0]
热水:power 230.6941228851291 accurcy 100 damagePercent 0.6480171991155312
冰冻光束:power 57.54853072128227 accurcy 100 damagePercent 0.16165317618337716
冥想:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
睡觉:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：3
变化技能的适应度：1
变化技能的适应度：3
变化技能的适应度：1
softmax: pool=74 T=0.9 alive=3 switchP=7(bench=716) thresh=0.75 floor=173 candidates=1 chosen=0(热水) [热水]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合8
对手的藏玛然特（盾之王）使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
盖欧卡失去了193HP！(47%的HP)
对手的藏玛然特（盾之王）的防御下降！
对手的藏玛然特（盾之王）的特防下降！

盖欧卡使用了热水！
OnUseAttack spot:0,attack:503
记录技能：热水
对手的藏玛然特（盾之王）失去了84%的HP！
热水造成了84伤害
对方特防等级与开始时不同，不进行计算！

雨停了。
盖欧卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
热水造成了84伤害
对方特防等级与开始时不同，不进行计算！
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
getFoeThreatToMe threat:49 bestDmg:0.48 spd:216vs[331,390]
me=58% foe=15% sw:best=0 good=0 for=0 pow=[热水:195.21793416572075,冰冻光束:73.08172531214527,冥想:0,睡觉:0]
热水:power 195.21793416572075 accurcy 100 damagePercent 0.569148496109973
冰冻光束:power 73.08172531214527 accurcy 100 damagePercent 0.21306625455435937
冥想:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
睡觉:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
斩杀技能生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合9
[Lv0.吧服BOT]清分少女收回了藏玛然特（盾之王）！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了莱希拉姆！
OnSendOut spot:1,prevIndex:5
记录了莱希拉姆

对手的莱希拉姆有兆级电压/涡轮火焰特性！
OnAbilityMessage spot:1,ability:40,part:0,type:0,foe:1,other:164
将记录莱希拉姆的特性兆级电压/涡轮火焰
莱希拉姆的特性是兆级电压/涡轮火焰
盖欧卡使用了热水！
OnUseAttack spot:0,attack:503
记录技能：热水
对手的莱希拉姆失去了33%的HP！
热水造成了33伤害
对方特防等级与开始时不同，不进行计算！

盖欧卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
热水造成了33伤害
对方特防等级与开始时不同，不进行计算！
将估算藏玛然特（盾之王）的速度
temptype:18
164
伊裴尔塔尔 standard:-15
大嘴鸥 standard:-30
伊裴尔塔尔 standard:-15
大嘴鸥 standard:-30
伊裴尔塔尔 standard:-15
大嘴鸥 standard:-30
getFoeThreatToMe threat:25 bestDmg:0.34 spd:216vs[166,306]
me=64% foe=66% sw:best=0 good=0 for=0 pow=[热水:127.06153846153848,冰冻光束:95.04615384615384,冥想:0,睡觉:0]
热水:power 127.06153846153848 accurcy 100 damagePercent 0.39216524216524223
冰冻光束:power 95.04615384615384 accurcy 100 damagePercent 0.29335232668566
冥想:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
睡觉:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合10
[Lv0.吧服BOT]清分少女收回了莱希拉姆！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了藏玛然特（盾之王）！
OnSendOut spot:1,prevIndex:5

对手的藏玛然特（盾之王）的不屈之盾发动了！
OnAbilityMessage spot:1,ability:164,part:0,type:0,foe:0,other:0
将记录藏玛然特（盾之王）的特性
藏玛然特（盾之王）的特性是
对手的藏玛然特（盾之王）的防御提升！
盖欧卡使用了睡觉！
OnUseAttack spot:0,attack:156
记录技能：睡觉
盖欧卡睡着了并恢复了健康！
OnMoveMessage spot:0,move:106,part:0,type:13,foe:0,other:0,q:
onMajorStatusChage spot:0 status:2

将估算莱希拉姆的速度
temptype:18
0
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
getFoeThreatToMe threat:46 bestDmg:0.48 spd:216vs[331,390]
me=100% foe=15% sw:best=0 good=0 for=0 pow=[冰冻光束:40.38232558139534,热水:0,冥想:0,睡觉:0]
## 睡眠情况下，伤害怎么有点怪，热水0但冰光40
冰冻光束:power 40.38232558139534 accurcy 100 damagePercent 0.13505794508827873
热水:power 0 accurcy 100 damagePercent 0
冥想:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
睡觉:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：3
变化技能的适应度：1
变化技能的适应度：3
变化技能的适应度：1
变化技能的适应度：3
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合11
对手的藏玛然特（盾之王）使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
盖欧卡失去了166HP！(41%的HP)
对手的藏玛然特（盾之王）的防御下降！
对手的藏玛然特（盾之王）的特防下降！

盖欧卡正在睡觉。

盖欧卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
记录技能：冥想
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
getFoeThreatToMe threat:49 bestDmg:0.48 spd:216vs[331,390]
me=65% foe=15% sw:best=0 good=0 for=0 pow=[冰冻光束:57.54853072128227,热水:0,冥想:0,睡觉:0]
冰冻光束:power 57.54853072128227 accurcy 100 damagePercent 0.17761892197926626
热水:power 0 accurcy 100 damagePercent 0
冥想:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
睡觉:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：2
变化技能的适应度：2
softmax: pool=57 T=0.9 alive=3 switchP=7(bench=716) thresh=0.75 floor=43 candidates=1 chosen=2(冰冻光束) [冰冻光束]=100
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合12
对手的藏玛然特（盾之王）使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
盖欧卡失去了169HP！(41%的HP)
对手的藏玛然特（盾之王）的防御下降！
对手的藏玛然特（盾之王）的特防下降！

盖欧卡正在睡觉。

盖欧卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
记录技能：冰冻光束
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
伊裴尔塔尔 standard:45
大嘴鸥 standard:20
getFoeThreatToMe threat:61 bestDmg:0.48 spd:216vs[331,390]
me=29% foe=15% sw:best=0 good=0 for=0 pow=[热水:195.21793416572075,冰冻光束:73.08172531214527,冥想:0,睡觉:0]
热水:power 195.21793416572075 accurcy 100 damagePercent 0.6217131661328686
冰冻光束:power 73.08172531214527 accurcy 100 damagePercent 0.23274434812785116
冥想:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
睡觉:power 0 accurcy 100 damagePercent 0
变化技能的适应度：4
斩杀技能生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合13
对手的藏玛然特（盾之王）使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
盖欧卡失去了119HP！(29%的HP)
onMajorStatusChage spot:0 status:31
盖欧卡倒下了！
OnKo spot:0
对手的藏玛然特（盾之王）的防御下降！
对手的藏玛然特（盾之王）的特防下降！

记录技能：热水
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:45
大嘴鸥 standard:25
好的交换选择：
好的防守选择：
好的攻击选择：1,4
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=4
swtich because of ko
Mew's放出了大嘴鸥！
OnSendOut spot:0,prevIndex:4

大嘴鸥的降雨特性引起了大雨！
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
0
伊裴尔塔尔 standard:35
伊裴尔塔尔 standard:35
伊裴尔塔尔 standard:35
getFoeThreatToMe threat:40 bestDmg:0.28 spd:121vs[331,390]
me=100% foe=15% sw:best=0 good=0 for=0 pow=[热水:236.0121951219512,拍落:33.10726447219069,急速折返:11.846197502837684,羽栖:0]
热水:power 236.0121951219512 accurcy 100 damagePercent 0.7516311946558956
拍落:power 33.10726447219069 accurcy 100 damagePercent 0.1054371480006073
急速折返:power 11.846197502837684 accurcy 100 damagePercent 0.03772674363961046
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
斩杀技能生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合14
[Lv0.吧服BOT]清分少女收回了藏玛然特（盾之王）！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了刺甲贝！
OnSendOut spot:1,prevIndex:1
记录了刺甲贝

大嘴鸥使用了热水！
OnUseAttack spot:0,attack:503
记录技能：热水
这不是很有效...
对手的刺甲贝失去了54%的HP！
热水造成了54伤害
对方特防等级与开始时不同，不进行计算！

雨一直下。
热水造成了54伤害
对方特防等级与开始时不同，不进行计算！
将估算藏玛然特（盾之王）的速度
temptype:18
75,92,142
伊裴尔塔尔 standard:-15
伊裴尔塔尔 standard:-15
伊裴尔塔尔 standard:-15
getFoeThreatToMe threat:40 bestDmg:0.3 spd:121vs[130,262]
me=100% foe=45% sw:best=0 good=0 for=0 pow=[热水:139.48373493975902,拍落:31.428790199081163,急速折返:22.410413476263397,羽栖:0]
热水:power 139.48373493975902 accurcy 100 damagePercent 0.5693213671010572
拍落:power 31.428790199081163 accurcy 100 damagePercent 0.12828077632278026
急速折返:power 22.410413476263397 accurcy 100 damagePercent 0.09147107541331999
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
softmax: pool=73 T=0.6 alive=2 switchP=7(bench=716) thresh=0.85 floor=118 candidates=1 chosen=0(热水) [热水]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合15
对手的刺甲贝使用了冰锥！
OnUseAttack spot:1,attack:333
记录技能：冰锥
大嘴鸥失去了27HP！(8%的HP)
大嘴鸥失去了27HP！(8%的HP)
大嘴鸥失去了28HP！(8%的HP)
大嘴鸥失去了27HP！(8%的HP)
大嘴鸥失去了27HP！(8%的HP)
击中5次！

大嘴鸥使用了热水！
OnUseAttack spot:0,attack:503
记录技能：热水
这不是很有效...
对手的刺甲贝失去了45%的HP！
热水造成了45伤害
最大特耐：37973.00000000001
最小特耐：32277.050000000003
onMajorStatusChage spot:1 status:31
对手的刺甲贝倒下了！
OnKo spot:1

雨一直下。
[Lv0.吧服BOT]清分少女放出了莱希拉姆！
OnSendOut spot:1,prevIndex:5

对手的莱希拉姆有兆级电压/涡轮火焰特性！
OnAbilityMessage spot:1,ability:40,part:0,type:0,foe:1,other:164
将记录莱希拉姆的特性兆级电压/涡轮火焰
莱希拉姆的特性是兆级电压/涡轮火焰
热水造成了45伤害
最大特耐：75946.00000000001
最小特耐：68200
将估算刺甲贝的速度
两技能先制相等，开始计算！
temptype:18
164
伊裴尔塔尔 standard:-25
伊裴尔塔尔 standard:-25
伊裴尔塔尔 standard:-25
getFoeThreatToMe threat:58 bestDmg:0.76 spd:121vs[166,306]
me=58% foe=66% sw:best=0 good=0 for=0 pow=[热水:129.66923076923078,拍落:50.722365038560405,急速折返:18.13110539845758,羽栖:0]
热水:power 129.66923076923078 accurcy 100 damagePercent 0.3758528428093646
拍落:power 50.722365038560405 accurcy 100 damagePercent 0.14702134793785623
急速折返:power 18.13110539845758 accurcy 100 damagePercent 0.0525539286911814
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
softmax: pool=66 T=0.6 alive=2 switchP=7(bench=716) thresh=0.85 floor=110 candidates=1 chosen=0(热水) [热水]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合16
对手的莱希拉姆使用了流星群！
OnUseAttack spot:1,attack:434
记录技能：流星群
大嘴鸥失去了188HP！(58%的HP)
onMajorStatusChage spot:0 status:31
大嘴鸥倒下了！
OnKo spot:0
对手的莱希拉姆的特攻迅速下降！
对手的莱希拉姆因为生命玉而受到了伤害！
OnItemMessage spot:1,item:21,part:0,berry:0,foe:0,other:0

雨一直下。
记录技能：热水
将估算莱希拉姆的速度
两技能先制相等，开始计算！
temptype:18
164
伊裴尔塔尔 standard:45
好的交换选择：
好的防守选择：
好的攻击选择：1
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=1
swtich because of ko
Mew's放出了伊裴尔塔尔！
OnSendOut spot:0,prevIndex:1

伊裴尔塔尔正在释放恶光环！
OnAbilityMessage spot:0,ability:103,part:0,type:16,foe:0,other:0
将估算莱希拉姆的速度
两技能先制相等，开始计算！
temptype:18
164
getFoeThreatToMe threat:22 bestDmg:0.27 spd:234vs[166,306]
me=100% foe=56% sw:best=0 good=0 for=0 pow=[拍落:242.50642673521853,急速折返:43.44987146529563,羽栖:0,剧毒:0]
拍落:power 242.50642673521853 accurcy 100 damagePercent 0.6968575480897085
急速折返:power 43.44987146529563 accurcy 100 damagePercent 0.1248559524864817
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：3
变化技能的适应度：1
变化技能的适应度：3
softmax: pool=64 T=0.6 alive=1 switchP=27(bench=716) thresh=0.85 floor=178 candidates=1 chosen=1(拍落) [拍落]=100
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合17
[Lv0.吧服BOT]清分少女收回了莱希拉姆！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了藏玛然特（盾之王）！
OnSendOut spot:1,prevIndex:1

对手的藏玛然特（盾之王）的不屈之盾发动了！
OnAbilityMessage spot:1,ability:164,part:0,type:0,foe:0,other:0
将记录藏玛然特（盾之王）的特性
藏玛然特（盾之王）的特性是
对手的藏玛然特（盾之王）的防御提升！
伊裴尔塔尔使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
这不是很有效...
对手的藏玛然特（盾之王）失去了10%的HP！
拍落造成了10伤害
对方物防等级与开始时不同，不进行计算！

雨一直下。
拍落造成了10伤害
对方物防等级与开始时不同，不进行计算！
将估算莱希拉姆的速度
temptype:18
0
getFoeThreatToMe threat:46 bestDmg:0.57 spd:234vs[331,390]
me=100% foe=4% sw:best=0 good=0 for=0 pow=[拍落:62.01282873636946,急速折返:11.092046183450927,羽栖:0,剧毒:0]
拍落:power 62.01282873636946 accurcy 100 damagePercent 0.16851312156622136
急速折返:power 11.092046183450927 accurcy 100 damagePercent 0.030141429846334042
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：0
斩杀技能生效
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合18
对手的藏玛然特（盾之王）使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
伊裴尔塔尔失去了256HP！(56%的HP)
对手的藏玛然特（盾之王）的防御下降！
对手的藏玛然特（盾之王）的特防下降！

伊裴尔塔尔使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
这不是很有效...
对手的藏玛然特（盾之王）失去了4%的HP！
拍落造成了4伤害
对方物防等级与开始时不同，不进行计算！
onMajorStatusChage spot:1 status:31
对手的藏玛然特（盾之王）倒下了！
OnKo spot:1

雨一直下。
[Lv0.吧服BOT]清分少女放出了莱希拉姆！
OnSendOut spot:1,prevIndex:1

对手的莱希拉姆有兆级电压/涡轮火焰特性！
OnAbilityMessage spot:1,ability:40,part:0,type:0,foe:1,other:164
将记录莱希拉姆的特性兆级电压/涡轮火焰
莱希拉姆的特性是兆级电压/涡轮火焰
拍落造成了4伤害
对方物防等级与开始时不同，不进行计算！
将估算藏玛然特（盾之王）的速度
两技能先制相等，开始计算！
temptype:18
164
getFoeThreatToMe threat:36 bestDmg:0.54 spd:234vs[166,306]
me=43% foe=56% sw:best=0 good=0 for=0 pow=[拍落:242.50642673521853,急速折返:43.44987146529563,羽栖:0,剧毒:0]
拍落:power 242.50642673521853 accurcy 100 damagePercent 0.6625858653967719
急速折返:power 43.44987146529563 accurcy 100 damagePercent 0.11871549580681866
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合19
对手的莱希拉姆使用了羽栖！
OnUseAttack spot:1,attack:355
记录技能：羽栖
对手的莱希拉姆在地上歇息！
OnMoveMessage spot:1,move:150,part:0,type:2,foe:0,other:0,q:
对手的莱希拉姆回复了HP！
OnMoveMessage spot:1,move:60,part:0,type:2,foe:0,other:0,q:

伊裴尔塔尔使用了羽栖！
OnUseAttack spot:0,attack:355
记录技能：羽栖
伊裴尔塔尔在地上歇息！
OnMoveMessage spot:0,move:150,part:0,type:2,foe:0,other:0,q:
伊裴尔塔尔回复了HP！
OnMoveMessage spot:0,move:60,part:0,type:2,foe:0,other:0,q:

雨一直下。
将估算莱希拉姆的速度
两技能先制相等，开始计算！
莱希拉姆的最小基础速度是234
temptype:18
164
getFoeThreatToMe threat:28 bestDmg:0.54 spd:234vs[234,306]
## 说起来记录对手速度的时候考虑可能存在同速对拼的情况，所以记录对手速度直接按我方实际值算，但对手先于我方出招实际上大概率是他快。我觉得我们对对手速度的估算以后应该不再是一个简单的上下限，而是需要一个概率密度的模型，从极限低速到极速的各种可能值和分布（比如0速概率0.2，满速概率0.2，极速概率0.3等等），然后对手对战中发现的先后手推理实际上是去尾；这对于对手的各项预测实际上都比较有用。最后我们评价的时候可以拿出“对方比我方快的概率"而不是单值
me=93% foe=100% sw:best=0 good=0 for=0 pow=[拍落:242.50642673521853,急速折返:43.44987146529563,羽栖:0,剧毒:0]
拍落:power 242.50642673521853 accurcy 100 damagePercent 0.7438847445865598
急速折返:power 43.44987146529563 accurcy 100 damagePercent 0.13328181431072278
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：3
变化技能的适应度：1
变化技能的适应度：3
softmax: pool=55 T=0.6 alive=1 switchP=27(bench=716) thresh=0.85 floor=178 candidates=1 chosen=1(拍落) [拍落]=100
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合20
[Lv0.吧服BOT]清分少女收回了莱希拉姆！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了土地云（化身形态）！ (土地云)
OnSendOut spot:1,prevIndex:2
记录了土地云

伊裴尔塔尔使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
对手的土地云（化身形态）失去了72%的HP！
拍落造成了72伤害
最大物耐：76675.83333333334
最小物耐：65174.458333333336
伊裴尔塔尔使对手的土地云（化身形态）的生命宝珠无效了！
OnMoveMessage spot:0,move:70,part:0,type:16,foe:1,other:91,q:

雨一直下。
拍落造成了72伤害
最大物耐：51117.22222222222
最小物耐：43449.63888888889
将估算莱希拉姆的速度
temptype:18
159,125
getFoeThreatToMe threat:22 bestDmg:0.37 spd:234vs[186,331]
me=93% foe=27% sw:best=0 good=0 for=0 pow=[拍落:176.28651685393257,急速折返:47.38483146067415,羽栖:0,剧毒:0]
拍落:power 176.28651685393257 accurcy 100 damagePercent 0.510975411170819
急速折返:power 47.38483146067415 accurcy 100 damagePercent 0.13734733756717143
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：2
斩杀技能生效
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合21
对手的土地云（化身形态）使用了污泥波！
OnUseAttack spot:1,attack:482
记录技能：污泥波
伊裴尔塔尔失去了115HP！(25%的HP)

伊裴尔塔尔使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
对手的土地云（化身形态）失去了27%的HP！
拍落造成了27伤害
最大物耐：136312.59259259258
最小物耐：115865.70370370371
onMajorStatusChage spot:1 status:31
对手的土地云（化身形态）倒下了！
OnKo spot:1

雨停了。
[Lv0.吧服BOT]清分少女放出了莱希拉姆！
OnSendOut spot:1,prevIndex:2

对手的莱希拉姆有兆级电压/涡轮火焰特性！
OnAbilityMessage spot:1,ability:40,part:0,type:0,foe:1,other:164
将记录莱希拉姆的特性兆级电压/涡轮火焰
莱希拉姆的特性是兆级电压/涡轮火焰
拍落造成了27伤害
最大物耐：204468.8888888889
最小物耐：173798.55555555556
将估算土地云的速度
两技能先制相等，开始计算！
土地云的最小基础速度是234
temptype:18
164
getFoeThreatToMe threat:31 bestDmg:0.54 spd:234vs[234,306]
me=68% foe=100% sw:best=0 good=0 for=0 pow=[拍落:242.50642673521853,急速折返:43.44987146529563,羽栖:0,剧毒:0]
拍落:power 242.50642673521853 accurcy 100 damagePercent 0.641551393479414
急速折返:power 43.44987146529563 accurcy 100 damagePercent 0.1149467499081895
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
softmax: pool=45 T=0.6 alive=1 switchP=27(bench=716) thresh=0.85 floor=178 candidates=1 chosen=1(拍落) [拍落]=100
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合22
对手的莱希拉姆使用了青焰！
OnUseAttack spot:1,attack:551
记录技能：青焰
伊裴尔塔尔失去了261HP！(57%的HP)
对手的莱希拉姆因为生命玉而受到了伤害！
OnItemMessage spot:1,item:21,part:0,berry:0,foe:0,other:0

伊裴尔塔尔使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
对手的莱希拉姆失去了64%的HP！
拍落造成了64伤害
最大物耐：86260.31250000001
最小物耐：73321.265625
伊裴尔塔尔使对手的莱希拉姆的生命宝珠无效了！
OnMoveMessage spot:0,move:70,part:0,type:16,foe:1,other:91,q:

拍落造成了64伤害
最大物耐：57506.875
最小物耐：48880.84375
将估算莱希拉姆的速度
两技能先制相等，开始计算！
莱希拉姆的最小基础速度是234
temptype:18
164
getFoeThreatToMe threat:43 bestDmg:0.54 spd:234vs[234,306]
me=11% foe=25% sw:best=0 good=0 for=0 pow=[拍落:161.67095115681235,急速折返:43.44987146529563,羽栖:0,剧毒:0]
拍落:power 161.67095115681235 accurcy 100 damagePercent 0.42657243049290855
急速折返:power 43.44987146529563 accurcy 100 damagePercent 0.11464346033059533
羽栖:power 0 accurcy 100 damagePercent 0
变化技能的适应度：4
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：1
斩杀技能生效
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合23
对手的莱希拉姆使用了青焰！
OnUseAttack spot:1,attack:551
记录技能：青焰
会心一击！
onCriticalHit spot:0
伊裴尔塔尔失去了51HP！(11%的HP)
onMajorStatusChage spot:0 status:31
伊裴尔塔尔倒下了！
OnKo spot:0

[Lv0.吧服BOT]清分少女获得了胜利！
[Lv0.吧服BOT]清分少女: 桑多涅，信不信我打爆你的脑袋，敲~

由于一位玩家关闭了战斗窗口，本窗口已失效。
