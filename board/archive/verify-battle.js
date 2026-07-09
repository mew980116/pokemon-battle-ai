// PO webCall battle-callback reachability test
// Temporarily paste this into PO's battle script window (replace the main AI
// script), start a battle, and watch the Node verify-server console.
// After testing, switch back to 20201227_v1.3.1.js.
//
// What this checks:
//   1. Can sys.webCall (async, with POST args) be called INSIDE battle callbacks?
//   2. Does the args object arrive as form-data or JSON?
//   3. (/wctest in chat) synchronous GET from the client context as a baseline.
//
// All comments/output are ASCII on purpose to avoid PO paste encoding issues.
// QScript-compatible: var only, function decls, string concat, indexOf.

var useAI = true;
var battleEnd = false;
var canCloseWindow = false;

var WC_URL = "http://127.0.0.1:8080/ping";
var WC_HEALTH = "http://127.0.0.1:8080/health";

function print_s(m) {
    print("[WCVERIFY] " + m);
}

// Async POST wrapper. sys.webCall(url, callbackScript, args).
// args is a plain object; PO sends it as POST parameters.
function wcPost(event, data) {
    var args = data || {};
    args.event = event;
    try {
        sys.webCall(WC_URL, "print('[WEBCALL] done')", args);
        print_s("-> sent: " + event + "  args=" + args.event);
    } catch (e) {
        print_s("!! webCall threw on " + event + ": " + e.message);
    }
}

({
    onBeginTurn: function (turn) {
        print_s("onBeginTurn turn=" + turn);
        wcPost("onBeginTurn", { turn: turn });
    },

    onUseAttack: function (spot, attack) {
        wcPost("onUseAttack", { spot: spot, attack: attack });
    },

    onSendOut: function (spot, prevIndex) {
        wcPost("onSendOut", { spot: spot, prev: prevIndex });
    },

    onSendBack: function (spot) {
        wcPost("onSendBack", { spot: spot });
    },

    onDamageDone: function (spot, damage) {
        wcPost("onDamageDone", { spot: spot, damage: damage });
    },

    onKo: function (spot) {
        wcPost("onKo", { spot: spot });
    },

    onMajorStatusChange: function (spot, status, multipleTurns, silent) {
        wcPost("onMajorStatusChange", { spot: spot, status: status });
    },

    onOfferChoice: function (player, choice) {
        print_s("onOfferChoice player=" + player);
        wcPost("onOfferChoice", { player: player });
    },

    onBattleEnd: function (result, winner) {
        wcPost("onBattleEnd", { result: result, winner: winner });
    },

    onPlayerMessage: function (player, message) {
        if (player === battle.me && message.indexOf("/eval ") === 0) {
            var code = message.substring(6);
            try {
                var r = eval(code);
                print_s("eval result: " + r);
            } catch (e) {
                print_s("eval error: " + e.message);
            }
            return;
        }
        // Manual baseline test: synchronous GET from client context.
        if (player === battle.me && message.indexOf("/wctest") === 0) {
            print_s("running /wctest ...");
            try {
                var sync = sys.synchronousWebCall(WC_HEALTH);
                print_s("sync GET health => " + sync);
            } catch (e) {
                print_s("sync GET error: " + e.message);
            }
            wcPost("manual-wctest", { src: "chat" });
        }
    },

    // Stubs so PO has a complete callback object if it needs one.
    onMiss: function (spot) {},
    onAvoid: function (spot) {},
    onStatusDamage: function (spot, status) {},
    onItemMessage: function (spot, item, part, foe, berry, other) {},
    onMoveMessage: function (spot, move, part, type, foe, other, q) {},
    onAbilityMessage: function (spot, ab, part, type, foe, other) {},
    onTierNotification: function (tier) {},
    onClauseActivated: function (clause) {},
    onEffectiveness: function (spot, effectiveness) {},
    onAttackFailing: function (spot, silent) {},
    onCriticalHit: function (spot) {},
    onChoiceSelection: function (player) {},
    onChoiceCancellation: function (player) {},
    onDrawRequest: function (player) {},
    onChoiceCancelled: function (player) {},
    onStatusOver: function (spot, status) {},
    onFlinch: function (spot) {},
    onReconnect: function (player) {}
});
