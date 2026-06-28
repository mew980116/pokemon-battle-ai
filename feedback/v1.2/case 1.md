Mew's与[Lv0.吧服BOT]清分少女的战斗开始了！
## 这把打的挺不错的

分级： BOT随机对战
模式：Singles
规则： 按照分级（计分）
规则： Sleep Clause
规则： Self-KO Clause
胜负分数变化： +10, -22

Mew's放出了酷豹！
OnSendOut spot:0,prevIndex:0
[Lv0.吧服BOT]清分少女放出了梦梦蚀！
OnSendOut spot:1,prevIndex:0
记录了梦梦蚀
将估算梦梦蚀的速度
temptype:18
108,28,118
旋转洛托姆 standard:25
高傲雉鸡 standard:-10
心蝙蝠 standard:10
脱壳忍者 standard:-5
泥巴鱼（伽勒尔的样子） standard:40
旋转洛托姆 standard:25
高傲雉鸡 standard:-10
心蝙蝠 standard:10
脱壳忍者 standard:-5
泥巴鱼（伽勒尔的样子） standard:40
旋转洛托姆 standard:25
高傲雉鸡 standard:-10
心蝙蝠 standard:10
脱壳忍者 standard:-5
泥巴鱼（伽勒尔的样子） standard:40
getFoeThreatToMe threat:0 bestDmg:0 spd:311vs[56,172]
me=100% foe=100% sw:best=0 good=0 for=0 pow=[拍落:414.27835051546384,突袭:296.96907216494844,急速折返:197.97938144329896,嬉闹:126.70103092783503]
## 考虑一个问题：如果我方速度比对方快，并且有比突袭伤害更高的招式，那么就可以直接不把突袭放入候选？或者直接假定伤害为0。这种情况下突袭负收益有点高（因为突袭虽然先制+1，但如果对手不使用攻击招式就使用失败）。当前代码逻辑是50%几率随机伤害视为0，但这是不够真实的
拍落:power 414.27835051546384 accurcy 100 damagePercent 1.0382916053019144
突袭:power 296.96907216494844 accurcy 100 damagePercent 0.7442833888845826
急速折返:power 197.97938144329896 accurcy 100 damagePercent 0.496188925923055
嬉闹:power 126.70103092783503 accurcy 90 damagePercent 0.31754644342815797
softmax: pool=78 T=2 alive=6 switchP=0(bench=0) thresh=0.65 floor=269 candidates=2 chosen=0(拍落) [拍落,突袭]=100,84
## 拍落跟突袭其实有上下位替代的关系，本身属性一样（打击面一样），突袭的+1先制度在这个场景没有收益，因此拍落是100%突袭的上位替代，softmax可以直接不要突袭
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合1
酷豹使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
这非常有效！
对手的梦梦蚀失去了100%的HP！
拍落造成了100伤害
最大物耐：82564.20000000001
最小物耐：70179.57
onMajorStatusChage spot:1 status:31
对手的梦梦蚀倒下了！
OnKo spot:1
酷豹使对手的梦梦蚀的讲究眼镜无效了！
OnMoveMessage spot:0,move:70,part:0,type:16,foe:1,other:6,q:

[Lv0.吧服BOT]清分少女放出了毛毛角羊！
OnSendOut spot:1,prevIndex:1
记录了毛毛角羊

拍落造成了100伤害
最大物耐：41282.100000000006
最小物耐：35089.785
将估算梦梦蚀的速度
temptype:18
204,80,185
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
getFoeThreatToMe threat:32 bestDmg:0.81 spd:311vs[162,302]

me=100% foe=100% sw:best=0 good=0 for=1 pow=[拍落:181.35347043701802,突袭:129.97172236503854,嬉闹:110.83290488431876,急速折返:86.6478149100257]
拍落:power 181.35347043701802 accurcy 100 damagePercent 0.6106177455791852
突袭:power 129.97172236503854 accurcy 100 damagePercent 0.4376152268183116
嬉闹:power 110.83290488431876 accurcy 90 damagePercent 0.3731747639202652
急速折返:power 86.6478149100257 accurcy 100 damagePercent 0.2917434845455411
softmax: pool=77 T=2 alive=6 switchP=1(bench=518) thresh=0.65 floor=117 candidates=2 chosen=3(突袭) [拍落,突袭]=100,84
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
getFoeThreatToMe threat:32 bestDmg:0.81 spd:311vs[162,302]
me=100% foe=100% sw:best=0 good=0 for=1 pow=[拍落:181.35347043701802,嬉闹:110.83290488431876,急速折返:86.6478149100257]
拍落:power 181.35347043701802 accurcy 100 damagePercent 0.5907279167329577
嬉闹:power 110.83290488431876 accurcy 90 damagePercent 0.36101923415087545
急速折返:power 86.6478149100257 accurcy 100 damagePercent 0.2822404394463378
softmax: pool=77 T=2 alive=6 switchP=1(bench=518) thresh=0.65 floor=117 candidates=1 chosen=0(拍落) [拍落]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合2
酷豹使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
对手的毛毛角羊失去了31%的HP！
拍落造成了31伤害
最大物耐：133168.06451612906
最小物耐：113192.8548387097
酷豹使对手的毛毛角羊的02零余果（睡眠）无效了！
OnMoveMessage spot:0,move:70,part:0,type:16,foe:1,other:8002,q:

对手的毛毛角羊使用了扑击！
OnUseAttack spot:1,attack:776
记录技能：扑击
这非常有效！
酷豹失去了204HP！(76%的HP)

拍落造成了31伤害
最大物耐：88778.70967741936
最小物耐：75461.90322580647
将估算毛毛角羊的速度
两技能先制相等，开始计算！
temptype:18
204,80,185
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
getFoeThreatToMe threat:60 bestDmg:1.09 spd:311vs[162,302]
me=23% foe=68% sw:best=0 good=0 for=1 pow=[突袭:129.97172236503854,拍落:120.90231362467867,嬉闹:110.83290488431876,急速折返:86.6478149100257]
突袭:power 129.97172236503854 accurcy 100 damagePercent 0.4592640366255779
拍落:power 120.90231362467867 accurcy 100 damagePercent 0.42721665591759245
嬉闹:power 110.83290488431876 accurcy 90 damagePercent 0.3916357063050133
急速折返:power 86.6478149100257 accurcy 100 damagePercent 0.30617602441705194
softmax: pool=75 T=1.1 alive=6 switchP=1(bench=518) thresh=0.75 floor=97 candidates=3 chosen=3(突袭) [突袭,拍落,嬉闹]=100,93,86
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
getFoeThreatToMe threat:60 bestDmg:1.09 spd:311vs[162,302]
me=23% foe=68% sw:best=0 good=0 for=1 pow=[拍落:120.90231362467867,嬉闹:110.83290488431876,急速折返:86.6478149100257]
拍落:power 120.90231362467867 accurcy 100 damagePercent 0.40983835127009716
嬉闹:power 110.83290488431876 accurcy 90 damagePercent 0.3757047623197246
急速折返:power 86.6478149100257 accurcy 100 damagePercent 0.2937214064746634
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
getFoeThreatToMe threat:60 bestDmg:1.09 spd:311vs[162,302]
me=23% foe=68% sw:best=0 good=0 for=1 pow=[拍落:120.90231362467867,嬉闹:110.83290488431876]
拍落:power 120.90231362467867 accurcy 100 damagePercent 0.349428652094447
嬉闹:power 110.83290488431876 accurcy 90 damagePercent 0.3203263146945629
softmax: pool=75 T=1.1 alive=6 switchP=1(bench=518) thresh=0.75 floor=90 candidates=2 chosen=2(嬉闹) [拍落,嬉闹]=100,92
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
getFoeThreatToMe threat:60 bestDmg:1.09 spd:311vs[162,302]
me=23% foe=68% sw:best=0 good=0 for=1 pow=[拍落:120.90231362467867]
拍落:power 120.90231362467867 accurcy 100 damagePercent 0.3912696233808371
rejected:I will switch!
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-10
脱壳忍者 standard:35
泥巴鱼（伽勒尔的样子） standard:70
好的交换选择：
好的防守选择：5
好的攻击选择：
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=5
开始回合3
Mew's收回了酷豹！
OnSendBack spot:0
Mew's放出了泥巴鱼（伽勒尔的样子）！
OnSendOut spot:0,prevIndex:5

对手的毛毛角羊使用了扑击！
OnUseAttack spot:1,attack:776
记录技能：扑击
这非常有效！
泥巴鱼（伽勒尔的样子）失去了122HP！(34%的HP)

泥巴鱼（伽勒尔的样子）的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
将估算毛毛角羊的速度
temptype:18
204,80,185
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
getFoeThreatToMe threat:28 bestDmg:0.46 spd:163vs[162,302]
me=71% foe=68% sw:best=0 good=0 for=0 pow=[地震:116.36760925449872,守住:0,哈欠:0,隐形岩:0]
地震:power 116.36760925449872 accurcy 100 damagePercent 0.43747221524247637
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
哈欠:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合4
对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
记录技能：棉花防守
对手的毛毛角羊的防御急剧提升！

泥巴鱼（伽勒尔的样子）使用了哈欠！
OnUseAttack spot:0,attack:281
记录技能：哈欠
泥巴鱼（伽勒尔的样子）使对手的毛毛角羊昏昏欲睡！
OnMoveMessage spot:0,move:144,part:0,type:0,foe:1,other:0,q:

泥巴鱼（伽勒尔的样子）的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
将估算毛毛角羊的速度
两技能先制相等，开始计算！
毛毛角羊的最小基础速度是163
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
getFoeThreatToMe threat:28 bestDmg:0.46 spd:163vs[163,302]
me=78% foe=68% sw:best=0 good=0 for=0 pow=[地震:52.27374301675978,守住:0,哈欠:0,隐形岩:0]
地震:power 52.27374301675978 accurcy 100 damagePercent 0.15840528186896904
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
哈欠:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合5
泥巴鱼（伽勒尔的样子）使用了守住！
OnUseAttack spot:0,attack:182
记录技能：守住
泥巴鱼（伽勒尔的样子）守护着自己！
OnMoveMessage spot:0,move:27,part:0,type:0,foe:0,other:0,q:

对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
记录技能：棉花防守
对手的毛毛角羊的防御急剧提升！

泥巴鱼（伽勒尔的样子）的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
对手的毛毛角羊睡着了！
onMajorStatusChage spot:1 status:2
将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
getFoeThreatToMe threat:28 bestDmg:0.46 spd:163vs[163,302]
me=84% foe=68% sw:best=0 good=0 for=1 pow=[地震:34.47751605995717,守住:0,哈欠:0,隐形岩:0]
地震:power 34.47751605995717 accurcy 100 damagePercent 0.1235753263797748
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
哈欠:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合6
对手的毛毛角羊正在睡觉。
对手的毛毛角羊使用了梦话！
OnUseAttack spot:1,attack:214
记录技能：梦话
对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
对手的毛毛角羊的防御无法higher了!
泥巴鱼（伽勒尔的样子）使用了隐形岩！
OnUseAttack spot:0,attack:446
记录技能：隐形岩
锋利的岩石悬浮在[Lv0.吧服BOT]清分少女队伍的空中！
OnMoveMessage spot:0,move:124,part:0,type:5,foe:1,other:0,q:

泥巴鱼（伽勒尔的样子）的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
将估算毛毛角羊的速度
两技能先制相等，开始计算！
毛毛角羊的最小基础速度是163
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
getFoeThreatToMe threat:28 bestDmg:0.46 spd:163vs[163,302]
me=90% foe=68% sw:best=0 good=0 for=1 pow=[地震:34.47751605995717,守住:0,哈欠:0,隐形岩:0]
地震:power 34.47751605995717 accurcy 100 damagePercent 0.09993482915929613
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
哈欠:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
变化技能的适应度：2
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：2
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：2
变化技能的适应度：0
变化技能的适应度：2
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合7
泥巴鱼（伽勒尔的样子）使用了守住！
OnUseAttack spot:0,attack:182
记录技能：守住
泥巴鱼（伽勒尔的样子）守护着自己！
OnMoveMessage spot:0,move:27,part:0,type:0,foe:0,other:0,q:

对手的毛毛角羊正在睡觉。

泥巴鱼（伽勒尔的样子）的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
getFoeThreatToMe threat:28 bestDmg:0.46 spd:163vs[163,302]
me=96% foe=68% sw:best=0 good=0 for=1 pow=[地震:34.47751605995717,守住:0,哈欠:0,隐形岩:0]
地震:power 34.47751605995717 accurcy 100 damagePercent 0.12629126761889073
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
哈欠:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
rejected:I will switch!
旋转洛托姆 standard:45
高傲雉鸡 standard:40
心蝙蝠 standard:45
脱壳忍者 standard:80
酷豹 standard:-20
好的交换选择：
好的防守选择：4
好的攻击选择：1
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=4

开始回合8
Mew's收回了泥巴鱼（伽勒尔的样子）！
OnSendBack spot:0
Mew's放出了脱壳忍者！
OnSendOut spot:0,prevIndex:4

对手的毛毛角羊正在睡觉。
对手的毛毛角羊使用了梦话！
OnUseAttack spot:1,attack:214
记录技能：梦话
对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
对手的毛毛角羊的防御无法higher了!

将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:35
高傲雉鸡 standard:35
心蝙蝠 standard:20
泥巴鱼（伽勒尔的样子） standard:120
酷豹 standard:-5
旋转洛托姆 standard:35
高傲雉鸡 standard:35
心蝙蝠 standard:20
泥巴鱼（伽勒尔的样子） standard:120
酷豹 standard:-5
旋转洛托姆 standard:35
高傲雉鸡 standard:35
心蝙蝠 standard:20
泥巴鱼（伽勒尔的样子） standard:120
酷豹 standard:-5
getFoeThreatToMe threat:22 bestDmg:0 spd:179vs[163,302]
me=100% foe=68% sw:best=0 good=0 for=1 pow=[影子偷袭:0,剧毒:0,守住:0,暗影爪:0]
影子偷袭:power 0 accurcy 100 damagePercent 0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：0
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
暗影爪:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
变化技能的适应度：2
变化技能的适应度：0
变化技能的适应度：2
变化技能的适应度：0
变化技能的适应度：2
变化技能的适应度：0
变化技能的适应度：2
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合9
脱壳忍者使用了守住！
OnUseAttack spot:0,attack:182
记录技能：守住
脱壳忍者守护着自己！
OnMoveMessage spot:0,move:27,part:0,type:0,foe:0,other:0,q:

onMajorStatusChage spot:1 status:0
对手的毛毛角羊醒来了！
对手的毛毛角羊使用了梦话！
OnUseAttack spot:1,attack:214
记录技能：梦话
但是失败了！
onAttackFailing spot:1 silent:false

将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
getFoeThreatToMe threat:22 bestDmg:0 spd:179vs[163,302]
me=100% foe=68% sw:best=0 good=0 for=1 pow=[影子偷袭:0,剧毒:0,守住:0,暗影爪:0]
影子偷袭:power 0 accurcy 100 damagePercent 0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：3
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
暗影爪:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合10
对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
记录技能：棉花防守
对手的毛毛角羊的防御无法higher了!

脱壳忍者使用了剧毒！
OnUseAttack spot:0,attack:92
记录技能：剧毒
脱壳忍者的攻击没有命中！

将估算毛毛角羊的速度
两技能先制相等，开始计算！
毛毛角羊的最小基础速度是179
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
getFoeThreatToMe threat:22 bestDmg:0 spd:179vs[179,302]
me=100% foe=68% sw:best=0 good=0 for=1 pow=[影子偷袭:0,剧毒:0,守住:0,暗影爪:0]
影子偷袭:power 0 accurcy 100 damagePercent 0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：3
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
暗影爪:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：3
变化技能的适应度：2
变化技能的适应度：2
变化技能的适应度：3
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合11
对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
记录技能：棉花防守
对手的毛毛角羊的防御无法higher了!

脱壳忍者使用了剧毒！
OnUseAttack spot:0,attack:92
记录技能：剧毒
对手的毛毛角羊中了剧毒！
onMajorStatusChage spot:1 status:5

对手的毛毛角羊受到了毒素的伤害！
将估算毛毛角羊的速度
两技能先制相等，开始计算！
毛毛角羊的最小基础速度是179
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
getFoeThreatToMe threat:22 bestDmg:0 spd:179vs[179,302]
me=100% foe=62% sw:best=0 good=0 for=1 pow=[影子偷袭:0,剧毒:0,守住:0,暗影爪:0]
影子偷袭:power 0 accurcy 100 damagePercent 0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：0
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
暗影爪:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：3
变化技能的适应度：3
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合12
脱壳忍者使用了守住！
OnUseAttack spot:0,attack:182
记录技能：守住
脱壳忍者守护着自己！
OnMoveMessage spot:0,move:27,part:0,type:0,foe:0,other:0,q:

对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
记录技能：棉花防守
对手的毛毛角羊的防御无法higher了!

对手的毛毛角羊受到了毒素的伤害！
将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
getFoeThreatToMe threat:22 bestDmg:0 spd:179vs[179,302]
me=100% foe=50% sw:best=0 good=0 for=1 pow=[影子偷袭:0,剧毒:0,守住:0,暗影爪:0]
影子偷袭:power 0 accurcy 100 damagePercent 0
剧毒:power 0 accurcy 90 damagePercent 0
变化技能的适应度：0
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
暗影爪:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
变化技能的适应度：1
变化技能的适应度：0
变化技能的适应度：1
变化技能的适应度：0
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：0
变化技能的适应度：1
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：1
rejected:I will switch!
旋转洛托姆 standard:-15
高傲雉鸡 standard:-15
心蝙蝠 standard:-30
泥巴鱼（伽勒尔的样子） standard:70
酷豹 standard:-55
好的交换选择：
好的防守选择：4
好的攻击选择：
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=4
## 人类好像不太会换泥巴鱼，因为对方对脱壳忍者不会有任何伤害，其实可以留场随便放招式。除非对面使用睡眠解决自己的剧毒。不过现阶段作为AI换了也行吧
## 另外从后面看起来泥巴鱼上场什么事都做不了，为什么这里有70的换人意愿
开始回合13
Mew's收回了脱壳忍者！
OnSendBack spot:0
Mew's放出了泥巴鱼（伽勒尔的样子）！
OnSendOut spot:0,prevIndex:4

对手的毛毛角羊使用了棉花防守！
OnUseAttack spot:1,attack:538
记录技能：棉花防守
对手的毛毛角羊的防御无法higher了!

泥巴鱼（伽勒尔的样子）的吃剩的东西使它回复了少量HP！
OnItemMessage spot:0,item:12,part:0,berry:0,foe:0,other:0
对手的毛毛角羊受到了毒素的伤害！
将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
getFoeThreatToMe threat:46 bestDmg:0.46 spd:163vs[179,302]
me=100% foe=31% sw:best=0 good=0 for=0 pow=[地震:34.47751605995717,守住:0,哈欠:0,隐形岩:0]
地震:power 34.47751605995717 accurcy 100 damagePercent 0.10543582892953263
守住:power 0 accurcy 100 damagePercent 0
变化技能的适应度：3
哈欠:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
隐形岩:power 0 accurcy 100 damagePercent 0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：3
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
变化技能的适应度：0
rejected:I will switch!
旋转洛托姆 standard:-5
高傲雉鸡 standard:-10
心蝙蝠 standard:-5
脱壳忍者 standard:30
酷豹 standard:-70
好的交换选择：
好的防守选择：
好的攻击选择：1
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=1

开始回合14
Mew's收回了泥巴鱼（伽勒尔的样子）！
OnSendBack spot:0
Mew's放出了旋转洛托姆！
OnSendOut spot:0,prevIndex:1

对手的毛毛角羊使用了扑击！
OnUseAttack spot:1,attack:776
记录技能：扑击
这不是很有效...
旋转洛托姆失去了124HP！(52%的HP)

对手的毛毛角羊受到了毒素的伤害！
将估算毛毛角羊的速度
drowsy:true
temptype:18
204,80,185
泥巴鱼（伽勒尔的样子） standard:70
高傲雉鸡 standard:-25
心蝙蝠 standard:-25
脱壳忍者 standard:20
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:70
高傲雉鸡 standard:-25
心蝙蝠 standard:-25
脱壳忍者 standard:20
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:70
高傲雉鸡 standard:-25
心蝙蝠 standard:-25
脱壳忍者 standard:20
酷豹 standard:-65
getFoeThreatToMe threat:8 bestDmg:0.16 spd:406vs[179,302]
me=47% foe=6% sw:best=0 good=0 for=1 pow=[十万伏特:139.97191011235955,空气斩:117.14325842696628,伏特替换:109.53370786516854,戏法:0]
十万伏特:power 139.97191011235955 accurcy 100 damagePercent 0.4981206765564397
先手斩杀生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合15
旋转洛托姆使用了十万伏特！
OnUseAttack spot:0,attack:85
记录技能：十万伏特
对手的毛毛角羊失去了6%的HP！
十万伏特造成了6伤害
最大特耐：487670
最小特耐：414519.5
onMajorStatusChage spot:1 status:31
对手的毛毛角羊倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了野蛮鲈鱼（红条纹的样子）！ (野蛮鲈鱼)
OnSendOut spot:1,prevIndex:3
记录了野蛮鲈鱼
锋利的岩石扎进了对手的野蛮鲈鱼（红条纹的样子）的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

十万伏特造成了6伤害
最大特耐：975340
最小特耐：829039
将估算毛毛角羊的速度
temptype:18
120,91,104
泥巴鱼（伽勒尔的样子） standard:-30
高傲雉鸡 standard:-25
心蝙蝠 standard:-25
脱壳忍者 standard:-20
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:-30
高傲雉鸡 standard:-25
心蝙蝠 standard:-25
脱壳忍者 standard:-20
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:-30
高傲雉鸡 standard:-25
心蝙蝠 standard:-25
脱壳忍者 standard:-20
酷豹 standard:-65
getFoeThreatToMe threat:14 bestDmg:0.53 spd:406vs[180,324]
me=47% foe=87% sw:best=0 good=0 for=0 pow=[十万伏特:411.5051975051975,伏特替换:321.39293139293136,空气斩:171.96049896049894,戏法:0]
十万伏特:power 411.5051975051975 accurcy 100 damagePercent 1.4644313078476778
伏特替换:power 321.39293139293136 accurcy 100 damagePercent 1.143747086807585
空气斩:power 171.96049896049894 accurcy 95 damagePercent 0.6119590710338041
戏法:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
softmax: pool=69 T=2 alive=6 switchP=5(bench=518) thresh=0.65 floor=267 candidates=2 chosen=0(十万伏特) [十万伏特,伏特替换]=100,90
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合16
旋转洛托姆使用了十万伏特！
OnUseAttack spot:0,attack:85
记录技能：十万伏特
这非常有效！
对手的野蛮鲈鱼（红条纹的样子）失去了87%的HP！
十万伏特造成了87伤害
最大特耐：67264.82758620688
最小特耐：57175.103448275855
onMajorStatusChage spot:1 status:31
对手的野蛮鲈鱼（红条纹的样子）倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了朽木妖！
OnSendOut spot:1,prevIndex:4
记录了朽木妖
锋利的岩石扎进了对手的朽木妖的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

十万伏特造成了87伤害
最大特耐：16816.20689655172
最小特耐：14293.775862068964
将估算野蛮鲈鱼的速度
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
getFoeThreatToMe threat:23 bestDmg:0.6 spd:406vs[105,232]
me=47% foe=87% sw:best=0 good=0 for=0 pow=[空气斩:252.0242179616549,十万伏特:75.30726538849646,伏特替换:58.905650857719465,戏法:0]
空气斩:power 252.0242179616549 accurcy 95 damagePercent 0.7730804231952604
十万伏特:power 75.30726538849646 accurcy 100 damagePercent 0.23100388155980509
伏特替换:power 58.905650857719465 accurcy 100 damagePercent 0.18069218054515174
戏法:power 0 accurcy 100 damagePercent 0
变化技能的适应度：2
变化技能的适应度：2
变化技能的适应度：2
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
getFoeThreatToMe threat:23 bestDmg:0.6 spd:406vs[105,232]
me=47% foe=87% sw:best=0 good=0 for=0 pow=[空气斩:252.0242179616549,十万伏特:75.30726538849646,伏特替换:58.905650857719465]
空气斩:power 252.0242179616549 accurcy 95 damagePercent 0.709927374539873
十万伏特:power 75.30726538849646 accurcy 100 damagePercent 0.21213314193942664
伏特替换:power 58.905650857719465 accurcy 100 damagePercent 0.1659314108668154
softmax: pool=59 T=2 alive=6 switchP=5(bench=518) thresh=0.65 floor=163 candidates=1 chosen=1(空气斩) [空气斩]=100
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
getFoeThreatToMe threat:23 bestDmg:0.6 spd:406vs[105,232]
me=47% foe=87% sw:best=0 good=0 for=0 pow=[十万伏特:75.30726538849646,伏特替换:58.905650857719465]
十万伏特:power 75.30726538849646 accurcy 100 damagePercent 0.21273238810309736
伏特替换:power 58.905650857719465 accurcy 100 damagePercent 0.1664001436658742
rejected:I will switch!
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:35
心蝙蝠 standard:-55
脱壳忍者 standard:-50
酷豹 standard:-45
好的交换选择：
好的防守选择：
好的攻击选择：2,5
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2
开始回合17
Mew's收回了旋转洛托姆！
OnSendBack spot:0
Mew's放出了高傲雉鸡！
OnSendOut spot:0,prevIndex:2

对手的朽木妖使用了鬼火！
OnUseAttack spot:1,attack:261
记录技能：鬼火
高傲雉鸡烧伤了！
onMajorStatusChage spot:0 status:4

对手的朽木妖的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
高傲雉鸡因烧伤而受到伤害！
将估算朽木妖的速度
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:25
旋转洛托姆 standard:-25
心蝙蝠 standard:-60
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:25
旋转洛托姆 standard:-25
心蝙蝠 standard:-60
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:25
旋转洛托姆 standard:-25
心蝙蝠 standard:-60
脱壳忍者 standard:-50
酷豹 standard:-45
getFoeThreatToMe threat:0 bestDmg:0.3 spd:285vs[105,232]
me=93% foe=93% sw:best=0 good=0 for=0 pow=[勇鸟猛攻:228.86566362170873,急速折返:44.91832348199892,舍身冲撞:0,清除浓雾:0]
勇鸟猛攻:power 228.86566362170873 accurcy 100 damagePercent 0.750379224989209
急速折返:power 44.91832348199892 accurcy 100 damagePercent 0.14727319174425874
舍身冲撞:power 0 accurcy 100 damagePercent 0
清除浓雾:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
softmax: pool=57 T=2 alive=6 switchP=2(bench=518) thresh=0.65 floor=148 candidates=1 chosen=0(勇鸟猛攻) [勇鸟猛攻]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合18
高傲雉鸡使用了勇鸟猛攻！
OnUseAttack spot:0,attack:413
记录技能：勇鸟猛攻
这非常有效！
对手的朽木妖失去了70%的HP！
勇鸟猛攻造成了70伤害
最大物耐：60052.28571428571
最小物耐：51044.44285714286
高傲雉鸡受到了伤害反弹！

对手的朽木妖使用了寄生种子！
OnUseAttack spot:1,attack:73
记录技能：寄生种子
高傲雉鸡被种下了种子
OnMoveMessage spot:1,move:72,part:1,type:11,foe:0,other:0,q:

对手的朽木妖的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
高傲雉鸡被种子吸收了HP！
OnMoveMessage spot:0,move:72,part:2,type:11,foe:0,other:0,q:
对手的朽木妖回复了HP！
OnMoveMessage spot:1,move:60,part:0,type:0,foe:0,other:0,q:
高傲雉鸡因烧伤而受到伤害！
勇鸟猛攻造成了70伤害
最大物耐：60052.28571428571
最小物耐：51044.44285714286
将估算朽木妖的速度
两技能先制相等，开始计算！
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:25
旋转洛托姆 standard:-25
心蝙蝠 standard:-60
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:25
旋转洛托姆 standard:-25
心蝙蝠 standard:-60
脱壳忍者 standard:-50
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:25
旋转洛托姆 standard:-25
心蝙蝠 standard:-60
脱壳忍者 standard:-50
酷豹 standard:-45
getFoeThreatToMe threat:3 bestDmg:0.3 spd:285vs[105,232]
me=51% foe=41% sw:best=0 good=0 for=0 pow=[勇鸟猛攻:228.86566362170873,急速折返:44.91832348199892,舍身冲撞:0,清除浓雾:0]
勇鸟猛攻:power 228.86566362170873 accurcy 100 damagePercent 0.613580867618522
急速折返:power 44.91832348199892 accurcy 100 damagePercent 0.12042445973726251
舍身冲撞:power 0 accurcy 100 damagePercent 0
清除浓雾:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
斩杀技能生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合19
[Lv0.吧服BOT]清分少女收回了朽木妖！
OnSendBack spot:1
[Lv0.吧服BOT]清分少女放出了千针鱼！
OnSendOut spot:1,prevIndex:5
记录了千针鱼
锋利的岩石扎进了对手的千针鱼的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

对手的千针鱼威吓了高傲雉鸡！
OnAbilityMessage spot:1,ability:34,part:0,type:0,foe:0,other:0
将记录千针鱼的特性威吓
千针鱼的特性是威吓
高傲雉鸡的攻击下降！
高傲雉鸡使用了勇鸟猛攻！
OnUseAttack spot:0,attack:413
记录技能：勇鸟猛攻
对手的千针鱼失去了24%的HP！
勇鸟猛攻造成了24伤害
我方物攻等级与开始时不同，不进行计算！
高傲雉鸡受到了伤害反弹！

对手的千针鱼的黑色淤泥使它回复了少量HP！
OnItemMessage spot:1,item:16,part:0,berry:0,foe:0,other:0
高傲雉鸡被种子吸收了HP！
OnMoveMessage spot:0,move:72,part:2,type:11,foe:0,other:0,q:
对手的千针鱼回复了HP！
OnMoveMessage spot:1,move:60,part:0,type:0,foe:0,other:0,q:
高傲雉鸡因烧伤而受到伤害！
勇鸟猛攻造成了24伤害
我方物攻等级与开始时不同，不进行计算！
将估算朽木妖的速度
temptype:18
22
泥巴鱼（伽勒尔的样子） standard:45
旋转洛托姆 standard:-15
心蝙蝠 standard:-30
脱壳忍者 standard:0
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:45
旋转洛托姆 standard:-15
心蝙蝠 standard:-30
脱壳忍者 standard:0
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:45
旋转洛托姆 standard:-15
心蝙蝠 standard:-30
脱壳忍者 standard:0
酷豹 standard:-65
getFoeThreatToMe threat:43 bestDmg:0.56 spd:285vs[157,295]
me=25% foe=82% sw:best=0 good=0 for=0 pow=[勇鸟猛攻:70.15979381443299,舍身冲撞:70.15979381443299,急速折返:13.850515463917523,清除浓雾:0]
勇鸟猛攻:power 70.15979381443299 accurcy 100 damagePercent 0.22272950417280313
舍身冲撞:power 70.15979381443299 accurcy 100 damagePercent 0.22272950417280313
急速折返:power 13.850515463917523 accurcy 100 damagePercent 0.04396989036164293
清除浓雾:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
rejected:I will switch!
泥巴鱼（伽勒尔的样子） standard:45
旋转洛托姆 standard:-15
心蝙蝠 standard:-30
脱壳忍者 standard:0
酷豹 standard:-65
好的交换选择：
好的防守选择：
好的攻击选择：2
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2

开始回合20
Mew's收回了高傲雉鸡！
OnSendBack spot:0
Mew's放出了旋转洛托姆！
OnSendOut spot:0,prevIndex:2

对手的千针鱼使用了攀瀑！
OnUseAttack spot:1,attack:127
记录技能：攀瀑
旋转洛托姆失去了96HP！(40%的HP)

对手的千针鱼的黑色淤泥使它回复了少量HP！
OnItemMessage spot:1,item:16,part:0,berry:0,foe:0,other:0
将估算千针鱼的速度
temptype:18
22
泥巴鱼（伽勒尔的样子） standard:40
高傲雉鸡 standard:-95
心蝙蝠 standard:-25
脱壳忍者 standard:0
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:40
高傲雉鸡 standard:-95
心蝙蝠 standard:-25
脱壳忍者 standard:0
酷豹 standard:-65
泥巴鱼（伽勒尔的样子） standard:40
高傲雉鸡 standard:-95
心蝙蝠 standard:-25
脱壳忍者 standard:0
酷豹 standard:-65
getFoeThreatToMe threat:21 bestDmg:0.54 spd:406vs[157,295]
me=7% foe=88% sw:best=0 good=0 for=0 pow=[十万伏特:411.5051975051975,伏特替换:321.39293139293136,空气斩:171.96049896049894,戏法:0]
十万伏特:power 411.5051975051975 accurcy 100 damagePercent 1.3147130910709184
伏特替换:power 321.39293139293136 accurcy 100 damagePercent 1.0268144772937104
空气斩:power 171.96049896049894 accurcy 95 damagePercent 0.5493945653690062
戏法:power 0 accurcy 100 damagePercent 0
先手斩杀生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合21
旋转洛托姆使用了十万伏特！
OnUseAttack spot:0,attack:85
记录技能：十万伏特
这非常有效！
对手的千针鱼失去了88%的HP！
十万伏特造成了88伤害
最大特耐：66500.45454545453
最小特耐：56525.38636363636
onMajorStatusChage spot:1 status:31
对手的千针鱼倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了夜曈！ (酷豹)
OnSendOut spot:1,prevIndex:2
记录了酷豹
锋利的岩石扎进了对手的夜曈的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

十万伏特造成了88伤害
最大特耐：33250.227272727265
最小特耐：28262.69318181818
将估算千针鱼的速度
temptype:18
7,84,158
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
getFoeThreatToMe threat:21 bestDmg:0.52 spd:406vs[195,342]
me=7% foe=87% sw:best=0 good=0 for=0 pow=[十万伏特:220.68749999999994,空气斩:184.40624999999997,伏特替换:172.31249999999997,戏法:0]
十万伏特:power 220.68749999999994 accurcy 100 damagePercent 0.7259457236842103
空气斩:power 184.40624999999997 accurcy 95 damagePercent 0.6065995065789472
伏特替换:power 172.31249999999997 accurcy 100 damagePercent 0.5668174342105262
戏法:power 0 accurcy 100 damagePercent 0
softmax: pool=46 T=1.1 alive=6 switchP=5(bench=518) thresh=0.75 floor=165 candidates=3 chosen=3(伏特替换) [十万伏特,空气斩,伏特替换]=100,84,82
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
getFoeThreatToMe threat:21 bestDmg:0.52 spd:406vs[195,342]
me=7% foe=87% sw:best=0 good=0 for=0 pow=[十万伏特:220.68749999999994,空气斩:184.40624999999997,戏法:0]
十万伏特:power 220.68749999999994 accurcy 100 damagePercent 0.8234608208955222
空气斩:power 184.40624999999997 accurcy 95 damagePercent 0.6880830223880596
戏法:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
softmax: pool=46 T=1.1 alive=6 switchP=5(bench=518) thresh=0.75 floor=165 candidates=2 chosen=1(空气斩) [十万伏特,空气斩]=100,84
sendCommand();choice.type=attack,slot=1,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-95
心蝙蝠 standard:-75
脱壳忍者 standard:-70
酷豹 standard:-45
getFoeThreatToMe threat:21 bestDmg:0.52 spd:406vs[195,342]
me=7% foe=87% sw:best=0 good=0 for=0 pow=[十万伏特:220.68749999999994,戏法:0]
十万伏特:power 220.68749999999994 accurcy 100 damagePercent 0.7307533112582779
戏法:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
softmax: pool=46 T=1.1 alive=6 switchP=5(bench=518) thresh=0.75 floor=165 candidates=1 chosen=0(十万伏特) [十万伏特]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合22
旋转洛托姆使用了十万伏特！
OnUseAttack spot:0,attack:85
记录技能：十万伏特
对手的夜曈失去了72%的HP！
十万伏特造成了72伤害
最大特耐：40639.166666666664
最小特耐：34543.291666666664

对手的夜曈使用了拍落！
OnUseAttack spot:1,attack:282
记录技能：拍落
旋转洛托姆失去了17HP！(7%的HP)
onMajorStatusChage spot:0 status:31
旋转洛托姆倒下了！
OnKo spot:0
对手的夜曈使旋转洛托姆的讲究围巾无效了！
OnMoveMessage spot:1,move:70,part:0,type:16,foe:0,other:5,q:

十万伏特造成了72伤害
最大特耐：40639.166666666664
最小特耐：34543.291666666664
将估算酷豹的速度
两技能先制相等，开始计算！
temptype:18
7,84,158
泥巴鱼（伽勒尔的样子） standard:15
高傲雉鸡 standard:-85
心蝙蝠 standard:-65
脱壳忍者 standard:-65
酷豹 standard:-45
好的交换选择：
好的防守选择：
好的攻击选择：2,5
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=5
swtich because of ko
Mew's放出了酷豹！
OnSendOut spot:0,prevIndex:5

将估算酷豹的速度
两技能先制相等，开始计算！
temptype:18
7,84,158
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-80
心蝙蝠 standard:-60
脱壳忍者 standard:-55
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-80
心蝙蝠 standard:-60
脱壳忍者 standard:-55
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-80
心蝙蝠 standard:-60
脱壳忍者 standard:-55
getFoeThreatToMe threat:37 bestDmg:0.35 spd:311vs[195,342]
me=23% foe=15% sw:best=0 good=0 for=0 pow=[嬉闹:382,急速折返:298,拍落:155.8125,突袭:111.75]
嬉闹:power 382 accurcy 90 damagePercent 1.3890909090909092
急速折返:power 298 accurcy 100 damagePercent 1.0836363636363637
拍落:power 155.8125 accurcy 100 damagePercent 0.5665909090909091
突袭:power 111.75 accurcy 100 damagePercent 0.40636363636363637
先制斩杀生效
sendCommand();choice.type=attack,slot=3,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合23
酷豹使用了突袭！
OnUseAttack spot:0,attack:389
记录技能：突袭
这不是很有效...
对手的夜曈失去了15%的HP！
突袭造成了15伤害
最大物耐：98794
最小物耐：83974.9
onMajorStatusChage spot:1 status:31
对手的夜曈倒下了！
OnKo spot:1

[Lv0.吧服BOT]清分少女放出了朽木妖！
OnSendOut spot:1,prevIndex:5
锋利的岩石扎进了对手的朽木妖的身体！
OnMoveMessage spot:1,move:124,part:1,type:5,foe:0,other:0,q:

突袭造成了15伤害
最大物耐：395176
最小物耐：335899.6
将估算酷豹的速度
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
getFoeThreatToMe threat:60 bestDmg:1 spd:311vs[105,232]
me=23% foe=28% sw:best=0 good=0 for=0 pow=[拍落:452.60666308436316,突袭:324.4868350349274,嬉闹:138.49435787211175,急速折返:108.1622783449758]
拍落:power 452.60666308436316 accurcy 100 damagePercent 1.22326125157936
突袭:power 324.4868350349274 accurcy 100 damagePercent 0.8769914460403444
嬉闹:power 138.49435787211175 accurcy 90 damagePercent 0.37430907533003177
急速折返:power 108.1622783449758 accurcy 100 damagePercent 0.29233048201344813
softmax: pool=15 T=1.1 alive=5 switchP=1(bench=518) thresh=0.97 floor=439 candidates=1 chosen=0(拍落) [拍落]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
getFoeThreatToMe threat:60 bestDmg:1 spd:311vs[105,232]
me=23% foe=28% sw:best=0 good=0 for=0 pow=[嬉闹:138.49435787211175,急速折返:108.1622783449758,突袭:0]
嬉闹:power 138.49435787211175 accurcy 90 damagePercent 0.44389217266702485
急速折返:power 108.1622783449758 accurcy 100 damagePercent 0.3466739690544096
突袭:power 0 accurcy 100 damagePercent 0
softmax: pool=15 T=1.1 alive=5 switchP=1(bench=518) thresh=0.97 floor=134 candidates=1 chosen=2(嬉闹) [嬉闹]=100
sendCommand();choice.type=attack,slot=2,zmove=undefined,mega=undefined,pokeSlot=undefined
checkDisabled();
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
getFoeThreatToMe threat:60 bestDmg:1 spd:311vs[105,232]
me=23% foe=28% sw:best=0 good=0 for=0 pow=[急速折返:108.1622783449758,突袭:0]
急速折返:power 108.1622783449758 accurcy 100 damagePercent 0.29233048201344813
突袭:power 0 accurcy 100 damagePercent 0
rejected:I will switch!
泥巴鱼（伽勒尔的样子） standard:20
高傲雉鸡 standard:-20
心蝙蝠 standard:-40
脱壳忍者 standard:-35
好的交换选择：
好的防守选择：
好的攻击选择：2
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2
开始回合24
Mew's收回了酷豹！
OnSendBack spot:0
Mew's放出了高傲雉鸡！
OnSendOut spot:0,prevIndex:2

对手的朽木妖使用了睡觉！
OnUseAttack spot:1,attack:156
记录技能：睡觉
对手的朽木妖睡着了并恢复了健康！
OnMoveMessage spot:1,move:106,part:0,type:13,foe:0,other:0,q:
onMajorStatusChage spot:1 status:2

高傲雉鸡因烧伤而受到伤害！
将估算朽木妖的速度
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:75
酷豹 standard:5
心蝙蝠 standard:-10
脱壳忍者 standard:0
泥巴鱼（伽勒尔的样子） standard:75
酷豹 standard:5
心蝙蝠 standard:-10
脱壳忍者 standard:0
泥巴鱼（伽勒尔的样子） standard:75
酷豹 standard:5
心蝙蝠 standard:-10
脱壳忍者 standard:0
getFoeThreatToMe threat:15 bestDmg:0.3 spd:285vs[105,232]
me=19% foe=100% sw:best=0 good=0 for=1 pow=[勇鸟猛攻:228.86566362170873,急速折返:44.91832348199892,舍身冲撞:0,清除浓雾:0]
勇鸟猛攻:power 228.86566362170873 accurcy 100 damagePercent 0.623612162456972
急速折返:power 44.91832348199892 accurcy 100 damagePercent 0.12239325199454747
舍身冲撞:power 0 accurcy 100 damagePercent 0
清除浓雾:power 0 accurcy 100 damagePercent 0
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
变化技能的适应度：1
softmax: pool=13 T=1.1 alive=5 switchP=2(bench=518) thresh=0.97 floor=221 candidates=1 chosen=0(勇鸟猛攻) [勇鸟猛攻]=100
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined

开始回合25
高傲雉鸡使用了勇鸟猛攻！
OnUseAttack spot:0,attack:413
记录技能：勇鸟猛攻
这非常有效！
对手的朽木妖失去了71%的HP！
勇鸟猛攻造成了71伤害
最大物耐：59206.47887323944
最小物耐：50325.50704225352
高傲雉鸡受到了伤害反弹！
onMajorStatusChage spot:0 status:31
高傲雉鸡倒下了！
OnKo spot:0

对手的朽木妖正在睡觉。

对手的朽木妖的吃剩的东西使它回复了少量HP！
OnItemMessage spot:1,item:12,part:0,berry:0,foe:0,other:0
勇鸟猛攻造成了71伤害
最大物耐：118412.95774647887
最小物耐：100651.01408450704
将估算朽木妖的速度
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:65
酷豹 standard:5
心蝙蝠 standard:5
脱壳忍者 standard:5
好的交换选择：
好的防守选择：1
好的攻击选择：2,4
sendCommand();choice.type=switch,slot=undefined,zmove=undefined,mega=undefined,pokeSlot=2
swtich because of ko
Mew's放出了酷豹！
OnSendOut spot:0,prevIndex:2

将估算朽木妖的速度
temptype:18
30,119,139
泥巴鱼（伽勒尔的样子） standard:70
心蝙蝠 standard:10
脱壳忍者 standard:15
泥巴鱼（伽勒尔的样子） standard:70
心蝙蝠 standard:10
脱壳忍者 standard:15
泥巴鱼（伽勒尔的样子） standard:70
心蝙蝠 standard:10
脱壳忍者 standard:15
getFoeThreatToMe threat:60 bestDmg:1 spd:311vs[105,232]
me=23% foe=34% sw:best=0 good=0 for=1 pow=[拍落:452.60666308436316,突袭:324.4868350349274,嬉闹:138.49435787211175,急速折返:108.1622783449758]
拍落:power 452.60666308436316 accurcy 100 damagePercent 1.2366302270064566
先手斩杀生效
sendCommand();choice.type=attack,slot=0,zmove=undefined,mega=undefined,pokeSlot=undefined
开始回合26
酷豹使用了拍落！
OnUseAttack spot:0,attack:282
记录技能：拍落
这非常有效！
对手的朽木妖失去了34%的HP！
拍落造成了34伤害
最大物耐：242835.8823529412
最小物耐：206410.5
onMajorStatusChage spot:1 status:31
对手的朽木妖倒下了！
OnKo spot:1
酷豹使对手的朽木妖的吃剩的东西无效了！
OnMoveMessage spot:0,move:70,part:0,type:16,foe:1,other:15,q:

Mew's获得了胜利！
[Lv0.吧服BOT]清分少女: 离家的...代价...

由于一位玩家关闭了战斗窗口，本窗口已失效。
