/*

0普通 1格斗 2飞行 3毒 4地面 5岩石 6虫 7鬼 8钢 9火 10水 11草 12电 13超能 14冰 15龙 16恶 17妖 18???
fpoke(battle.me).stat(2)
fpoke(battle.opp).minStat(2)
fpoke(battle.me).statBoost(1)
poke(0).status
poke(0).totalLife
poke(0).life
poke(0).lifePercent
sys.pokeNum(poke(1).pokeName)   poke(1).numRef
poke(0).ability
poke(1).basestat(1) 
fpoke(battle.opp).pokemon.numRef
*/
function typechart(typenumatk, typenumdef, special) { //1胆气2千箭齐发
    var chart = [
        [1, 1, 1, 1, 1, 0.5, 1, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, 1, 0.5, 0.5, 1, 2, 0.5, 0, 2, 1, 1, 1, 1, 0.5, 2, 1, 2, 0.5, 1],
        [1, 2, 1, 1, 1, 0.5, 2, 1, 0.5, 1, 1, 2, 0.5, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 0.5, 0.5, 0.5, 1, 0.5, 0, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1],
        [1, 1, 0, 2, 1, 2, 0.5, 1, 2, 2, 1, 0.5, 2, 1, 1, 1, 1, 1, 1],
        [1, 0.5, 2, 1, 0.5, 1, 2, 1, 0.5, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1],
        [1, 0.5, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 0.5, 1, 2, 1, 2, 1, 1, 2, 0.5, 1],
        [0, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0.5, 1, 1],
        [1, 1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 0.5, 1, 0.5, 1, 2, 1, 1, 2, 1],
        [1, 1, 1, 1, 1, 0.5, 2, 1, 2, 0.5, 0.5, 2, 1, 1, 2, 0.5, 1, 1, 1],
        [1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0.5, 0.5, 1, 1, 1, 0.5, 1, 1, 1],
        [1, 1, 0.5, 0.5, 2, 2, 0.5, 1, 0.5, 0.5, 2, 0.5, 1, 1, 1, 0.5, 1, 1, 1],
        [1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 2, 0.5, 0.5, 1, 1, 0.5, 1, 1, 1],
        [1, 2, 1, 2, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 0.5, 1, 1, 0, 1, 1],
        [1, 1, 2, 1, 2, 1, 1, 1, 0.5, 0.5, 0.5, 2, 1, 1, 0.5, 2, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 1, 1, 2, 1, 0, 1],
        [1, 0.5, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 1],
        [1, 2, 1, 0.5, 1, 1, 1, 1, 0.5, 0.5, 1, 1, 1, 1, 1, 2, 2, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];
    if (special === 1 && ([0, 1]).indexOf(typenumatk) !== -1 && typenumdef === 7) return 1;
    if (special === 2 && typenumdef === 2) return 1;
    return (chart[typenumatk][typenumdef]);

}

function recordBug(bug) {
    var dateObj = new Date();
    var time = "" + dateObj.getFullYear() + (dateObj.getMonth() + 1) + dateObj.getDate() + " " + dateObj.getHours() + dateObj.getMinutes() + dateObj.getSeconds();
    sys.appendToFile("buglog.txt", time + " " + bug + "\r\n");
    print_s(bug);
}

function getWeight(pokemon) {
    var weightData = {};
    var data = sys.getFileContent('db/pokes/weight.txt').split('\n');
    for (var x = 0; x < data.length; x++) {
        var line = data[x].split(" ");
        var pokenum = line[0].split(":");
        pokenum[0] = parseInt(65536 * pokenum[1], 10) + parseInt(pokenum[0], 10);
        weightData[pokenum[0]] = line[1];
    }
    return weightData[pokemon];
}

function calcBaseStats(pokeNum, stat, level, ev, iv, nature) {
    if (!level) level = 100;
    if (!ev) ev = 0;
    if (!iv) iv = 31;
    if (!nature) nature = 0;
    const buff = [0, 1, 1, 1, 1, 2, 0, 2, 2, 2, 5, 5, 0, 5, 5, 3, 3, 3, 0, 3, 4, 4, 4, 4, 0];
    const debuff = [0, 2, 5, 3, 4, 1, 0, 5, 3, 4, 1, 2, 0, 3, 4, 1, 2, 5, 0, 4, 1, 2, 5, 3, 0];
    var ret = sys.pokeBaseStats(pokeNum, 8)[stat];
    if (stat === 0) {
        if (baseStat === 1) return 1;
        return Math.floor((ret * 2 + iv + ev / 4) * level / 100 + 10 + level);
    }
    ret = (ret * 2 + iv + ev / 4) * level / 100 + 5;
    if (buff[nature] === stat) ret *= 1.1;
    if (debuff[nature] === stat) ret *= 0.9;
    return Math.floor(ret);
}

function statsCalcFromBase(pokeNum, stat, level) {
    if (!level) level = 100;
    var stats = [0, 0, 0];
    var baseStat = sys.pokeBaseStats(pokeNum, 8)[stat];
    if (stat === 0) {
        if (baseStat === 1) return [1, 1, 1];
        stats[0] = Math.floor((baseStat * 2 + 31 + 252 / 4) * level / 100 + 10 + level);
        stats[1] = Math.floor(baseStat * 2 * level / 100 + 10 + level);
        stats[2] = Math.floor((baseStat * 2 + 31) * level / 100 + 10 + level);
    } else {
        stats[0] = Math.floor(((baseStat * 2 + 31 + 252 / 4) * level / 100 + 5) * 1.1);
        stats[1] = Math.floor((baseStat * 2 * level / 100 + 5) * 0.9);
        stats[2] = Math.floor((baseStat * 2 + 31) * level / 100 + 5);
    }
    return stats;
}

function calcStatWhenBoost(baseStat, level) {
    if (level === 0) return baseStat;
    if (level > 0) return baseStat * (2 + level) / 2;
    if (level < 0) return baseStat * 2 / (2 + level);
    return baseStat;
}

var pokemonInfoCountainer = function (pokeNum, ability, item, stats, statboost, bulk) {
    var ret = {};
    ret.pokeNum = pokeNum;
    ret.ability = ability;
    ret.item = item;
    ret.stats = stats;
    ret.statboost = statboost;
    ret.bulk = bulk;
    return ret;
}

var turnMemory = {
    memory: {
        foeSlot: 0
    },
    reset: function () {
        this.memory = {
            foeSlot: 0
        };
    },
    recordOnBeginTurn: function () {
        var memory = {
            foeSlot: foeInformation.currentSlot,
            foePokeNum: fpoke(battle.opp).pokemon.numRef,
            myPokenum: poke(battle.me).numRef,
            foeStatus: fpoke(battle.opp).pokemon.status,
            myStatus: poke(battle.me).status,
            foeAtkBoost: fpoke(battle.opp).statBoost(1),
            foeDefBoost: fpoke(battle.opp).statBoost(2),
            foeSpABoost: fpoke(battle.opp).statBoost(3),
            foeSpDBoost: fpoke(battle.opp).statBoost(4),
            foeSpeBoost: fpoke(battle.opp).statBoost(5),
            myAtkBoost: fpoke(battle.me).statBoost(1),
            myDefBoost: fpoke(battle.me).statBoost(2),
            mySpABoost: fpoke(battle.me).statBoost(3),
            mySpDBoost: fpoke(battle.me).statBoost(4),
            mySpeBoost: fpoke(battle.me).statBoost(5),
            mySpe: fpoke(battle.me).stat(5),
            terrain: battle.data.field.terrain,
            weather: battle.data.field.weather
        }
        this.memory = memory;
    }
}

var previousTurnEventRecord = {
    first: -1,
    ct: [false, false],
    usemove: [0, 0],
    foeactiveability: 0,
    activeabilityorder: [],
    damage: [0, 0],
    foeAbilityRecord: {},
    reset: function () {
        this.first = -1;
        this.usemove = [0, 0];
        this.foeactiveability = 0;
        this.activeability = [];
        this.foeAbilityRecord = {};
        this.damage = [0, 0];
        this.ct = [false, false];
    },
    recordFirst: function (side) {
        if (this.first !== -1) return;
        this.first = side;
    },
    recordMove: function (side, move) {
        if (this.usemove[side] !== 0) return;
        this.usemove[side] = move;
        this.lastSpot = side;
        print_s("记录技能：" + sys.move(move));
    },
    recordFoeAbilityMess: function (slot, ab, part, other, type) {
        this.foeAbilityRecord.slot = slot;
        this.foeAbilityRecord.ab = ab;
        this.foeAbilityRecord.part = part;
        this.foeAbilityRecord.other = other;
        this.foeAbilityRecord.type = type;
    },
    recordDamage: function (spot, dam) {
        if (this.ct[spot]) dam /= 1.5;
        this.damage[spot] += dam;
        this.ct[spot] = false;
    },
    analyseCT: function (spot) {
        this.ct[spot] = true;
    }

}

var foeInformation = {
    pokemon: [{
        specialStatus: {}
    }, {
        specialStatus: {}
    }, {
        specialStatus: {}
    }, {
        specialStatus: {}
    }, {
        specialStatus: {}
    }, {
        specialStatus: {}
    }],
    currentSlot: 0,
    teamSpecailStatus: {},
    initial: function () {
        for (var i = 0; i < 6; i++) {
            var pokeinfo = {
                pokeNum: 0,
                item: -1,
                ability: -1,
                tempability: -1,
                maxDefBulk: 0,
                maxSpDBulk: 0,
                minDefBulk: 0,
                minSpDBulk: 0,
                hpPercentageWhenLeave: 0,
                currentIndex: i,
                maxBaseSpeed: 0,
                minBaseSpeed: 0,
                natureAdd: -1,
                natureLow: -1,
                ev: [0, 0, 0, 0, 0, 0],
                iv: [31, 31, 31, 31, 31, 31],
                level: 0,
                //moves: [],
                possibleAbility: [],
                specialStatus: {},
                lastMove: 0,
                mustUseMove: 0,
                temptype: 18
            };
            this.pokemon[i] = pokeinfo;
        }
    },
    emptyInfo: function () {
        var ret = {
            pokeNum: 0,
            item: -1,
            ability: -1,
            tempability: -1,
            maxDefBulk: 0,
            maxSpDBulk: 0,
            minDefBulk: 0,
            minSpDBulk: 0,
            hpPercentageWhenLeave: 0,
            currentIndex: this.findSlotFromNumber(fpoke(battle.opp).pokemon.numRef),
            maxBaseSpeed: 0,
            minBaseSpeed: 0,
            natureAdd: -1,
            natureLow: -1,
            ev: [0, 0, 0, 0, 0, 0],
            iv: [31, 31, 31, 31, 31, 31],
            level: 0,
            //moves: [],
            possibleAbility: [],
            specialStatus: {},
            lastMove: 0,
            temptype: 18
        }
        return ret;
    },
    findSlotFromIndex: function (index) {
        for (var i = 0; i < 6; i++) {
            if (typeof (this.pokemon[i]) !== "object") {
                recordBug("findSlotFromIndex出错 i=" + i + "this.pokemon[i]=" + this.pokemon[i]);
                continue;
            }
            if (this.pokemon[i].currentIndex === index) return i;
        }
        return 0;
    },
    findSlotFromNumber: function (number) {
        for (var i = 0; i < 6; i++) {
            {
                if (typeof (this.pokemon[i]) !== "object") {
                    recordBug("findSlotFromNumber出错 i=" + i + "this.pokemon[i]=" + this.pokemon[i]);
                    continue;
                }
                if (this.pokemon[i].pokeNum === number) return i;
            }
        }
        for (i = 0; i < 6; i++) {
            if (tpoke(i).numRef % 65536 === number % 65536) return i;
        }
        return 0;
    },
    changeIndex: function (slot1, slot2) {
        if (typeof (this.pokemon[slot1]) !== "object") {
            recordBug("changeIndex出错 slot1=" + slot1 + "this.pokemon[slot1]=" + this.pokemon[slot1]);
            return;
        }
        if (typeof (this.pokemon[slot2]) !== "object") {
            recordBug("changeIndex出错 slot2=" + slot2 + "this.pokemon[slot2]=" + this.pokemon[slot2]);
            return;
        }
        var temp = this.pokemon[slot1].currentIndex;
        this.pokemon[slot1].currentIndex = this.pokemon[slot2].currentIndex;
        this.pokemon[slot2].currentIndex = temp;
    },
    onfoeSwap: function (prevIndex) {
        if (prevIndex === 0) return;
        var oldSlot = this.currentSlot;
        this.currentSlot = this.findSlotFromIndex(prevIndex);
        if (this.currentSlot < 0 || this.currentSlot > 5) this.currentSlot = this.findSlotFromNumber(fpoke(battle.opp).pokemon.numRef);
        this.changeIndex(oldSlot, this.currentSlot);
        if (typeof (this.pokemon[oldSlot]) !== "object") {
            recordBug("onfoeSwap出错 oldSlot=" + oldSlot + "this.pokemon[oldSlot]=" + this.pokemon[oldSlot]);
            return;
        }
        this.pokemon[oldSlot].tempability = -1;
        this.pokemon[oldSlot].specialStatus = {};
        this.pokemon[oldSlot].lastMove = 0;
        this.pokemon[oldSlot].mustUseMove = 0;
        this.pokemon[oldSlot].temptype = 18;
        //print_s(sys.pokemon(this.pokemon[this.currentSlot].pokeNum) + "与" + sys.pokemon(this.pokemon[oldSlot].pokeNum) + "交换！");
    },
    loadInFoeNewPokeInfo: function () {
        var info = this.pokemon[this.currentSlot];
        if (typeof (info) !== "object") {
            recordBug("loadInFoeNewPokeInfo出错 currentSlot=" + this.currentSlot + "this.pokemon[currentSlot]=" + this.pokemon[this.currentSlot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum !== 0) {
            if (info.pokeNum % 65536 !== fpoke(battle.opp).pokemon.numRef % 65536) {
                if (fpoke(battle.opp).pokemon.numRef === 570 || fpoke(battle.opp).pokemon.numRef === 571) this.loadNewForm();
                else print_s("读取对手信息与内存数据不符！");
            }
            if (info.pokeNum % 65536 === fpoke(battle.opp).pokemon.numRef % 65536) this.loadNewForm();
            return;
        }
        info.pokeNum = fpoke(battle.opp).pokemon.numRef;
        info.maxBaseSpeed = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 5, fpoke(battle.opp).pokemon.level)[0];
        info.minBaseSpeed = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 5, fpoke(battle.opp).pokemon.level)[1];
        info.maxDefBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0, fpoke(battle.opp).pokemon.level)[0] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 2, fpoke(battle.opp).pokemon.level)[0];
        info.minDefBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0, fpoke(battle.opp).pokemon.level)[1] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 2, fpoke(battle.opp).pokemon.level)[1];
        info.maxSpDBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0, fpoke(battle.opp).pokemon.level)[0] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 4, fpoke(battle.opp).pokemon.level)[0];
        info.minSpDBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0, fpoke(battle.opp).pokemon.level)[1] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 4, fpoke(battle.opp).pokemon.level)[1];
        info.possibleAbility[0] = sys.pokeAbility(fpoke(battle.opp).pokemon.numRef, 0, 8);
        info.possibleAbility.push(sys.pokeAbility(fpoke(battle.opp).pokemon.numRef, 1, 8));
        info.possibleAbility.push(sys.pokeAbility(fpoke(battle.opp).pokemon.numRef, 2, 8));
        if (fpoke(battle.opp).pokemon.numRef === 658) info.possibleAbility.push(215);
        info.level = fpoke(battle.opp).pokemon.level;
        this.pokemon[this.currentSlot] = info;
        print_s("记录了" + sys.pokemon(info.pokeNum));
    },
    loadNewForm: function () {
        var info = this.pokemon[this.currentSlot];
        if (typeof (info) !== "object") {
            recordBug("loadInFoeNewForm出错 currentSlot=" + this.currentSlot + "this.pokemon[currentSlot]=" + this.pokemon[this.currentSlot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0 || info.pokeNum === fpoke(battle.opp).pokemon.numRef && fpoke(battle.opp).pokemon.numRef !== 570 && fpoke(battle.opp).pokemon.numRef !== 571) return;
        var oldNum = info.pokeNum;
        var oldMaxBaseSpeed = info.maxBaseSpeed;
        var oldMinBaseSpeed = info.minBaseSpeed;
        info.pokeNum == fpoke(battle.opp).pokemon.numRef;
        info.possibleAbility = [sys.pokeAbility(fpoke(battle.opp).pokemon.numRef, 0, 8)];
        if (info.pokeNum % 65536 === 555) info.possibleAbility[0] = 161;
        info.ability = 0;
        // (sys.pokeBaseStats(info.pokeNum, 7) * 2 + 31 + 252 / 4) * info.level / 100 + 5)*1.1
        if (info.natureAdd === 5) {
            info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed / 1.1 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 1.1);
            info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed / 1.1 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 1.1);
        } else if (info.natureLow === 5) {
            info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed / 0.9 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 0.9);
            info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed / 0.9 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 0.9);
        } else if (info.natureAdd !== -1) {
            if (sys.pokeBaseStats(info.pokeNum, 8)[5] > sys.pokeBaseStats(oldNum, 8)[5]) {
                info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5));
                info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed / 0.9 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 0.9);
            } else {
                info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed / 0.9 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 0.9);
                info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5));
            }
        } else if (info.natureLow !== -1) {
            if (sys.pokeBaseStats(info.pokeNum, 8)[5] > sys.pokeBaseStats(oldNum, 8)[5]) {
                info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed / 1.1 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 1.1);
                info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5));
            } else {
                info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5));
                info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed / 1.1 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 1.1);
            }
        } else {
            if (sys.pokeBaseStats(info.pokeNum, 8)[5] > sys.pokeBaseStats(oldNum, 8)[5]) {
                info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed / 1.1 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 1.1);
                info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed / 0.9 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 0.9);
            } else {
                info.maxBaseSpeed = Math.ceil(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMaxBaseSpeed / 0.9 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 0.9);
                info.minBaseSpeed = Math.floor(((sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + (oldMinBaseSpeed / 1.1 - 5) * 100 / info.level - sys.pokeBaseStats(oldNum, 8)[5] * 2) * info.level / 100 + 5) * 1.1);
            }
        }
        info.maxBaseSpeed = Math.min(info.maxBaseSpeed, statsCalcFromBase(info.pokeNum, 5, info.level)[0]);
        info.minBaseSpeed = Math.max(info.minBaseSpeed, statsCalcFromBase(info.pokeNum, 5, info.level)[1]);
        info.maxDefBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0)[0] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 2)[0];
        info.minDefBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0)[1] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 2)[1];
        info.maxSpDBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0)[0] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 4)[0];
        info.minSpDBulk = statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 0)[1] * statsCalcFromBase(fpoke(battle.opp).pokemon.numRef, 4)[1];
        print_s("记录了形态的变化");
        this.pokemon[this.currentSlot] = info;
    },
    loadAbility: function (slot, ability) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("loadAbility出错 slot=" + slot + "this.pokemon[slot]=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return;
        if (info.possibleAbility.indexOf(ability) === -1) info.tempability = ability;
        else info.ability = info.possibleAbility.indexOf(ability);
        this.pokemon[slot] = info;
    },
    analyseCurrentAbility: function (slot, ab, part, other, type, spot) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("analyseCurrentAbility出错 slot=" + slot + "this.pokemon[slot]=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        var ability = 0;
        switch (ab) {
            case 2:
                ability = 106;
                break;
            case 3:
                ability = 83;
                break;
            case 4:
                ability = 107;
                break;
            case 9:
                ability = 16;
                info.temptype = type;
                break;
            case 11:
                ability = 56;
                break;
            case 12:
                ability = 39;
                break;
            case 13:
                ability = 88;
                break;
            case 14:
                ability = ([117, 2, 45, 70])[part];
                break;
            case 15:
                ability = 87;
                break;
            case 16:
                ability = 27;
                break;
            case 17:
                ability = 142;
                break;
            case 18:
                ability = other;
                break;
            case 19:
                ability = 18;
                break;
            case 21:
                ability = 59;
                info.temptype = type;
                break;
            case 22:
                ability = 108;
                break;
            case 23:
                ability = 119;
                break;
            case 24:
                ability = 19;
                break;
            case 29:
                ability = 93;
                break;
            case 30:
                ability = other;
                break;
            case 31:
                ability = other;
                break;
            case 32:
                ability = other;
                break;
            case 33:
                ability = other;
                break;
            case 34:
                ability = 22;
                break;
            case 37:
                ability = 102;
                break;
            case 38:
                ability = other;
                break;
            case 40:
                ability = other;
                break;
            case 41:
                ability = 78;
                break;
            case 44:
                ability = 22;
                break;
            case 45:
                ability = 90;
                break;
            case 46:
                ability = 46;
                break;
            case 47:
                ability = 152;
                break;
            case 50:
                ability = other;
                break;
            case 54:
                ability = 61;
                break;
            case 55:
                ability = 112;
                if (part === 1) info.tempability = 0;
                break;
            case 56:
                ability = 94;
                break;
            case 57:
                ability = 43;
                break;
            case 58:
                ability = 3;
                break;
            case 60:
                ability = 80;
                break;
            case 61:
                ability = 28;
                break;
            case 66:
                info.tempability = other;
                ability = 36;
                break;
            case 67:
                ability = 54;
                break;
            case 68:
                ability = other;
                break;
            case 70:
                ability = other;
                break;
            case 71:
                ability = 25;
                break;
            case 74:
                ability = 133;
                break;
            case 77:
                ability = 161;
                break;
            case 78:
                ability = 124;
                break;
            case 80:
                ability = other;
                break;
            case 81:
                ability = 150;
                break;
            case 85:
                ability = 140;
                break;
            case 86:
                ability = 144;
                break;
            case 88:
                ability = 139;
                break;
            case 89:
                ability = other;
                break;
            case 90:
                ability = 147;
                break;
            case 91:
                ability = 5;
                break;
            case 93:
                ability = 53;
                break;
            case 94:
                ability = 154;
                break;
            case 95:
                ability = 141;
                break;
            case 96:
                ability = 130;
                break;
            case 97:
                ability = 155;
                break;
            case 99:
                ability = 131;
                break;
            case 102:
                ability = 127;
                break;
            case 103:
                ability = ([168, 169])[type - 16];
                break;
            case 104:
                ability = other;
                break;
            case 107:
                ability = 175;
                info.temptype = type;
                break;
            case 110:
                ability = 177;
                break;
            case 112:
                ability = 179;
                break;
            case 115:
                ability = 183;
                break;
            case 117:
                ability = 166;
                break;
            case 118:
                ability = 185;
                break;
            case 120:
                ability = 26;
                break;
            case 122:
                ability = 60;
                break;
            case 124:
                ability = 188;
                break;
            case 125:
                ability = 167;
                break;
            case 126:
                ability = ([189, 190, 191])[part];
                break;
            case 127:
                ability = 194;
                break;
            case 128:
                ability = ([198, 219, 220, 218])[part];
                break;
            case 129:
                ability = 199;
                break;
            case 133:
                ability = 205;
                break;
            case 138:
                ability = 203;
                info.temptype = 18;
                break;
            case 139:
                ability = 210;
                break;
            case 140:
                ability = 208;
                break;
            case 141:
                ability = 215;
                break;
            case 142:
                ability = 196;
                break;
            case 143:
                info.tempability = other;
                ability = 216;
                break;
            case 147:
                ability = 211;
                break;
            case 148:
                ability = 195;
                break;
            case 149:
                ability = 209;
                break;
            default:
                ability = 0;
        }
        print_s("将记录" + sys.pokemon(info.pokeNum) + "的特性" + sys.ability(ability));
        if (info.pokeNum === 0) return;
        if (info.possibleAbility.indexOf(ability) === -1) return;
        info.ability = info.possibleAbility.indexOf(ability);
        this.pokemon[slot] = info;
        print_s(sys.pokemon(info.pokeNum) + "的特性是" + sys.ability(ability));
    },
    analyseCurrentItem: function (itemMess, part) {
        var info = this.pokemon[this.currentSlot];
        if (typeof (info) !== "object") {
            recordBug("analyseCurrentItem出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return;
        var item = 0;
        switch (itemMess) {
            case 3:
                item = 37;
                break;
            case 4:
                item = 9;
                break;
            case 12:
                item = 15;
                break;
            case 16:
                item = 50;
                break;
            case 17:
                item = 180;
                break;
            case 19:
                item = ([71, 141])[part];
                break;
            case 21:
                item = 91;
                break;
            case 24:
                item = 126;
                break;
            case 29:
                item = 183;
                break;
            case 34:
                item = 235;
                break;
            case 35:
                item = ([0, 236])[part];
                break;
            case 41:
                item = 7;
                break;
            case 42:
                item = 332;
                break;
            case 66:
                item = 2001;
                break;
            case 67:
                item = 342;
                break;
            case 68:
                item = 3000;
                break;
            case 72:
                item = 363;
                break;
            case 73:
                item = 3034;
                break;
            default:
                item = 0;
        }
        info.item = item;
        this.pokemon[this.currentSlot] = info;
        //print_s(sys.pokemon(info.pokeNum) + "的道具是" + sys.item(item));
    },
    analyseCurrentMoveMess: function (spot, move, part, type, foe, other) {
        var info = this.pokemon[this.currentSlot];
        //print_s("将记录" + sys.pokemon(info.pokeNum) + "的信息");
        if (typeof (info) !== "object") {
            recordBug("analyseCurrentMoveMess出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return;
        switch (move) {
            case 1:
                if (part === 2 && foe === battle.opp) this.loadAbility(this.currentSlot, 64);
                return;
            case 11:
                this.clearLastMove();
                return;
            case 13:
                if (part < 6 && spot === battle.opp) info.lastMove = 340;
                break;
            case 14:
            case 19:
            case 20:
                if (spot === battle.opp) info.temptype = type;
                break;
            case 157:
                if (spot === battle.opp && part === 0) info.temptype = type;
                break;
            case 104:
                if (part < 6 && spot === battle.opp) info.lastMove = other;
                break;
            case 23:
                if (spot === battle.opp) info.item = other;
                break;
            case 25:
                if (foe === battle.opp && part === 0) info.specialStatus.cursed = true;
                break;
            case 28:
                if (part === 0 && foe === battle.opp) info.disabledMove = other;
                if (part === 2 && spot === battle.opp) info.disabledMove = 0;
                break;

            case 33:
                if (part === 0 && spot === battle.opp) info.specialStatus.encore = false;
                if (part === 1 && foe === battle.opp) info.specialStatus.encore = true;
                break;
            case 43:
                if (part === 0 && foe === battle.opp) this.loadAbility(this.currentSlot, 5);
                return;
            case 51:
            case 231:
                if (spot === battle.opp) info.tempability = 0;
                break;
            case 70:
                if (foe === battle.opp) info.item = 0;
                break;
            case 93:
                if (spot === battle.opp && part === 1) info.specialStatus.confused = true;
                break;
            case 95:
                if (spot === battle.me && other < 2) myInformation.needSwitch = true;
                if (spot === battle.opp) info.specialStatus.perishSong = true;
                break;
            case 105:
                if (spot === battle.opp) info.item = other;
                break;
            case 108:
                if (spot === battle.opp) info.tempability = other;
                if (spot === battle.me && other === 54) myInformation.needSwitch = true;
                break;
            case 112:
                if (spot === battle.opp) info.tempability = poke(foe).ability;
                break;
            case 114:
                if (spot === battle.opp) this.loadAbility(this.currentSlot, 6);
                return;
            case 132:
                if (spot === battle.opp) {
                    if (part === 0) info.item = poke(foe).item;
                    if (part === 1) info.item = other;
                }
                break;
            case 134:
                if (foe === battle.opp && part === 1) info.specialStatus.taunt = true;
                if (spot === battle.opp && part === 2) info.specialStatus.taunt = false;
            case 143:
                if (foe === battle.opp) info.tempability = other;
                if (foe === battle.me && other === 54) myInformation.needSwitch = true;
                break;
            case 144:
                if (part === 2 && spot === battle.opp) this.loadAbility(this.currentSlot, other);
                if (foe === battle.opp && part === 0) info.specialStatus.drowsy = true;
                if (foe === battle.me && part === 0 && switchesList.length > this.getPokeCount()) myInformation.needSwitch = true;
                return;
            case 158:
                if (foe === battle.opp) info.tempability = other;
                if (foe === battle.me && other === 54) myInformation.needSwitch = true;
                break;
            case 160:
                if (foe === battle.opp) info.item = 0;
                break;
            case 162:
                if (foe === battle.opp) info.item = other;
                break;
            case 72:
                if (foe === battle.opp && part === 1) info.specialStatus.seeded = true;
                if (foe === battle.opp && part === 0) info.specialStatus.seeded = false;
                break;
            case 175:
                if (foe === battle.opp) {
                    info.specialStatus.smackDown = true;
                    info.specialStatus.magnetRise = false;
                }
                break;
            case 68:
                if (spot === battle.opp && part === 0) info.specialStatus.magnetRise = true;
                if (spot === battle.opp && part === 1) info.specialStatus.magnetRise = false;
                break;
            case 174:
                if (foe === battle.opp && part === 0) info.specialStatus.magnetRise = true;
                if (spot === battle.opp && part === 1) info.specialStatus.magnetRise = false;
                break;
            case 73:
                if (spot === battle.opp) {
                    if (part === 0) this.teamSpecailStatus.reflect = true;
                    if (part === 1) this.teamSpecailStatus.lightScreen = true;
                    if (part === 4) this.teamSpecailStatus.reflect = false;
                    if (part === 5) this.teamSpecailStatus.lightScreen = false;
                }
                break;
            case 103:
                if (spot === battle.opp && part === 1) info.specialStatus.seeded = false;
                break;
            case 107:
                if (foe === battle.opp && part === 1) info.specialStatus.rooted = true;
                break;
            case 109:
                if (spot === battle.opp && part === 0) this.teamSpecailStatus.safeguard = true;
                if (spot === battle.opp && part === 1) this.teamSpecailStatus.safeguard = false;
                break;
            case 133:
                if (spot === battle.opp && part === 0) this.teamSpecailStatus.tailwind = true;
                if (spot === battle.opp && part === 1) this.teamSpecailStatus.tailwind = false;
                break;
            case 151:
                if (spot === battle.opp && part === 0) info.specialStatus.rooted = true;
                break;
            case 233:
                if (spot === battle.opp) info.specialStatus.burnUp = true;
                break;
            case 236:
                if (spot === battle.opp && part === 0) this.teamSpecailStatus.auroraVeil = true;
                if (spot === battle.opp && part === 1) this.teamSpecailStatus.auroraVeil = false;
                break;
        }
        this.pokemon[this.currentSlot] = info;
    },
    analyseMove: function (slot, move) {
        // print_s("slot:" + slot + " move:" + sys.move(move));
        // var info = this.pokemon[slot];
        // print_s("将记录" + sys.pokemon(info.pokeNum) + "的技能" + sys.move(move));
        // if (info.pokeNum === 0) return;
        // print_s("现有记录：" + info.moves);
        // if (info.moves.indexOf(move) !== -1 || info.moves.length >= 4 || move === 0) return;
        // info.moves.push(move);
        // this.pokemon[slot] = info;
        // print_s(sys.pokemon(info.pokeNum) + "的技能有" + sys.move(move));
    },
    analyseNature: function (slot) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("analyseNature出错 slot=" + slot + "slot=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return;
        if (info.minBaseSpeed > (sys.pokeBaseStats(info.pokeNum, 8)[5] * 2 + 31 + 252 / 4) * info.level / 100 + 5) info.natureAdd = 5;
        if (info.maxBaseSpeed < (sys.pokeBaseStats(info.pokeNum, 8)[5] * 2) * info.level / 100 + 5) info.natureLow = 5;
        this.pokemon[slot] = info;
        //print_s(sys.pokemon(info.pokeNum) + "性格增加:" + info.natureAdd);
        //print_s(sys.pokemon(info.pokeNum) + "性格降低:" + info.natureLow)
    },
    analyseCurrentDamage: function () {
        //print_s("对手造成的伤害：" + previousTurnEventRecord.damage[battle.opp]);
        //print_s("我方使用的技能：" + sys.move(previousTurnEventRecord.usemove[battle.me]));
        if (previousTurnEventRecord.damage[battle.opp] === 0) return;
        if (previousTurnEventRecord.usemove[battle.me] <= 0) return;
        if (turnMemory.memory.myPokenum !== poke(battle.me).numRef) return;
        //if (turnMemory.memory.foeSlot !== this.currentSlot) return;
        var info = this.pokemon[this.currentSlot];
        if (typeof (info) !== "object") {
            recordBug("analyseCurrentDamage出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return;
        var damage = previousTurnEventRecord.damage[battle.opp];
        var movenum = previousTurnEventRecord.usemove[battle.me];
        print_s(sys.move(movenum) + "造成了" + damage + "伤害");
        var maxpow = CalcMoveDamWithoutDef(movenum);
        if (maxpow === 0) {
            print_s("使用的技能无威力，不进行计算！");
            return;
        }
        var minpow = maxpow * 0.85;
        if (moveDataObj[movenum].category === 1) {
            if (fpoke(battle.opp).statBoost(2) !== turnMemory.memory.foeDefBoost) {
                print_s("对方物防等级与开始时不同，不进行计算！");
                return;
            }
            if (fpoke(battle.me).statBoost(1) !== turnMemory.memory.myAtkBoost) {
                print_s("我方物攻等级与开始时不同，不进行计算！");
                return;
            }
            if (fpoke(battle.opp).statBoost(2) !== 0 || maxpow / damage * 100 < info.minDefBulk || minpow / damage * 100 > info.maxDefBulk || fpoke(battle.me).statBoost(1) !== 0) {
                info.maxDefBulk = maxpow / damage * 100;

                info.minDefBulk = minpow / damage * 100;
            } else {
                if (maxpow / damage * 100 < info.maxDefBulk) info.maxDefBulk = maxpow / damage * 100;
                if (minpow / damage * 100 > info.minDefBulk) info.minDefBulk = minpow / damage * 100;
            }
            print_s("最大物耐：" + info.maxDefBulk);
            print_s("最小物耐：" + info.minDefBulk);
        }
        if (moveDataObj[movenum].category === 2) {
            if (fpoke(battle.opp).statBoost(4) !== turnMemory.memory.foeSpDBoost) {
                print_s("对方特防等级与开始时不同，不进行计算！");
                return;
            }
            if (fpoke(battle.me).statBoost(3) !== turnMemory.memory.mySpABoost) {
                print_s("我方特攻等级与开始时不同，不进行计算！");
                return;
            }
            if (fpoke(battle.opp).statBoost(4) !== 0 || maxpow / damage * 100 < info.minSpDBulk || minpow / damage * 100 > info.maxSpDBulk || fpoke(battle.me).statBoost(3) !== 0) {
                info.maxSpDBulk = maxpow / damage * 100;
                info.minSpDBulk = minpow / damage * 100;
            } else {
                if (maxpow / damage * 100 < info.maxSpDBulk) info.maxSpDBulk = maxpow / damage * 100;
                if (minpow / damage * 100 > info.minSpDBulk) info.minSpDBulk = minpow / damage * 100;
            }
            print_s("最大特耐：" + info.maxSpDBulk);
            print_s("最小特耐：" + info.minSpDBulk);
        }
        this.pokemon[this.currentSlot] = info;
    },
    analysePossibleSpeed: function (slot, mySpeed, foeSpeedBoost, mySpeedBoost, foePriority, myPriority) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("analysePossibleSpeed出错 slot=" + slot + "slot=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return;
        print_s("将估算" + sys.pokemon(info.pokeNum) + "的速度");
        var myMove = previousTurnEventRecord.usemove[battle.me];
        var foeMove = previousTurnEventRecord.usemove[battle.opp];
        var terrain = turnMemory.memory.terrain;
        var weather = turnMemory.memory.terrain;
        if (myMove <= 0 || foeMove <= 0) return;
        if (foePriority === null) foePriority = moveDataObj[foeMove].priority;
        if (myPriority === null) myPriority = moveDataObj[myMove].priority;
        if (myPriority !== foePriority) return;
        print_s("两技能先制相等，开始计算！");
        var tempbuf = 1;
        if (poke(battle.opp).status === 1) tempbuf *= 2;
        if (info.tempability !== -1 || info.ability !== -1) {
            if (this.hasAbility(slot, 112)) tempbuf *= 2;
            if (this.hasAbility(slot, 33) && weather === 2) tempbuf /= 2;
            if (this.hasAbility(slot, 34) && weather === 4) tempbuf /= 2;
            if (this.hasAbility(slot, 84) && this.getItem(slot) === 0) tempbuf /= 2;
            if (this.hasAbility(slot, 95) && poke(battle.opp).status === 5) tempbuf /= 2;
            if (this.hasAbility(slot, 146) && weather === 3) tempbuf /= 2;
            if (this.hasAbility(slot, 212) && terrain === 1) tempbuf /= 2;
            if (this.hasAbility(slot, 221) && weather === 1) tempbuf /= 2;
        }
        if (info.item === 5) tempbuf /= 1.5;
        if (info.item === 212) tempbuf *= 2;
        if (previousTurnEventRecord.first === battle.opp) {
            var foeMin = mySpeed * tempbuf;
            if (foeSpeedBoost > 0) foeMin = foeMin * 2 / (2 + foeSpeedBoost);
            if (foeSpeedBoost < 0) foeMin = foeMin * (2 + foeSpeedBoost) / 2;
            foeMin = Math.floor(foeMin);
            if (foeMin > info.maxBaseSpeed) {
                var itemBuf = 1;
                var abilityBuf = 1;
                if (info.item === -1) itemBuf /= 1.5;
                if (info.tempability === -1 || info.ability === -1) abilityBuf /= 2;
                if (!(this.hasAbility(slot, 33) && weather === 2)) abilityBuf = 1;
                if (!(this.hasAbility(slot, 34) && weather === 4)) abilityBuf = 1;
                if (!(this.hasAbility(slot, 84) && this.getItem(slot) === 0)) abilityBuf = 1;
                if (!(this.hasAbility(slot, 95) && poke(battle.opp).status === 5)) abilityBuf = 1;
                if (!(this.hasAbility(slot, 146) && weather === 3)) abilityBuf = 1;
                if (!(this.hasAbility(slot, 212) && terrain === 1)) abilityBuf = 1;
                if (!(this.hasAbility(slot, 221) && weather === 1)) abilityBuf = 1;
                if (foeMin * itemBuf * abilityBuf > info.maxBaseSpeed) {
                    print_s("对手理论最小速度无法计算！");
                    return;
                }
                info.minBaseSpeed = statsCalcFromBase(info.pokeNum, 5, info.level)[1];
                if (info.natureLow === 5) info.natureLow = -1;
                if (abilityBuf < 1) {
                    foeMin *= abilityBuf;
                    if (this.hasAbility(slot, 33) && weather === 2) info.ability = info.possibleAbility.indexOf(33);
                    if (this.hasAbility(slot, 34) && weather === 4) info.ability = info.possibleAbility.indexOf(34);
                    if (this.hasAbility(slot, 84) && this.getItem(slot) === 0) info.ability = info.possibleAbility.indexOf(84);
                    if (this.hasAbility(slot, 95) && poke(battle.opp).status === 5) info.ability = info.possibleAbility.indexOf(95);
                    if (this.hasAbility(slot, 146) && weather === 3) info.ability = info.possibleAbility.indexOf(146);
                    if (this.hasAbility(slot, 212) && terrain === 1) info.ability = info.possibleAbility.indexOf(212);
                    if (this.hasAbility(slot, 221) && weather === 1) info.ability = info.possibleAbility.indexOf(221);
                    print_s("分析出了对方的特性");
                }
                if (itemBuf < 1) {
                    foeMin *= itemBuf;
                    info.item = 5;
                    print_s("分析出了对方的专爱围巾");
                }
                if (foeMin < info.minBaseSpeed) {
                    foeMin /= itemBuf;
                    info.item = -1;
                    print_s("对方不会携带专爱围巾");
                }
                if (foeMin < info.minBaseSpeed) {
                    foeMin = foeMin / abilityBuf * itemBuf;
                    info.item = 5;
                    info.ability = 0;
                    print_s("对方只能携带专爱围巾");
                }
                if (foeMin < info.minBaseSpeed) {

                    print_s("无法再判断对方的速度");
                    return;
                }
            } else if (foeMin < info.minBaseSpeed) return;
            foeMin = Math.floor(foeMin);
            info.minBaseSpeed = foeMin;
            print_s(sys.pokemon(info.pokeNum) + "的最小基础速度是" + foeMin);
        }
        if (previousTurnEventRecord.first === battle.me) {
            var foeMax = mySpeed * tempbuf;
            if (foeSpeedBoost > 0) foeMax = foeMax * 2 / (2 + foeSpeedBoost);
            if (foeSpeedBoost < 0) foeMax = foeMax * (2 + foeSpeedBoost) / 2;
            foeMax = Math.ceil(foeMax);

            if (foeMax < info.minBaseSpeed) {
                info.maxBaseSpeed = statsCalcFromBase(info.pokeNum, 5, info.level)[0];
                if (info.natureAdd === 5) info.natureAdd = -1;
                if (info.item === -1) info.item = 212;
                foeMax = Math.ceil(foeMax * 2);
                if (foeMax < info.minBaseSpeed) {
                    print_s("对手理论最大速度无法计算！算得" + foeMax + "，但其最小理论速度为" + info.minBaseSpeed);
                    return;
                }
                print_s("按照对方携带黑色铁球进行了计算！");
            } else if (foeMax > info.maxBaseSpeed) return;
            info.maxBaseSpeed = foeMax;
            print_s(sys.pokemon(info.pokeNum) + "的最大基础速度是" + foeMax);
        }
        this.pokemon[slot] = info;
        this.analyseNature(slot);
    },
    getPossibleAbility: function (slot) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("getPossibleAbility出错 slot=" + slot + " this.pokemon[slot]=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        if (info.tempability !== -1) return [info.tempability];
        var ret = [];
        if (info.ability !== -1) ret[0] = info.possibleAbility[info.ability];
        else
            for (var i = 0; i < info.possibleAbility.length; i++) {
                if (i > 4) return [];
                if (info.possibleAbility[i] !== 0) ret.push(info.possibleAbility[i]);
            }
        //print_s("对手的可能特性：" + ret);
        return ret;
    },
    hasAbility: function (slot, ab) {
        return (this.getPossibleAbility(slot).indexOf(ab) !== -1)
    },
    getItem: function (slot) {
        //print_s("记录对手的道具：" + sys.item(this.pokemon[slot].item));
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("getItem出错 slot=" + slot + "slot=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        return info.item;
    },
    getPossibleBaseSpeed: function (slot) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("getPossibleBaseSpeed出错 slot=" + slot + "slot=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        var ret = [0, 0];
        ret[0] = info.minBaseSpeed;
        ret[1] = info.maxBaseSpeed;
        //print_s("记录对手的速度区间：" + ret);
        return ret;
    },
    getPossibleSpeed: function (slot, boost, buf) {
        var info = this.pokemon[slot];
        if (typeof (info) !== "object") {
            recordBug("getPossibleSpeed出错 slot=" + slot + "slot=" + this.pokemon[slot]);
            info = this.emptyInfo();
        }
        var ret = [0, 0];
        if (info.item === 5) buf *= 1.5;
        if (info.item === 212) buf /= 2;
        if (poke(battle.opp).status === 1) buf /= 2;
        if (this.teamSpecailStatus.tailwind === true) buf *= 2;
        var weather = battle.data.field.weather;
        var terrain = battle.data.field.terrain;
        var tempbuf = 1;
        if (this.hasAbility(slot, 33) && weather === 2) tempbuf *= 2;
        if (this.hasAbility(slot, 34) && weather === 4) tempbuf *= 2;
        if (this.hasAbility(slot, 84) && this.getItem(slot) === 0) tempbuf *= 2;
        if (this.hasAbility(slot, 95) && poke(battle.opp).status === 5) tempbuf *= 2;
        if (this.hasAbility(slot, 146) && weather === 3) tempbuf *= 2;
        if (this.hasAbility(slot, 212) && terrain === 1) tempbuf *= 2;
        if (this.hasAbility(slot, 221) && weather === 1) tempbuf *= 2;
        if (this.hasAbility(slot, 112)) tempbuf *= 2;
        if (info.tempability !== -1 || info.ability !== -1) ret[0] = Math.floor(calcStatWhenBoost(info.minBaseSpeed, boost) * buf * tempbuf);
        else ret[0] = Math.floor(calcStatWhenBoost(info.minBaseSpeed, boost) * buf);
        ret[1] = Math.ceil(calcStatWhenBoost(info.maxBaseSpeed, boost) * buf * tempbuf);
        return ret;
    },
    getCurrentPossibleDamage: function (movenum) {
        var ret = [0, 0];
        var info = this.pokemon[this.currentSlot];
        //print_s("将记录" + sys.pokemon(info.pokeNum) + "的信息");
        if (typeof (info) !== "object") {
            recordBug("getCurrentPossibleDamage出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            info = this.emptyInfo();
        }
        if (info.pokeNum === 0) return ret;
        if (movenum < 0) {
            recordBug("getCurrentPossibleDamage出错 movenum=" + movenum);
            return ret;
        }
        var maxpow = CalcMoveDamWithoutDef(movenum);
        if (maxpow === 0) return ret;
        var minpow = maxpow * 0.85;
        if (moveDataObj[movenum].category === 1) {
            ret[1] = maxpow / info.minDefBulk;
            ret[0] = minpow / info.maxDefBulk;
        }
        if (moveDataObj[movenum].category === 2) {
            ret[1] = maxpow / info.minSpDBulk;
            ret[0] = minpow / info.maxSpDBulk;
        }
        return ret;
    },
    hasMove: function (move) {
        var flag = false;
        for (var i = 0; i < 4; i++) {
            if (typeof (move) === "number") {
                if (fpoke(battle.opp).pokemon.move(i).num === move) {
                    flag = true;
                    if (this.hasSpecialStatus("encore") && this.pokemon[this.currentSlot].lastMove !== move || fpoke(battle.opp).pokemon.move(i).pp > 0 || this.pokemon[this.currentSlot].specialStatus.disabledMove !== move) return false;
                }
            }
            if (typeof (move) === "object") {
                if (move.indexOf(fpoke(battle.opp).pokemon.move(i).num) !== -1) {
                    flag = true;
                    if (fpoke(battle.opp).pokemon.move(i).pp === 0) return false;
                }
            }
        }
        return flag;
    },
    recordLastMove: function (move) {
        if (move === 0) return;
        if (typeof (this.pokemon[this.currentSlot]) !== "object") {
            recordBug("recordLastMove出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            return;
        }
        this.pokemon[this.currentSlot].lastMove = move;
    },
    clearLastMove: function () {
        if (typeof (this.pokemon[this.currentSlot]) !== "object") {
            recordBug("clearLastMove出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            return;
        }
        this.pokemon[this.currentSlot].lastMove = 0;
    },
    getLastMove: function () {
        if (typeof (this.pokemon[this.currentSlot]) !== "object") {
            recordBug("getLastMove出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            return 0;
        }
        return this.pokemon[this.currentSlot].lastMove;
    },
    getSpecailStatus: function () {
        if (typeof (this.pokemon[this.currentSlot]) !== "object") {
            recordBug("getSpecailStatus出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            return {};
        }
        return this.pokemon[this.currentSlot].specialStatus;
    },
    hasSpecialStatus: function (status) {
        if (typeof (this.pokemon[this.currentSlot]) !== "object") {
            recordBug("hasSpecailStatus出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot]=" + this.pokemon[this.currentSlot]);
            return false;
        }
        if (typeof (this.pokemon[this.currentSlot].specialStatus) !== "object") {
            recordBug("hasSpecailStatus出错 this.currentSlot=" + this.currentSlot + "this.pokemon[this.currentSlot].specialStatus=" + this.pokemon[this.currentSlot].specialStatus);
            return false;
        }
        return (this.teamSpecailStatus[status] === true || this.pokemon[this.currentSlot].specialStatus[status] === true);
    },
    getPokeCount: function () {
        var ret = 0;
        for (var i = 0; i < 6; i++)
            if (battle.data.team(battle.opp).poke(i).status !== 31) ret++;
        return ret;
    },
    getType: function () {
        var ret = 18;
        if (this.pokemon[this.currentSlot].temptype > -1 && this.pokemon[this.currentSlot].temptype < 18) return this.pokemon[this.currentSlot].temptype;
        return ret;
    }
}
var myInformation = {
    needSwitch: false
};

function loadJsonData(file) {
    if (!sys.getFileContent(file)) return undefined;
    var data = JSON.parse(sys.getFileContent(file));
    return data;
}

function saveJsonData(file, data) {
    sys.writeToFile(file, JSON.stringify(data));
}
var canCloseWindow = true;
var battleEnd = false;
var useAI = false;
var srcname = battle.data.team(battle.me).name;
var tarname = battle.data.team(battle.opp).name;
useAI = (srcname.toLowerCase() === "[lv0.吧服bot]清分少女" || srcname.toLowerCase() === "mew's");
var moveDataObj = loadJsonData("movedata.json");
var channel = 0;
var hasMega = false;
var hasZ = false;
var lastBattleCommand = {};
var lastSuccessfulCommand = {};
var disabledAttackSlot = [];
var switchDisabled = false;

const gemByType = [259, 248, 251, 249, 250, 254, 253, 255, 258, 243, 244, 246, 245, 252, 247, 256, 257, -1];
const platesByType = [-1, 188, 196, 201, 187, 199, 192, 198, 193, 189, 197, 194, 202, 195, 191, 185, 186, 330];
const megaStoneForNum = [65539, 65542, 131078, 65545, 65601, 65630, 65651, 65663, 65666, 65678, 65686, 131222, 65717, 65748, 65750, 65765, 65784, 65793, 65818, 65839, 65842, 65844, 65846, 65890, 65895, 65981, 65984, 65996, 65790, 65796, 65551, 65554, 65616, 65744, 65838, 65855, 65859, 65870, 65898, 65909, 65912, 65964, 66011, 66067, 66255, 65916, 65917];

var switchesList = [];
var commandEffect = false;

function print_s(content) {
    if (srcname.toLowerCase() === "[lv0.吧服bot]清分少女") return;
    print(content);
}

function resetCommandStatus() {
    commandEffect = true;
    switchDisabled = false;
    lastSuccessfulCommand = lastBattleCommand;
    //if (lastBattleCommand === null) lastBattleCommand = {};
    if (lastSuccessfulCommand === null) lastSuccessfulCommand = {};
    disabledAttackSlot = [];
    switchesList = [];
    for (var i = 1; i < 6; i++) {
        if (!tpoke(i).isKoed()) {
            switchesList.push(i);
        }
    }
}

function sendCommand(id, choice) {
    if (!useAI) {
        return;
    }
    if (battleEnd) return;
    print_s("sendCommand();choice.type=" + choice.type + ",slot=" + choice.attackSlot + ",zmove=" + choice.zmove + ",mega=" + choice.mega + ",pokeSlot=" + choice.pokeSlot);
    canCloseWindow = false;
    sys.setTimer(function () {
        battle.battleCommand(id, choice);
        canCloseWindow = true;
    }, 1000, 0);
}

function checkDisabled() {
    print_s("checkDisabled();");
    if (lastBattleCommand === null) return;
    if (lastBattleCommand.type === "attack" && disabledAttackSlot.indexOf(lastBattleCommand.attackSlot) === -1) {
        if (!lastBattleCommand.zmove && !lastBattleCommand.mega) disabledAttackSlot.push(lastBattleCommand.attackSlot);
        return;
    }
    if (lastBattleCommand.type === "switch") {
        switchDisabled = true;
        return;
    }
    print_s("发生了异常");
}

function getSwitchPower() {
    var maxpow = 0;
    for (var i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        var maxmovepow = getMoveDamage(slot).maxmovepow;
        if (maxmovepow > maxpow) maxpow = maxmovepow;
    }
    return maxpow;
}

function getGoodForSwitch() {
    if (fpoke(battle.opp).pokemon.isKoed()) return switchesList;
    var getTypechart = function (type, slot) {
        if (slot < 0 || slot > 5 || typeof (slot) !== "number") return 0;
        return typechart(type, sys.pokeType1(tpoke(slot).numRef), 0) * typechart(type, sys.pokeType2(tpoke(slot).numRef), 0);
    }
    var ret1 = [];
    var ret2 = [];
    for (var i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        if (slot < 0 || slot > 5 || typeof (slot) !== "number") continue;
        var standard = 25;
        if (!poke(battle.me).isKoed())
            for (var j = 0; j < 18; j++) {
                if (getTypechart(j, slot) > 1 && getTypechart(j, 0) > 1) {
                    if (j === fpoke(battle.opp).type1() || j === fpoke(battle.opp).type2()) standard -= 50;
                    else if (([5, 17, 7, 9, 12, 14]).indexOf() !== -1) standard -= 20;
                    else standard -= 5;
                }
                if (getTypechart(j, slot) < 1 && getTypechart(j, 0) > 1) {
                    if (j === fpoke(battle.opp).type1() || j === fpoke(battle.opp).type2()) standard += 30;
                    else standard += 5;
                }
                if (getTypechart(j, slot) < 1 && getTypechart(j, 0) > 2) {
                    if (j === fpoke(battle.opp).type1() || j === fpoke(battle.opp).type2()) standard += 20;
                    else standard += 5;
                }
                if (getTypechart(j, slot) === 0 && getTypechart(j, 0) > 1) {
                    if (j === fpoke(battle.opp).type1() || j === fpoke(battle.opp).type2()) standard += 30;
                }
            }
        // if ((2 * fpoke(battle.opp).pokemon.level + 10) / 250 * fpoke(battle.opp).maxStat(1) / tpoke(slot).basestat(2) * 200 - tpoke(slot).life < 0) standard -= 50;
        // if ((2 * fpoke(battle.opp).pokemon.level + 10) / 250 * fpoke(battle.opp).maxStat(3) / tpoke(slot).basestat(4) * 200 - tpoke(slot).life < 0) standard -= 50;
        if ((2 * fpoke(battle.opp).pokemon.level + 10) / 250 * fpoke(battle.opp).maxStat(1) / tpoke(slot).basestat(2) * 135 / tpoke(slot).totalLife < 0.3) standard += 30;
        if ((2 * fpoke(battle.opp).pokemon.level + 10) / 250 * fpoke(battle.opp).maxStat(3) / tpoke(slot).basestat(4) * 135 / tpoke(slot).totalLife < 0.3) standard += 30;
        if ((2 * fpoke(battle.opp).pokemon.level + 10) / 250 * fpoke(battle.opp).maxStat(1) / tpoke(slot).basestat(2) * 150 / tpoke(slot).totalLife > 0.5) standard -= 30;
        if ((2 * fpoke(battle.opp).pokemon.level + 10) / 250 * fpoke(battle.opp).maxStat(3) / tpoke(slot).basestat(4) * 150 / tpoke(slot).totalLife > 0.5) standard -= 30;
        if (getTypechart(fpoke(battle.opp).type1(), slot) > 1) standard -= 50;
        if (getTypechart(fpoke(battle.opp).type1(), slot) > 2) standard -= 30;
        if (fpoke(battle.opp).type2() !== 18 && getTypechart(fpoke(battle.opp).type2(), slot) > 1) standard -= 50;
        if (fpoke(battle.opp).type2() !== 18 && getTypechart(fpoke(battle.opp).type2(), slot) > 1) standard -= 30;
        if (fpoke(battle.opp).maxStat(1) > 260 && fpoke(battle.opp).maxStat(1) > fpoke(battle.opp).maxStat(3) * 1.5)
            if (getTypechart(2, slot) > 2 || getTypechart(5, slot) > 2 || getTypechart(16, slot) > 2 || getTypechart(7, slot) > 2) standard -= 30;
        if (fpoke(battle.opp).maxStat(3) > 260 && fpoke(battle.opp).maxStat(3) > fpoke(battle.opp).maxStat(1) * 1.5)
            if (getTypechart(9, slot) > 2 || getTypechart(12, slot) > 2 || getTypechart(14, slot) > 2) standard -= 30;
        if (fpoke(battle.opp).maxStat(1) > 350)
            if (getTypechart(5, slot) > 1 || getTypechart(17, slot) > 1) standard -= 30;
        if (fpoke(battle.opp).maxStat(3) > 350)
            if (getTypechart(9, slot) > 1 || getTypechart(12, slot) > 1) standard -= 30;
        if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3)) > 0) {
            standard -= 20;
            if (tpoke(slot).ability === 109 && !(foeInformation.hasAbility(foeInformation.currentSlot, 104) || foeInformation.hasAbility(foeInformation.currentSlot, 164))) standard += 50;
        }
        if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3)) > 1) {
            standard -= 15;
            if (tpoke(slot).ability === 109 && !(foeInformation.hasAbility(foeInformation.currentSlot, 104) || foeInformation.hasAbility(foeInformation.currentSlot, 164))) standard += 35;
        }

        if (battle.data.field.zone(battle.me).stealthRocks && getTypechart(5, slot) > 1) standard -= 30;
        if (tpoke(slot).life / tpoke(slot).totalLife > 0.7) standard += 20;
        if (tpoke(slot).life / tpoke(slot).totalLife < 0.4) standard -= 30;
        if (tpoke(slot).status !== 0) standard -= 20;
        if ((battle.data.field.zone(battle.me).spikesLevel > 0 || battle.data.field.zone(battle.me).toxicSpikesLevel > 0 || battle.data.field.zone(battle.me).stickyWeb) && isOnLand([sys.pokeType1(tpoke(slot).numRef), sys.pokeType2(tpoke(slot).numRef)], tpoke(slot).item, false, tpoke(slot).ability === 26, false)) standard += 20;
        if (battle.data.field.zone(battle.me).toxicSpikesLevel > 0 && (sys.pokeType1(tpoke(slot).numRef) === 3 || sys.pokeType2(tpoke(slot).numRef) === 3) && !isOnLand([sys.pokeType1(tpoke(slot).numRef), sys.pokeType2(tpoke(slot).numRef)], tpoke(slot).item, false, tpoke(slot).ability === 26, false)) standard += 30;
        if (getTypechart(fpoke(battle.opp).type1(), slot) < 1) standard += 20;
        if (fpoke(battle.opp).type2() !== 18 && getTypechart(fpoke(battle.opp).type2(), slot) < 1) standard += 20;
        if (getTypechart(fpoke(battle.opp).type1(), slot) === 0) standard += 20;
        if (fpoke(battle.opp).type2() !== 18 && getTypechart(fpoke(battle.opp).type2(), slot) === 0) standard += 20;
        if (([4, 5, 6]).indexOf(foeInformation.getItem(foeInformation.currentSlot)) !== -1) {
            var move = foeInformation.getLastMove();
            if (move > 0) {
                if (moveDataObj[move].category === 3) standard += 20;
                if (getTypechart(sys.moveType(move), slot) < 1) standard += 20;
                if (getTypechart(sys.moveType(move), slot) === 0) standard += 50;
            }
        }
        if (([3, 2]).indexOf(fpoke(battle.opp).pokemon.status) !== -1) standard += 50;
        if (([235, 113, 242, 480]).indexOf(poke(battle.opp).numRef) !== -1) standard += 50;
        print_s(sys.pokemon(tpoke(slot).numRef) + " standard:" + standard);
        if (100 < standard) ret1.push(slot);
        if (50 < standard) ret2.push(slot);
    }
    //if (ret.length > 0) print_s("较好的交换选择：" + ret);
    if (ret1.length === 0) return ret2;
    return ret1;
}

function getBestSwitchList() {
    var goodForSwitch = getGoodForSwitch();
    var goodAttackSwitch = [];
    var alternative = [];
    var foeHp = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife * (fpoke(battle.opp).minStat(0) + fpoke(battle.opp).maxStat(0)) / 2 * sys.rand(90, 110) / 100;
    for (i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        if (slot < 0 || slot > 5 || typeof (slot) !== "number") continue;
        if (fpoke(battle.opp).pokemon.isKoed()) {
            goodAttackSwitch.push(slot);
            continue;
        }
        var maxmovepow = getMoveDamage(slot).maxmovepow;
        var flag = false;
        var speed = tpoke(slot).basestat(5);
        if (maxmovepow > foeHp * 1.3 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) flag = true;
        if (maxmovepow > foeHp * 1.3 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && sys.rand(0, 2)) flag = true;
        if (flag) goodAttackSwitch.push(slot);
    }
    for (i = 0; i < goodAttackSwitch.length; i++)
        if (goodForSwitch.indexOf(goodAttackSwitch[i]) !== -1) alternative.push(goodAttackSwitch[i]);
    return alternative;
}

function getGoodSwitchList() {
    var goodForSwitch = getGoodForSwitch();
    var goodAttackSwitch = [];
    var alternative = [];
    var maxpow = 0;
    for (var i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        var maxmovepow = getMoveDamage(slot).maxmovepow;
        if (maxmovepow > maxpow) maxpow = maxmovepow;
    }
    var foeHp = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife * (fpoke(battle.opp).minStat(0) + fpoke(battle.opp).maxStat(0)) / 2 * sys.rand(90, 110) / 100;
    var foeMaxHp = (fpoke(battle.opp).minStat(0) + fpoke(battle.opp).maxStat(0)) / 2 * sys.rand(90, 110) / 100;
    for (i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        if (slot < 0 || slot > 5 || typeof (slot) !== "number") continue;
        if (fpoke(battle.opp).pokemon.isKoed()) {
            goodAttackSwitch.push(slot);
            continue;
        }
        var maxmovepow = getMoveDamage(slot).maxmovepow;
        var maxDamagePercent = maxmovepow / foeMaxHp;
        var flag = false;
        var speed = tpoke(slot).basestat(5);
        if (maxmovepow > foeHp * 1.3 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) flag = true;
        if (maxmovepow > foeHp * 1.3 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && sys.rand(0, 2)) flag = true;
        if (flag) goodAttackSwitch.push(slot);
    }
    if (goodAttackSwitch.length === 0)
        for (i = 0; i < switchesList.length; i++) {
            var slot = switchesList[i];
            if (slot < 0 || slot > 5 || typeof (slot) !== "number") continue;
            var maxmovepow = getMoveDamage(slot).maxmovepow;
            var maxDamagePercent = maxmovepow / foeMaxHp;
            var flag = false;
            var speed = tpoke(slot).basestat(5);
            if (maxmovepow > foeHp * 1.1 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) flag = true;
            if (maxmovepow > foeHp * 1.1 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && sys.rand(0, 2)) flag = true;
            if (maxpow / foeHp > 1.3 && maxmovepow / foeHp < 0.7) continue;
            if (maxpow / foeHp > 0.9 && maxmovepow / foeHp < 0.7 && sys.rand(0, 3)) continue;
            if (maxDamagePercent > 0.75 && sys.rand(0, 2)) flag = true;
            if (maxDamagePercent > 1 && sys.rand(0, 2)) flag = true;
            if (flag) goodAttackSwitch.push(slot);
        }
    for (i = 0; i < goodAttackSwitch.length; i++)
        if (goodForSwitch.indexOf(goodAttackSwitch[i]) !== -1) alternative.push(goodAttackSwitch[i]);
    return alternative;
}

function attemptSwitch(passive) {
    if (battleEnd) return;
    if (passive && (switchDisabled || switchesList.length === 0)) {
        battle.attackButton();
        // sys.setTimer(function () {
        //     attemptCommand();
        // }, 100, 0);
        lastBattleCommand = {};
        return;
    }
    // if (switchesList.length === 0) {
    //     battle.attackButton();
    //     lastBattleCommand = {};
    //     return;
    // }
    var goodForSwitch = getGoodForSwitch();
    var goodAttackSwitch = [];
    var alternative = [];
    var maxpow = 0;
    for (var i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        var maxmovepow = getMoveDamage(slot).maxmovepow;
        if (maxmovepow > maxpow) maxpow = maxmovepow;
    }
    var foeHp = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife * (fpoke(battle.opp).minStat(0) + fpoke(battle.opp).maxStat(0)) / 2 * sys.rand(90, 110) / 100;
    var foeMaxHp = (fpoke(battle.opp).minStat(0) + fpoke(battle.opp).maxStat(0)) / 2 * sys.rand(90, 110) / 100;
    var cswitch = switchesList[sys.rand(0, switchesList.length)];
    for (i = 0; i < switchesList.length; i++) {
        var slot = switchesList[i];
        if (slot < 0 || slot > 5 || typeof (slot) !== "number") continue;
        if (fpoke(battle.opp).pokemon.isKoed()) {
            goodAttackSwitch.push(slot);
            continue;
        }
        var maxmovepow = getMoveDamage(slot).maxmovepow;
        var maxDamagePercent = maxmovepow / foeMaxHp;
        var flag = false;
        var speed = tpoke(slot).basestat(5);
        if (maxmovepow > foeHp * 1.3 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) flag = true;
        if (maxmovepow > foeHp * 1.3 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && (sys.rand(0, 2) || !passive)) flag = true;
        if (flag) goodAttackSwitch.push(slot);
    }
    if (passive || goodAttackSwitch.length === 0)
        for (i = 0; i < switchesList.length; i++) {
            var slot = switchesList[i];
            if (slot < 0 || slot > 5 || typeof (slot) !== "number") continue;
            if (goodAttackSwitch.indexOf(slot) !== -1) continue;
            var maxmovepow = getMoveDamage(slot).maxmovepow;
            var maxDamagePercent = maxmovepow / foeMaxHp;
            var flag = false;
            var speed = tpoke(slot).basestat(5);
            if (maxmovepow > foeHp * 1.1 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) flag = true;
            if (maxmovepow > foeHp * 1.1 && speed >= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && (sys.rand(0, 2) || !passive)) flag = true;
            if (maxpow / foeHp < 0.7 && maxmovepow === maxpow) flag = true;
            if (maxpow / foeHp > 1.3 && maxmovepow / foeHp < 0.7) continue;
            if (maxpow / foeHp > 0.9 && maxmovepow / foeHp < 0.7 && sys.rand(0, 3)) continue;
            //print_s("slot" + slot + "'s maxmovepow:" + maxmovepow + ",maxpow:" + maxpow + ",curpower:" + curpower);
            if (maxDamagePercent > 0.5 && sys.rand(0, 2) && !passive) flag = true;
            if (maxDamagePercent > 0.75 && (sys.rand(0, 2) || !passive)) flag = true;
            if (maxDamagePercent > 1 && sys.rand(0, 2)) flag = true;
            if (flag) goodAttackSwitch.push(slot);
        }
    for (i = 0; i < goodAttackSwitch.length; i++)
        if (goodForSwitch.indexOf(goodAttackSwitch[i]) !== -1) alternative.push(goodAttackSwitch[i]);
    print_s("好的交换选择：" + alternative);
    print_s("好的防守选择：" + goodForSwitch);
    print_s("好的攻击选择：" + goodAttackSwitch);
    if (alternative.length > 0) cswitch = alternative[sys.rand(0, alternative.length)];
    else {
        if (goodForSwitch.length > 0) cswitch = goodForSwitch[sys.rand(0, goodForSwitch.length)];
        else if (goodAttackSwitch.length > 0) cswitch = goodAttackSwitch[sys.rand(0, goodAttackSwitch.length)];
        if (!passive && goodAttackSwitch.length > 0) cswitch = goodAttackSwitch[sys.rand(0, goodAttackSwitch.length)];
    }
    if (cswitch < 0 || cswitch > 5 || typeof (cswitch) !== "number") {
        recordBug("attemptSwitch错误 cswitch=" + cswitch + " alternative=" + alternative + " goodForSwitch=" + goodForSwitch + " goodAttackSwitch=" + goodAttackSwitch);
        cswitch = switchesList[sys.rand(0, switchesList.length)];
    }
    var choice = {
        "slot": battle.me,
        "type": "switch",
        "pokeSlot": cswitch
    };
    sendCommand(battle.id, choice);
    lastBattleCommand = choice;
    lastBattleCommand.pokeNum = tpoke(cswitch).numRef;
}

function isOnLand(type, item, moldBreaker, levitate, special) {
    if (item === 212) return true;
    if (special.smackDown) return true;
    if (special.magnetRise) return false;
    if (type[0] === 2 || type[1] === 2) return false;
    if (item === 236) return false;
    if (!moldBreaker && levitate) return false;
    return true;
}

function getStatusMoveEffectiveForCurrentFoe(moveNum) { //0无效或者是负面效果，1有效但效果比较一般，2有效，3可以优先使用，4强制使用
    if (moveNum < 1) return 0;
    var ret = 2;
    if (battle.data.field.weather === 2 && moveNum === 240) return 0;
    if (battle.data.field.weather === 4 && moveNum === 241) return 0;
    if (battle.data.field.weather === 1 && moveNum === 258) return 0;
    if (battle.data.field.weather !== 1 && moveNum === 635) return 0;
    if (battle.data.field.weather === 3 && moveNum === 201) return 0;
    if (battle.data.field.terrain === 1 && moveNum === 588) return 0;
    if (battle.data.field.terrain === 2 && moveNum === 593) return 0;
    if (battle.data.field.terrain === 3 && moveNum === 599) return 0;
    if (battle.data.field.terrain === 4 && moveNum === 633) return 0;
    if ((([4, 5, 6]).indexOf(poke(battle.me).item) !== -1 && ([271, 415]).indexOf(moveNum) === -1) || poke(battle.me).ability === 103 || poke(battle.me).ability === 255) return 0; //专爱
    if (([28, 39, 43, 48, 50, 73, 77, 78, 79, 81, 86, 92, 95, 108, 109, 134, 137, 139, 142, 147, 148, 171, 178, 180, 184, 186, 204, 207, 213, 230, 260, 261, 262, 271, 281, 297, 298, 313, 320, 321, 373, 375, 377, 380, 388, 415, 445, 464, 487, 493, 494, 511, 560, 567, 581, 587, 600, 607, 650, 652]).indexOf(moveNum) !== -1 && fpoke(battle.opp).substitute && poke(battle.me).ability !== 151) return 0; //对方替身
    if (([77, 78, 79, 147]).indexOf(moveNum) !== -1) { //粉末类
        if (fpoke(battle.opp).type1() === 11 || fpoke(battle.opp).type2() === 11) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(142) !== -1) return 0;
    }
    if (([158]).indexOf(poke(battle.me).ability) !== -1) { //恶心
        if ((fpoke(battle.opp).type1() === 16 || fpoke(battle.opp).type2() === 16) && ([28, 39, 43, 45, 47, 48, 50, 73, 77, 78, 79, 81, 86, 92, 95, 103, 108, 109, 134, 137, 139, 142, 147, 148, 171, 178, 180, 184, 186, 204, 207, 213, 227, 230, 259, 260, 261, 262, 269, 271, 297, 298, 313, 319, 320, 321, 373, 375, 377, 380, 388, 415, 445, 464, 487, 493, 494, 511, 560, 567, 574, 581, 587, 600, 607, 650, 652, 432]).indexOf(moveNum) !== -1) return 0;
    }
    if (([104, 164]).indexOf(poke(battle.me).ability) === -1 && ([28, 39, 43, 45, 47, 48, 50, 73, 77, 78, 79, 81, 86, 92, 95, 103, 108, 109, 134, 137, 139, 142, 147, 148, 171, 178, 180, 184, 186, 204, 207, 213, 227, 230, 259, 260, 261, 262, 269, 271, 297, 298, 313, 319, 320, 321, 373, 375, 377, 380, 388, 415, 445, 464, 487, 493, 494, 511, 560, 567, 574, 581, 587, 600, 607, 650, 652, 446, 191, 390, 605]).indexOf(moveNum) !== -1) { //对方魔反、属性问题
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(156) !== -1) return 0;
        var movetype = sys.moveType(moveNum);
        if ((foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(11) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(87) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(114) !== -1) && movetype === 10) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(18) !== -1 && movetype === 9) return 0;
        if ((foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(10) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(31) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(78) !== -1) && movetype === 12) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(157) !== -1 && movetype === 11) return 0;
    }
    if (moveNum === 269) { //挑拨
        if (foeInformation.hasSpecialStatus("taunt")) return 0;
        if (([113, 36, 133, 227, 233, 235, 242, 480, 545, 707, 313, 681, 598]).indexOf(poke(battle.opp).numRef) !== -1) ret++;
    }
    if (moveNum === 227) { //再来一次
        if (foeInformation.hasSpecialStatus("encore")) return 0;
        if (foeInformation.getLastMove() < 1) return 0;
        if (moveDataObj[foeInformation.getLastMove()].category === 0) ret++;
    }
    if (moveNum === 446) {
        if (battle.data.field.zone(battle.opp).stealthRocks) return 0;
        if (foeInformation.getPokeCount() < 2) return 0;
        if (foeInformation.getPokeCount() > 3) ret++;
        if (foeInformation.getPokeCount() > 5) ret++;
    } //岩钉
    if (moveNum === 191) {
        if (battle.data.field.zone(battle.opp).spikesLevel === 3) return 0;
        if (foeInformation.getPokeCount() < 2) return 0;
        if (foeInformation.getPokeCount() > 3) ret++;
    }
    if (moveNum === 390) {
        if (battle.data.field.zone(battle.opp).toxicSpikesLevel === 2) return 0;
        if (foeInformation.getPokeCount() < 2) return 0;
    }
    if (moveNum === 605 && battle.data.field.zone(battle.opp).stickyWeb) {
        if (battle.data.field.zone(battle.opp).stickyWeb) return 0;
        if (foeInformation.getPokeCount() < 2) return 0;
        if (foeInformation.getPokeCount() > 3) ret++;
    }
    if (moveNum === 432 && !battle.data.field.zone(battle.me).stickyWeb && !battle.data.field.zone(battle.me).stealthRocks && !battle.data.field.zone(battle.me).spikesLevel && !battle.data.field.zone(battle.me).toxicSpikesLevel) return 1; //除雾
    if (([54, 50, 100, 102, 116, 118, 119, 144, 166, 169, 170, 171, 180, 193, 199, 201, 203, 212, 213, 219, 227, 230, 240, 241, 254, 256, 258, 259, 260, 266, 270, 272, 274, 275, 277, 278, 285, 286, 287, 288, 289, 293, 300, 316, 335, 346, 356, 357, 373, 377, 379, 380, 381, 383, 384, 385, 388, 393, 433, 445, 469, 470, 471, 472, 476, 477, 478, 487, 493, 494, 495, 501, 502, 505, 511, 513, 516, 562, 567, 581, 589, 590, 594, 601, 607, 641, 651, 660, 747, 749, 750, 752, 753, 756, 777, 836, 837]).indexOf(moveNum) !== -1) {
        if (lastSuccessfulCommand.movenum === moveNum) ret--;
        ret--;
    } //实用性比较差的变化技能
    if (moveNum === 164) { //替身
        if (fpoke(battle.me).substitute || poke(battle.me).life / poke(battle.me).totalLife < 0.25) return 0;
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.5) ret -= 2;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(151) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(173) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(92) !== -1) ret -= 2;
        if (poke(battle.me).life / poke(battle.me).totalLife > 0.8) ret++;
        if (poke(battle.me).life / poke(battle.me).totalLife > 0.5) ret++;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0]) ret--;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret--;
        if (([113, 242, 235, 480, 598, 707]).indexOf(poke(battle.opp).numRef) !== -1) ret++;
    }
    if (moveNum === 187) { //腹鼓
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.5 || fpoke(battle.me).statBoost(1) > 5) return 0;
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.65 || fpoke(battle.me).statBoost(1) > 1) ret -= 2;
        if (fpoke(battle.me).statBoost(1) < 0 || poke(battle.me).life / poke(battle.me).totalLife > 0.8) ret++;
    }
    if (([116, 176, 194, 195, 273, 285, 286, 356, 357, 373, 377, 379, 384, 385, 388, 391, 393, 477, 478, 567, 581, 598, 171, 366, 636]).indexOf(moveNum) !== -1 && lastSuccessfulCommand.movenum === moveNum) return 0; //不连续使用的变化技能
    if (moveNum === 214) { //梦话
        if (poke(battle.me).status !== 2 && poke(battle.me).ability !== 194) return 0;
        if (poke(battle.me).ability === 194) ret--;
        ret += 2;
    }
    if (moveNum === 226) { //接力棒
        if (switchesList.length === 0) return 0;
        if (fpoke(battle.me).statBoost(1) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(3) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) < 0) return 0;
        if (fpoke(battle.me).statBoost(1) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(3) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(7) > 2) ret += 2;
    }
    if (([150, 160, 176, 608, 609]).indexOf(moveNum) !== -1) { //主要是变化Z
        if (poke(battle.me).item >= 3000 && poke(battle.me).item < 4000 && !hasZ) ret++;
        else return 0;
    }
    if (moveNum === 174) { //诅咒
        if (fpoke(battle.me).type1() === 7 || fpoke(battle.me).type2() === 7) {
            if (foeInformation.hasSpecialStatus("cursed")) return 0;
            if (fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(4) + fpoke(battle.opp).statBoost(7) > 2) ret += 3;
            if (fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(7) + Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) > 3) ret -= 3;
            if (poke(battle.me).life / poke(battle.me).totalLife < 0.5) {
                ret--;
                if (switchesList.length === 0) return 0;
            }
            if (foeInformation.getPokeCount() === 1) ret++;
        } else {
            if (fpoke(battle.me).statBoost(1) < -1) ret -= 2;
            if (fpoke(battle.me).statBoost(1) > 1) ret--;
            if (poke(battle.me).status === 4 && ([41, 224, 98]).indexOf(poke(battle.me).ability) === -1) ret--;
            if (([104, 164]).indexOf(poke(battle.me).ability) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) !== -1) ret -= 2;
            ret++;
        }
    }
    if (([182, 197, 203, 595, 647, 604, 792]).indexOf(moveNum) !== -1) {
        if (([182, 197, 203, 595, 647, 604, 792]).indexOf(lastSuccessfulCommand.movenum) !== -1) ret -= 2;
        if (poke(battle.me).ability === 3 && fpoke(battle.me).statBoost(5) < 2 || poke(battle.me).ability === 141) ret++;
        if (poke(battle.me).item === 15 && poke(battle.me).life / poke(battle.me).totalLife < 0.8) ret++;
        if (poke(battle.me).status === 4) ret--;
        if (poke(battle.opp).status === 4 || poke(battle.opp).status === 5) ret++;
    } //保护类
    if (moveNum === 595 && poke(battle.me).numRef === (681 + 65536)) {
        ret++;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret++;
    } //王盾
    if (([182, 197, 203, 595, 647, 604]).indexOf(moveNum) !== -1 && ([273]).indexOf(lastSuccessfulCommand.movenum) !== -1) {
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.4) ret++;
    } //许愿保护
    if (([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303, 273, 791, 842]).indexOf(moveNum) !== -1) {
        if (moveNum === 156 && battle.data.field.terrain === 1) return 0;
        if (poke(battle.me).life / poke(battle.me).totalLife > 0.8) ret -= 2;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret++;
        if (poke(battle.me).life / poke(battle.me).totalLife > 0.5 && fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret--;
        if (moveNum === 156 && ([1, 2, 3, 4, 5]).indexOf(poke(battle.me).status) !== -1 && poke(battle.me).life / poke(battle.me).totalLife < 0.5) ret += 2;
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.5 && fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0]) ret++;
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.3) ret++;
        if (poke(battle.me).status === 5) ret -= 2;
    } //回复类技能

    if (([271, 415]).indexOf(moveNum) !== -1) { //戏法
        if (foeInformation.getItem(foeInformation.currentSlot) > 2000 || (foeInformation.getItem(foeInformation.currentSlot) > 184 && foeInformation.getItem(foeInformation.currentSlot) < 203) || (foeInformation.getItem(foeInformation.currentSlot) > 212 && foeInformation.getItem(foeInformation.currentSlot) < 231) || (foeInformation.getItem(foeInformation.currentSlot) > 341 && foeInformation.getItem(foeInformation.currentSlot) < 361) || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(60) !== -1) return 0;
        if (([4, 5, 6, 71, 331, 183, 141]).indexOf(foeInformation.getItem(foeInformation.currentSlot)) !== -1) return 0;
        if (([4, 5, 6, 71, 238]).indexOf(poke(battle.me).item) === -1) ret--;
        if (([113, 227, 233, 235, 242, 707, 598]).indexOf(poke(battle.opp).numRef) !== -1) ret++;
    }
    if (([137, 147, 281, 375, 47, 77, 78, 79, 86, 92, 95, 139, 142, 261, 320, 464, 137]).indexOf(moveNum) !== -1) { //异常状态
        if (([1, 2, 3, 4, 5]).indexOf(fpoke(battle.opp).pokemon.status) !== -1) return 0;
        if (foeInformation.hasSpecialStatus("safeguard") && poke(battle.me).ability !== 151) return 0;
        if (battle.data.field.terrain === 3 && isOnLand([fpoke(battle.opp).type1(), fpoke(battle.opp).type2()], foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(poke(battle.me).ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), false)) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(194) !== -1) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(209) !== -1 && fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife > 0.5) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(102) !== -1 && battle.data.field.weather === 4) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(93) !== -1 && battle.data.field.weather === 2) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(63) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(62) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(95) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(30) !== -1) ret--;
    }
    if (([79, 147, 281, 95]).indexOf(moveNum) !== -1) {
        if (battle.data.field.terrain === 1 && isOnLand([fpoke(battle.opp).type1(), fpoke(battle.opp).type2()], foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(poke(battle.me).ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), false)) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(15) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(72) !== -1) return 0;
        if (moveNum === 281 && foeInformation.hasSpecialStatus("drowsy")) return 0;
        for (var index = 1; index < 6; index++)
            if (battle.data.team(battle.opp).poke(index).status === 2) return 0;
        if ((fpoke(battle.opp).minStat(1) > 240 || fpoke(battle.opp).minStat(3) > 240) || foeInformation.getPossibleBaseSpeed(foeInformation.currentSlot)[1] > 393) ret++;
        if (moveDataObj[moveNum].accurcy > 80) ret++;
    } //催眠
    if (([171]).indexOf(moveNum) !== -1 && ([2]).indexOf(fpoke(battle.opp).pokemon.status) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(194) === -1) return 0; //噩梦
    if (([109, 48, 186, 298, 207]).indexOf(moveNum) !== -1) {
        if (foeInformation.hasSpecialStatus("confused")) return 0;
        if (battle.data.field.terrain === 3 && isOnLand([fpoke(battle.opp).type1(), fpoke(battle.opp).type2()], foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(poke(battle.me).ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), false)) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(20) !== -1) return 0;
        if (([207, 109, 298]).indexOf(moveNum) !== -1)
            ret++;

    } //混乱
    if (([86, 78, 137]).indexOf(moveNum) !== -1) { //麻痹
        if (fpoke(battle.opp).type1() === 12 || fpoke(battle.opp).type2() === 12) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(7) !== -1) return 0;
        if (moveNum === 86 && (fpoke(battle.opp).type1() === 4 || fpoke(battle.opp).type2() === 4)) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(95) !== -1) return 0;
        if (foeInformation.getPossibleBaseSpeed(foeInformation.currentSlot)[1] > 328) ret++;
        if (foeInformation.getPossibleBaseSpeed(foeInformation.currentSlot)[1] > 393) ret++;
        if (foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] >= fpoke(battle.me).stat(5) && foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] / 2 < fpoke(battle.me).stat(5)) ret++;
    }
    if (([261]).indexOf(moveNum) !== -1) { //烧伤
        if (fpoke(battle.opp).type1() === 9 || fpoke(battle.opp).type2() === 9) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(41) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(224) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(98) !== -1) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(138) !== -1) ret--;
        if (fpoke(battle.opp).minStat(1) > 240) ret++;
    }
    if (([77, 92, 139]).indexOf(moveNum) !== -1) { //中毒
        if (([202]).indexOf(poke(battle.me).ability) === -1) {
            if (fpoke(battle.opp).type1() === 3 || fpoke(battle.opp).type2() === 3) return 0;
            if (fpoke(battle.opp).type1() === 8 || fpoke(battle.opp).type2() === 8) return 0;
        }
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(17) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(90) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(98) !== -1) return 0;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(137) !== -1) return 1;
        if (moveNum === 92 && ret > 1 && fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife > 0.5) ret++;
    }

    if (([73]).indexOf(moveNum) !== -1) { //寄生种子
        if (fpoke(battle.opp).type1() === 11 || fpoke(battle.opp).type2() === 11) return 0;
        if (foeInformation.hasSpecialStatus("seeded")) return 0;
        if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.35 && fpoke(battle.opp).minStat(0) < 300) return 1;
        if (fpoke(battle.opp).maxStat(0) > 403 && fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife > 0.6) ret++;
    }
    if (([215, 312]).indexOf(moveNum) !== -1) { //治愈之铃
        var count = 0;
        for (var i = 0; i < 6; i++)
            if (([1, 2, 3, 4, 5]).indexOf(tpoke(i).status) !== -1) count++;
        if (count === 0) return 0;
        if (count > 1 && poke(battle.me).life / poke(battle.me).totalLife > 0.3) ret++;
        if (poke(battle.me).life / poke(battle.me).totalLife < 0.4) ret--;
    }
    if (([97, 366, 397, 475, 504, 569]).indexOf(moveNum) !== -1) {
        if (poke(battle.me).status === 1) ret -= 3;
        if (fpoke(battle.me).stat(5) > 441) ret -= 3;
        if (fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret -= 2;
        if (fpoke(battle.me).stat(5) <= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && calcStatWhenBoost(poke(battle.me).basestat(5), fpoke(battle.me).statBoost(5) + 2) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret++;
        if (fpoke(battle.me).stat(5) <= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] && calcStatWhenBoost(poke(battle.me).basestat(5), fpoke(battle.me).statBoost(5) + 2) > Math.max(foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1], 350)) ret++;
    }
    if (([349, 483, 608, 609]).indexOf(moveNum) !== -1) {
        if (poke(battle.me).status === 1) ret -= 2;
        if (fpoke(battle.me).stat(5) > 441) ret -= 3;
        if (fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret--;
        if (fpoke(battle.me).stat(5) <= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] && calcStatWhenBoost(poke(battle.me).basestat(5), fpoke(battle.me).statBoost(5) + 1) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) ret++;
    }
    if (([18, 46]).indexOf(moveNum) !== -1 && (foeInformation.hasSpecialStatus("rooted") || foeInformation.getPokeCount() === 1)) return 0;
    if (([18, 46, 114, 195, 244, 391, 606]).indexOf(moveNum) !== -1) {
        if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(2), fpoke(battle.opp).statBoost(3), fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(7)) > 1) ret++;
        if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(2), fpoke(battle.opp).statBoost(3), fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(7)) > 3) ret += 2;
        if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3)) + fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(7) < 0) ret--;
        if (!battle.data.field.zone(battle.opp).stealthRocks && !battle.data.field.zone(battle.opp).spikesLevel > 1) ret--;
        if (([114, 195, 244, 391]).indexOf(moveNum) !== -1 && fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(7) + Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) > fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(4) + fpoke(battle.opp).statBoost(5) + fpoke(battle.opp).statBoost(7) + Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3))) ret -= 4;
    }
    if (moveNum === 194) {
        if (switchesList.length === 0) return 0;
        if (foeInformation.getPokeCount() === 1) ret++;
        if (switchesList.length >= foeInformation.getPokeCount()) ret++;
        if (poke(battle.me).life / poke(battle.me).totalLife > 0.5) ret--;
    }
    if (moveNum === 195) {
        if (switchesList.length === 0) return 0;
        if (foeInformation.hasSpecialStatus("perishSong")) return 0;
        if (foeInformation.getPokeCount() === 1) ret += 2;
    }
    if (([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303, 361, 461, 262, 182, 197, 203, 595, 647, 604, 194, 195]).indexOf(moveNum) === -1 && poke(battle.me).life / poke(battle.me).totalLife < 0.3) ret--;
    if (([14, 54, 74, 96, 97, 100, 102, 106, 110, 111, 112, 116, 119, 133, 150, 151, 159, 160, 164, 166, 169, 170, 174, 176, 193, 199, 212, 254, 266, 268, 270, 272, 285, 286, 287, 293, 294, 300, 316, 322, 335, 336, 339, 346, 347, 349, 356, 357, 379, 381, 384, 385, 392, 397, 417, 455, 468, 469, 470, 471, 472, 475, 476, 477, 478, 483, 489, 495, 502, 504, 505, 508, 513, 516, 526, 538, 569, 580, 583, 592, 597, 603, 608, 609, 615, 636, 641, 651, 653, 660, 662, 671]).indexOf(moveNum) !== -1 && poke(battle.me).life / poke(battle.me).totalLife < 0.3) ret--;

    if (([14, 96, 336, 349, 468, 508, 339, 489]).indexOf(moveNum) !== -1) {
        if (fpoke(battle.me).statBoost(1) < -1) ret -= 2;
        if (fpoke(battle.me).statBoost(1) > 1) {
            ret--;
            if (([14, 96, 336, 349, 468, 508]).indexOf(moveNum) !== -1) ret--;
        }
        if (fpoke(battle.me).statBoost(1) > 5) return 0;
        if (poke(battle.me).ability === 126) return 0;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] && fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) < 1 && poke(battle.me).life / poke(battle.me).totalLife < 0.8) ret--;
        if (poke(battle.me).status === 4 && ([41, 224, 98]).indexOf(poke(battle.me).ability) === -1) ret -= 2;
        if (([104, 164]).indexOf(poke(battle.me).ability) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) !== -1) ret -= 2;
        ret++;
        if (foeInformation.hasMove([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303, 273])) ret++;
    }
    if (([294, 417, 569, 483, 347]).indexOf(moveNum) !== -1) {
        if (fpoke(battle.me).statBoost(3) < -1) ret -= 2;
        if (fpoke(battle.me).statBoost(3) > 1) {
            ret--;
            if (([294, 417, 569]).indexOf(moveNum) !== -1) ret--;
        }
        if (fpoke(battle.me).statBoost(3) > 5) return 0;
        if (poke(battle.me).ability === 126) return 0;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] && fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) < 1 && poke(battle.me).life / poke(battle.me).totalLife < 0.8) ret--;
        if (([104, 164]).indexOf(poke(battle.me).ability) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) !== -1) ret -= 2;
        ret++;
        if (foeInformation.hasMove([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303, 273])) ret++;
    }
    if (([74, 504, 526]).indexOf(moveNum) !== -1) {
        if (Math.max(fpoke(battle.me).statBoost(3), fpoke(battle.me).statBoost(1)) < -1) ret -= 2;
        if (Math.max(fpoke(battle.me).statBoost(3), fpoke(battle.me).statBoost(1)) > 1) ret--;
        if (Math.max(fpoke(battle.me).statBoost(3), fpoke(battle.me).statBoost(1)) > 5) return 0;
        if (poke(battle.me).ability === 126) return 0;
        if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] && fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) < 1 && poke(battle.me).life / poke(battle.me).totalLife < 0.8) ret--;
        if (([104, 164]).indexOf(poke(battle.me).ability) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) !== -1) ret -= 2;
        ret++;
        if (foeInformation.hasMove([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303, 273])) ret++;
    }
    if (([104, 107]).indexOf(moveNum) !== -1) {
        if (fpoke(battle.me).statBoost(7) < -1) ret -= 2;
        if (fpoke(battle.me).statBoost(7) > 1) ret--;
        if (fpoke(battle.me).statBoost(7) > 3) ret--;
        if (fpoke(battle.me).statBoost(7) > 5) return 0;
        if (poke(battle.me).ability === 126) return 0;
        if (poke(battle.me).status === 4 && ([41, 224, 98]).indexOf(poke(battle.me).ability) === -1) ret -= 2;
        if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(99) !== -1) return 0;
        ret++;
        if (poke(battle.me).life / poke(battle.me).totalLife > 0.5) ret++;
        if (poke(battle.me).status === 5) ret--;
    }
    if (poke(battle.opp).numRef === 681 + 65536) ret++;
    if (ret > 4) ret = 4;
    if (ret < 0) ret = 0;
    return ret;
}

function calcMoveDamageBuff(movenum, movebasepow, defPossibleAbility, initbuf) {
    if (movenum < 0) return 0;
    var pokemon = fpoke(battle.me).pokemon;
    var foetype = [fpoke(battle.opp).type1(), fpoke(battle.opp).type2()];
    if (foeInformation.getType() !== 18) foetype = [foeInformation.getType(), 18];
    if (foeInformation.hasSpecialStatus("burnUp")) foetype[foetype.indexOf(9)] = 18;
    var mytype = [18, 18];
    mytype[0] = sys.pokeType1(pokemon.numRef);
    mytype[1] = sys.pokeType2(pokemon.numRef);
    var ability = poke(battle.me).ability;
    var item = pokemon.item;
    var movetype = sys.moveType(movenum);
    if (movenum === 237) movetype = pokemon.hiddenPower;
    if (([449, 638]).indexOf(movenum) !== -1) movetype = fpoke(battle.me).type1();
    if (ability === 165 && movetype === 0) movetype = 2;
    if (ability === 174 && movetype === 0) movetype = 17;
    if (ability === 176 && movetype === 0) movetype = 14;
    if (ability === 228 && movetype === 0) movetype = 12;
    if (ability === 96) movetype = 0;
    if (ability === 227 && moveDataObj[movenum].voice === true) movetype = 10; //湿润之声
    var movecategory = moveDataObj[movenum].category;

    if (movecategory === 0 || movecategory === 3) return 0;
    if (movenum === 616 || foeInformation.hasSpecialStatus("smackDown")) initbuf = initbuf * typechart(movetype, foetype[0], 2) * typechart(movetype, foetype[1], 2);
    else initbuf = initbuf * typechart(movetype, foetype[0], ([113]).indexOf(ability) !== -1 ? 1 : 0) * typechart(movetype, foetype[1], ([113]).indexOf(ability) !== -1 ? 1 : 0);
    //sys.pokeType1(pokemon.numRef)
    if (mytype[0] === movetype || mytype[1] === movetype || ability === 175) {
        if (([91]).indexOf(ability) !== -1 || (([15, 448]).indexOf(pokemon.numRef) !== -1 && item > 2000 && item < 3000 && !hasMega)) initbuf = initbuf * 2;
        else initbuf = initbuf * 1.5;
    }
    if (ability !== 13 && defPossibleAbility.indexOf(13) === -1 && defPossibleAbility.indexOf(76) === -1 && ability !== 76) {
        if (movetype === 9 && (battle.data.field.weather === 4 || battle.data.field.weather === 5)) initbuf = initbuf * 1.5;
        if (movetype === 10 && battle.data.field.weather === 4) initbuf = initbuf * 0.5;
        if (movetype === 10 && battle.data.field.weather === 5) initbuf = 0;
        if (movetype === 10 && battle.data.field.weather === 2 || battle.data.field.weather === 6) initbuf = initbuf * 1.5;
        if (movetype === 9 && battle.data.field.weather === 2) initbuf = initbuf * 0.5;
        if (movetype === 9 && battle.data.field.weather === 6) initbuf = 0;
        if (([76, 630]).indexOf(movenum) !== -1 && ([1, 2, 3, 6]).indexOf(battle.data.field.weather) !== -1) initbuf = initbuf * 0.5;
        if (([87, 542]).indexOf(movenum) !== -1 && ([2]).indexOf(battle.data.field.weather) !== -1) initbuf = initbuf / 0.7;
        if (([87, 542]).indexOf(movenum) !== -1 && ([4, 5]).indexOf(battle.data.field.weather) !== -1) initbuf = initbuf / 0.7 * 0.5;
        if (([59]).indexOf(movenum) !== -1 && ([1]).indexOf(battle.data.field.weather) !== -1) initbuf = initbuf / 0.7;
        if (battle.data.field.weather === 7 && (foetype[0] === 2 || foetype[1] === 2) && typechart(movetype, 2, 0) > 1) initbuf /= 2;
    }
    if (movetype === 12 && battle.data.field.terrain === 1) initbuf = initbuf * 1.5;
    if (movetype === 11 && battle.data.field.terrain === 2) initbuf = initbuf * 1.5;
    if ((movenum === 80 || movenum === 222 || movenum === 523) && battle.data.field.terrain === 2) initbuf = initbuf * 0.5;
    if (movetype === 15 && battle.data.field.terrain === 3) initbuf = initbuf * 0.5;
    if (movetype === 13 && battle.data.field.terrain === 4) initbuf = initbuf * 1.5;

    if (item === 91) initbuf = initbuf * 1.3;

    // if (pokeSlot === 0) {
    //     if (fpoke(battle.me).statBoost(1) > 0 && movecategory === 1)
    //         movepow[i] = movepow[i] * (2 + fpoke(battle.me).statBoost(1)) / 2;

    //     if (fpoke(battle.me).statBoost(3) > 0 && movecategory === 2)
    //         movepow[i] = movepow[i] * (2 + fpoke(battle.me).statBoost(3)) / 2;

    //     if (fpoke(battle.me).statBoost(1) < 0 && movecategory === 1)
    //         movepow[i] = movepow[i] * 2 / (2 - fpoke(battle.me).statBoost(1));

    //     if (fpoke(battle.opp).statBoost(2) > 0 && movecategory === 1)
    //         movepow[i] = movepow[i] * 2 / (2 - fpoke(battle.opp).statBoost(2));

    //     if (fpoke(battle.me).statBoost(3) < 0 && movecategory === 2)
    //         movepow[i] = movepow[i] * 2 / (2 - fpoke(battle.me).statBoost(3));

    //     if (fpoke(battle.opp).statBoost(4) > 0 && movecategory === 2)
    //         movepow[i] = movepow[i] * 2 / (2 - fpoke(battle.opp).statBoost(4));
    // }
    if (([104, 164]).indexOf(ability) === -1) {
        //print_s(foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(26));
        if (defPossibleAbility.indexOf(26) !== -1 && movetype === 4 && movenum !== 616) initbuf = 0;
        if (defPossibleAbility.indexOf(25) !== -1 && typechart(movetype, foetype[0]) * typechart(movetype, foetype[1]) < 2) initbuf = 0;
        if (defPossibleAbility.indexOf(11) !== -1 && defPossibleAbility.indexOf(87) !== -1 && defPossibleAbility.indexOf(114) !== -1 && movetype === 10) initbuf = 0;
        if (defPossibleAbility.indexOf(18) !== -1 && movetype === 9) initbuf = 0;
        if (defPossibleAbility.indexOf(12) !== -1 && defPossibleAbility.indexOf(31) !== -1 && defPossibleAbility.indexOf(78) !== -1 && movetype === 12) initbuf = 0;
        if (defPossibleAbility.indexOf(157) !== -1 && movetype === 11) initbuf = 0;
        if (defPossibleAbility.indexOf(6) !== -1 && ([120, 153]).indexOf(movenum) !== -1) initbuf = 0;
    }
    if (moveDataObj[movenum].priority > 0) {
        if (defPossibleAbility.indexOf(199) !== -1 || defPossibleAbility.indexOf(214) !== -1) initbuf = 0;
        if (battle.data.field.terrain === 4) {
            if (isOnLand([fpoke(battle.opp).type1(), fpoke(battle.opp).type2()], foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(poke(battle.me).ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), false)) initbuf = 0;
        }
    }
    if (([138]).indexOf(movenum) !== -1 && fpoke(battle.opp).pokemon.status !== 2) initbuf = 0;
    if (([55]).indexOf(ability) !== -1 && movecategory === 1) initbuf = initbuf * 1.5;
    if (([62]).indexOf(ability) !== -1 && movecategory === 1 && ([1, 2, 4, 5]).indexOf(pokemon.status) !== -1) initbuf = initbuf * 1.5;
    if (([65]).indexOf(ability) !== -1 && movetype === 11 && pokemon.life / pokemon.totalLife * 3 < 1) initbuf = initbuf * 1.5;
    if (([66]).indexOf(ability) !== -1 && movetype === 9 && pokemon.life / pokemon.totalLife * 3 < 1) initbuf = initbuf * 1.5;
    if (([67]).indexOf(ability) !== -1 && movetype === 10 && pokemon.life / pokemon.totalLife * 3 < 1) initbuf = initbuf * 1.5;
    if (([68]).indexOf(ability) !== -1 && movetype === 6 && pokemon.life / pokemon.totalLife * 3 < 1) initbuf = initbuf * 1.5;
    if (([89]).indexOf(ability) !== -1 && moveDataObj[movenum].ironFist === true) initbuf = initbuf * 1.2;
    if (([120]).indexOf(ability) !== -1 && moveDataObj[movenum].reckless === true) initbuf = initbuf * 1.2;
    if (([165, 174, 176, 228]).indexOf(ability) !== -1 && movetype === 0) initbuf = initbuf * 1.2;
    if (ability === 96) initbuf = initbuf * 1.2;
    if (([101]).indexOf(ability) !== -1 && movebasepow <= 60) initbuf = initbuf * 1.5;
    if (([110]).indexOf(ability) !== -1 && typechart(movetype, foetype[0]) * typechart(movetype, foetype[1]) < 1) initbuf = initbuf * 2;
    if (([122]).indexOf(ability) !== -1 && battle.data.field.weather === 4 && movecategory === 1) initbuf = initbuf * 1.5;
    if (([125]).indexOf(ability) !== -1 && moveDataObj[movenum].effect > 0) initbuf = initbuf * 1.3; //强行
    if (([137]).indexOf(ability) !== -1 && movecategory === 1 && ([5]).indexOf(pokemon.status) !== -1) initbuf = initbuf * 1.5;
    if (([138]).indexOf(ability) !== -1 && movecategory === 2 && ([5]).indexOf(pokemon.status) !== -1) initbuf = initbuf * 1.5;
    if (([148]).indexOf(ability) !== -1 && fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && moveDataObj[movenum].priority < 1) initbuf = initbuf * 1.3; //分析
    if (([159]).indexOf(ability) !== -1 && ([4, 5, 8]).indexOf(movetype) !== -1 && battle.data.field.weather === 3) initbuf = initbuf * 1.3;
    if (([178]).indexOf(ability) !== -1 && moveDataObj[movenum].strongJaw === true) initbuf = initbuf * 1.5; //强壮之颚
    if (([172]).indexOf(ability) !== -1 && moveDataObj[movenum].megaLauncher === true) initbuf = initbuf * 1.5; //超级发射器
    if (([173]).indexOf(ability) !== -1) initbuf = initbuf * 1.25; //亲子爱
    if (([180]).indexOf(ability) !== -1) {
        var touch = false;
        if (movecategory === 1 && moveDataObj[movenum].touch !== false) touch = true;
        if (movecategory !== 1 && moveDataObj[movenum].touch === true) touch = true;
        if (touch) initbuf = initbuf * 1.3; //硬爪
    }
    if (([168]).indexOf(ability) !== -1 && movetype === 16) initbuf = initbuf * 4 / 3;
    if (([169]).indexOf(ability) !== -1 && movetype === 17) initbuf = initbuf * 4 / 3;
    if (([224]).indexOf(ability) !== -1 && movetype === 10) initbuf = initbuf * 2;
    if (([201]).indexOf(ability) !== -1 && movecategory === 2) initbuf = initbuf * 1.3;
    if (([233]).indexOf(ability) !== -1 && typechart(movetype, foetype[0]) * typechart(movetype, foetype[1]) > 1) initbuf = initbuf * 1.25;
    if (([62]).indexOf(ability) === -1 && movecategory === 1 && ([4]).indexOf(pokemon.status) !== -1) initbuf = initbuf * 0.5;
    if (movenum === 362 && fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5) initbuf = initbuf * 2;
    if (moveDataObj[movenum].times > 0) {
        if (ability === 92) initbuf = initbuf * moveDataObj[movenum].times;
        else if (moveDataObj[movenum].times === 5) initbuf = initbuf * 3.168;
        else initbuf = initbuf * moveDataObj[movenum].times;
    }
    if (movenum === 282 && foeInformation.getItem(foeInformation.currentSlot) !== 0 && !(foeInformation.getItem(foeInformation.currentSlot) > 2000 || (foeInformation.getItem(foeInformation.currentSlot) > 184 && foeInformation.getItem(foeInformation.currentSlot) < 203) || (foeInformation.getItem(foeInformation.currentSlot) > 212 && foeInformation.getItem(foeInformation.currentSlot) < 231) || (foeInformation.getItem(foeInformation.currentSlot) > 341 && foeInformation.getItem(foeInformation.currentSlot) < 361))) initbuf *= 1.5;

    if (movenum === 485 && foetype.indexOf(mytype[0]) === -1 && foetype.indexOf(mytype[1]) === -1 && mytype[1] !== 18) initbuf = 0;
    return initbuf;

}

function CalcMoveDamWithoutDef(movenum) {
    if (movenum < 0) return 0;
    var movebasepow = moveDataObj[movenum].power;
    if (movebasepow < 2) return 0;
    var buff = 1;
    var movecategory = moveDataObj[movenum].category;
    if (fpoke(battle.me).stat(1) < 1 || fpoke(battle.me).stat(3) < 1) return 0;
    if (movecategory === 1) {
        buff = buff * fpoke(battle.me).stat(1);
    }
    if (movecategory === 2) {
        buff = buff * fpoke(battle.me).stat(3);
    }
    if (movenum === 500 || movenum === 658) movebasepow = movebasepow * (1 + Math.max(0, fpoke(battle.me).statBoost(1)) + Math.max(0, fpoke(battle.me).statBoost(2)) + Math.max(0, fpoke(battle.me).statBoost(3)) + Math.max(0, fpoke(battle.me).statBoost(4)) + Math.max(0, fpoke(battle.me).statBoost(5)) + Math.max(0, fpoke(battle.me).statBoost(6)) + Math.max(0, fpoke(battle.me).statBoost(7)));
    if (([284, 323]).indexOf(movenum) !== -1) movebasepow = movebasepow * poke(battle.me).life / poke(battle.me).totalLife;
    return ((2 * poke(battle.me).level + 10) / 250 * movebasepow * buff + 2) * calcMoveDamageBuff(movenum, movebasepow, foeInformation.getPossibleAbility(foeInformation.currentSlot), 1);
}

function getMoveDamage(pokeSlot, enabledAttackSlot) {
    if (pokeSlot < 0 || pokeSlot > 5 || typeof (pokeSlot) !== "number") {
        recordBug("getMoveDamage错误 pokeSlot=" + pokeSlot);
        pokeSlot = 0;
    }
    if (pokeSlot !== 0) {
        enabledAttackSlot = [];
        for (var i = 0; i < 4; i++) {
            if (tpoke(pokeSlot).move(i).PP > 0) enabledAttackSlot.push(i);
        }
    }
    var res = {};
    var foetype = [fpoke(battle.opp).type1(), fpoke(battle.opp).type2()];
    if (foeInformation.getType() !== 18) foetype = [foeInformation.getType(), 18];
    if (foeInformation.hasSpecialStatus("burnUp")) foetype[foetype.indexOf(9)] = 18;
    var movepow = [];
    var maxmovepow = 0;
    var maxmove = 0;
    var ability;
    var item;
    var mytype = [18, 18];
    var pokemon = tpoke(pokeSlot);
    if (pokeSlot === 0) {
        pokemon = fpoke(battle.me).pokemon;
        mytype[0] = fpoke(battle.me).type1();
        mytype[1] = fpoke(battle.me).type2();
        ability = poke(battle.me).ability;
        item = poke(battle.me).item;
    } else {
        ability = pokemon.ability;
        item = pokemon.item;
    }
    if (!hasMega && megaStoneForNum[tpoke(pokeSlot).item - 2001] % 65536 === tpoke(pokeSlot).numRef) {
        pokemon = {
            numRef: megaStoneForNum[tpoke(pokeSlot).item - 2001],
            ability: sys.pokeAbility(this.numRef, 0, 8),
            item: tpoke(pokeSlot).item,
            hiddenPower: tpoke(pokeSlot).hiddenPower,
            level: tpoke(pokeSlot).level,
            status: tpoke(pokeSlot).status,
            life: tpoke(pokeSlot).life,
            totalLife: tpoke(pokeSlot).totalLife,
            nature: tpoke(pokeSlot).nature,
            happiness: tpoke(pokeSlot).happiness,
            ev: function (index) {
                return tpoke(pokeSlot).ev(index);
            },
            iv: function (index) {
                return tpoke(pokeSlot).iv(index);
            },
            basestat: function (index) {
                return calcBaseStats(this.numRef, index, this.level, this.ev(index), this.iv(index), this.nature);
            },
            move: function (slot) {
                return tpoke(pokeSlot).move(slot);
            }
        };
        ability = pokemon.ability;
        item = pokemon.item;
        mytype[0] = sys.pokeType1(this.numRef);
        mytype[1] = sys.pokeType2(this.numRef);
    }


    if (pokeSlot !== 0) {
        mytype[0] = sys.pokeType1(pokemon.numRef);
        mytype[1] = sys.pokeType2(pokemon.numRef);
    }

    if (ability === 0 && foeInformation.getPossibleAbility(foeInformation.currentSlot).length === 1) ability == foeInformation.getPossibleAbility(foeInformation.currentSlot)[0];

    var foeDef = fpoke(battle.opp).minStat(2) * 1.1 + 31;
    var foeSpD = fpoke(battle.opp).minStat(4) * 1.1 + 31;
    if (([113, 242, 479 + 65536 * 4, 700, 537, 488, 122]).indexOf(fpoke(battle.opp).pokemon.numRef) !== -1) foeDef = fpoke(battle.opp).maxStat(2);
    if (([302, 681, 227]).indexOf(fpoke(battle.opp).pokemon.numRef) !== -1) foeDef = fpoke(battle.opp).maxStat(4);
    for (i = 0; i < enabledAttackSlot.length; i++) {
        var slot = enabledAttackSlot[i];
        var movenum = pokemon.move(slot).num;
        if (movenum < 0) {
            recordBug("getMoveDamage出错 pokemon=" + pokemon.numRef + " slot=" + slot);
            movepow[i] = 0;
            continue;
        }
        var movetype = sys.moveType(movenum);
        if (movenum === 237) movetype = pokemon.hiddenPower;
        if (([449, 638, 628]).indexOf(movenum) !== -1 && pokeSlot === 0) movetype = mytype[0];
        if (ability === 165 && movetype === 0) movetype = 2;
        if (ability === 174 && movetype === 0) movetype = 17;
        if (ability === 176 && movetype === 0) movetype = 14;
        if (ability === 228 && movetype === 0) movetype = 12;
        if (ability === 96) movetype = 0;
        if (ability === 227 && moveDataObj[movenum].voice === true) movetype = 10; //湿润之声
        if (movenum === 546) {
            if (item === 227) movetype = 10;
            if (item === 228) movetype = 12;
            if (item === 229) movetype = 9;
            if (item === 230) movetype = 14;
        }
        var movebasepow = moveDataObj[movenum].power;
        var buff = 1;
        var movecategory = moveDataObj[movenum].category;

        if (movecategory === 0 || movecategory === 3) {
            movepow[i] = 0;
        } else {
            if (pokeSlot === 0) {
                if (movecategory === 1) {
                    var attstat = fpoke(battle.me).stat(1);
                    if (!hasMega && megaStoneForNum[tpoke(pokeSlot).item - 2001] % 65536 === tpoke(pokeSlot).numRef) attstat = calcStatWhenBoost(pokemon.basestat(1), fpoke(battle.me).statBoost(1));
                    if (fpoke(battle.me).stat(1) < 1) attstat = calcStatWhenBoost(calcBaseStats(pokemon.numRef, 1, pokemon.level, 0, 31, 0), fpoke(battle.me).statBoost(1));
                    buff = buff * attstat / foeDef;
                    if (([104, 164]).indexOf(ability) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) !== -1) movepow[i] = buff / fpoke(battle.me).stat(1) * pokemon.basestat(1);
                    if (ability === 109 && !(foeInformation.hasAbility(foeInformation.currentSlot, 104) || foeInformation.hasAbility(foeInformation.currentSlot, 164))) buff = buff * foeDef / calcBaseStats(fpoke(battle.opp).pokemon.numRef, 2, fpoke(battle.opp).pokemon.level, 0, 31, 0);
                    if (pokemon.numRef === 681) buff = buff / pokemon.basestat(1) * calcBaseStats(681 + 65536, 1, pokemon.level, pokemon.ev(1), pokemon.iv(1), pokemon.nature);
                }
                if (movecategory === 2) {
                    var spastat = fpoke(battle.me).stat(3);
                    if (!hasMega && megaStoneForNum[tpoke(pokeSlot).item - 2001] % 65536 === tpoke(pokeSlot).numRef) spastat = calcStatWhenBoost(pokemon.basestat(3), fpoke(battle.me).statBoost(3));
                    if (fpoke(battle.me).stat(3) < 1) attstat = calcStatWhenBoost(calcBaseStats(pokemon.numRef, 3, pokemon.level, 0, 31, 0), fpoke(battle.me).statBoost(3));
                    buff = buff * spastat / foeSpD;
                    if (ability === 109 && !(foeInformation.hasAbility(foeInformation.currentSlot, 104) || foeInformation.hasAbility(foeInformation.currentSlot, 164))) buff = buff * foeDef / calcBaseStats(fpoke(battle.opp).pokemon.numRef, 4, fpoke(battle.opp).pokemon.level, 0, 31, 0);
                    if (([104, 164]).indexOf(ability) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) !== -1) movepow[i] = buff / fpoke(battle.me).stat(3) * pokemon.basestat(3);
                    if (pokemon.numRef === 681) buff = buff / pokemon.basestat(3) * calcBaseStats(681 + 65536, 3, pokemon.level, pokemon.ev(3), pokemon.iv(3), pokemon.nature);
                }

                if (movenum === 473 || movenum === 548) buff = buff * foeSpD / foeDef;
                if (movenum === 776) buff = buff * fpoke(battle.me).stat(2) / fpoke(battle.me).stat(1);
                if (movenum === 95) buff = buff * fpoke(battle.opp).minstat(1) / fpoke(battle.me).stat(1);
                if (movenum === 500 || movenum === 658) movebasepow = movebasepow * (1 + Math.max(0, fpoke(battle.me).statBoost(1)) + Math.max(0, fpoke(battle.me).statBoost(2)) + Math.max(0, fpoke(battle.me).statBoost(3)) + Math.max(0, fpoke(battle.me).statBoost(4)) + Math.max(0, fpoke(battle.me).statBoost(5)) + Math.max(0, fpoke(battle.me).statBoost(6)) + Math.max(0, fpoke(battle.me).statBoost(7)));
            } else {
                if (movecategory === 1) buff = buff * pokemon.basestat(1) / foeDef;
                if (movecategory === 2) buff = buff * pokemon.basestat(3) / foeSpD;
                if (pokemon.numRef === 681) buff = buff / pokemon.basestat(3) * calcBaseStats(681, 3, pokemon.level, pokemon.ev(3), pokemon.iv(3), pokemon.nature);
                if (movenum === 473 || movenum === 548) buff = buff * foeSpD / foeDef;
                if (movenum === 776) buff = buff * pokemon.basestat(2) / pokemon.basestat(1);
                if (movenum === 95) buff = buff * fpoke(battle.opp).minstat(1) / pokemon.basestat(1);
                if (ability !== 109 || foeInformation.hasAbility(foeInformation.currentSlot, 104) || foeInformation.hasAbility(foeInformation.currentSlot, 164)) {
                    if (fpoke(battle.opp).statBoost(2) > 0 && movecategory === 1)
                        buff = buff * 2 / (2 - fpoke(battle.opp).statBoost(2));
                    if (fpoke(battle.opp).statBoost(2) < 0 && movecategory === 1)
                        buff = buff * (2 - fpoke(battle.opp).statBoost(2)) / 2;
                    if (fpoke(battle.opp).statBoost(4) > 0 && movecategory === 2)
                        buff = buff * 2 / (2 - fpoke(battle.opp).statBoost(4));
                    if (fpoke(battle.opp).statBoost(4) < 0 && movecategory === 2)
                        buff = buff * (2 - fpoke(battle.opp).statBoost(4)) / 2;
                }
                if (lastSuccessfulCommand.movenum === 226) {
                    if ((([104, 164]).indexOf(ability) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(109) === -1)) {
                        if (fpoke(battle.me).statBoost(1) > 0 && movecategory === 1)
                            buff = buff * (2 + fpoke(battle.me).statBoost(1)) / 2;

                        if (fpoke(battle.me).statBoost(3) > 0 && movecategory === 2)
                            buff = buff * (2 + fpoke(battle.me).statBoost(3)) / 2;

                        if (fpoke(battle.me).statBoost(1) < 0 && movecategory === 1)
                            buff = buff * 2 / (2 - fpoke(battle.me).statBoost(1));

                        if (fpoke(battle.me).statBoost(3) < 0 && movecategory === 2)
                            buff = buff * 2 / (2 - fpoke(battle.me).statBoost(3));


                    }

                    if (movenum === 500 || movenum === 658) movebasepow = movebasepow * (1 + Math.max(0, fpoke(battle.me).statBoost(1)) + Math.max(0, fpoke(battle.me).statBoost(2)) + Math.max(0, fpoke(battle.me).statBoost(3)) + Math.max(0, fpoke(battle.me).statBoost(4)) + Math.max(0, fpoke(battle.me).statBoost(5)) + Math.max(0, fpoke(battle.me).statBoost(6)) + Math.max(0, fpoke(battle.me).statBoost(7)));
                }
                //if (item === 4 && movecategory === 1) movebasepow = movebasepow * 1.5;
                //if (item === 6 && movecategory === 2) movebasepow = movebasepow * 1.5;
            }
            if (([113, 233, 772, 680, 112, 356, 200, 198, 533, 207]).indexOf(fpoke(battle.opp).pokemon.numRef) !== -1)
                if (foeInformation.getItem(foeInformation.currentSlot) < 0 || foeInformation.getItem(foeInformation.currentSlot) === 233) buff /= 1.5;

            if (([284, 323, 846]).indexOf(movenum) !== -1) movebasepow = movebasepow * pokemon.life / pokemon.totalLife;
            if (([175, 179]).indexOf(movenum) !== -1) {
                if (pokemon.life / pokemon.totalLife < 0.0417) movebasepow = 200;
                else if (pokemon.life / pokemon.totalLife < 0.1042) movebasepow = 150;
                else if (pokemon.life / pokemon.totalLife < 0.2083) movebasepow = 100;
                else if (pokemon.life / pokemon.totalLife < 0.3542) movebasepow = 80;
                else if (pokemon.life / pokemon.totalLife < 0.6875) movebasepow = 40;
                else movebasepow = 20;
            }
            if (movenum === 360) {
                if (pokeSlot === 0) movebasepow = Math.min(150, 25 * foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] / fpoke(battle.me).stat(5));
                else movebasepow = Math.min(150, 25 * foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] / pokemon.basestat(5));
            }
            if (movenum === 486) {
                var speedRatio = fpoke(battle.me).stat(5) / foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1];
                if (pokeSlot !== 0) speedRatio = pokemon.basestat(5) / foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1];
                if (speedRatio < 1) movebasepow = 40;
                else if (speedRatio < 2) movebasepow = 60;
                else if (speedRatio < 3) movebasepow = 80;
                else if (speedRatio < 4) movebasepow = 120;
                else movebasepow = 150;
            }
            if (movenum === 216) movebasepow = Math.max(1, Math.floor(pokemon.happiness / 2.5));
            if (movenum === 218) movebasepow = Math.max(1, Math.floor((255 - pokemon.happiness) / 2.5));
            if (movenum === 462 || movenum === 378) movebasepow = Math.round(poke(battle.opp).life / poke(battle.opp).totalLife) * 120;
            if (movenum === 374) {
                if (([212]).indexOf(pokemon.item) !== -1) movebasepow = 130;
            }
            if (movenum === 376) {
                if (pokemon.move(slot).PP > 4) movebasepow = 40;
                if (pokemon.move(slot).PP === 4) movebasepow = 50;
                if (pokemon.move(slot).PP === 3) movebasepow = 60;
                if (pokemon.move(slot).PP === 2) movebasepow = 80;
                if (pokemon.move(slot).PP === 1) movebasepow = 200;
            }

            //技能基础威力影响，包括双方能力
            movepow[i] = (2 * pokemon.level + 10) / 250 * movebasepow * buff + 2;
            if (movenum === 616 || foeInformation.hasSpecialStatus("smackDown")) movepow[i] = movepow[i] * typechart(movetype, foetype[0], 2) * typechart(movetype, foetype[1], 2);
            else movepow[i] = movepow[i] * typechart(movetype, foetype[0], ([113]).indexOf(ability) !== -1 ? 1 : 0) * typechart(movetype, foetype[1], ([113]).indexOf(ability) !== -1 ? 1 : 0);
            //sys.pokeType1(pokemon.numRef)
            if (mytype[0] === movetype || mytype[1] === movetype || ability === 175) {
                if (([91]).indexOf(ability) !== -1) movepow[i] = movepow[i] * 2;
                else movepow[i] = movepow[i] * 1.5;
            }
            if (ability !== 13 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(13) === -1 && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(76) === -1 && ability !== 76) {
                if (movetype === 9 && (battle.data.field.weather === 4 || battle.data.field.weather === 5)) movepow[i] = movepow[i] * 1.5;
                if (movetype === 10 && battle.data.field.weather === 4) movepow[i] = movepow[i] * 0.5;
                if (movetype === 10 && battle.data.field.weather === 5) movepow[i] = 0;
                if (movetype === 10 && battle.data.field.weather === 2 || battle.data.field.weather === 6) movepow[i] = movepow[i] * 1.5;
                if (movetype === 9 && battle.data.field.weather === 2) movepow[i] = movepow[i] * 0.5;
                if (movetype === 9 && battle.data.field.weather === 6) movepow[i] = 0;
                if (([76, 630]).indexOf(movenum) !== -1 && ([1, 2, 3, 6]).indexOf(battle.data.field.weather) !== -1) movepow[i] = movepow[i] * 0.5;
                if (([87, 542]).indexOf(movenum) !== -1 && ([2]).indexOf(battle.data.field.weather) !== -1) movepow[i] = movepow[i] / 0.7;
                if (([87, 542]).indexOf(movenum) !== -1 && ([4, 5]).indexOf(battle.data.field.weather) !== -1) movepow[i] = movepow[i] / 0.7 * 0.5;
                if (([59]).indexOf(movenum) !== -1 && ([1]).indexOf(battle.data.field.weather) !== -1) movepow[i] = movepow[i] / 0.7;
                if (battle.data.field.weather === 7 && (foetype[0] === 2 || foetype[1] === 2) && typechart(movetype, 2, 0) > 1) movepow[i] /= 2;
                if (battle.data.field.weather === 3 && foetype.indexOf(5) !== -1 && movecategory === 2) movepow[i] /= 1.5;
            }
            if (movetype === 12 && battle.data.field.terrain === 1) movepow[i] = movepow[i] * 1.5;
            if (movetype === 11 && battle.data.field.terrain === 2) movepow[i] = movepow[i] * 1.5;
            if ((movenum === 80 || movenum === 222 || movenum === 523) && battle.data.field.terrain === 2) movepow[i] = movepow[i] * 0.5;
            if (movetype === 15 && battle.data.field.terrain === 3) movepow[i] = movepow[i] * 0.5;
            if (movetype === 13 && battle.data.field.terrain === 4) movepow[i] = movepow[i] * 1.5;
            if (movenum === 823 && battle.data.field.terrain === 4 && isOnLand(mytype, item, false, (ability === 26), {})) movepow[i] = movepow[i] * 1.5;
            if (movenum === 828 && battle.data.field.terrain === 3 && isOnLand(mytype, item, false, (ability === 26), {})) movepow[i] = movepow[i] * 1.5;
            if (movenum === 830 && battle.data.field.terrain === 1 && isOnLand(foetype, foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(pokemon.ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), foeInformation.getSpecailStatus())) movepow[i] = movepow[i] * 2;
            if (ability !== 151) {
                if (movecategory === 1 && foeInformation.hasSpecialStatus("reflect")) movepow[i] *= 0.5;
                if (movecategory === 2 && foeInformation.hasSpecialStatus("lightScreen")) movepow[i] *= 0.5;
                if (foeInformation.hasSpecialStatus("auroraVeil")) movepow[i] *= 0.5;
            }

            if (([55]).indexOf(ability) !== -1 && movecategory === 1) movepow[i] = movepow[i] * 1.5;
            if (([62]).indexOf(ability) !== -1 && movecategory === 1 && ([1, 2, 4, 5]).indexOf(pokemon.status) !== -1) movepow[i] = movepow[i] * 1.5;
            if (([65]).indexOf(ability) !== -1 && movetype === 11 && pokemon.life / pokemon.totalLife * 3 < 1) movepow[i] = movepow[i] * 1.5;
            if (([66]).indexOf(ability) !== -1 && movetype === 9 && pokemon.life / pokemon.totalLife * 3 < 1) movepow[i] = movepow[i] * 1.5;
            if (([67]).indexOf(ability) !== -1 && movetype === 10 && pokemon.life / pokemon.totalLife * 3 < 1) movepow[i] = movepow[i] * 1.5;
            if (([68]).indexOf(ability) !== -1 && movetype === 6 && pokemon.life / pokemon.totalLife * 3 < 1) movepow[i] = movepow[i] * 1.5;
            if (([89]).indexOf(ability) !== -1 && moveDataObj[movenum].ironFist === true) movepow[i] = movepow[i] * 1.2;
            if (([120]).indexOf(ability) !== -1 && moveDataObj[movenum].reckless === true) movepow[i] = movepow[i] * 1.2;
            if (([165, 174, 176, 228]).indexOf(ability) !== -1 && movetype === 0) movepow[i] = movepow[i] * 1.2;
            if (ability === 96) movepow[i] = movepow[i] * 1.2;
            if (([101]).indexOf(ability) !== -1 && movebasepow <= 60) movepow[i] = movepow[i] * 1.5;
            if (([110]).indexOf(ability) !== -1 && typechart(movetype, foetype[0]) * typechart(movetype, foetype[1]) < 1) movepow[i] = movepow[i] * 2;
            if (([122]).indexOf(ability) !== -1 && battle.data.field.weather === 4 && movecategory === 1) movepow[i] = movepow[i] * 1.5;
            if (([125]).indexOf(ability) !== -1 && moveDataObj[movenum].effect > 0) movepow[i] = movepow[i] * 1.3; //强行
            if (([137]).indexOf(ability) !== -1 && movecategory === 1 && ([5]).indexOf(pokemon.status) !== -1) movepow[i] = movepow[i] * 1.5;
            if (([138]).indexOf(ability) !== -1 && movecategory === 2 && ([5]).indexOf(pokemon.status) !== -1) movepow[i] = movepow[i] * 1.5;
            if (([148]).indexOf(ability) !== -1 && fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && moveDataObj[movenum].priority < 1) movepow[i] = movepow[i] * 1.3; //分析
            if (([159]).indexOf(ability) !== -1 && ([4, 5, 8]).indexOf(movetype) !== -1 && battle.data.field.weather === 3) movepow[i] = movepow[i] * 1.3;
            if (([178]).indexOf(ability) !== -1 && moveDataObj[movenum].strongJaw === true) movepow[i] = movepow[i] * 1.5; //强壮之颚
            if (([172]).indexOf(ability) !== -1 && moveDataObj[movenum].megaLauncher === true) movepow[i] = movepow[i] * 1.5; //超级发射器
            if (([173]).indexOf(ability) !== -1) movepow[i] = movepow[i] * 1.25; //亲子爱
            if (([180]).indexOf(ability) !== -1) {
                var touch = false;
                if (movecategory === 1 && moveDataObj[movenum].touch !== false) touch = true;
                if (movecategory !== 1 && moveDataObj[movenum].touch === true) touch = true;
                if (touch) movepow[i] = movepow[i] * 1.3; //硬爪
            }
            if (([255]).indexOf(ability) !== -1) {
                if (lastSuccessfulCommand.type === "attack" && (movenum !== lastSuccessfulCommand.movenum)) movepow[i] = 0;
                else if (movecategory === 1) movepow[i] *= 1.5;
            }
            if (([168]).indexOf(ability) !== -1 && movetype === 16) movepow[i] = movepow[i] * 4 / 3;
            if (([169]).indexOf(ability) !== -1 && movetype === 17) movepow[i] = movepow[i] * 4 / 3;
            if (([224]).indexOf(ability) !== -1 && movetype === 10) movepow[i] = movepow[i] * 2;
            if (([201]).indexOf(ability) !== -1 && movecategory === 2) movepow[i] = movepow[i] * 1.3;
            if (([233]).indexOf(ability) !== -1 && typechart(movetype, foetype[0]) * typechart(movetype, foetype[1]) > 1) movepow[i] = movepow[i] * 1.25;
            if (([62]).indexOf(ability) === -1 && movecategory === 1 && ([4]).indexOf(pokemon.status) !== -1) movepow[i] = movepow[i] * 0.5;
            if (([131]).indexOf(ability) !== -1 && movetype === 12 && pokemon.numRef === 895) movepow[i] = movepow[i] * 1.5;
            if (([131]).indexOf(ability) !== -1 && movetype === 15 && pokemon.numRef === 896) movepow[i] = movepow[i] * 1.5;

            if (movenum === 362 && fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5) movepow[i] = movepow[i] * 2;
            if (moveDataObj[movenum].times > 0) {
                if (ability === 92) movepow[i] = movepow[i] * moveDataObj[movenum].times;
                else if (moveDataObj[movenum].times === 5) movepow[i] = movepow[i] * 3.168;
                else movepow[i] = movepow[i] * moveDataObj[movenum].times;
            }
            if (movenum === 251) movepow[i] *= (switchesList.length + 1) / 6;

            if (movenum === 282 && foeInformation.getItem(foeInformation.currentSlot) !== 0 && !(foeInformation.getItem(foeInformation.currentSlot) > 2000 || (foeInformation.getItem(foeInformation.currentSlot) > 184 && foeInformation.getItem(foeInformation.currentSlot) < 203) || (foeInformation.getItem(foeInformation.currentSlot) > 212 && foeInformation.getItem(foeInformation.currentSlot) < 231) || (foeInformation.getItem(foeInformation.currentSlot) > 341 && foeInformation.getItem(foeInformation.currentSlot) < 361))) movepow[i] *= 1.5;


            if (item === 91) movepow[i] = movepow[i] * 1.3;
            if (movenum === 512) {
                if (item === 0) movepow[i] = movepow[i] * 2;
                if (gemByType[movetype] === item) movepow[i] = movepow[i] * 2;
            }

            if (gemByType[movetype] === item) movepow[i] = movepow[i] * 1.3;
            if (platesByType[movetype] === item) movepow[i] = movepow[i] * 1.2;
            if (movenum === 568 && foetype.indexOf(10) !== -1) movepow[i] = movepow[i] * 4;

            //非固定伤害类技能结束

            if (([162, 627]).indexOf(movenum) !== -1) //愤怒门牙
                movepow[i] = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife * fpoke(battle.opp).minStat(0) / 2 * typechart(movetype, foetype[0], ([113]).indexOf(ability) !== -1 ? 1 : 0) * typechart(movetype, foetype[1], ([113]).indexOf(ability) !== -1 ? 1 : 0);
            if (([12, 32, 90, 329]).indexOf(movenum) !== -1) { //一击必杀

                movepow[i] = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife * fpoke(battle.opp).minStat(0) * typechart(movetype, foetype[0], ([113]).indexOf(ability) !== -1 ? 1 : 0) * typechart(movetype, foetype[1], ([113]).indexOf(ability) !== -1 ? 1 : 0);

                if (movenum === 329 && (foetype[0] === 14 || foetype[1] === 14)) movepow[i] = 0;
                if (ability !== 99 && (([170, 199]).indexOf(lastSuccessfulCommand.movenum) === -1 || pokeSlot !== 0)) {
                    movepow[i] = movepow[i] * 0.3;
                    if (movenum === 329 && mytype[0] !== 14 && mytype[1] !== 14) movepow[i] = movepow[i] * 2 / 3;
                }
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(5) !== -1) movepow[i] = 0;
                if (pokemon.level < poke(battle.opp).level) movepow[i] = 0;
            }
            if (([69, 101]).indexOf(movenum) !== -1) { //地球投
                movepow[i] = pokemon.level;
            }
            if (movenum === 283) movepow[i] = Math.max(0, fpoke(battle.opp).minStat(0) * poke(battle.opp).life / poke(battle.opp).totalLife - pokemon.life);

            //命中率影响
            if (moveDataObj[movenum].accurcy < 101 && moveDataObj[movenum].accurcy > 30 && ability !== 99 && pokeSlot !== 0) {
                var accurcy = moveDataObj[movenum].accurcy;
                var statboost = -fpoke(battle.opp).statBoost(7);
                if (lastSuccessfulCommand.movenum === 226) statboost += fpoke(battle.me).statBoost(6);
                if (statboost > 6) statboost = 6;
                if (statboost < -6) statboost = -6;
                if (statboost > 0) accurcy = accurcy * (3 + statboost) / 3;
                if (statboost < 0) accurcy = accurcy * 3 / (3 - statboost);
                if (ability === 162) accurcy *= 1.1;
                if (accurcy > 100) accurcy = 100;
                movepow[i] = movepow[i] * accurcy / 100;
            }

            //0威力的情况
            if (typechart(movetype, foetype[0], ([113]).indexOf(ability) !== -1 ? 1 : 0) * typechart(movetype, foetype[1], ([113]).indexOf(ability) !== -1 ? 1 : 0) === 0) movepow[i] = 0;
            if (([104, 164]).indexOf(ability) === -1) {
                //print_s(foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(26));
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(25) !== -1 && typechart(movetype, foetype[0]) * typechart(movetype, foetype[1]) < 2) movepow[i] = 0;
                if ((foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(11) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(87) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(114) !== -1) && movetype === 10) movepow[i] = 0;
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(18) !== -1 && movetype === 9) movepow[i] = 0;
                if ((foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(10) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(31) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(78) !== -1) && movetype === 12) movepow[i] = 0;
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(157) !== -1 && movetype === 11) movepow[i] = 0;
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(6) !== -1 && ([120, 153]).indexOf(movenum) !== -1) movepow[i] = 0;
                if (moveDataObj[movenum].voice === true && foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(43) !== -1) movepow[i] = 0;
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(185) !== -1 && ([121, 140, 188, 296, 301, 311, 331, 350, 360, 396, 402, 411, 412, 443, 190, 486, 491, 545, 654, 663, 247]).indexOf(movenum) !== -1) movepow[i] = 0;
            }
            if (movenum === 824 && ([1, 2, 3, 4]).indexOf(battle.data.field.terrain) === -1) movepow[i] = 0;
            if (movenum === 835 && foeInformation.getItem(foeInformation.currentSlot) === 0) movepow[i] = 0;
            if (moveDataObj[movenum].priority > 0 || movenum === 829 && battle.data.field.terrain === 2 && isOnLand(mytype, item, false, (ability === 26), {}) || movetype === 2 && ability === 182 && pokemon.life === pokemon.totalLife) {
                if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(199) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(214) !== -1) movepow[i] = 0;
                if (battle.data.field.terrain === 4) {
                    if (isOnLand(foetype, foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(pokemon.ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), foeInformation.getSpecailStatus())) movepow[i] = 0;
                }
            }
            if (([138]).indexOf(movenum) !== -1 && fpoke(battle.opp).pokemon.status !== 2) movepow[i] = 0;
            if (movenum === 485 && foetype.indexOf(mytype[0]) === -1 && foetype.indexOf(mytype[1]) === -1 && mytype[1] !== 18) movepow[i] = 0;
            if (lastSuccessfulCommand.type === "attack" && pokeSlot === 0)
                if (([252, 646]).indexOf(movenum) !== -1) movepow[i] = 0;
            if (([120, 153, 828]).indexOf(movenum) !== -1) { //自杀技能
                if (pokemon.life / pokemon.totalLife > 0.7) movepow[i] = 0;
            }
            if (([389]).indexOf(movenum) !== -1) { //偷袭
                if (movenum === lastSuccessfulCommand.movenum && sys.rand(0, 2) && pokeSlot === 0) movepow[i] = 0;
                if (([63, 307, 308, 338, 439]).indexOf(foeInformation.getLastMove()) !== -1) movepow[i] = 0;
            }
            if (!isOnLand(foetype, foeInformation.getItem(foeInformation.currentSlot), ([104, 164]).indexOf(pokemon.ability) !== -1, foeInformation.hasAbility(foeInformation.currentSlot, 26), foeInformation.getSpecailStatus()) && movetype === 4 && movenum !== 616) movepow[i] = 0;
            if (movenum === 659 && mytype[0] !== 9 && mytype[1] !== 9 && pokeSlot === 0) movepow[i] = 0;
            if (pokemon.status === 2 && sys.rand(0, switchesList.length + 1)) movepow[i] = 0;
            if (poke(battle.opp).numRef % 65536 === 681 && !foeInformation.hasSpecialStatus("taunt") && sys.rand(0, 3) && movecategory === 1 && moveDataObj[movenum].touch !== false && foeInformation.getLastMove() !== 595) movepow[i] = 0;
            if (([136, 26]).indexOf(movenum) !== -1 && foeInformation.getPokeCount() > 1 && !sys.rand(0, 3)) movepow[i] = 0;
            if (movenum === 387) movepow[i] = 0;
            //if (movenum === 507 && getWeight(fpoke(battle.opp).pokemon.numRef % 65536) > 200) movepow[i] = 0;


        }



        if (movepow[i] > maxmovepow) {
            maxmovepow = movepow[i];
            maxmove = i;
        }
    }
    res.maxmove = maxmove;
    res.maxmovepow = maxmovepow;
    res.movepow = movepow;
    return res;
}

function attemptCommand() {
    if (battleEnd) return;

    if (commandEffect === false) checkDisabled();
    // if (lastBattleCommand === null) {
    //     attemptSwitch(false);
    //     return;
    // }

    commandEffect = false;
    var enabledAttackSlot = [];
    for (var i = 0; i < 4; i++) {
        if (disabledAttackSlot.indexOf(i) === -1) enabledAttackSlot.push(i);
    }
    print_s("enabledAttackSlot:" + enabledAttackSlot);
    print_s("switchesList:" + switchesList);
    if (enabledAttackSlot.length === 0 && switchesList.length > 0) {
        attemptSwitch(true);
        return;
    }
    if (enabledAttackSlot.length < 2 && (switchesList.length === 0 || switchDisabled)) {
        {
            battle.attackButton();
            //print_s("attackButton();");
            // sys.setTimer(function () {
            //     attemptCommand();
            // }, 100, 0);
            lastBattleCommand = {};
        }
        return;
    }
    // if (([369, 521, 600]).indexOf(lastSuccessfulCommand.movenum) !== -1 && switchesList.length > 0) {
    //     /* var cswitch = switchesList[sys.rand(0, switchesList.length)];

    //     choice = {
    //         "slot": battle.me,
    //         "type": "switch",
    //         "pokeSlot": cswitch
    //     };
    //     sendCommand(battle.id, choice);
    //     lastBattleCommand = choice; */
    //     print_s("swtich because of move");
    //     attemptSwitch(true);
    //     return;
    // }
    if (poke(battle.me).isKoed() && switchesList.length > 0) {
        /*             var cswitch = switchesList[sys.rand(0, switchesList.length)];

                    choice = {
                        "slot": battle.me,
                        "type": "switch",
                        "pokeSlot": cswitch
                    };
                    sendCommand(battle.id, choice);
                    lastBattleCommand = choice; */
        attemptSwitch(false);
        print_s("swtich because of ko");
        return;
    }

    var choice = {
        "slot": battle.me,
        "type": "attack",
        "attackSlot": 0
    };
    var usemove = -1;
    var rejected = true;
    var moveDamage = getMoveDamage(0, enabledAttackSlot);
    var maxmove = moveDamage.maxmove;
    var maxmovepow = moveDamage.maxmovepow;
    var movepow = [];
    var tempSlot = [];
    var temppow = moveDamage.movepow;
    for (; temppow.length - movepow.length > 0;) {
        var tempindex = 0;
        for (var x = 1; x < temppow.length; x++)
            if (temppow[x] > temppow[tempindex]) tempindex = x;
        movepow.push(temppow[tempindex]);
        temppow[tempindex] = -1;
        tempSlot.push(enabledAttackSlot[tempindex]);
    }
    enabledAttackSlot = tempSlot;
    print_s("enabledAttackSlot:" + enabledAttackSlot);
    var bestSwitchList = getBestSwitchList();
    var goodSwitchList = getGoodSwitchList();
    var goodForSwitch = getGoodForSwitch();
    print_s("bestSwitchList:" + bestSwitchList + " goodSwitchList:" + goodSwitchList + " goodForSwitch:" + goodForSwitch);

    var foeHp = fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife * fpoke(battle.opp).maxStat(0);
    var foeMaxHp = sys.rand(fpoke(battle.opp).minStat(0), fpoke(battle.opp).maxStat(0) + 1);
    var maxDamagePercent = maxmovepow / foeMaxHp;

    print_s("maxmove:" + maxmove + " " + maxmovepow);
    print_s("movepow:" + movepow);
    // if (maxmovepow < 100 && switchesList.length > 0) {
    //     var ut = -1;
    //     var vs = -1;
    //     var ps = -1;
    //     for (i = 0; i < 4; i++) {
    //         if (poke(battle.me).move(i).num === 369) ut = i;
    //         if (poke(battle.me).move(i).num === 521) vs = i;
    //         if (poke(battle.me).move(i).num === 600) ps = i;
    //     }
    //     if (ps !== -1 && sys.rand(0, 4)) usemove = ps;
    //     if (vs !== -1 && sys.rand(0, 4)) usemove = vs;
    //     if (ut !== -1 && sys.rand(0, 4)) usemove = ut;
    //     if (usemove !== -1 && disabledAttackSlot.indexOf(usemove) === -1 && (movepow[enabledAttackSlot.indexOf(usemove)] > 0 || !sys.rand(0, 8))) {
    //         choice.attackSlot = usemove;
    //         battle.battleCommand(battle.id, choice);
    //         lastBattleCommand = choice;
    //         lastBattleCommand.movenum = poke(battle.me).move(lastBattleCommand.attackSlot).num;
    //         return;
    //     }
    //     if (((maxmovepow < 76 && sys.rand(0, 2)) || (!sys.rand(0, 3) && switchesList.length > 1)) && !switchDisabled) {
    //         /*                 var cswitch = switchesList[sys.rand(0, switchesList.length)];

    //                         choice = {
    //                             "slot": battle.me,
    //                             "type": "switch",
    //                             "pokeSlot": cswitch
    //                         };
    //                         sendCommand(battle.id, choice);
    //                         lastBattleCommand = choice; */
    //         print_s("I will switch!");
    //         attemptSwitch(true);
    //         return;
    //     }

    // }
    var choosetime = -1;
    print_s("foe:" + foeHp);
    print_s("me:" + (poke(battle.me).life / poke(battle.me).totalLife));
    while ((rejected && choosetime < 30) || choosetime < enabledAttackSlot.length * 4) {
        rejected = true;
        choice.zmove = undefined;

        choosetime++;
        //print_s("第" + choosetime + "次选择");
        if (choosetime >= 35) {
            print_s("循环出错！");
            return;
        }
        usemove = enabledAttackSlot[sys.rand(0, enabledAttackSlot.length)];
        if (choosetime < enabledAttackSlot.length * 3) usemove = enabledAttackSlot[choosetime % enabledAttackSlot.length];
        if (disabledAttackSlot.indexOf(usemove) !== -1) {
            rejected = true;
            continue;
        }
        var power = movepow[enabledAttackSlot.indexOf(usemove)];
        var damagePercent = power / foeMaxHp;
        var moveNum = fpoke(battle.me).pokemon.move(usemove).num;
        if (moveNum < 0 || typeof (moveNum) !== "number") {
            recordBug("attemptCommand出错 pokemon=" + fpoke(battle.me).pokemon.numRef + " usemove=" + usemove + " moveNum=" + moveNum);
            continue;
        }
        var accurcy = 101;
        if (moveDataObj[moveNum].accurcy < 101 && poke(battle.me).ability !== 99 && moveDataObj[moveNum].accurcy > 30 && ([170, 199]).indexOf(lastSuccessfulCommand.movenum) === -1) {
            accurcy = moveDataObj[moveNum].accurcy;
            var statboost = fpoke(battle.me).statBoost(6) - fpoke(battle.opp).statBoost(7);
            if (statboost > 6) statboost = 6;
            if (statboost < -6) statboost = -6;
            if (statboost > 0) accurcy = accurcy * (3 + statboost) / 3;
            if (statboost < 0) accurcy = accurcy * 3 / (3 - statboost);
        }
        if (poke(battle.me).ability === 162) accurcy *= 1.1;
        if (accurcy > 100) accurcy = 100;
        if (moveDataObj[moveNum].accurcy === 30 && poke(battle.me).ability !== 99 && ([170, 199]).indexOf(lastSuccessfulCommand.movenum) === -1) {
            accurcy = 30;
            if (moveNum === 329 && fpoke(battle.me).type1() !== 14 && fpoke(battle.me).type2() !== 14) accurcy = 20;
        }
        if (choosetime < enabledAttackSlot.length)
            print_s(sys.move(moveNum) + ":power " + power + " accurcy " + accurcy + " damagePercent " + damagePercent);
        else print_s(sys.move(moveNum));
        var estimateDamage = foeInformation.getCurrentPossibleDamage(moveNum);
        var estimateDamageFlag = false;
        if (estimateDamage[0] > 0 && estimateDamage[1] / estimateDamage[0] < 2) estimateDamageFlag = true;
        if (estimateDamage[0] > damagePercent) estimateDamageFlag = false;
        // print_s("推测伤害：" + estimateDamage);
        //if (power < 10 && maxDamagePercent > 0.35) rejected = true;

        if (power < 5 && moveDataObj[moveNum].power > 5) {
            rejected = true;
            continue;
            //print_s("威力太小，拒绝");
        }
        if (moveNum === lastSuccessfulCommand.movenum && lastSuccessfulCommand.failed === true && sys.rand(0, 5)) continue;
        if (moveNum === 264 && !fpoke(battle.me).substitute) {
            if (choosetime < enabledAttackSlot.length * 3) continue;
            if (sys.rand(0, 5)) continue;
        }
        if (([13, 19, 76, 91, 143, 248, 353, 467, 578, 629, 630, 663, 569]).indexOf(moveNum) !== -1) { //蓄力技能
            if ((poke(battle.me).item !== 22 || !(poke(battle.me).item > 2999 && poke(battle.me).item < 4000 && !hasZ)) && choosetime < enabledAttackSlot.length * 4 || choosetime < enabledAttackSlot.length * 3) {
                flag = true;
                continue;
            }
            if (poke(battle.me).item > 2999 && poke(battle.me).item < 4000 && !hasZ && poke(battle.opp).life / poke(battle.opp).totalLife > 0.5 && sys.rand(0, 3)) choice.zmove = true;
        }
        if (([276, 315, 354, 434, 437, 623]).indexOf(moveNum) !== -1 && ([153, 126, 196, 231]).indexOf(poke(battle.me).ability) === -1 && poke(battle.me).item !== 37) { //副作用            

            print_s("副作用判定");
            if (choosetime < enabledAttackSlot.length * 2) continue;
            if (usemove !== maxmove && sys.rand(0, 2)) rejected = true;
            if (poke(battle.opp).life / poke(battle.opp).totalLife < 0.35 && maxmovepow > foeHp && power * accurcy / 100 < foeHp * 1.2 && sys.rand(0, 3)) rejected = true;
            if (rejected || choosetime < enabledAttackSlot.length * 3) continue;
            if (poke(battle.me).item > 2999 && poke(battle.me).item < 4000 && !hasZ && poke(battle.opp).life / poke(battle.opp).totalLife > 0.5 && sys.rand(0, 3)) choice.zmove = true;

            //if (!rejected) print_s("使用副作用技能");
        }
        if (([63, 307, 308, 338, 439]).indexOf(moveNum) !== -1) { //硬直
            print_s("硬直判定");
            if (choosetime < enabledAttackSlot.length * 2) continue;
            if (usemove !== maxmove && sys.rand(0, 2)) rejected = true;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.35 && maxmovepow > foeHp && power * accurcy / 100 < foeHp * 1.2 && sys.rand(0, 3)) rejected = true;
            if (rejected && choosetime < enabledAttackSlot.length * 3) continue;
            if (poke(battle.me).item > 2999 && poke(battle.me).item < 4000 && !hasZ && poke(battle.opp).life / poke(battle.opp).totalLife > 0.5 && sys.rand(0, 3)) choice.zmove = true;
            //if (!rejected) print_s("使用副作用技能");
        }
        if (([172, 503, 221, 558, 613, 394, 659]).indexOf(moveNum) !== -1 && poke(battle.me).status === 3 && movepow > 0) { //解冻技能
            print_s("进行解冻");
            flag = false;
            break;
        }
        if (power / maxmovepow * 6 < 5 && moveDataObj[moveNum].priority < 1 || power < 10) {
            if (([4, 5, 6]).indexOf(poke(battle.me).item) !== -1 && rejected && sys.rand(0, 4) && choosetime < enabledAttackSlot.length * 3) continue;
            if (([91]).indexOf(poke(battle.me).item) !== -1 && rejected && sys.rand(0, 4) && choosetime < enabledAttackSlot.length * 3 && poke(battle.me).life / poke(battle.me).totalLife < 0.1) continue;
            if (moveDataObj[moveNum].touch !== false && moveDataObj[moveNum].category === 1 && (foeInformation.hasAbility(foeInformation.currentSlot, 24) || foeInformation.hasAbility(foeInformation.currentSlot, 160)) && rejected && sys.rand(0, 2) && choosetime < enabledAttackSlot.length * 3 && poke(battle.me).life / poke(battle.me).totalLife < 0.125) continue;
        }

        if (fpoke(battle.opp).substitute && poke(battle.me).ability !== 151 && moveDataObj[moveNum].voice !== true) {
            if (power > foeMaxHp * 0.3) rejected = false;
            if (!rejected) {
                if ((([63, 276, 307, 308, 315, 338, 354, 434, 437, 439, 623]).indexOf(moveNum) !== -1 || ([13, 19, 76, 130, 143, 206, 248, 264, 291, 340, 353, 359, 387, 447, 467, 484, 486, 507, 535, 578, 584, 610, 629, 630, 663]).indexOf(moveNum) !== -1) && choosetime < enabledAttackSlot.length * 3) continue;
                if (accurcy < 80 && choosetime < enabledAttackSlot.length) continue;
                if (accurcy >= 80 && choosetime < enabledAttackSlot.length && sys.rand(0, 100) > accurcy * 4 - 290) continue;
                if (choice.zmove === true) continue;
                choice.zmove = false;
                if (choosetime >= enabledAttackSlot.length && !rejected) break;
                print_s("破替身技能生效");
            }
        }
        if (poke(battle.opp).numRef === 778 && ([104, 164]).indexOf(poke(battle.me).ability) === -1) {
            if (power > 10) rejected = false;
            if ((([63, 276, 307, 308, 315, 338, 354, 434, 437, 439, 623]).indexOf(moveNum) !== -1 || ([13, 19, 76, 130, 143, 206, 248, 264, 291, 340, 353, 359, 387, 447, 467, 484, 486, 507, 535, 578, 584, 610, 629, 630, 663]).indexOf(moveNum) !== -1) && choosetime < enabledAttackSlot.length * 3) continue;
            if (accurcy < 80 && choosetime < enabledAttackSlot.length) continue;
            if (accurcy >= 80 && choosetime < enabledAttackSlot.length && sys.rand(0, 100) > accurcy * 4 - 290) continue;
            if (choice.zmove === true) continue;
            choice.zmove = false;
            if (choosetime >= enabledAttackSlot.length && !rejected) break;
            print_s("破画皮技能生效");
        }
        rejected = true;
        if (moveDataObj[moveNum].priority === 0 && fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] && ([63, 276, 307, 308, 315, 338, 354, 434, 437, 439, 623]).indexOf(moveNum) === -1 && ([13, 19, 76, 130, 143, 206, 248, 264, 291, 340, 353, 359, 387, 447, 467, 484, 486, 507, 535, 578, 584, 610, 629, 630, 663]).indexOf(moveNum) === -1 && fpoke(battle.opp).showing) {
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.05 && power > 30) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.15 && power > 90) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.25 && power > 150) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.35 && power > 210) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5 && power > 300) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.7 && power > 420) rejected = false;
            // if (power > 600) rejected = false;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.4 && estimateDamageFlag && estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife) rejected = false;
            if (estimateDamageFlag && estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife && sys.rand(0, 2)) rejected = false;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.4 && !estimateDamageFlag && power > foeHp * 1.3) rejected = false;
            if (!estimateDamageFlag && power > foeHp * 1.3 && sys.rand(0, 2)) rejected = false;
            if (estimateDamage[0] > 1.2 && estimateDamageFlag) rejected = false;
            if (power > foeMaxHp * 1.5 && !estimateDamageFlag) rejected = false;
            if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3)) > 0 && (estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife || power > foeHp * 1.3)) rejected = false;
            if (!rejected) {
                if (accurcy < 90 && choosetime < enabledAttackSlot.length) continue;
                if (accurcy >= 90 && choosetime < enabledAttackSlot.length && sys.rand(0, 100) > accurcy * 4 - 290) continue;
                choice.zmove = false;
                print_s("先手斩杀生效");
                break;
            }
            if (([120, 153, 194, 858]).indexOf(moveNum) !== -1) { //自杀技能
                if (switchesList.length === 0) continue;
                if (moveNum === 194 && lastSuccessfulCommand.movenum === moveNum) continue;
                if (([120, 153, 858]).indexOf(moveNum) !== -1 && power < foeHp * 1.1) continue;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.2 && sys.rand(0, 3)) rejected = false;
                else if (poke(battle.me).life / poke(battle.me).totalLife < 0.4 && (sys.rand(0, 2) || Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(2), fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(3)) > 0)) rejected = false;
                if (choosetime >= enabledAttackSlot.length * 2 && !rejected) {
                    print_s("先手兑子生效");
                    break;
                }
            }
        }
        if ((moveDataObj[moveNum].priority > 0 || sys.moveType(moveNum) === 2 && poke(battle.me).ability === 182 && poke(battle.me).life === poke(battle.me).totalLife || moveNum === 829 && battle.data.field.terrain === 2) && power > 10 && fpoke(battle.opp).showing) {
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.05 && power > 30) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.15 && power > 90) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.25 && power > 150) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.35 && power > 210) rejected = false;
            // if (power > 600) rejected = false;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5 && estimateDamageFlag && estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife) rejected = false;
            if (estimateDamageFlag && estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife && sys.rand(0, 3)) rejected = false;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5 && !estimateDamageFlag && power > foeHp * 1.1) rejected = false;
            if (!estimateDamageFlag && power > foeHp * 1.3 && sys.rand(0, 3)) rejected = false;
            if (estimateDamage[0] > 1 && estimateDamageFlag) rejected = false;
            if (power > foeMaxHp * 1.3 && !estimateDamageFlag) rejected = false;
            if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3)) + fpoke(battle.opp).statBoost(5) > 0 && (estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife || power > foeHp * 1.1)) rejected = false;
            if (!rejected) {
                if (accurcy < 90 && choosetime < enabledAttackSlot.length) continue;
                if (accurcy >= 90 && choosetime < enabledAttackSlot.length && sys.rand(0, 100) > accurcy * 4 - 290) continue;
                choice.zmove = false;
                print_s("先制斩杀生效");
                break;
            }
            if (([252, 656]).indexOf(moveNum) !== -1 && damagePercent > (0.1 + foeInformation.getItem(foeInformation.currentSlot) === 15 ? 0.0625 : 0)) {
                rejected = false;
                if (choosetime >= enabledAttackSlot.length) {
                    choice.zmove = false;
                    //print_s("下马威，迎头一击生效");
                    break;
                }
            }
            if (fpoke(battle.me).stat(5) <= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && poke(battle.me).life / poke(battle.me).totalLife < 0.3) {
                rejected = false;
                if (choosetime >= enabledAttackSlot.length) {
                    choice.zmove = false;
                    print_s("残血后手先制技能输出生效");
                    break;
                }
            }
        }
        if (moveDataObj[moveNum].priority === 0 && ([13, 19, 76, 130, 143, 120, 153, 206, 248, 264, 291, 340, 353, 387, 447, 467, 484, 486, 507, 535, 578, 584, 610, 629, 630, 663]).indexOf(moveNum) === -1) {
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.15 && power > 90) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.35 && power > 210) rejected = false;
            // if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife > 0.8 && power > 600) rejected = false;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5 && estimateDamageFlag && estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife) rejected = false;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.5 && !estimateDamageFlag && power > foeHp * 1.3) rejected = false;
            if (estimateDamage[0] > 1.3 && estimateDamageFlag) rejected = false;
            if (power > foeMaxHp * 1.5 && !estimateDamageFlag) rejected = false;
            if (fpoke(battle.opp).statBoost(1) + fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(3) + fpoke(battle.opp).statBoost(4) + fpoke(battle.opp).statBoost(5) > 1 && (estimateDamage[0] > fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife || power > foeHp * 1.3)) rejected = false;
            if (!rejected) {
                if (accurcy < 70 && choosetime < enabledAttackSlot.length) continue;
                if (accurcy >= 70 && choosetime < enabledAttackSlot.length && sys.rand(0, 100) > accurcy * 4 - 290) continue;
                choice.zmove = false;
                if (choosetime >= enabledAttackSlot.length) {
                    print_s("斩杀技能生效");
                    break;
                }
            }
        }
        if (switchesList.length > 0 && (goodSwitchList.length > 0 || goodForSwitch.length > 0 && !sys.rand(0, 3))) {
            if (([369, 521, 600, 838]).indexOf(moveNum) !== -1) {
                //无效的情况
                if (moveNum !== 600 && power === 0) continue;
                if (moveNum === 600 && getStatusMoveEffectiveForCurrentFoe(moveNum) === 0) continue;
                //非常需要换人的情况
                if (myInformation.needSwitch) rejected = false;
                if (!rejected && choosetime >= enabledAttackSlot.length) break;
                //其他的情况
                if (([4, 5, 6]).indexOf(poke(battle.me).item) !== -1 && !sys.rand(0, 3)) rejected = false;
                if (fpoke(battle.me).statBoost(1) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(3) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) > 2) rejected = true;
                if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3) > 1) && maxmovepow / foeMaxHp > 0.7) rejected = true;
                if (getSwitchPower() / foeMaxHp < 0.4 && sys.rand(0, 4)) rejected = true;
                if (poke(battle.me).ability !== 144) {
                    var estimateHp = poke(battle.me).life / poke(battle.me).totalLife;
                    if (battle.data.field.zone(battle.me).stealthRocks) estimateHp -= 0.125 * typechart(5, fpoke(battle.me).type1()) * typechart(5, fpoke(battle.me).type2());
                    if (battle.data.field.zone(battle.me).spikesLevel && fpoke(battle.me).type1() !== 2 && fpoke(battle.me).type2() !== 2 && poke(battle.me).ability !== 26) estimateHp -= 1 / (10 - battle.data.field.zone(battle.me).spikesLevel * 2);
                    if (estimateHp < poke(battle.me).life / poke(battle.me).totalLife && poke(battle.me).totalLife < 2) rejected = true;
                    if (estimateHp <= 0) rejected = true;
                }
                if (fpoke(battle.me).substitute && sys.rand(0, 3)) rejected = true;


                //print_s("替换技能拒绝：" + rejected);
                if (!rejected && choosetime >= enabledAttackSlot.length * 2) break;
            }
        }
        if (usemove === maxmove && damagePercent * accurcy / 100 > 0.5 && sys.rand(0, 2)) rejected = false;
        if (damagePercent * accurcy / 100 > 0.7 && sys.rand(0, 2) && power / maxmovepow * 5 > 4) rejected = false;
        if (damagePercent * accurcy / 100 > 0.9 && sys.rand(0, 2) && power / maxmovepow * 4 > 3) rejected = false;
        if (usemove === maxmove && (maxmovepow - getSwitchPower()) / foeMaxHp > -0.1 && sys.rand(0, 4)) rejected = false;
        if (usemove === maxmove && damagePercent * accurcy / 100 > 0.5 && goodSwitchList.length < sys.rand(0, 4)) rejected = false;
        if (usemove === maxmove && power * accurcy / 100 > foeHp * 0.8 && goodSwitchList.length < sys.rand(0, 4)) rejected = false;
        if (usemove === maxmove && Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(3)) > 1 && damagePercent * accurcy / 100 > 0.4) rejected = false;
        //if (usemove === maxmove && choosetime >= enabledAttackSlot.length * 4 && sys.rand(0, 4)) rejected = false;
        if (usemove === maxmove && power < 10) rejected = true;
        if (!rejected && (choosetime >= enabledAttackSlot.length * 3 || choosetime >= enabledAttackSlot.length * 2 && sys.rand(0, 2))) break;
        if (moveDataObj[moveNum].category === 3 || moveDataObj[moveNum].category === 0) {
            rejected = true;
            var ret = getStatusMoveEffectiveForCurrentFoe(moveNum);
            print_s("变化技能的适应度：" + ret);
            if (ret === 0) {
                rejected = true;
            }
            if (ret >= 3 && choosetime >= enabledAttackSlot.length) {
                if (!sys.rand(0, 3)) rejected = false;
                if (ret === 4 && sys.rand(0, 2)) {
                    rejected = false;
                    break;
                }

                if (choosetime >= enabledAttackSlot.length * 2 && !rejected) break;
            }
            if (ret === 1) {
                if (choosetime < enabledAttackSlot.length * 4 || sys.rand(0, 2)) {
                    rejected = true;
                }
                if (sys.rand(0, 3)) rejected = true;
            }
            if (ret === 2 && choosetime >= enabledAttackSlot.length * 3 && !sys.rand(0, 3)) rejected = false;
            if (!rejected && choosetime >= enabledAttackSlot.length * 3) break;
            //if (!rejected) print_s("使用该变化技能");
        }

        var switchFlag = false;
        rejected = true;

        if (bestSwitchList.length > 0) {
            if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) {
                if (Math.max(typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2()), typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2())) > 1) rejected = false;
                if ((poke(battle.me).item === 10 || poke(battle.me).ability === 5) && poke(battle.me).life === poke(battle.me).totalLife) rejected = true;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.3) rejected = true;
            }

            if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(6) < 0 && maxmovepow / foeMaxHp < 0.8) {
                rejected = false;
                // if (!rejected) print_s("被弱化，换人！");
            } else if (maxmovepow / foeMaxHp < 0.6) {
                rejected = false;
                // if (!rejected) print_s("输出不足，换人！");
            }

            if (fpoke(battle.me).substitute && sys.rand(0, 3)) rejected = true;
            if (fpoke(battle.opp).statBoost(1) + fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(3) + fpoke(battle.opp).statBoost(4) + fpoke(battle.opp).statBoost(5) + fpoke(battle.opp).statBoost(7) > 2 && sys.rand(0, 3)) rejected = true;
            if (Math.max(fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(7)) > 3) rejected = true;
            if (!rejected && choosetime >= enabledAttackSlot.length) {
                switchFlag = true;
            }
        } else if (goodSwitchList.length > 0 || goodForSwitch.length > 1 && sys.rand(0, 2)) {
            if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) {
                if (Math.max(typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2()), typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2())) > 1) rejected = false;
                if ((poke(battle.me).item === 10 || poke(battle.me).ability === 5) && poke(battle.me).life === poke(battle.me).totalLife) rejected = true;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.4) rejected = true;
            }

            if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(6) < 0 && maxmovepow / foeMaxHp < 0.5) {
                if (sys.rand(0, 3)) rejected = false;
                // if (!rejected) print_s("被弱化，换人！");
            } else if (maxmovepow / foeMaxHp < 0.4) {
                if (!sys.rand(0, 3)) rejected = false;
                // if (!rejected) print_s("输出不足，换人！");
            }
            if ((power / foeMaxHp > 0.6 && sys.rand(0, 4)) || (maxmovepow / foeMaxHp > 0.9 && sys.rand(0, 4))) rejected = true;
            if (maxmovepow - getSwitchPower() > -0.1 && sys.rand(0, 4)) rejected = true;
            if (getSwitchPower() / foeMaxHp < 0.35 && sys.rand(0, 4)) rejected = true;

            if (fpoke(battle.me).substitute && sys.rand(0, 3)) rejected = true;
            if (fpoke(battle.opp).statBoost(1) + fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(3) + fpoke(battle.opp).statBoost(4) + fpoke(battle.opp).statBoost(5) + fpoke(battle.opp).statBoost(7) > 2 && sys.rand(0, 3)) rejected = true;
            if (Math.max(fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(7)) > 3) rejected = true;
            if (!rejected && choosetime >= enabledAttackSlot.length * 2) {
                switchFlag = true;
            }
        } else if (goodForSwitch.length > 0 && sys.rand(0, 2)) {
            if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) {
                if (Math.max(typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2()), typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2())) > 2) rejected = false;
                if ((poke(battle.me).item === 10 || poke(battle.me).ability === 5) && poke(battle.me).life === poke(battle.me).totalLife) rejected = true;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.5) rejected = true;
            }
            if (fpoke(battle.me).stat(5) <= foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0]) {
                if (Math.max(typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2()), typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2())) > 1) rejected = false;
                if ((poke(battle.me).item === 10 || poke(battle.me).ability === 5) && poke(battle.me).life === poke(battle.me).totalLife) rejected = true;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.5) rejected = true;
            }
            if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) {
                if (Math.max(typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2()), typechart(fpoke(battle.opp).type2(), fpoke(battle.me).type1()) * typechart(fpoke(battle.opp).type1(), fpoke(battle.me).type2())) > 1) rejected = false;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.5) rejected = true;
                if ((poke(battle.me).item === 10 || poke(battle.me).ability === 5) && poke(battle.me).life === poke(battle.me).totalLife) rejected = true;
            }

            if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(6) < -1 && maxmovepow / foeMaxHp < 0.4) {
                if (sys.rand(0, 3)) rejected = false;
                // if (!rejected) print_s("被弱化，换人！");
            } else if (maxmovepow / foeMaxHp < 0.4 && !sys.rand(0, 3)) {
                rejected = false;
                // if (!rejected) print_s("输出不足，换人！");
            }
            if (power / foeMaxHp > 0.4 && sys.rand(0, 4) || maxmovepow / foeMaxHp > 0.5 && sys.rand(0, 4)) rejected = true;
            if ((maxmovepow - getSwitchPower()) / foeMaxHp > -0.2 && sys.rand(0, 4)) rejected = true;
            if (getSwitchPower() / foeMaxHp < 0.7 && sys.rand(0, 4)) rejected = true;

            if (fpoke(battle.me).substitute && sys.rand(0, 5)) rejected = true;
            if (fpoke(battle.opp).statBoost(1) + fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(3) + fpoke(battle.opp).statBoost(4) + fpoke(battle.opp).statBoost(5) + fpoke(battle.opp).statBoost(7) > 1) rejected = true;
            if (Math.max(fpoke(battle.opp).statBoost(2) + fpoke(battle.opp).statBoost(4), fpoke(battle.opp).statBoost(7)) > 2) rejected = true;
            if (!rejected && choosetime >= enabledAttackSlot.length * 3) {
                switchFlag = true;
            }
        }


        //再生力换人
        if (goodSwitchList.length > 0) {
            if (poke(battle.me).ability === 144) {
                if (maxmovepow / foeMaxHp < 0.5 && sys.rand(0, 3)) rejected = false;
                if (poke(battle.me).life / poke(battle.me).totalLife < 0.4 && sys.rand(0, 3)) rejected = false;
                if (maxmovepow / foeMaxHp < 0.7 && poke(battle.me).life / poke(battle.me).totalLife < 0.6 && sys.rand(0, 3)) rejected = false;
                if (!rejected && choosetime >= enabledAttackSlot.length) {
                    switchFlag = true;
                }
            }
        }

        //不要换人
        if (poke(battle.me).ability !== 144) {
            var estimateHp = poke(battle.me).life / poke(battle.me).totalLife;
            if (battle.data.field.zone(battle.me).stealthRocks) estimateHp -= 0.125 * typechart(5, fpoke(battle.me).type1()) * typechart(5, fpoke(battle.me).type2());
            if (battle.data.field.zone(battle.me).spikesLevel && fpoke(battle.me).type1() !== 2 && fpoke(battle.me).type2() !== 2 && poke(battle.me).ability !== 26) estimateHp -= 1 / (10 - battle.data.field.zone(battle.me).spikesLevel * 2);
            if (estimateHp < poke(battle.me).life / poke(battle.me).totalLife && poke(battle.me).totalLife < 2) switchFlag = false;
            if (estimateHp <= 0) switchFlag = false;
        }
        //必须换人
        if (switchesList.length > 0) {
            if (myInformation.needSwitch) rejected = false;
            if (!rejected && choosetime >= enabledAttackSlot.length) {
                switchFlag = true;
            }

            if (fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) + fpoke(battle.me).statBoost(6) + Math.min(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) < -1 || Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) < 0) {
                rejected = false;
                // if (!rejected) print_s("能力等级低，换人！");
            }
            if (!rejected && (choosetime >= enabledAttackSlot.length * 2 || sys.rand(0, 3) && choosetime >= enabledAttackSlot.length)) {
                switchFlag = true;
            }
        }
        if (switchFlag) {
            rejected = true;
            if (([369, 521, 838]).indexOf(moveNum) !== -1 && power > 10 || moveNum === 600 && getStatusMoveEffectiveForCurrentFoe(moveNum) > 1) rejected = false;
            if (!rejected || !switchDisabled) break;
        }
        rejected = true;

        // if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) > 1 && ([14, 74, 96, 294, 336, 349, 417, 468, 504, 508, 526, 569, 597]).indexOf(moveNum) !== -1 && sys.rand(0, 2)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 3) continue;
        //     //print_s("过度强化，拒绝");
        // } //我方强化
        if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) > 1 && damagePercent * accurcy / 100 < 0.5 && usemove !== maxmove && moveDataObj[moveNum].priority < 1) {
            if (getStatusMoveEffectiveForCurrentFoe(moveNum) < 2 && choosetime < enabledAttackSlot.length * 3) {
                rejcted = true;
                continue;
            }
            // if (poke(battle.me).life / poke(battle.me).totalLife < 0.4 && ([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303]).indexOf(moveNum) === -1) rejected = true;
            if (choosetime < enabledAttackSlot.length * 2 && rejected) continue;
            //if (rejected) print_s("经过了强化，不使用小威力技能！");
            //else print_s("经过了强化，使用小威力技能");
        }
        if (([14, 74, 96, 294, 336, 339, 347, 349, 367, 417, 468, 483, 489, 504, 508, 526, 569, 597]).indexOf(moveNum) !== -1) {
            if (maxDamagePercent < 0.4 && ((maxmovepow - getSwitchPower()) / foeMaxHp > -0.1 || switchesList.length === 0 || switchDisabled) && poke(battle.me).life / poke(battle.me).totalLife > 0.5 && !sys.rand(0, 3)) rejected = false;
            if (Math.max(fpoke(battle.me).statBoost(1), fpoke(battle.me).statBoost(3)) > 1 && (sys.rand(0, 2) || maxmovepow > foeHp * 1.2)) rejected = true;
            if (!rejected && choosetime >= enabledAttackSlot.length * 2 && sys.rand(0, 2)) break;
            if (!rejected && choosetime >= enabledAttackSlot.length * 3) break;
            //print_s("输出不足，进行强化！");
        }



        // if (([86, 78, 137]).indexOf(moveNum) !== -1) { //麻痹
        //     print_s("麻痹技能判定");
        //     if (fpoke(battle.opp).type1() === 12 || fpoke(battle.opp).type2() === 12) rejected = true;
        //     else if (foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(7) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(10) !== -1) rejected = true;
        //     else if (moveNum === 86 && (fpoke(battle.opp).type1() === 4 || fpoke(battle.opp).type2() === 4 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(31) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(13) !== -1 || foeInformation.getPossibleAbility(foeInformation.currentSlot).indexOf(13) !== -1)) rejected = true;
        //     else if (fpoke(battle.opp).minStat(5) > 340) rejected = false;
        //     if (rejected) continue;
        // }
        // if (([261]).indexOf(moveNum) !== -1) { //烧伤
        //     print_s("烧伤技能判定");
        //     if (fpoke(battle.opp).type1() === 9 || fpoke(battle.opp).type2() === 9) rejected = true;
        //     else if (fpoke(battle.opp).pokemon.numRef === 752) rejected = true;
        //     else if (fpoke(battle.opp).minStat(1) > 300) rejected = false;
        //     else if (fpoke(battle.opp).minStat(1) > 200 && sys.rand(0, 2)) rejected = false;
        //     if (rejected) continue;
        // }
        // if (([77, 92, 139]).indexOf(moveNum) !== -1) { //中毒
        //     print_s("中毒技能判定");
        //     if (([202]).indexOf(poke(battle.me).ability) === -1) {
        //         if (fpoke(battle.opp).type1() === 3 || fpoke(battle.opp).type2() === 3) rejected = true;
        //         if (fpoke(battle.opp).type1() === 8 || fpoke(battle.opp).type2() === 8) rejected = true;
        //     }
        //     if (rejected) continue;
        // }
        // if (([77, 78, 79, 147]).indexOf(moveNum) !== -1) { //粉末类
        //     print_s("粉末技能判定");
        //     if (fpoke(battle.opp).type1() === 11 || fpoke(battle.opp).type2() === 11) rejected = true;
        //     if (fpoke(battle.opp).pokemon.numRef === 630) rejected = true;
        //     if (rejected) continue;
        // }
        // if (([73]).indexOf(moveNum) !== -1) { //寄生种子
        //     print_s("寄生种子判定");
        //     if (fpoke(battle.opp).type1() === 11 || fpoke(battle.opp).type2() === 11) rejected = true;
        //     if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.35) rejected = true;
        //     if (rejected) continue;
        // }
        // if (([69, 101]).indexOf(moveNum) !== -1) { //地球投
        //     //print_s("固定伤害判定");
        //     if (foeHp < poke(battle.me).level) rejected = false;
        //     if (!rejected) break;
        //     if (maxmovepow < poke(battle.me).level && !sys.rand(0, 4)) rejected = false;
        // }
        if (([68, 243, 368]).indexOf(moveNum) !== -1) { //反击类
            //print_s("反击类判定");
            if (poke(battle.me).life / poke(battle.me).totalLife < 0.5) {
                rejected = true;
                continue;
            }

            if (moveNum === 68) {
                if (fpoke(battle.opp).type1() === 7 || fpoke(battle.opp).type2() === 7) {
                    rejected = true;
                    continue;
                }
                if (!fpoke(battle.opp).showing && fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) rejected = false;
                if (!rejected) break;
                if (!fpoke(battle.opp).showing) rejected = false;
                if (!sys.rand(0, 3)) rejected = false;
                if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && maxDamagePercent > 0.5) rejected = true;
                if (fpoke(battle.opp).maxStat(1) * 1.5 < fpoke(battle.opp).maxStat(3)) rejected = true;
                if (lastSuccessfulCommand.movenum === moveNum || sys.rand(0, 2)) rejected = true;
                if (!rejected && choosetime >= enabledAttackSlot.length * 3) break;
            }
            if (moveNum === 243) {
                if (fpoke(battle.opp).type1() === 17 || fpoke(battle.opp).type2() === 17) {
                    rejected = true;
                    continue;
                }
                if (!sys.rand(0, 3)) rejected = false;
                if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && maxDamagePercent > 0.5) rejected = true;
                if (fpoke(battle.opp).maxStat(1) * 1.5 < fpoke(battle.opp).maxStat(3)) rejected = true;
                if (lastSuccessfulCommand.movenum === moveNum || sys.rand(0, 2)) rejected = true;
                if (!rejected && choosetime >= enabledAttackSlot.length * 3) break;
            }
            if (moveNum === 368) {
                if (!fpoke(battle.opp).showing && fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1]) rejected = false;
                if (!rejected) break;
                if (fpoke(battle.me).stat(5) > foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[1] || maxDamagePercent > 0.5) rejected = true;
                else if (fpoke(battle.me).stat(5) < foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1)[0] && sys.rand(0, 2)) rejected = false;
                else if (!sys.rand(0, 5)) rejected = false;
                if (lastSuccessfulCommand.movenum === moveNum || sys.rand(0, 2)) rejected = true;
                if (!rejected && choosetime >= enabledAttackSlot.length * 3) break;
            }
        }
        if (([175, 179, 283]).indexOf(moveNum) !== -1) { //起死回生
            if (poke(battle.me).life / poke(battle.me).totalLife < 0.2 && sys.rand(0, 3)) rejected = false;
            if (poke(battle.me).life < 5) rejected = false;
            if (fpoke(battle.opp).type1() === 7 || fpoke(battle.opp).type2() === 7) rejected = true;
            if (!rejected && choosetime >= enabledAttackSlot.length * 2) break;
            else continue;
        }
        if (([515]).indexOf(moveNum) !== -1) { //豁命
            if (poke(battle.me).life > foeHp && sys.rand(0, 2)) rejected = false;
            if (maxmovepow > poke(battle.me).life * 0.8) rejected = true;
            if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife < 0.25) rejected = true;
            if (fpoke(battle.opp).type1() === 7 || fpoke(battle.opp).type2() === 7) rejected = true;
            if (!rejected && choosetime >= enabledAttackSlot.length * 2) break;
            else continue;
        }

        // if (([4, 5, 6]).indexOf(poke(battle.me).item) !== -1 && power < 10 && ([271, 415]).indexOf(moveNum) === -1) {
        //     rejected = true;
        //     print_s("专爱变化生效，拒绝");
        // }
        // if (([4, 5, 6, 71]).indexOf(poke(battle.me).item) === -1 && ([271, 415]).indexOf(moveNum) !== -1) {
        //     rejected = true;
        //     print_s("戏法规则生效，拒绝");
        // }


        if (damagePercent * accurcy / 100 > 0.3 && !sys.rand(0, 8)) rejected = false;
        if (damagePercent * accurcy / 100 > 0.45 && !sys.rand(0, 4)) rejected = false;
        if (damagePercent * accurcy / 100 > 0.6 && sys.rand(0, 2)) rejected = false;

        // if (([182, 197, 203, 595, 647, 604]).indexOf(moveNum) !== -1 && ([182, 197, 203, 595, 647, 604]).indexOf(lastSuccessfulCommand.movenum) !== -1 && sys.rand(0, 6)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("保护类技能规则生效，拒绝");
        // } //保护类
        // if (moveNum === 595 && poke(battle.me).numRef === (681 + 65536)) {
        //     if (switchesList.length < 4 && fpoke(battle.me).stat(5) < fpoke(battle.opp).maxStat(5)) rejected = false;
        //     if (fpoke(battle.opp).pokemon.life / fpoke(battle.opp).pokemon.totalLife > 0.5 && maxmovepow < 300) rejected = false;
        //     if (!rejected && choosetime >= enabledAttackSlot.length * 2) break;
        // } //王盾
        // if (([182]).indexOf(moveNum) !== -1 && ([273]).indexOf(lastSuccessfulCommand.movenum) !== -1 && poke(battle.me).life / poke(battle.me).totalLife < 0.3 && sys.rand(0, 3)) rejected = false; //许愿保护
        // if (([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303]).indexOf(moveNum) !== -1 && poke(battle.me).life / poke(battle.me).totalLife > 0.7) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("回复规则生效，拒绝");
        // } //回复类技能
        if (([120, 153, 361, 461, 262, 194]).indexOf(moveNum) !== -1) { //自杀技能
            //print_s("自杀技能检测");
            if (switchesList.length === 0) rejected = true;
            if (poke(battle.me).life / poke(battle.me).totalLife > 0.7 && sys.rand(0, 5)) rejected = true;
            if (poke(battle.me).life / poke(battle.me).totalLife > 0.4 && sys.rand(0, 3)) rejected = true;
            if (choosetime < enabledAttackSlot.length * 2) continue;
        }
        // if (([116, 176, 194, 195, 273, 285, 286, 356, 357, 373, 377, 379, 384, 385, 388, 391, 393, 477, 478, 567, 581, 598, 171, 366, 636]).indexOf(moveNum) !== -1 && lastSuccessfulCommand.movenum === moveNum) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("连续使用规则生效，拒绝");
        // } //不连续使用
        // if ((moveNum === 214 || moveNum === 173) && poke(battle.me).status === 2 && sys.rand(0, 3)) {
        //     print_s("梦话检测");
        //     rejected = false;
        //     break;
        // }
        // if ((moveNum === 214 || moveNum === 173) && poke(battle.me).status !== 2 && poke(battle.me).ability !== 194) {
        //     print_s("裸梦话检测");
        //     rejected = true;
        //     continue;
        // }
        if (moveNum === 226) {
            //print_s("接力棒检测");
            if (switchesList.length === 0) {
                rejected = true;
                continue;
            }
            if (fpoke(battle.me).statBoost(1) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(3) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) < 0) {
                rejected = true;
                continue;
            }
            if (fpoke(battle.me).statBoost(1) + fpoke(battle.me).statBoost(2) + fpoke(battle.me).statBoost(3) + fpoke(battle.me).statBoost(4) + fpoke(battle.me).statBoost(5) > 2 && (poke(battle.me).life / poke(battle.me).totalLife < 0.5 || maxmovepow < 210)) {
                rejected = false;
                break;
            }
            if (sys.rand(0, 2)) rejected = true;
            else rejected = false;
        }
        if (([150, 160, 176, 608, 609]).indexOf(moveNum) !== -1) {
            //print_s("强制Z检测");
            if (poke(battle.me).item >= 3000 && poke(battle.me).item < 4000 && !hasZ && choosetime >= enabledAttackSlot.length * 2) {
                choice.zmove = true;
                rejected = false;
                break;
            } else {
                rejected = true;
                continue;
            }
        }
        // if (([137, 147, 281, 375, 47, 77, 78, 79, 86, 92, 95, 139, 142, 261, 320, 464, 137]).indexOf(moveNum) !== -1 && (([1, 2, 3, 4, 5]).indexOf(fpoke(battle.opp).pokemon.status) !== -1 || battle.data.field.terrain === 3 || ([775, 774]).indexOf(fpoke(battle.opp).pokemon.numRef) !== -1)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("异常状态规则生效，拒绝");
        // }
        // if (([79, 147, 281, 95]).indexOf(moveNum) !== -1 && (battle.data.field.terrain === 1)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("电场催眠，拒绝");
        // }
        // if (([109, 48, 186, 298]).indexOf(moveNum) !== -1 && (([6]).indexOf(fpoke(battle.opp).pokemon.status) !== -1 || battle.data.field.terrain === 3)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("混乱规则生效，拒绝");
        // }
        //if (([171]).indexOf(moveNum) !== -1 && ([2]).indexOf(fpoke(battle.opp).pokemon.status) !== -1 && sys.rand(0, 3)) rejected = false;
        // if (moveDataObj[moveNum].category === 3 && ([105, 135, 156, 220, 234, 235, 236, 456, 645, 355, 303, 120, 153, 361, 461, 262, 182, 197, 203, 595, 647, 604, 194]).indexOf(moveNum) === -1) {
        //     if (poke(battle.me).life / poke(battle.me).totalLife < 0.3 && sys.rand(0, 5)) rejected = true;
        //     else if (poke(battle.me).life / poke(battle.me).totalLife < 0.5 && sys.rand(0, 2)) rejected = true;
        //     if (rejected && choosetime < enabledAttackSlot.length * 2) continue;
        // }
        // if (maxDamagePercent > 0.2 && ([54, 50, 100, 102, 116, 118, 119, 144, 166, 169, 170, 171, 174, 180, 193, 195, 199, 201, 203, 212, 213, 219, 227, 230, 240, 241, 254, 256, 258, 259, 260, 266, 270, 272, 274, 275, 277, 278, 285, 286, 287, 288, 289, 293, 300, 316, 335, 346, 356, 357, 373, 377, 379, 380, 381, 383, 384, 385, 388, 393, 433, 445, 469, 470, 471, 472, 476, 477, 478, 487, 493, 494, 495, 501, 502, 505, 511, 513, 516, 562, 567, 581, 589, 590, 594, 601, 607, 641, 651, 660]).indexOf(moveNum) !== -1) {
        //     if (sys.rand(0, 4)) rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2)
        //         continue;
        // }
        // if (moveNum === 164 && (fpoke(battle.me).substitute || poke(battle.me).life / poke(battle.me).totalLife < 0.4)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("替身，拒绝");
        // }
        // if (moveNum === 187 && (poke(battle.me).life / poke(battle.me).totalLife < 0.6 || fpoke(battle.me).statBoost(1) > 1)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("腹鼓规则生效，拒绝");
        // }
        //if (moveNum === 740 && poke(battle.me).life / poke(battle.me).totalLife < 0.4) rejected = true;

        // if (moveNum === 446 && battle.data.field.zone(battle.opp).stealthRocks) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("岩钉规则生效，拒绝");
        // }
        // if (moveNum === 191 && battle.data.field.zone(battle.opp).spikesLevel === 3) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("地钉规则生效，拒绝");
        // }
        // if (moveNum === 390 && battle.data.field.zone(battle.opp).toxicSpikesLevel === 2) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("毒钉规则生效，拒绝");
        // }
        // if (moveNum === 605 && battle.data.field.zone(battle.opp).stickyWeb) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("虫网规则生效，拒绝");
        // }
        if (moveNum === 229 && !battle.data.field.zone(battle.me).stickyWeb && !battle.data.field.zone(battle.me).stealthRocks && !battle.data.field.zone(battle.me).spikesLevel && !battle.data.field.zone(battle.me).toxicSpikesLevel && sys.rand(0, 3)) {
            rejected = true;
            if (choosetime < enabledAttackSlot.length * 3) continue;
            //print_s("高旋规则生效，拒绝");
        }
        // if (([104, 164]).indexOf(poke(battle.me).ability) === -1) { //对方魔反
        //     if (([196, 178, 359, 719, 302]).indexOf(fpoke(battle.opp).pokemon.numRef % 65536) !== -1 && ([28, 39, 43, 45, 47, 48, 50, 73, 77, 78, 79, 81, 86, 92, 95, 103, 108, 109, 134, 137, 139, 142, 147, 148, 171, 178, 180, 184, 186, 204, 207, 213, 227, 230, 259, 260, 261, 262, 269, 271, 297, 298, 313, 319, 320, 321, 373, 375, 377, 380, 388, 415, 445, 464, 487, 493, 494, 511, 560, 567, 574, 581, 587, 600, 607, 650, 652]).indexOf(moveNum) !== -1) {
        //         rejected = true;
        //         if (choosetime < enabledAttackSlot.length * 2) continue;
        //         print_s("不防魔反，拒绝");
        //     }
        // }
        // if (([158]).indexOf(poke(battle.me).ability) !== -1) {
        //     if (fpoke(battle.opp).type1() === 16 || fpoke(battle.opp).type2() === 16 && ([28, 39, 43, 45, 47, 48, 50, 73, 77, 78, 79, 81, 86, 92, 95, 103, 108, 109, 134, 137, 139, 142, 147, 148, 171, 178, 180, 184, 186, 204, 207, 213, 227, 230, 259, 260, 261, 262, 269, 271, 297, 298, 313, 319, 320, 321, 373, 375, 377, 380, 388, 415, 445, 464, 487, 493, 494, 511, 560, 567, 574, 581, 587, 600, 607, 650, 652]).indexOf(moveNum) !== -1) {
        //         rejected = true;
        //         if (choosetime < enabledAttackSlot.length * 2) continue;
        //         print_s("恶系恶心，拒绝");
        //     }
        // }
        // if (([28, 39, 43, 45, 47, 48, 50, 73, 77, 78, 79, 81, 86, 92, 95, 103, 108, 109, 134, 137, 139, 142, 147, 148, 171, 178, 180, 184, 186, 204, 207, 213, 227, 230, 259, 260, 261, 262, 269, 271, 297, 298, 313, 319, 320, 321, 373, 375, 377, 380, 388, 415, 445, 464, 487, 493, 494, 511, 560, 567, 574, 581, 587, 600, 607, 650, 652]).indexOf(moveNum) !== -1 && fpoke(battle.opp).substitute) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 2) continue;
        //     print_s("不穿替身，拒绝");
        // } //对方替身
        if (Math.max(fpoke(battle.opp).statBoost(1), fpoke(battle.opp).statBoost(2), fpoke(battle.opp).statBoost(3), fpoke(battle.opp).statBoost(4)) > 1 && (([18, 46, 114, 244, 391, 606]).indexOf(moveNum) !== -1 || (([509, 525, 499]).indexOf(moveNum) !== -1) && power > 0) && !foeInformation.hasSpecialStatus("rooted")) rejected = false; //对方强化

        // if (Math.max(fpoke(battle.me).statBoost(5)) > 0 && ([97, 366, 397, 475]).indexOf(moveNum) !== -1 && sys.rand(0, 3)) {
        //     rejected = true;
        //     if (choosetime < enabledAttackSlot.length * 3) continue;
        //     print_s("速度过度强化，拒绝");
        // }
        // if (battle.data.field.weather === 2 && moveNum === 240) rejected = true;
        // if (battle.data.field.weather === 4 && moveNum === 241) rejected = true;
        // if (battle.data.field.weather === 1 && moveNum === 258) rejected = true;
        // if (battle.data.field.weather !== 1 && moveNum === 635) rejected = true;
        // if (battle.data.field.weather === 3 && moveNum === 201) rejected = true;
        // if (battle.data.field.terrain === 1 && moveNum === 588) rejected = true;
        // if (battle.data.field.terrain === 2 && moveNum === 593) rejected = true;
        // if (battle.data.field.terrain === 3 && moveNum === 599) rejected = true;
        // if (battle.data.field.terrain === 4 && moveNum === 633) rejected = true;
        if (damagePercent * accurcy / 100 > 1.5) {
            if (sys.rand(0, 2)) rejected = false;
            if (!rejected) {
                choice.zmove = false;
                break;
            }
        }
        // print_s("本技能拒绝结果：" + rejected);
        // if (!sys.rand(0, 100) && usemove !== 0) {
        //     print_s("随机允许使用技能");
        //     rejected = false;
        // }
    }
    if (rejected) {
        print_s("rejected:I will switch!");
        attemptSwitch(true);
        //battle.attackButton();
        // sys.setTimer(function () {
        //     attemptCommand();
        // }, 100, 0);
        //lastBattleCommand = null;
        return;
    }
    if (!hasMega && poke(battle.me).item > 2000 && poke(battle.me).item < 3000) {
        choice.mega = true;
        if (lastBattleCommand.mega === true && !commandEffect && sys.rand(0, 4)) choice.mega = undefined;
    }
    if (choice.zmove !== true && lastBattleCommand.zmove === true && !commandEffect && sys.rand(0, 2)) choice.zmove = false;
    if (choice.zmove === false) choice.zmove = undefined;
    else if (poke(battle.me).item > 2999 && poke(battle.me).item < 4000) {
        if (!hasZ && sys.rand(0, 2))
            choice.zmove = true;
        //
    }
    choice.attackSlot = usemove;
    sendCommand(battle.id, choice);
    lastBattleCommand = choice;
    lastBattleCommand.movenum = fpoke(battle.me).pokemon.move(lastBattleCommand.attackSlot).num;
}
var nick = function (spot) {
    return battle.data.field.poke(spot).pokemon.nick;
};
var verb = false;
var send = function (msg) {
    return;
    if (!verb) /*print (msg)*/;
    else client.network().sendChanMessage(channel, msg);
};

var poke = function (spot) {
    if (spot !== battle.me && spot !== battle.opp || typeof (spot) !== "number") {
        recordBug("poke 出错spot=" + spot);
        spot = battle.me;
    }
    return battle.data.team(spot).poke(0);
};
var fpoke = function (spot) {
    if (spot !== battle.me && spot !== battle.opp || typeof (spot) !== "number") {
        recordBug("fpoke 出错spot=" + spot);
        spot = battle.me;
    }
    return battle.data.field.poke(spot);
};
var tpoke = function (ind) {
    if (ind < 0 || ind > 5 || typeof (ind) !== "number") {
        recordBug("tpoke 出错ind=" + ind);
        ind = 0;
    }
    return battle.data.team(battle.me).poke(ind);
};

({
    onBeginTurn: function (turn) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        send("Turn " + turn + " of the battle!");
        turnMemory.recordOnBeginTurn();
        previousTurnEventRecord.reset();
    },
    onMiss: function (spot) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && spot === battle.opp) battle.battleMessage(battle.id, "？");
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && spot === battle.me) battle.battleMessage(battle.id, "？？？");
    },
    onAvoid: function (spot) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && spot === battle.me) battle.battleMessage(battle.id, "？");
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && spot === battle.spot) battle.battleMessage(battle.id, "？？？");
    },
    onStatusDamage: function (spot, status) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && status === 6 && spot === battle.spot) battle.battleMessage(battle.id, "？");
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && status === 6 && spot === battle.me) battle.battleMessage(battle.id, "？？？");
    },
    onKo: function (spot) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        send("Oh no! " + nick(spot) + " fainted!");
        print_s("OnKo spot:" + spot);
        //if (spot === battle.opp && tarname.toLowerCase() === "百万斗鹰" && foeInformation.getPokeCount() === 1) battle.battleMessage(battle.id, "出来混的，总是要还的。被本AI逼入绝境的滋味不错吧？");
        //if (spot === battle.me && tarname.toLowerCase() === "k3憋虐胱卜") battle.battleMessage(battle.id, "我爬了");
    },
    onUseAttack: function (spot, attack) { //attack 技能
        if (battleEnd) return;
        print_s("OnUseAttack spot:" + spot + ",attack:" + attack);
        previousTurnEventRecord.recordFirst(spot);
        previousTurnEventRecord.recordMove(spot, attack);
        if (spot === battle.opp) foeInformation.recordLastMove(previousTurnEventRecord.usemove[spot]);
    },
    onSendBack: function (spot) {
        print_s("OnSendBack spot:" + spot);
    },
    onSendOut: function (spot, prevIndex) {
        if (battleEnd) return;
        print_s("OnSendOut spot:" + spot + ",prevIndex:" + prevIndex);
        if (spot === battle.opp) {
            foeInformation.onfoeSwap(prevIndex);
            foeInformation.loadInFoeNewPokeInfo();
        }
        if (spot === battle.me) myInformation.needSwitch = false;
    },
    onItemMessage: function (spot, item, part, foe, berry, other) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        print_s("OnItemMessage spot:" + spot + ",item:" + item + ",part:" + part + ",berry:" + berry + ",foe:" + foe + ",other:" + other);
        if (spot === battle.opp) {
            if (berry !== 0) foeInformation.analyseCurrentItem(berry, part);
            else if (item !== 0) foeInformation.analyseCurrentItem(item, part);
        }
        if (spot === battle.me && item === 68 && part === 0) hasZ = true;
        if (spot === battle.me && item === 66) hasMega = true;
    },
    onMoveMessage: function (spot, move, part, type, foe, other, q) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        print_s("OnMoveMessage spot:" + spot + ",move:" + move + ",part:" + part + ",type:" + type + ",foe:" + foe + ",other:" + other + ",q:" + q);
        foeInformation.analyseCurrentMoveMess(spot, move, part, type, foe, other);
        //if (spot === battle.opp) foeInformation.analyseCurrentMove(move);
    },

    onAbilityMessage: function (spot, ab, part, type, foe, other) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        print_s("OnAbilityMessage spot:" + spot + ",ability:" + ab + ",part:" + part + ",type:" + type + ",foe:" + foe + ",other:" + other);
        if (spot === battle.opp) foeInformation.analyseCurrentAbility(foeInformation.currentSlot, ab, part, other, type);
        if (spot === battle.opp) previousTurnEventRecord.recordFoeAbilityMess(foeInformation.currentSlot, ab, part, other, type);
    },
    onTierNotification: function (tier) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        if (srcname.toLowerCase() === "[lv0.吧服bot]清分少女") battle.showMinimized();
        foeInformation.initial();
        turnMemory.reset();
    },
    onClauseActivated: function (clause) {
        if (!useAI) {
            return;
        }
        print_s("onClauseActivated clause:" + clause);
        if (battle.data.team(battle.me).time < 1 && clause === 5) {
            sys.appendToFile("crashlog.txt", "Timeout\r\n");
            sys.appendToFile("crashlog.txt", sys.move(poke(battle.me).move(0).num) + " " + sys.move(poke(battle.me).move(1).num) + " " + sys.move(poke(battle.me).move(2).num) + " " + sys.move(poke(battle.me).move(3).num) + " " + sys.ability(poke(battle.me).ability) + " " + sys.item(poke(battle.me).item) + " " + sys.pokemon(poke(battle.me).numRef) + " " + tpoke(0).life + " " + sys.pokemon(tpoke(1).numRef) + " " + tpoke(1).life + " " + sys.pokemon(tpoke(2).numRef) + " " + tpoke(2).life + " " + sys.pokemon(tpoke(3).numRef) + " " + tpoke(3).life + " " + sys.pokemon(tpoke(4).numRef) + " " + tpoke(4).life + " " + sys.pokemon(tpoke(5).numRef) + " " + tpoke(5).life + "\r\n");
            recordBug("Timeout");
        }
    },
    onEffectiveness: function (spot, effectiveness) { //0,[1,2],[4],[8,16]
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        //print_s("onClauseActivated clause:" + clause);
        if (spot === battle.opp && effectiveness === 0)
            lastSuccessfulCommand.failed = true;
    },
    onAttackFailing: function (spot, silent) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        print_s("onAttackFailing spot:" + spot + " silent:" + silent);
        if (spot === battle.opp && silent === false) lastSuccessfulCommand.failed = true;
    },
    onBattleEnd: function (result, winner) {
        if (!useAI) {
            return;
        }
        //resetCommandStatus();
        if (battleEnd) return;
        battleEnd = true;
        sys.setTimer(function () {
            canCloseWindow = true;
        }, 5000, 0);
        sys.setTimer(function () {
            if (!canCloseWindow) sys.setTimer(function () {
                foeInformation.pokemon = [];
                battle.close();
            }, 40000, 0);
            else {
                canCloseWindow = false;
                foeInformation.pokemon = [];
                battle.close();
            }
        }, 7000, 0);

    },
    onDamageDone: function (spot, damage) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        previousTurnEventRecord.recordDamage(spot, damage);
        if (spot === battle.opp) foeInformation.analyseCurrentDamage();
        if (spot == battle.me) {
            send(":(( My " + nick(spot) + " lost " + damage + " HP!");
        } else {
            send(nick(spot) + " lost " + damage + "% ;D !");
        }
    },
    onOfferChoice: function (player, choice) {
        if (player != battle.me || !useAI) {
            return;
        }
        if (battleEnd) return;
        canCloseWindow = false;
        sys.setTimer(function () {
            resetCommandStatus();
            foeInformation.loadInFoeNewPokeInfo();
            //for (var i = 0; i < 6; i++) print_s(sys.pokemon(foeInformation.pokemon[foeInformation.findSlotFromIndex(i)].pokeNum));
            if (lastSuccessfulCommand.type === "attack") previousTurnEventRecord.recordMove(battle.me, lastBattleCommand.movenum);
            //print_s("foeSlot" + turnMemory.memory.foeSlot);
            //print_s(sys.move(previousTurnEventRecord.usemove[battle.opp]));
            // if (previousTurnEventRecord.foeAbilityRecord.slot !== undefined)
            //     foeInformation.analyseCurrentAbility(previousTurnEventRecord.foeAbilityRecord.slot, previousTurnEventRecord.foeAbilityRecord.ab, previousTurnEventRecord.foeAbilityRecord.part, previousTurnEventRecord.foeAbilityRecord.other)
            //foeInformation.analyseMove(turnMemory.memory.foeSlot, previousTurnEventRecord.usemove[battle.opp]);
            foeInformation.analyseCurrentDamage();
            foeInformation.analysePossibleSpeed(turnMemory.memory.foeSlot, turnMemory.memory.mySpe, turnMemory.memory.foeSpeBoost, turnMemory.memory.mySpeBoost, null, null);

            for (var i in foeInformation.getSpecailStatus()) print_s(i + ":" + foeInformation.getSpecailStatus()[i]);
            print_s("temptype:" + foeInformation.getType());

            ////foeInformation.getMoves(foeInformation.currentSlot);
            print_s(foeInformation.getPossibleAbility(foeInformation.currentSlot));
            //foeInformation.getItem(foeInformation.currentSlot);
            //print_s(foeInformation.getPossibleAbility(foeInformation.currentSlot));
            //print_s(sys.item(foeInformation.getItem(foeInformation.currentSlot)));
            //foeInformation.getPossibleBaseSpeed(foeInformation.currentSlot);
            //print_s(foeInformation.getPossibleSpeed(foeInformation.currentSlot, fpoke(battle.opp).statBoost(5), 1));
        }, 500, 0);

    },
    onChoiceSelection: function (player) {

        if (player != battle.me || !useAI) {
            return;
        }
        if (battleEnd) return;
        var timer = 1000;
        if (srcname.toLowerCase() !== "[lv0.吧服bot]清分少女") timer = 5000;
        canCloseWindow = false;
        sys.setTimer(function () {
            try {
                attemptCommand();
            } catch (e) {
                sys.appendToFile("crashlog.txt", e + "\r\n");
                sys.appendToFile("crashlog.txt", sys.move(poke(battle.me).move(0).num) + " " + sys.move(poke(battle.me).move(1).num) + " " + sys.move(poke(battle.me).move(2).num) + " " + sys.move(poke(battle.me).move(3).num) + " " + sys.ability(poke(battle.me).ability) + " " + sys.item(poke(battle.me).item) + " " + sys.pokemon(poke(battle.me).numRef) + " " + tpoke(0).life + " " + sys.pokemon(tpoke(1).numRef) + " " + tpoke(1).life + " " + sys.pokemon(tpoke(2).numRef) + " " + tpoke(2).life + " " + sys.pokemon(tpoke(3).numRef) + " " + tpoke(3).life + " " + sys.pokemon(tpoke(4).numRef) + " " + tpoke(4).life + " " + sys.pokemon(tpoke(5).numRef) + " " + tpoke(5).life + "\r\n");
                print_s(e);
                recordBug(e);
                if (srcname.toLowerCase() === "[lv0.吧服bot]清分少女") battle.battleMessage(battle.id, "QAQ清分少女出现了一些问题，30秒后将会认输，请截图发送给睿睿来修复");
                battleEnd = true;
                sys.setTimer(function () {
                    canCloseWindow = true;
                }, 25000, 0);
                sys.setTimer(function () {
                    if (canCloseWindow) {
                        foeInformation.pokemon = [];
                        battle.forfeit();
                    } else battleEnd = false;
                }, 30000, 0);
            }
        }, timer, 0);

    },
    onCriticalHit: function (spot) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        print_s("onCriticalHit spot:" + spot);
        previousTurnEventRecord.analyseCT(spot);
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && spot === battle.opp) battle.battleMessage(battle.id, "？");
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && spot === battle.me) battle.battleMessage(battle.id, "？？？");
        //if (spot === battle.opp && tarname.toLowerCase() === "磁界齿轮") battle.battleMessage(battle.id, "对不起 我是狗");
    },
    onChoiceCancellation: function (player) {
        this.onChoiceSelection(player);
    },
    onDrawRequest: function (player) {
        this.onChoiceCancelled(player);
    },
    onChoiceCancelled: function (player) {
        //    print ("old useAI: " + useAI);
        useAI = !useAI;
        print_s("new useAI: " + useAI);
    },
    onMajorStatusChange: function (spot, status, multipleTurns, silent) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        print_s("onMajorStatusChage spot:" + spot + " status:" + status);
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && status === 3 && spot === battle.opp) battle.battleMessage(battle.id, "？");
        //if (tarname.toLowerCase() === "挖沙蜻蜓" && status === 3 && spot === battle.me) battle.battleMessage(battle.id, "？？？");
        //if (spot === battle.opp && tarname.toLowerCase() === "磁界齿轮" && status === 3) battle.battleMessage(battle.id, "对不起 我是狗");
        if (spot === battle.opp && status === 6) foeInformation.pokemon[foeInformation.currentSlot].specialStatus.confused = true;
    },
    onStatusOver: function (spot, status) {
        if (battleEnd) return;
        if (spot === battle.opp && status === 6) foeInformation.pokemon[foeInformation.currentSlot].specialStatus.confused = false;
    },
    onFlinch: function (spot) {
        if (!useAI) {
            return;
        }
        if (battleEnd) return;
        //if (spot === battle.opp && tarname.toLowerCase() === "磁界齿轮") battle.battleMessage(battle.id, "对不起 我是狗");
    },
    onPlayerMessage: function (player, message) {
        if (player == battle.me) {
            if (message == "annoy") {
                verb = true;
            } else if (message == "debug") {
                verb = false;
            } else if (message.substr(0, 5) == "eval ") {
                //sys.eval(message.substr(5));
                //var bindChannel = channel;
                try {
                    var res = eval(message.substr(5));
                    print_s("Got from eval: " + res);
                } catch (err) {
                    print_s("Error in eval: " + err);
                }
                return;
            }
        }
    },
    onReconnect: function (player) {
        //if (foeInformation.pokemon.length === 0) foeInformation.initial();
        print_s("onReconnect:player" + player);
        if (player !== client.ownId()) return;
        if (srcname.toLowerCase() === "[lv0.吧服bot]清分少女") battle.battleMessage(battle.id, "QAQ清分少女出现了一些问题，30秒后将会认输");
        battleEnd = true;
        sys.setTimer(function () {
            canCloseWindow = true;
        }, 25000, 0);
        sys.setTimer(function () {
            if (canCloseWindow) {
                foeInformation.pokemon = [];
                battle.forfeit();
            } else battleEnd = false;
        }, 30000, 0);
    }
})