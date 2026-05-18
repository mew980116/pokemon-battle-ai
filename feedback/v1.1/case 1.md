Mew's: v1.1 AI
清分少女: v1.0 AI

这篇战报体现较多问题


Mew's与[Lv0.吧服BOT]清分少女的战斗开始了！

分级： BOT随机对战
模式：Singles
规则： 按照分级（计分）
规则： Sleep Clause
规则： Self-KO Clause
胜负分数变化： +8, -24

Mew's放出了费洛美螂！
OnSendOut spot:0,prevIndex:0
[Lv0.吧服BOT]清分少女放出了帕路奇亚！
OnSendOut spot:1,prevIndex:0
记录了帕路奇亚
对手的帕路奇亚释放了压力！
OnAbilityMessage spot:1,ability:46,part:0,type:0,foe:0,other:0
将记录帕路奇亚的特性压迫感
帕路奇亚的特性是压迫感
将估算帕路奇亚的速度
temptype:18
46
蕾冠王（骑黑马的样子） standard:-10
鳃鱼龙 standard:-105
武道熊师 standard:-50
帕路奇亚 standard:-105
帝牙卢卡 standard:50
蕾冠王（骑黑马的样子） standard:-10
鳃鱼龙 standard:-105
武道熊师 standard:-50
帕路奇亚 standard:-105
帝牙卢卡 standard:50
蕾冠王（骑黑马的样子） standard:-10
鳃鱼龙 standard:-105
武道熊师 standard:-50
帕路奇亚 standard:-105
帝牙卢卡 standard:50
me=100% foe=100% sw:best=0 good=0 for=0 pow=[近身战:201.45308483290484,三旋击:160.36025706940873,急速折返:157.9357326478149,毒击:120.04627249357327]
近身战:power 201.45308483290484 accurcy 100 damagePercent 0.5372082262210796
三旋击:power 160.36025706940873 accurcy 90 damagePercent 0.42762735218508996
急速折返:power 157.9357326478149 accurcy 100 damagePercent 0.42116195372750637
毒击:power 120.04627249357327 accurcy 100 damagePercent 0.3201233933161954
softmax: pool=77 T=2 switchP=0(bench=0) candidates=4 chosen=3(毒击) [近身战,三旋击,急速折返,毒击]=100,89,88,77
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined

## 回合1：费洛美螂的道具是专爱围巾，专爱系列道具倾向于低温度的保守策略，避免发散；这种情况下UT的权重应该很高，其他攻击招式如果不能秒对面，很可能被反杀（原因是费洛美螂没有耐久），都要降低权重。近身战有属性盲点（幽灵），在对手信息极少的情况下权重更应降低。而假如能秒人并且没有属性盲点，由于异兽提升特性，权重可以提高。
## 毒击在这里非常差，人类玩家通常会选择UT

开始回合1
费洛美螂使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
对手的帕路奇亚失去了26%的HP！
毒击造成了26伤害
最大物耐：105976.92307692308
最小物耐：90080.38461538461

对手的帕路奇亚使用了龙尾！
OnUseAttack spot:1,attack:525
记录技能：龙尾
费洛美螂失去了157HP！(55%的HP)
OnSendBack spot:0
OnSendOut spot:0,prevIndex:2
鳃鱼龙强制上场！
OnMoveMessage spot:1,move:107,part:2,type:15,foe:0,other:0,q:

对手的帕路奇亚的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
将估算帕路奇亚的速度
temptype:18
46
蕾冠王（骑黑马的样子） standard:-15
费洛美螂 standard:-100
武道熊师 standard:-50
帕路奇亚 standard:-160
帝牙卢卡 standard:35
蕾冠王（骑黑马的样子） standard:-15
费洛美螂 standard:-100
武道熊师 standard:-50
帕路奇亚 standard:-160
帝牙卢卡 standard:35
蕾冠王（骑黑马的样子） standard:-15
费洛美螂 standard:-100
武道熊师 standard:-50
帕路奇亚 standard:-160
帝牙卢卡 standard:35
me=100% foe=79% sw:best=0 good=0 for=0 pow=[逆鳞:367.4807197943444,精神之牙:131.0244215938303,踢倒:82.32904884318766,鳃咬:49.13415809768637]
逆鳞:power 367.4807197943444 accurcy 100 damagePercent 1.0351569571671673
精神之牙:power 131.0244215938303 accurcy 100 damagePercent 0.3690828777290995
踢倒:power 82.32904884318766 accurcy 100 damagePercent 0.23191281364278216
鳃咬:power 49.13415809768637 accurcy 100 damagePercent 0.1384060791484123
softmax: pool=75 T=2 switchP=0(bench=0) candidates=4 chosen=1(逆鳞) [逆鳞,精神之牙,踢倒,鳃咬]=100,59,47,36
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

## 回合2 鳃鱼龙也是围巾，温度需要降低，逆鳞外的招式选择率应<5%

开始回合2
鳃鱼龙使用了逆鳞！
OnUseAttack spot:0,attack:200
记录技能：逆鳞
这非常有效！
对手的帕路奇亚失去了79%的HP！
逆鳞造成了79伤害
最大物耐：105976.92307692308
最小物耐：90783.87341772154
onMajorStatusChage spot:1 status:31
对手的帕路奇亚倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了莱希拉姆！
OnSendOut spot:1,prevIndex:3
记录了莱希拉姆

对手的莱希拉姆有兆级电压/涡轮火焰特性！
OnAbilityMessage spot:1,ability:40,part:0,type:0,foe:1,other:164
将记录莱希拉姆的特性兆级电压/涡轮火焰
莱希拉姆的特性是兆级电压/涡轮火焰


开始回合3
鳃鱼龙使用了逆鳞！
OnUseAttack spot:0,attack:200
记录技能：逆鳞
这非常有效！
对手的莱希拉姆失去了95%的HP！
逆鳞造成了95伤害
最大物耐：88816.42105263159
最小物耐：75493.95789473686

对手的莱希拉姆使用了真气弹！
OnUseAttack spot:1,attack:411
记录技能：真气弹
鳃鱼龙失去了269HP！(83%的HP)
对手的莱希拉姆因为生命玉而受到了伤害！
OnItemMessage spot:1,item:21,part:0,berry:0,foe:0,other:0
onMajorStatusChage spot:1 status:31
对手的莱希拉姆倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了露奈雅拉！
OnSendOut spot:1,prevIndex:1
记录了露奈雅拉

开始回合4
鳃鱼龙使用了逆鳞！
OnUseAttack spot:0,attack:200
记录技能：逆鳞
对手的露奈雅拉失去了20%的HP！
逆鳞造成了20伤害
最大物耐：210939.00000000003
最小物耐：179298.15000000002
鳃鱼龙平静下来了！
OnMoveMessage spot:0,move:93,part:0,type:15,foe:0,other:0,q:
鳃鱼龙混乱了！
onMajorStatusChage spot:0 status:6

对手的露奈雅拉使用了祸不单行！
OnUseAttack spot:1,attack:506
记录技能：祸不单行
鳃鱼龙失去了52HP！(16%的HP)
onMajorStatusChage spot:0 status:31
鳃鱼龙倒下了！
OnKo spot:0

## 武道熊师（恶系本系4倍克制露奈雅拉幽灵+超能）&蕾冠王（幽灵系本系4倍克制露奈雅拉），前者counter露奈雅拉，后者特性适合清场，在对手信息不足的情况下前者更合适

逆鳞造成了20伤害
最大物耐：210939.00000000003
最小物耐：179298.15000000002
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
蕾冠王（骑黑马的样子） standard:-75
费洛美螂 standard:-145
武道熊师 standard:15
帕路奇亚 standard:-45
帝牙卢卡 standard:35
好的交换选择：
好的防守选择：
好的攻击选择：1,3
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=1
swtich because of ko
Mew's放出了蕾冠王（骑黑马的样子）！
OnSendOut spot:0,prevIndex:1

蕾冠王（骑黑马的样子）使得[Lv0.吧服BOT]清分少女的队伍紧张得吃不了树果了！
OnAbilityMessage spot:0,ability:102,part:0,type:0,foe:0,other:0
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
费洛美螂 standard:-135
武道熊师 standard:75
帕路奇亚 standard:-45
帝牙卢卡 standard:35
费洛美螂 standard:-135
武道熊师 standard:75
帕路奇亚 standard:-45
帝牙卢卡 standard:35
费洛美螂 standard:-135
武道熊师 standard:75
帕路奇亚 standard:-45
帝牙卢卡 standard:35
me=100% foe=79% sw:best=1 good=1 for=1 pow=[星碎:1377.3156237383932,精神冲击:134.91158940397355,吸取之吻:97.16358498183286,诡计:0]
星碎:power 1377.3156237383932 accurcy 100 damagePercent 3.218027158267274
先手斩杀生效
softmax: pool=67 T=2 switchP=3(bench=484) candidates=3 chosen=2(精神冲击) [星碎,精神冲击,吸取之吻]=100,31,26
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

## 缺少对手后台信息，不应该使用精神冲击（对对手前台露奈雅拉没伤害），T应该很低（对手留场可以直接秒我）

开始回合5
[Lv0.吧服BOT]清分少女收回了露奈雅拉！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了三首恶龙！
OnSendOut spot:1,prevIndex:5
记录了三首恶龙

蕾冠王（骑黑马的样子）使用了精神冲击！
OnUseAttack spot:0,attack:473
记录技能：精神冲击
这对对手的三首恶龙没有效果！

将估算露奈雅拉的速度
temptype:18
26
费洛美螂 standard:5
武道熊师 standard:65
帕路奇亚 standard:-95
帝牙卢卡 standard:15
费洛美螂 standard:5
武道熊师 standard:65
帕路奇亚 standard:-95
帝牙卢卡 standard:15
费洛美螂 standard:5
武道熊师 standard:65
帕路奇亚 standard:-95
帝牙卢卡 standard:15
me=100% foe=100% sw:best=1 good=0 for=1 pow=[吸取之吻:449.04044943820224,星碎:199.33820224719102,诡计:0,精神冲击:0]
吸取之吻:power 449.04044943820224 accurcy 100 damagePercent 1.2202186126038104
星碎:power 199.33820224719102 accurcy 100 damagePercent 0.5416798974108452
诡计:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
精神冲击:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
softmax: pool=66 T=2 switchP=3(bench=484) candidates=2 chosen=3(吸取之吻) [吸取之吻,星碎]=100,66
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined

## 按照星碎的伤害跟吸取之吻的比较，星碎的权重应该很低。然后温度也应该低（对面对我有威胁）

开始回合6
蕾冠王（骑黑马的样子）使用了吸取之吻！
OnUseAttack spot:0,attack:564
记录技能：吸取之吻
这非常有效！
对手的三首恶龙失去了100%的HP！
吸取之吻造成了100伤害
最大特耐：93704
最小特耐：79648.4
对手的三首恶龙的能量被吸收了！
onMajorStatusChage spot:1 status:31
对手的三首恶龙倒下了！
OnKo spot:1
蕾冠王（骑黑马的样子）的特攻提升！
蕾冠王（骑黑马的样子）因为生命玉而受到了伤害！
OnItemMessage spot:0,item:21,part:0,berry:0,foe:0,other:0

[Lv0.吧服BOT]清分少女放出了玛夏多！
OnSendOut spot:1,prevIndex:2
记录了玛夏多

吸取之吻造成了100伤害
我方特攻等级与开始时不同，不进行计算！
将估算三首恶龙的速度
temptype:18
101
费洛美螂 standard:-35
武道熊师 standard:-15
帕路奇亚 standard:-15
帝牙卢卡 standard:-5
费洛美螂 standard:-35
武道熊师 standard:-15
帕路奇亚 standard:-15
帝牙卢卡 standard:-5
费洛美螂 standard:-35
武道熊师 standard:-15
帕路奇亚 standard:-15
帝牙卢卡 standard:-5
me=90% foe=100% sw:best=0 good=0 for=0 pow=[星碎:1191.208988764045,精神冲击:877.3430340557276,吸取之吻:333.9247191011236,诡计:0]
星碎:power 1191.208988764045 accurcy 100 damagePercent 3.159705540488183
先手斩杀生效
softmax: pool=56 T=2 switchP=14(bench=635) candidates=3 chosen=0(星碎) [星碎,精神冲击,吸取之吻]=100,85,52
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合7
对手的玛夏多使用了暗影偷盗！
OnUseAttack spot:1,attack:670
记录技能：暗影偷盗
这非常有效！
对手的玛夏多偷取了目标的能力提升!
OnMoveMessage spot:1,move:238,part:0,type:7,foe:0,other:0,q:
蕾冠王（骑黑马的样子）失去了307HP！(90%的HP)
onMajorStatusChage spot:0 status:31
蕾冠王（骑黑马的样子）倒下了！
OnKo spot:0

记录技能：星碎
将估算玛夏多的速度
两技能先制相等，开始计算！
分析出了对方的专爱围巾
玛夏多的最小基础速度是292
temptype:18
101
费洛美螂 standard:-95
武道熊师 standard:-75
帕路奇亚 standard:-65
帝牙卢卡 standard:-55
好的交换选择：
好的防守选择：
好的攻击选择：4,5
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=4
swtich because of ko
Mew's放出了帕路奇亚！
OnSendOut spot:0,prevIndex:4

## 这里可能没有记录到分析出对手专爱围巾的情况下已经锁暗影偷盗，如果能分析出来，武道熊师是比较合适的counter

帕路奇亚释放了压力！
OnAbilityMessage spot:0,ability:46,part:0,type:0,foe:0,other:0
将估算玛夏多的速度
两技能先制相等，开始计算！
玛夏多的最小基础速度是292
temptype:18
101
费洛美螂 standard:-100
武道熊师 standard:-80
帝牙卢卡 standard:-55
费洛美螂 standard:-100
武道熊师 standard:-80
帝牙卢卡 standard:-55
费洛美螂 standard:-100
武道熊师 standard:-80
帝牙卢卡 standard:-55
me=100% foe=100%[+1atk] sw:best=0 good=0 for=0 pow=[水炮:261.9016853932584,亚空裂斩:238.3651685393258,打雷:174.60112359550558,真气拳:0]
水炮:power 261.9016853932584 accurcy 80 damagePercent 0.7336181663676705
亚空裂斩:power 238.3651685393258 accurcy 95 damagePercent 0.6676895477292039
打雷:power 174.60112359550558 accurcy 70 damagePercent 0.48907877757844703
真气拳:power 0 accurcy 100 damagePercent 0
softmax: pool=44 T=1.6 switchP=7(bench=484) candidates=3 chosen=1(水炮) [水炮,亚空裂斩,打雷]=100,94,77
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合8
对手的玛夏多使用了暗影偷盗！
OnUseAttack spot:1,attack:670
记录技能：暗影偷盗
帕路奇亚失去了163HP！(50%的HP)

帕路奇亚使用了水炮！
OnUseAttack spot:0,attack:56
记录技能：水炮
对手的玛夏多失去了90%的HP！
水炮造成了90伤害
最大特耐：61449.33333333332
最小特耐：52231.93333333333

水炮造成了90伤害
最大特耐：61449.33333333332
最小特耐：52231.93333333333
将估算玛夏多的速度
两技能先制相等，开始计算！
temptype:18
101
费洛美螂 standard:-100
武道熊师 standard:-80
帝牙卢卡 standard:-55
费洛美螂 standard:-100
武道熊师 standard:-80
帝牙卢卡 standard:-55
费洛美螂 standard:-100
武道熊师 standard:-80
帝牙卢卡 standard:-55
me=49% foe=9%[+1atk] sw:best=0 good=0 for=0 pow=[水炮:261.9016853932584,亚空裂斩:238.3651685393258,打雷:174.60112359550558,真气拳:0]
水炮:power 261.9016853932584 accurcy 80 damagePercent 0.8235902056391773
亚空裂斩:power 238.3651685393258 accurcy 95 damagePercent 0.749576001695993
打雷:power 174.60112359550558 accurcy 70 damagePercent 0.5490601370927849
真气拳:power 0 accurcy 100 damagePercent 0
斩杀技能生效
softmax: pool=19 T=1.6 switchP=7(bench=484) candidates=3 chosen=1(水炮) [水炮,亚空裂斩,打雷]=100,94,77
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合9
对手的玛夏多使用了暗影偷盗！
OnUseAttack spot:1,attack:670
记录技能：暗影偷盗
帕路奇亚失去了159HP！(49%的HP)
onMajorStatusChage spot:0 status:31
帕路奇亚倒下了！
OnKo spot:0

记录技能：水炮
将估算玛夏多的速度
两技能先制相等，开始计算！
temptype:18
101
费洛美螂 standard:-95
武道熊师 standard:-75
帝牙卢卡 standard:-55
好的交换选择：
好的防守选择：
好的攻击选择：5
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=5
swtich because of ko
Mew's放出了帝牙卢卡！
OnSendOut spot:0,prevIndex:5

帝牙卢卡释放了压力！
OnAbilityMessage spot:0,ability:46,part:0,type:0,foe:0,other:0
将估算玛夏多的速度
两技能先制相等，开始计算！
temptype:18
101
费洛美螂 standard:-60
武道熊师 standard:-125
费洛美螂 standard:-60
武道熊师 standard:-125
费洛美螂 standard:-60
武道熊师 standard:-125
me=100% foe=9%[+1atk] sw:best=0 good=0 for=0 pow=[流星群:338.8820224719101,大字爆炎:191.47191011235952,隐形岩:0,剧毒:0]
流星群:power 338.8820224719101 accurcy 90 damagePercent 0.9627330183861083
大字爆炎:power 191.47191011235952 accurcy 85 damagePercent 0.5439542900919304
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：2
斩杀技能生效
softmax: pool=19 T=1.6 switchP=3(bench=484) candidates=3 chosen=0(隐形岩) [流星群,大字爆炎,隐形岩]=100,69,37
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
## 人类应该不太会用隐形岩，但从33%的伤害来评估的话，隐形岩应该还算合理
开始回合10
对手的玛夏多使用了暗影偷盗！
OnUseAttack spot:1,attack:670
记录技能：暗影偷盗
帝牙卢卡失去了136HP！(33%的HP)

帝牙卢卡使用了隐形岩！
OnUseAttack spot:0,attack:446
记录技能：隐形岩
锋利的岩石悬浮在[Lv0.吧服BOT]清分少女队伍的空中！
OnMoveMessage spot:0,move:124,part:0,type:5,foe:1,other:0,q:

帝牙卢卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
将估算玛夏多的速度
两技能先制相等，开始计算！
temptype:18
101
费洛美螂 standard:-60
武道熊师 standard:-125
费洛美螂 standard:-60
武道熊师 standard:-125
费洛美螂 standard:-60
武道熊师 standard:-125
me=72% foe=9%[+1atk] sw:best=0 good=0 for=0 pow=[流星群:338.8820224719101,大字爆炎:191.47191011235952,隐形岩:0,剧毒:0]
流星群:power 338.8820224719101 accurcy 90 damagePercent 0.9036853932584269
大字爆炎:power 191.47191011235952 accurcy 85 damagePercent 0.5105917602996254
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：2
斩杀技能生效
softmax: pool=19 T=1.6 switchP=2(bench=484) candidates=2 chosen=1(流星群) [流星群,大字爆炎]=100,69
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
## 流星群跟大字爆炎都能收残切命中率接近，大字爆炎更好吧，因为流星群降自己2段特攻
开始回合11
[Lv0.吧服BOT]清分少女收回了玛夏多！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了固拉多！
OnSendOut spot:1,prevIndex:4
记录了固拉多
锋利的岩石扎进了对手的固拉多的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

对手的固拉多的干旱特性加强了阳光！
帝牙卢卡使用了流星群！
OnUseAttack spot:0,attack:434
记录技能：流星群
对手的固拉多失去了71%的HP！
流星群造成了71伤害
最大特耐：101052.67605633802
最小特耐：85894.77464788732
帝牙卢卡的特攻迅速下降！

阳光很强。
对手的固拉多的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
帝牙卢卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
流星群造成了71伤害
我方特攻等级与开始时不同，不进行计算！
将估算玛夏多的速度
temptype:18
70
费洛美螂 standard:-10
武道熊师 standard:-50
费洛美螂 standard:-10
武道熊师 standard:-50
费洛美螂 standard:-10
武道熊师 standard:-50
me=78% foe=28% sw:best=0 good=0 for=0 pow=[流星群:170.94101123595505,大字爆炎:145.10393258426964,隐形岩:0,剧毒:0]
流星群:power 170.94101123595505 accurcy 90 damagePercent 0.4284235870575314
大字爆炎:power 145.10393258426964 accurcy 85 damagePercent 0.3636690039706006
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：2
rejected:I will switch!
费洛美螂 standard:-10
武道熊师 standard:-50
好的交换选择：
好的防守选择：
好的攻击选择：2,3
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2
## 第一发流星群71%伤害，特攻-2后同随机数水平应该是35%伤害，能收残，作为人类不太会选择换，而是继续打
开始回合12
Mew's收回了帝牙卢卡！
OnSendBack spot:0
Mew's放出了费洛美螂！
OnSendOut spot:0,prevIndex:2
## 结果就是直接把费洛美螂送掉了
对手的固拉多使用了断崖之剑！
OnUseAttack spot:1,attack:619
记录技能：断崖之剑
这不是很有效...
费洛美螂失去了126HP！(44%的HP)
onMajorStatusChage spot:0 status:31
费洛美螂倒下了！
OnKo spot:0

阳光很强。
对手的固拉多的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
将估算固拉多的速度
temptype:18
70
帝牙卢卡 standard:-5
武道熊师 standard:-45
好的交换选择：
好的防守选择：
好的攻击选择：2,3
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2
swtich because of ko
Mew's放出了帝牙卢卡！
OnSendOut spot:0,prevIndex:2

帝牙卢卡释放了压力！
OnAbilityMessage spot:0,ability:46,part:0,type:0,foe:0,other:0
将估算固拉多的速度
temptype:18
70
武道熊师 standard:-50
武道熊师 standard:-50
武道熊师 standard:-50
me=78% foe=34% sw:best=0 good=0 for=0 pow=[流星群:338.8820224719101,大字爆炎:287.2078651685393,隐形岩:0,剧毒:0]
流星群:power 338.8820224719101 accurcy 90 damagePercent 0.9794278106124569
大字爆炎:power 287.2078651685393 accurcy 85 damagePercent 0.8300805351691887
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：2
斩杀技能生效
softmax: pool=51 T=2 switchP=2(bench=484) candidates=2 chosen=2(大字爆炎) [流星群,大字爆炎]=100,92
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合13
对手的固拉多使用了隐形岩！
OnUseAttack spot:1,attack:446
记录技能：隐形岩
锋利的岩石悬浮在Mew's队伍的空中！
OnMoveMessage spot:1,move:124,part:0,type:5,foe:0,other:0,q:

帝牙卢卡使用了大字爆炎！
OnUseAttack spot:0,attack:126
记录技能：大字爆炎
对手的固拉多失去了34%的HP！
大字爆炎造成了34伤害
最大特耐：178558.23529411765
最小特耐：151774.5
onMajorStatusChage spot:1 status:31
对手的固拉多倒下了！
OnKo spot:1

阳光很强。
帝牙卢卡的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
[Lv0.吧服BOT]清分少女放出了玛夏多！
OnSendOut spot:1,prevIndex:4
锋利的岩石扎进了对手的玛夏多的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

大字爆炎造成了34伤害
最大特耐：178558.23529411765
最小特耐：151774.5
将估算固拉多的速度
两技能先制相等，开始计算！
固拉多的最小基础速度是216
temptype:18
101
武道熊师 standard:-125
武道熊师 standard:-125
武道熊师 standard:-125
me=84% foe=2% sw:best=0 good=0 for=0 pow=[流星群:338.8820224719101,大字爆炎:287.2078651685393,隐形岩:0,剧毒:0]
流星群:power 338.8820224719101 accurcy 90 damagePercent 0.9085308913456035
大字爆炎:power 287.2078651685393 accurcy 85 damagePercent 0.7699942765912582
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：2
斩杀技能生效
softmax: pool=18 T=2 switchP=2(bench=484) candidates=2 chosen=2(大字爆炎) [流星群,大字爆炎]=100,92
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合14
对手的玛夏多使用了近身战！
OnUseAttack spot:1,attack:370
记录技能：近身战
这非常有效！
帝牙卢卡失去了343HP！(84%的HP)
onMajorStatusChage spot:0 status:31
帝牙卢卡倒下了！
OnKo spot:0
对手的玛夏多的防御下降！
对手的玛夏多的特防下降！
## 场面应该已经属于残局了，T还是很高？不太对吧
阳光很强。
记录技能：大字爆炎
将估算玛夏多的速度
两技能先制相等，开始计算！
temptype:18
101
武道熊师 standard:-75
好的交换选择：
好的防守选择：
好的攻击选择：3
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=3
swtich because of ko
Mew's放出了武道熊师（一击流）！ (武道熊师)
OnSendOut spot:0,prevIndex:3
锋利的岩石扎进了武道熊师（一击流）的身体！
OnMoveMessage spot:0,move:124,part:1,type:5,foe:0,other:0,q:

将估算玛夏多的速度
两技能先制相等，开始计算！
temptype:18
101
me=93% foe=2% sw:best=0 good=0 for=0 pow=[暗冥强击:263.71469740634006,突袭:231.12536023054753,毒击:87.90489913544668,近身战:0]
暗冥强击:power 263.71469740634006 accurcy 100 damagePercent 0.8040082237998173
突袭:power 231.12536023054753 accurcy 100 damagePercent 0.7046504885077669
先制斩杀生效
softmax: pool=17 T=2 switchP=5(bench=484) candidates=3 chosen=2(毒击) [暗冥强击,突袭,毒击]=100,93,57
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

## 专爱围巾武道熊师，已经没有换人可能了（很重要，会锁招到底，T应该极低），对面场上是残血玛夏多，场下是露奈雅拉，这里点暗冥强击跟突袭都大概率赢了，但是点了毒击输了
## 另外点暗冥强击胜率是100%，突袭胜率还要低一些（不能稳定造成伤害且有PP限制），所以这里必须点暗冥强击

开始回合15
[Lv0.吧服BOT]清分少女收回了玛夏多！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了露奈雅拉！
OnSendOut spot:1,prevIndex:5
对手的露奈雅拉的厚底靴保护了对手的露奈雅拉！
OnMoveMessage spot:1,move:124,part:2,type:0,foe:1,other:0,q:

武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了10%的HP！
毒击造成了10伤害
对方物防等级与开始时不同，不进行计算！

阳光变弱了。
毒击造成了10伤害
对方物防等级与开始时不同，不进行计算！
将估算玛夏多的速度
temptype:18
193
me=93% foe=69% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.6470809262129538
softmax: pool=44 T=2 switchP=5(bench=484) candidates=3 chosen=2(毒击) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合16
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了11%的HP！
毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181

对手的露奈雅拉使用了羽栖！
OnUseAttack spot:1,attack:355
记录技能：羽栖
对手的露奈雅拉在地上歇息！
OnMoveMessage spot:1,move:150,part:0,type:2,foe:0,other:0,q:
对手的露奈雅拉回复了HP！
OnMoveMessage spot:1,move:60,part:0,type:2,foe:0,other:0,q:

毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
me=93% foe=100% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.7910417269616439
先手斩杀生效
softmax: pool=43 T=2 switchP=5(bench=484) candidates=3 chosen=1(突袭) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=100% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.695170880262967
softmax: pool=43 T=2 switchP=5(bench=484) candidates=2 chosen=3(暗冥强击) [暗冥强击,毒击]=100,28
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=100% sw:best=0 good=0 for=0 pow=[毒击:58.05960264900662,近身战:0]
毒击:power 58.05960264900662 accurcy 100 damagePercent 0.14773435788551303
近身战:power 0 accurcy 100 damagePercent 0
rejected:I will switch!
开始回合17
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了5%的HP！
毒击造成了5伤害
最大物耐：241267.99999999997
最小物耐：205077.8

对手的露奈雅拉使用了鬼火！
OnUseAttack spot:1,attack:261
记录技能：鬼火
对手的露奈雅拉的攻击没有命中！

毒击造成了5伤害
最大物耐：241267.99999999997
最小物耐：205077.8
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
me=93% foe=94% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.6747962302598063
softmax: pool=41 T=2 switchP=5(bench=484) candidates=3 chosen=3(暗冥强击) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=94% sw:best=0 good=0 for=0 pow=[突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
突袭:power 611.1258278145694 accurcy 100 damagePercent 1.3733164669990325
毒击:power 58.05960264900662 accurcy 100 damagePercent 0.13047101718877893
近身战:power 0 accurcy 100 damagePercent 0
softmax: pool=41 T=2 switchP=5(bench=484) candidates=2 chosen=2(毒击) [突袭,毒击]=100,30
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合18
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了11%的HP！
毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181

对手的露奈雅拉使用了清除浓雾！
OnUseAttack spot:1,attack:432
记录技能：清除浓雾
武道熊师（一击流）的回避率下降！
对手的露奈雅拉清理了场地！
OnMoveMessage spot:1,move:77,part:1,type:2,foe:0,other:0,q:

毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
me=93% foe=82% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.5178981084707612
先手斩杀生效
softmax: pool=39 T=2 switchP=7(bench=484) candidates=3 chosen=3(暗冥强击) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=82% sw:best=0 good=0 for=0 pow=[突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
突袭:power 611.1258278145694 accurcy 100 damagePercent 1.5710175522225436
先制斩杀生效
softmax: pool=39 T=2 switchP=7(bench=484) candidates=2 chosen=1(突袭) [突袭,毒击]=100,30
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=82% sw:best=0 good=0 for=0 pow=[毒击:58.05960264900662,近身战:0]
毒击:power 58.05960264900662 accurcy 100 damagePercent 0.1444268722612105
近身战:power 0 accurcy 100 damagePercent 0
rejected:I will switch!
开始回合19
[Lv0.吧服BOT]清分少女收回了露奈雅拉！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了玛夏多！
OnSendOut spot:1,prevIndex:5

武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的玛夏多失去了2%的HP！
毒击造成了2伤害
最大物耐：603170
最小物耐：512694.5
onMajorStatusChage spot:1 status:31
对手的玛夏多倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了露奈雅拉！
OnSendOut spot:1,prevIndex:5

毒击造成了2伤害
最大物耐：603170
最小物耐：512694.5
将估算露奈雅拉的速度
temptype:18
193
me=93% foe=82% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.6470809262129538
softmax: pool=11 T=2 switchP=7(bench=484) candidates=3 chosen=3(暗冥强击) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=82% sw:best=0 good=0 for=0 pow=[突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
突袭:power 611.1258278145694 accurcy 100 damagePercent 1.3952644470652271
毒击:power 58.05960264900662 accurcy 100 damagePercent 0.13255617043152196
近身战:power 0 accurcy 100 damagePercent 0
softmax: pool=11 T=2 switchP=7(bench=484) candidates=2 chosen=1(突袭) [突袭,毒击]=100,30
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=93% foe=82% sw:best=0 good=0 for=0 pow=[毒击:58.05960264900662,近身战:0]
毒击:power 58.05960264900662 accurcy 100 damagePercent 0.12248861318355828
近身战:power 0 accurcy 100 damagePercent 0
rejected:I will switch!
开始回合20
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了11%的HP！
毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181

对手的露奈雅拉使用了祸不单行！
OnUseAttack spot:1,attack:506
记录技能：祸不单行
这不是很有效...
武道熊师（一击流）失去了76HP！(22%的HP)

毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
me=71% foe=71% sw:best=0 good=0 for=0 pow=[暗冥强击:696.7152317880794,突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
暗冥强击:power 696.7152317880794 accurcy 100 damagePercent 1.5346150479913645
先手斩杀生效
softmax: pool=11 T=2 switchP=7(bench=484) candidates=3 chosen=3(暗冥强击) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=71% foe=71% sw:best=0 good=0 for=0 pow=[突袭:611.1258278145694,毒击:58.05960264900662,近身战:0]
突袭:power 611.1258278145694 accurcy 100 damagePercent 1.5550275516910164
先制斩杀生效
softmax: pool=11 T=2 switchP=7(bench=484) candidates=2 chosen=1(突袭) [突袭,毒击]=100,30
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=71% foe=71% sw:best=0 good=0 for=0 pow=[毒击:58.05960264900662,近身战:0]
毒击:power 58.05960264900662 accurcy 100 damagePercent 0.14514900662251656
近身战:power 0 accurcy 100 damagePercent 0
rejected:I will switch!
开始回合21
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了11%的HP！
毒击造成了11伤害
最大物耐：109667.27272727274
最小物耐：93217.18181818181

对手的露奈雅拉使用了鬼火！
OnUseAttack spot:1,attack:261
记录技能：鬼火
武道熊师（一击流）烧伤了！
onMajorStatusChage spot:0 status:4

武道熊师（一击流）因烧伤而受到伤害！
毒击造成了11伤害
最大物耐：54833.63636363637
最小物耐：46608.590909090904
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
me=65% foe=60% sw:best=0 good=0 for=0 pow=[暗冥强击:348.3576158940397,突袭:305.5629139072847,毒击:29.02980132450331,近身战:0]
暗冥强击:power 348.3576158940397 accurcy 100 damagePercent 0.8274527693445124
突袭:power 305.5629139072847 accurcy 100 damagePercent 0.7258026458605338
毒击:power 29.02980132450331 accurcy 100 damagePercent 0.06895439744537603
近身战:power 0 accurcy 100 damagePercent 0
softmax: pool=11 T=2 switchP=7(bench=484) candidates=3 chosen=3(暗冥强击) [暗冥强击,突袭,毒击]=100,93,28
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=65% foe=60% sw:best=0 good=0 for=0 pow=[突袭:305.5629139072847,毒击:29.02980132450331,近身战:0]
突袭:power 305.5629139072847 accurcy 100 damagePercent 0.6529122092035998
毒击:power 29.02980132450331 accurcy 100 damagePercent 0.062029490009622455
近身战:power 0 accurcy 100 damagePercent 0
softmax: pool=11 T=2 switchP=7(bench=484) candidates=2 chosen=1(突袭) [突袭,毒击]=100,30
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=65% foe=60% sw:best=0 good=0 for=0 pow=[毒击:29.02980132450331,近身战:0]
毒击:power 29.02980132450331 accurcy 100 damagePercent 0.06269935491253414
近身战:power 0 accurcy 100 damagePercent 0
rejected:I will switch!

开始回合22
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了5%的HP！
毒击造成了5伤害
最大物耐：120633.99999999999
最小物耐：102538.9

对手的露奈雅拉使用了祸不单行！
OnUseAttack spot:1,attack:506
记录技能：祸不单行
这不是很有效...
武道熊师（一击流）失去了144HP！(42%的HP)

武道熊师（一击流）因烧伤而受到伤害！
毒击造成了5伤害
最大物耐：120633.99999999999
最小物耐：102538.9
将估算露奈雅拉的速度
两技能先制相等，开始计算！
temptype:18
193
me=17% foe=55% sw:best=0 good=0 for=0 pow=[暗冥强击:348.3576158940397,突袭:305.5629139072847,毒击:29.02980132450331,近身战:0]
暗冥强击:power 348.3576158940397 accurcy 100 damagePercent 0.7318437308698313
突袭:power 305.5629139072847 accurcy 100 damagePercent 0.6419388947632032
毒击:power 29.02980132450331 accurcy 100 damagePercent 0.060986977572485945
近身战:power 0 accurcy 100 damagePercent 0
softmax: pool=11 T=1.1 switchP=7(bench=484) candidates=3 chosen=1(突袭) [暗冥强击,突袭,毒击]=100,88,10
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=17% foe=55% sw:best=0 good=0 for=0 pow=[暗冥强击:348.3576158940397,毒击:29.02980132450331,近身战:0]
暗冥强击:power 348.3576158940397 accurcy 100 damagePercent 0.7443538801154695
毒击:power 29.02980132450331 accurcy 100 damagePercent 0.062029490009622455
近身战:power 0 accurcy 100 damagePercent 0
softmax: pool=11 T=1.1 switchP=7(bench=484) candidates=2 chosen=3(暗冥强击) [暗冥强击,毒击]=100,10
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
me=17% foe=55% sw:best=0 good=0 for=0 pow=[毒击:29.02980132450331,近身战:0]
毒击:power 29.02980132450331 accurcy 100 damagePercent 0.06256422699246403
近身战:power 0 accurcy 100 damagePercent 0
rejected:I will switch!

开始回合23
武道熊师（一击流）使用了毒击！
OnUseAttack spot:0,attack:398
记录技能：毒击
这不是很有效...
对手的露奈雅拉失去了5%的HP！
毒击造成了5伤害
最大物耐：120633.99999999999
最小物耐：102538.9
对手的露奈雅拉中毒了！
onMajorStatusChage spot:1 status:5

对手的露奈雅拉使用了祸不单行！
OnUseAttack spot:1,attack:506
记录技能：祸不单行
这不是很有效...
武道熊师（一击流）失去了58HP！(17%的HP)
onMajorStatusChage spot:0 status:31
武道熊师（一击流）倒下了！
OnKo spot:0

[Lv0.吧服BOT]清分少女获得了胜利！
[Lv0.吧服BOT]清分少女: 桑多涅，信不信我打爆你的脑袋，敲~

由于一位玩家关闭了战斗窗口，本窗口已失效。
