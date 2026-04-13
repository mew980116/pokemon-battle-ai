// 回调函数测试脚本
// 此脚本用于测试系统回调函数的触发情况，不包含任何对战逻辑

// 全局变量
var useAI = true;
var battleEnd = false;
var srcname = "Test Battle";
var canCloseWindow = false;

// 辅助函数（与20201227.js保持一致）
function print_s(message) {
    // 在Qt引擎窗口环境中，直接输出消息
    print("[TEST] " + message);
}

function send(message) {
    // 在Qt引擎窗口环境中，直接输出消息
    print("[SEND] " + message);
}

function nick(spot) {
    return spot === battle.me ? "My Pokemon" : "Foe Pokemon";
}

// 回调函数对象（与20201227.js保持一致的格式）
({
    // 回合相关
    onBeginTurn: function (turn) {
        print_s("onBeginTurn called with turn: " + turn);
    },
    
    // 攻击相关
    onMiss: function (spot) {
        print_s("onMiss called with spot: " + spot);
    },
    
    onAvoid: function (spot) {
        print_s("onAvoid called with spot: " + spot);
    },
    
    onStatusDamage: function (spot, status) {
        print_s("onStatusDamage called with spot: " + spot + ", status: " + status);
    },
    
    onKo: function (spot) {
        print_s("onKo called with spot: " + spot);
    },
    
    onUseAttack: function (spot, attack) {
        print_s("onUseAttack called with spot: " + spot + ", attack: " + attack);
    },
    
    // 宝可梦交换相关
    onSendBack: function (spot) {
        print_s("onSendBack called with spot: " + spot);
    },
    
    onSendOut: function (spot, prevIndex) {
        print_s("onSendOut called with spot: " + spot + ", prevIndex: " + prevIndex);
    },
    
    // 道具、技能、特性消息
    onItemMessage: function (spot, item, part, foe, berry, other) {
        print_s("onItemMessage called with spot: " + spot + ", item: " + item + ", part: " + part + ", foe: " + foe + ", berry: " + berry + ", other: " + other);
    },
    
    onMoveMessage: function (spot, move, part, type, foe, other, q) {
        print_s("onMoveMessage called with spot: " + spot + ", move: " + move + ", part: " + part + ", type: " + type + ", foe: " + foe + ", other: " + other + ", q: " + q);
    },
    
    onAbilityMessage: function (spot, ab, part, type, foe, other) {
        print_s("onAbilityMessage called with spot: " + spot + ", ab: " + ab + ", part: " + part + ", type: " + type + ", foe: " + foe + ", other: " + other);
    },
    
    // 对战信息
    onTierNotification: function (tier) {
        print_s("onTierNotification called with tier: " + tier);
    },
    
    onClauseActivated: function (clause) {
        print_s("onClauseActivated called with clause: " + clause);
    },
    
    // 攻击效果
    onEffectiveness: function (spot, effectiveness) {
        print_s("onEffectiveness called with spot: " + spot + ", effectiveness: " + effectiveness);
    },
    
    onAttackFailing: function (spot, silent) {
        print_s("onAttackFailing called with spot: " + spot + ", silent: " + silent);
    },
    
    // 对战结束
    onBattleEnd: function (result, winner) {
        print_s("onBattleEnd called with result: " + result + ", winner: " + winner);
    },
    
    // 伤害
    onDamageDone: function (spot, damage) {
        print_s("onDamageDone called with spot: " + spot + ", damage: " + damage);
    },
    
    // 选择相关
    onOfferChoice: function (player, choice) {
        print_s("onOfferChoice called with player: " + player + ", choice: " + choice);
    },
    
    onChoiceSelection: function (player) {
        print_s("onChoiceSelection called with player: " + player);
    },
    
    onCriticalHit: function (spot) {
        print_s("onCriticalHit called with spot: " + spot);
    },
    
    onChoiceCancellation: function (player) {
        print_s("onChoiceCancellation called with player: " + player);
    },
    
    onDrawRequest: function (player) {
        print_s("onDrawRequest called with player: " + player);
    },
    
    onChoiceCancelled: function (player) {
        print_s("onChoiceCancelled called with player: " + player);
    },
    
    // 状态变化
    onMajorStatusChange: function (spot, status, multipleTurns, silent) {
        print_s("onMajorStatusChange called with spot: " + spot + ", status: " + status + ", multipleTurns: " + multipleTurns + ", silent: " + silent);
    },
    
    onStatusOver: function (spot, status) {
        print_s("onStatusOver called with spot: " + spot + ", status: " + status);
    },
    
    onFlinch: function (spot) {
        print_s("onFlinch called with spot: " + spot);
    },
    
    // 其他
    onPlayerMessage: function (player, message) {
        print_s("onPlayerMessage called with player: " + player + ", message: " + message);
        // 处理/eval命令，当我方发送/eval XXXX时执行XXXX
        if (player === battle.me && message.indexOf("/eval ") === 0) {
            var code = message.substring(6);
            try {
                var result = eval(code);
                print_s("Eval result: " + result);
            } catch (e) {
                print_s("Eval error: " + e.message);
            }
        }
    },
    
    onReconnect: function (player) {
        print_s("onReconnect called with player: " + player);
    }
});