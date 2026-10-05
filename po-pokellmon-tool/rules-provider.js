'use strict';

var calc = require('./vendor/smogon-calc/index.js');
var contract = require('./decision-contract.js');

var DEX = {};

function toId(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function capitalize(value) {
    var text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text;
}

function getDex(gen) {
    var generation = Number(gen) || 9;
    if (!DEX[generation]) DEX[generation] = calc.Generations.get(generation) || calc.Generations.get(9);
    return DEX[generation];
}

function getTypes(pokemon) {
    return pokemon && Array.isArray(pokemon.types) ? pokemon.types : [];
}

function hasType(types, type) {
    var want = toId(type);
    for (var i = 0; i < types.length; i++) if (toId(types[i]) === want) return true;
    return false;
}

function typeMultiplier(moveType, defenderTypes, gen) {
    if (!moveType || !defenderTypes || !defenderTypes.length) return 1;
    var type = getDex(gen).types.get(toId(moveType));
    if (!type || !type.effectiveness) return 1;
    var multiplier = 1;
    for (var i = 0; i < defenderTypes.length; i++) {
        var target = capitalize(defenderTypes[i]);
        if (type.effectiveness[target] !== undefined) multiplier *= type.effectiveness[target];
    }
    return multiplier;
}

function getMove(action, state, gen) {
    // contract.actionId 会把 action.id 规范化成 move:<slot>；
    // 规则算法应优先使用原始招式 name，不能把 move:1 当作图鉴 id。
    var id = action && action.name;
    if (!id && action && action.id && String(action.id).indexOf('move:') !== 0) id = action.id;
    if (!id && state && state.me && state.me.moves) {
        for (var i = 0; i < state.me.moves.length; i++) {
            if (Number(state.me.moves[i].slot) === Number(action.slot)) {
                id = state.me.moves[i].id || state.me.moves[i].name;
                break;
            }
        }
    }
    if (!id) return null;
    try {
        var move = getDex(gen).moves.get(toId(id));
        return move && move.exists !== false ? move : null;
    } catch (error) {
        return null;
    }
}

function normalizeWeather(value) {
    var id = toId(value);
    if (id.indexOf('rain') !== -1) return 'Rain';
    if (id.indexOf('sun') !== -1 || id.indexOf('harshsun') !== -1) return 'Sun';
    if (id.indexOf('sand') !== -1) return 'Sand';
    if (id.indexOf('hail') !== -1) return 'Hail';
    if (id.indexOf('snow') !== -1) return 'Snow';
    return undefined;
}

function normalizeTerrain(value) {
    var id = toId(value);
    if (id.indexOf('electric') !== -1) return 'Electric';
    if (id.indexOf('grassy') !== -1) return 'Grassy';
    if (id.indexOf('misty') !== -1) return 'Misty';
    if (id.indexOf('psychic') !== -1) return 'Psychic';
    return undefined;
}

function calcFieldSide(screens) {
    var result = {};
    var values = Array.isArray(screens) ? screens : [];
    for (var i = 0; i < values.length; i++) {
        var id = toId(values[i]);
        if (id.indexOf('reflect') !== -1) result.isReflect = true;
        if (id.indexOf('lightscreen') !== -1) result.isLightScreen = true;
        if (id.indexOf('auroraveil') !== -1) result.isAuroraVeil = true;
        if (id.indexOf('tailwind') !== -1) result.isTailwind = true;
    }
    return result;
}

function moveId(move) {
    return toId(move && (move.id || move.name));
}

function effectiveMoveType(move, attacker) {
    var id = moveId(move);
    if (id === 'multiattack' && attacker) {
        var name = String(attacker.name || '');
        var formMatch = name.match(/-([A-Za-z]+)$/);
        if (formMatch && formMatch[1].toLowerCase() !== 'normal') {
            return capitalize(formMatch[1]);
        }
        var types = getTypes(attacker);
        if (types.length && toId(types[0]) !== 'normal') return types[0];
    }
    if (id === 'revelationdance' && attacker && getTypes(attacker).length) {
        return getTypes(attacker)[0];
    }
    return move && move.type;
}

function countBoosts(pokemon) {
    var total = 0;
    var boosts = pokemon && Array.isArray(pokemon.boosts) ? pokemon.boosts : [];
    for (var i = 0; i < boosts.length; i++) {
        var match = String(boosts[i]).match(/([+-]\d+)$/);
        if (match) total += Math.abs(Number(match[1]));
    }
    return total;
}

function statRowFor(pokemon, state, side) {
    if (!pokemon) return null;
    var rows = side === 'me' && state && Array.isArray(state.myStats) ? state.myStats : [];
    // PS battle slots and request team-array slots are not always identical
    // after random-battle team normalization. Prefer the species name before
    // falling back to the numeric slot, otherwise damage uses another
    // teammate's observed stats.
    for (var i = 0; i < rows.length; i++) {
        if (pokemon.name && toId(rows[i].name) === toId(pokemon.name)) return rows[i];
    }
    for (var j = 0; j < rows.length; j++) {
        if (pokemon.slot && Number(rows[j].slot) === Number(pokemon.slot)) return rows[j];
    }
    return null;
}

function boostsObject(pokemon) {
    var result = {};
    var boosts = pokemon && Array.isArray(pokemon.boosts) ? pokemon.boosts : [];
    for (var i = 0; i < boosts.length; i++) {
        var match = String(boosts[i]).match(/^([a-z]+)([+-]\d+)$/i);
        if (match) result[match[1].toLowerCase()] = Number(match[2]);
    }
    return result;
}

function makeCalcPokemon(pokemon, state, gen, side, extra) {
    if (!pokemon || !pokemon.name) return null;
    var row = statRowFor(pokemon, state, side);
    var options = {
        level: Number(pokemon.level || row && row.level || 100),
        item: pokemon.item || row && row.item || undefined,
        ability: pokemon.ability || undefined,
        status: pokemon.status || undefined,
        boosts: boostsObject(pokemon)
    };
    if (side === 'opp' && !row) {
        // Opponent random-battle stats are hidden. Use a conservative legal
        // max-EV profile instead of the calc library's neutral zero-EV
        // default, which systematically understates OHKO threats.
        options.evs = { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 };
        options.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    }
    if (extra) {
        if (extra.isDynamaxed) options.isDynamaxed = true;
        if (extra.teraType) options.teraType = extra.teraType;
    }
    if (pokemon.hpPct !== null && pokemon.hpPct !== undefined) {
        var maxHp = Number(row && row.hp || 0);
        if (!maxHp) {
            maxHp = Number(pokemon.maxHp || 0);
            // HP Percentage Mod uses 100 as the displayed denominator, not
            // the Pokemon's real HP total.
            if (maxHp > 1 && maxHp <= 100) maxHp = 0;
        }
        if (maxHp > 0) options.curHP = Math.max(1, Math.round(maxHp * Number(pokemon.hpPct) / 100));
    }
    try {
        var result = new calc.Pokemon(gen, pokemon.name, options);
        // PS request exposes the actual randomized stats for our team. The calc
        // object accepts the species defaults, so replace its calculated stats
        // with the observed values when they are available.
        if (row && row.stats) {
            var keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if (row.stats[key] !== undefined && row.stats[key] !== null) {
                    result.stats[key] = Number(row.stats[key]);
                    result.rawStats[key] = Number(row.stats[key]);
                }
            }
            if (row.stats.hp && pokemon.hpPct !== null && pokemon.hpPct !== undefined) {
                result.originalCurHP = Math.max(1, Math.round(Number(row.stats.hp) * Number(pokemon.hpPct) / 100));
            }
        }
        return result;
    } catch (error) {
        return null;
    }
}

function damageRange(action, attacker, defender, state, gen, side, extra) {
    var move = getMove(action, state, gen);
    if (!move || move.category === 'Status' || !move.basePower) return null;
    var atk = makeCalcPokemon(attacker, state, gen, side, extra);
    var def = makeCalcPokemon(defender, state, gen, side === 'me' ? 'opp' : 'me');
    if (!atk || !def) return null;
    try {
        var attackerSide = side === 'me' ? 'me' : 'opp';
        var defenderSide = side === 'me' ? 'opp' : 'me';
        var calcMove = new calc.Move(gen, move.name || move.id);
        var effectiveType = effectiveMoveType(move, attacker);
        if (effectiveType) calcMove.type = effectiveType;
        var result = calc.calculate(gen, atk, def, calcMove, new calc.Field({
            weather: normalizeWeather(state && state.weather),
            terrain: normalizeTerrain(state && state.terrain),
            attackerSide: calcFieldSide(state && state.screens && state.screens[attackerSide]),
            defenderSide: calcFieldSide(state && state.screens && state.screens[defenderSide])
        }));
        var range = result.range();
        if (!range || range.length < 2) return null;
        var maxHp = Number(defender.maxHp || 0);
        if (maxHp > 1 && maxHp <= 100) maxHp = 0;
        if (!maxHp) {
            var row = statRowFor(defender, state, side === 'me' ? 'opp' : 'me');
            maxHp = Number(row && row.hp || def.maxHP());
        }
        return {
            min: Number(range[0]),
            max: Number(range[1]),
            avg: (Number(range[0]) + Number(range[1])) / 2,
            percentMin: maxHp ? Number(range[0]) / maxHp * 100 : null,
            percentMax: maxHp ? Number(range[1]) / maxHp * 100 : null,
            move: move
        };
    } catch (error) {
        return null;
    }
}

function currentHp(pokemon, state, side, gen) {
    if (!pokemon) return 0;
    var row = statRowFor(pokemon, state, side);
    if (row && row.hp && pokemon.hpPct !== null && pokemon.hpPct !== undefined) {
        return Number(row.hp) * Number(pokemon.hpPct) / 100;
    }
    // In HP Percentage Mod, pokemon.hp/maxHp are the displayed percentage
    // values. Only treat the protocol hp as an absolute value when the
    // denominator is a real HP total (or Shedinja's 1 HP).
    if (pokemon.hp !== null && pokemon.hp !== undefined &&
        (Number(pokemon.maxHp || 0) > 100 || Number(pokemon.maxHp || 0) === 1)) {
        return Number(pokemon.hp);
    }
    var maxHp = Number(row && row.hp || 0);
    if (!maxHp) {
        maxHp = Number(pokemon.maxHp || 0);
        if (maxHp > 1 && maxHp <= 100) maxHp = 0;
    }
    if (!maxHp) {
        var calcPokemon = makeCalcPokemon(pokemon, state, gen || 9, side);
        maxHp = calcPokemon ? calcPokemon.maxHP() : 0;
    }
    if (maxHp && pokemon.hpPct !== null && pokemon.hpPct !== undefined) return maxHp * Number(pokemon.hpPct) / 100;
    return maxHp;
}

function damageReachesHp(damage, pokemon, state, side, gen, stable) {
    if (!damage || !pokemon) return false;
    if (pokemon.hpPct !== null && pokemon.hpPct !== undefined &&
        damage.percentMax !== null && damage.percentMax !== undefined) {
        var threshold = Number(pokemon.hpPct);
        var value = stable ? damage.percentMin : damage.percentMax;
        return value >= threshold;
    }
    var hp = currentHp(pokemon, state, side, gen);
    if (!hp) return false;
    return (stable ? damage.min : damage.max) >= hp;
}

function damageCanKo(damage, pokemon, state, side, gen) {
    return damageReachesHp(damage, pokemon, state, side, gen, false);
}

function damageStableKo(damage, pokemon, state, side, gen) {
    return damageReachesHp(damage, pokemon, state, side, gen, true);
}

function maxHpFor(pokemon, state, side, gen) {
    if (!pokemon) return 0;
    var row = statRowFor(pokemon, state, side);
    if (row && row.hp) return Number(row.hp);
    var calcPokemon = makeCalcPokemon(pokemon, state, gen || 9, side);
    return calcPokemon ? Number(calcPokemon.maxHP() || 0) : 0;
}

function historyTargetName(line) {
    var match = String(line || '').match(/^\|(?:switch|damage|heal)\|p1a: ([^|]+)/);
    return match ? match[1] : null;
}

function historyHpPercent(token) {
    var value = String(token || '').split(' ')[0];
    if (value === '0') return 0;
    var match = value.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    var hp = Number(match[1]);
    var maxHp = Number(match[2]);
    return maxHp > 0 ? hp / maxHp * 100 : null;
}

function recentOpponentDamageObservation(state, defender) {
    if (!state || !defender || !defender.name) return null;
    var history = Array.isArray(state.fullHistory) ? state.fullHistory :
        (Array.isArray(state.history) ? state.history : []);
    var wanted = toId(defender.name);
    var current = null;
    var pending = null;
    var observations = [];

    function finishPending() {
        if (pending && pending.damagePct > 0 && !pending.critical) {
            observations.push({
                move: pending.move,
                target: pending.target,
                damagePct: pending.damagePct
            });
        }
        pending = null;
    }

    for (var i = 0; i < history.length; i++) {
        var line = String(history[i] || '');
        if (line.indexOf('|move|p2a: ') === 0) {
            finishPending();
            var moveParts = line.split('|');
            var target = moveParts[4] || '';
            if (target.indexOf('p1a: ') === 0 &&
                toId(target.slice(5)) === wanted) {
                pending = {
                    move: moveParts[3] || '',
                    target: target.slice(5),
                    beforePct: current,
                    damagePct: 0,
                    critical: false
                };
            }
            continue;
        }
        if (line.indexOf('|crit|') === 0 && pending) {
            pending.critical = true;
            continue;
        }
        if (line.indexOf('|switch|p1a: ') === 0) {
            var switchName = historyTargetName(line);
            var switchParts = line.split('|');
            var switchPct = historyHpPercent(switchParts[3]);
            if (toId(switchName) === wanted) current = switchPct;
            else current = null;
            finishPending();
            continue;
        }
        if (line.indexOf('|damage|p1a: ') === 0) {
            var damageName = historyTargetName(line);
            var damageParts = line.split('|');
            var afterPct = historyHpPercent(damageParts[3]);
            if (toId(damageName) === wanted && afterPct !== null) {
                if (pending && pending.beforePct !== null && pending.beforePct !== undefined &&
                    line.indexOf('[from]') === -1) {
                    pending.damagePct += Math.max(0, pending.beforePct - afterPct);
                }
                current = afterPct;
            }
            continue;
        }
        if (line.indexOf('|heal|p1a: ') === 0) {
            var healName = historyTargetName(line);
            var healParts = line.split('|');
            var healPct = historyHpPercent(healParts[3]);
            if (toId(healName) === wanted && healPct !== null) current = healPct;
            finishPending();
            continue;
        }
        if (line.indexOf('|move|') === 0 && pending) finishPending();
    }
    finishPending();
    return observations;
}

function scaleDamage(damage, factor) {
    if (!damage || !isFinite(factor) || factor <= 0) return damage;
    return {
        min: damage.min * factor,
        max: damage.max * factor,
        avg: damage.avg * factor,
        percentMin: damage.percentMin === null ? null : damage.percentMin * factor,
        percentMax: damage.percentMax === null ? null : damage.percentMax * factor,
        move: damage.move
    };
}

function calibrateIncomingDamage(damage, attacker, defender, state, gen, side) {
    if (!damage || side !== 'opp' || !state) return damage;
    var observations = recentOpponentDamageObservation(state, defender);
    if (!observations || !observations.length) return damage;
    var team = Array.isArray(state.myTeam) ? state.myTeam : [];
    var bestFactor = 1;
    for (var i = 0; i < observations.length; i++) {
        var observation = observations[i];
        if (!observation.damagePct) continue;
        var observedTarget = null;
        for (var j = 0; j < team.length; j++) {
            if (toId(team[j].name) === toId(observation.target)) {
                observedTarget = team[j];
                break;
            }
        }
        if (!observedTarget) continue;
        var baseline = damageRange({ name: observation.move }, attacker, observedTarget, state, gen, side);
        if (!baseline || !baseline.percentMax || baseline.percentMax <= 0) continue;
        var factor = observation.damagePct / baseline.percentMax;
        if (factor > bestFactor) bestFactor = factor;
    }
    bestFactor = Math.max(0.75, Math.min(2.5, bestFactor));
    return scaleDamage(damage, bestFactor);
}

function recoveryTargetHp(move, pokemon, state, side, gen) {
    var maxHp = maxHpFor(pokemon, state, side, gen);
    var hp = currentHp(pokemon, state, side, gen);
    if (!maxHp || !hp) return 0;
    var id = moveId(move);
    if (id === 'rest') return maxHp;
    return Math.min(maxHp, hp + maxHp * 0.5);
}

function recoveryDefender(pokemon, move) {
    if (!pokemon || moveId(move) !== 'roost' ||
        !hasType(getTypes(pokemon), 'Flying')) return pokemon;
    var copy = {};
    var keys = Object.keys(pokemon);
    for (var i = 0; i < keys.length; i++) copy[keys[i]] = pokemon[keys[i]];
    copy.types = getTypes(pokemon).filter(function (type) {
        return toId(type) !== 'flying';
    });
    return copy;
}

function bestKnownDamage(attacker, defender, moves, state, gen, side) {
    var best = null;
    for (var i = 0; i < (moves || []).length; i++) {
        var action = moves[i];
        if (!action) continue;
        var damage = damageRange(action, attacker, defender, state, gen, side);
        if (!damage) continue;
        if (!best || damage.avg > best.avg) best = damage;
    }
    return best;
}

function isRecoveryMove(move) {
    return ['recover', 'roost', 'slackoff', 'softboiled', 'moonlight', 'morningsun',
        'synthesis', 'shoreup', 'rest', 'wish'].indexOf(moveId(move)) !== -1;
}

function isSetupMove(move) {
    return ['swordsdance', 'nastyplot', 'dragondance', 'quiverdance', 'calmmind',
        'bulkup', 'irondefense', 'amnesia', 'shellsmash', 'agility', 'cosmicpower',
        'curse', 'coil', 'shiftgear'].indexOf(moveId(move)) !== -1;
}

function isPivotMove(move) {
    return ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport'].indexOf(moveId(move)) !== -1;
}

function isDelayedDamageMove(move) {
    return ['futuresight', 'doomdesire', 'phantomforce', 'shadowforce',
        'fly', 'bounce', 'dig', 'dive', 'skullbash', 'razorwind',
        'solarbeam', 'solarblade'].indexOf(moveId(move)) !== -1;
}

function isPriorityMove(move) {
    return !!(move && Number(move.priority || 0) > 0);
}

function isRecoilMove(move) {
    return ['bravebird', 'flareblitz', 'doubleedge', 'woodhammer', 'headsmash',
        'wildcharge', 'volttackle', 'submission', 'highjumpkick', 'jumpkick'].indexOf(moveId(move)) !== -1;
}

function contactChipDamage(move, defender, state, gen) {
    if (!move || !move.flags || !move.flags.contact || !defender) return 0;
    var maxHp = maxHpFor(defender, state, 'opp', gen);
    if (!maxHp) return 0;
    var chip = 0;
    var ability = toId(defender.ability);
    if (ability === 'ironbarbs' || ability === 'roughskin') chip += maxHp / 8;
    var item = toId(defender.item);
    if (item === 'rockyhelmet') chip += maxHp / 6;
    return chip;
}

function statusMoveImmune(move, defender, state) {
    var id = moveId(move);
    var types = getTypes(defender);
    if (id === 'toxic' && (hasType(types, 'Poison') || hasType(types, 'Steel'))) return true;
    if (id === 'thunderwave' && hasType(types, 'Electric')) return true;
    if (id === 'willowisp' && hasType(types, 'Fire')) return true;
    if (['sleeppowder', 'spore', 'stunspore', 'poisonpowder'].indexOf(id) !== -1 &&
        (hasType(types, 'Grass') || String(defender && defender.ability || '').toLowerCase() === 'overcoat')) {
        return true;
    }
    if (id === 'leechseed' && hasType(types, 'Grass')) return true;
    if (['hypnosis', 'sing', 'lovelykiss', 'darkvoid', 'yawn'].indexOf(id) !== -1) {
        var ability = toId(defender && defender.ability);
        if (['insomnia', 'vitalspirit', 'sweetveil'].indexOf(ability) !== -1) return true;
        if (state && state.weather === 'Sun' && ability === 'leafguard') return true;
    }
    return false;
}

function entryHazardPercent(pokemon, state, gen) {
    var hazards = Array.isArray(state && state.myHazards) ? state.myHazards : [];
    var percent = 0;
    var rockMultiplier = typeMultiplier('Rock', getTypes(pokemon), gen);
    var spikesLayers = 0;
    for (var i = 0; i < hazards.length; i++) {
        var id = toId(hazards[i]);
        if (id.indexOf('stealthrock') !== -1) {
            if (rockMultiplier > 0) percent += 12.5 * rockMultiplier;
        } else if (id === 'spikes' || id.indexOf('spikes') !== -1) {
            spikesLayers++;
        }
    }
    if (spikesLayers > 0 &&
        !hasType(getTypes(pokemon), 'Flying') &&
        toId(pokemon && pokemon.ability) !== 'levitate') {
        percent += spikesLayers === 1 ? 12.5 : (spikesLayers === 2 ? 16.67 : 25);
    }
    return Math.min(100, percent);
}

function statusResidualLethal(pokemon) {
    if (!pokemon || pokemon.hpPct === null || pokemon.hpPct === undefined) return false;
    var status = toId(pokemon.status);
    var hpPct = Number(pokemon.hpPct);
    if (status === 'tox' || status === 'toxic') return hpPct <= 20;
    if (status === 'psn' || status === 'poison' || status === 'brn' || status === 'burn') {
        return hpPct <= 12.5;
    }
    return false;
}

function residualDamageFor(pokemon, state, gen) {
    if (!pokemon) return 0;
    var maxHp = maxHpFor(pokemon, state, 'me', gen);
    if (!maxHp) return 0;
    var percent = 0;
    var weather = normalizeWeather(state && state.weather);
    var types = getTypes(pokemon);
    var ability = toId(pokemon.ability);
    if ((weather === 'Sand' &&
        !hasType(types, 'Rock') && !hasType(types, 'Ground') && !hasType(types, 'Steel') &&
        ability !== 'sandrush' && ability !== 'sandforce' && ability !== 'sandveil') ||
        (weather === 'Hail' && !hasType(types, 'Ice'))) {
        percent += 6.25;
    }
    var status = toId(pokemon.status);
    if (status === 'brn' || status === 'burn' || status === 'psn' || status === 'poison' ||
        status === 'tox' || status === 'toxic') {
        percent += 6.25;
    }
    return maxHp * percent / 100;
}

function recentOwnSwitchSlots(state) {
    var history = state && Array.isArray(state.fullHistory) && state.fullHistory.length ?
        state.fullHistory : (state && Array.isArray(state.history) ? state.history : []);
    var team = state && Array.isArray(state.myTeam) ? state.myTeam : [];
    var slots = [];
    for (var i = 0; i < history.length; i++) {
        var line = String(history[i] || '');
        if (line.indexOf('|switch|p1a: ') !== 0) continue;
        var body = line.slice('|switch|p1a: '.length);
        var name = body.split('|')[0];
        var slot = null;
        for (var j = 0; j < team.length; j++) {
            if (toId(team[j].name) === toId(name)) {
                slot = Number(team[j].slot);
                break;
            }
        }
        if (slot !== null && (!slots.length || slots[slots.length - 1] !== slot)) {
            slots.push(slot);
        }
    }
    return slots;
}

function leadCandidate(state, action) {
    var team = state && Array.isArray(state.myTeam) ? state.myTeam : [];
    for (var i = 0; i < team.length; i++) {
        if (Number(team[i].slot) === Number(action.lead)) return team[i];
    }
    return null;
}

function leadMoveScore(moveIdValue, candidate, opponent, gen) {
    var move;
    try {
        move = getDex(gen).moves.get(toId(moveIdValue));
    } catch (error) {
        move = null;
    }
    if (!move || move.exists === false) return 0;
    var multiplier = typeMultiplier(move.type, getTypes(opponent), gen);
    if (multiplier === 0) return 0;
    var stab = hasType(getTypes(candidate), move.type) ? 1.5 : 1;
    var accuracy = typeof move.accuracy === 'number' ? move.accuracy / 100 : 1;
    if (move.category === 'Status' || !move.basePower) {
        if (['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'].indexOf(moveId(move)) !== -1) return 34;
        if (isSetupMove(move)) return 22;
        return 8;
    }
    return Number(move.basePower) * multiplier * stab * accuracy;
}

function expectedIncoming(attacker, defender, state, gen, side) {
    return bestKnownDamage(attacker, defender,
        attacker && Array.isArray(attacker.moves) ? attacker.moves : [], state, gen, side);
}

function rulesCache(state) {
    if (!state || typeof state !== 'object') return null;
    if (!state.__rulesCache) {
        try {
            Object.defineProperty(state, '__rulesCache', {
                value: {},
                enumerable: false,
                configurable: true
            });
        } catch (error) {
            state.__rulesCache = {};
        }
    }
    return state.__rulesCache;
}

function incomingActsFirst(incoming, attacker, defender, state, gen, attackerSide) {
    if (!incoming || !incoming.move || !attacker || !defender) return null;
    return moveActsFirst({
        name: incoming.move.name || incoming.move.id
    }, attacker, defender, state, gen, attackerSide);
}

function incomingThreat(attacker, defender, state, gen, side) {
    var cache = rulesCache(state);
    var cacheKey = side + '|' + toId(attacker && attacker.name) + '|' +
        toId(defender && defender.name) + '|' +
        String(attacker && attacker.hpPct) + '|' + String(defender && defender.hpPct) +
        '|' + String(attacker && attacker.boosts) + '|' +
        String(attacker && attacker.moves && attacker.moves.length) + '|' +
        String(state && state.weather) + '|' + String(state && state.terrain);
    if (cache && cache[cacheKey]) return cache[cacheKey];
    var known = expectedIncoming(attacker, defender, state, gen, side);
    var representative = estimateUnknownDamage(attacker, defender, state, gen, side);
    var result;
    if (!known) result = representative;
    else if (!representative) result = known;
    else result = representative.max > known.max ? representative : known;
    result = calibrateIncomingDamage(result, attacker, defender, state, gen, side);
    if (cache && result) cache[cacheKey] = result;
    return result;
}

function estimateUnknownDamage(attacker, defender, state, gen, side) {
    if (!attacker || !attacker.name || !getTypes(attacker).length) return null;
    var representativeMoves = {
        Normal: ['boomburst', 'doubleedge', 'hypervoice'],
        Fire: ['overheat', 'fireblast', 'flamethrower'],
        Water: ['hydropump', 'surf'],
        Electric: ['thunder', 'thunderbolt'],
        Grass: ['leafstorm', 'energyball'],
        Ice: ['blizzard', 'icebeam'],
        Fighting: ['closecombat'],
        Poison: ['sludgewave', 'sludgebomb'],
        Ground: ['earthquake'],
        Flying: ['bravebird', 'hurricane'],
        Psychic: ['psychic'],
        Bug: ['megahorn', 'bugbuzz'],
        Rock: ['stoneedge', 'rockslide'],
        Ghost: ['shadowball'],
        Dragon: ['dracometeor', 'outrage'],
        Dark: ['darkestlariat', 'knockoff'],
        Steel: ['ironhead'],
        Fairy: ['moonblast']
    };
    var best = null;
    var types = getTypes(attacker);
    for (var i = 0; i < types.length; i++) {
        var moveNames = representativeMoves[types[i]] || [];
        for (var mi = 0; mi < moveNames.length; mi++) {
            var damage = damageRange({ name: moveNames[mi] }, attacker, defender, state, gen, side);
            if (damage && (!best || damage.avg > best.avg)) best = damage;
        }
    }
    // A revealed STAB move is not the whole threat model. Random battles
    // frequently hide one coverage move specifically for the switch target
    // (for example Muk's Ice Punch into a Dragon). Only add this conservative
    // supplement when the target is already below half HP or the opponent has
    // revealed only part of its moveset, and discount it to avoid treating
    // every legal coverage move as certain.
    var defenderHpPct = defender && defender.hpPct !== null &&
        defender.hpPct !== undefined ? Number(defender.hpPct) : 100;
    if (defenderHpPct <= 50 || types.length && (!attacker.moves || attacker.moves.length < 4)) {
        var coverageMoves = [
            'earthquake', 'closecombat', 'stoneedge', 'icepunch', 'firepunch',
            'thunderpunch', 'knockoff', 'crunch', 'playrough', 'shadowclaw',
            'flamethrower', 'icebeam', 'thunderbolt', 'focusblast',
            'shadowball', 'psychic', 'energyball', 'earthpower', 'surf'
        ];
        for (var ci = 0; ci < coverageMoves.length; ci++) {
            var coverage = damageRange({ name: coverageMoves[ci] }, attacker, defender, state, gen, side);
            if (!coverage) continue;
            var discounted = scaleDamage(coverage, 0.85);
            if (!best || discounted.avg > best.avg) best = discounted;
        }
    }
    return best;
}

function scoreMove(action, state, gen) {
    var move = getMove(action, state, gen);
    if (!move) return 0;
    var me = state.me || {};
    var opp = state.opp || {};
    var moveType = effectiveMoveType(move, me);
    var multiplier = typeMultiplier(moveType, getTypes(opp), gen);
    var stab = hasType(getTypes(me), moveType) ? 1.5 : 1;
    var accuracy = typeof move.accuracy === 'number' ? move.accuracy / 100 : 1;
    var power = Number(move.basePower || 0);
    var score = 0;
    var incoming = incomingThreat(opp, me, state, gen, 'opp');
    var incomingOrder = incomingActsFirst(incoming, opp, me, state, gen, 'opp');
    var activeHp = currentHp(me, state, 'me', gen);
    var moveIdValue = moveId(move);
    var delayedDamage = isDelayedDamageMove(move);

    // 状态招式的图鉴属性不等于伤害属性；例如 Stealth Rock 不能因为目标免疫
    // Rock 伤害就被当成非法选择。伤害招式才按属性免疫直接淘汰。
    if (multiplier === 0 && move.category !== 'Status' && power > 0) return -100000;
    if (move.category === 'Status' && statusMoveImmune(move, opp, state)) return -100000;
    if (move.category === 'Status' || power <= 0) {
        score = 24;
        if (toId(move.id) === 'protect' || toId(move.id) === 'detect') score = 18;
        if (['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'].indexOf(moveId(move)) !== -1) {
            var hazards = state.oppHazards || [];
            var hazardId = moveId(move);
            var hazardLayers = 0;
            for (var hi = 0; hi < hazards.length; hi++) {
                if (toId(hazards[hi]).indexOf(hazardId) !== -1) hazardLayers++;
            }
            var maxLayers = hazardId === 'spikes' ? 3 :
                (hazardId === 'toxicspikes' ? 2 : 1);
            if (hazardLayers >= maxLayers) {
                score = -75;
            } else {
                score = 42 + Math.max(0, maxLayers - hazardLayers) * 12;
            }
            if (state.oppRemaining && state.oppRemaining <= 2) score -= 18;
            // 对手已经强化多级时，继续铺场通常等于白送回合；先造成伤害或
            // 处理当前威胁。此前 Stealth Rock 分数会压过 Earthquake，
            // 导致 Mudsdale 对 +3 Scrafty 连续铺场后被击倒。
            if (countBoosts(opp) >= 2) score -= 65;
        }
        if (['toxic', 'thunderwave', 'willowisp', 'sleeppowder', 'spore', 'hypnosis', 'glare'].indexOf(moveId(move)) !== -1) {
            score = opp.status ? 5 : 58;
            if (moveId(move) === 'sleeppowder' || moveId(move) === 'spore') score += 18;
        }
        if (isRecoveryMove(move)) {
            score = me.hpPct !== null && me.hpPct < 65 ? 70 : 8;
            // A recovery move only helps if the active Pokemon survives the
            // opponent's best known or estimated attack after healing.
            var recoveryIncoming = incoming;
            var recoveryOrder = incomingOrder;
            if (moveIdValue === 'roost') {
                var roostDefender = recoveryDefender(me, move);
                recoveryIncoming = incomingThreat(opp, roostDefender, state, gen, 'opp');
                recoveryOrder = incomingActsFirst(recoveryIncoming, opp, roostDefender,
                    state, gen, 'opp');
            }
            if (recoveryIncoming && activeHp) {
                var recoveryTarget = recoveryTargetHp(move, me, state, 'me', gen);
                var postRecoveryResidual = residualDamageFor(me, state, gen);
                if (recoveryOrder === true &&
                    recoveryIncoming.max + postRecoveryResidual >= activeHp) {
                    // The opponent moves first, so the recovery never happens
                    // when the current HP is already within the incoming KO
                    // range.
                    score = -170;
                } else if (recoveryTarget &&
                    recoveryIncoming.max + postRecoveryResidual >= recoveryTarget) {
                    score = -135;
                } else if (recoveryTarget && recoveryIncoming.max >= activeHp) {
                    score += 35;
                } else if (recoveryTarget &&
                    recoveryTarget < maxHpFor(me, state, 'me', gen) * 0.7) {
                    score -= 12;
                }
            }
        }
        if (isSetupMove(move)) {
            score = me.hpPct === null || me.hpPct > 60 ? 48 : 12;
            if (countBoosts(me) >= 3) score -= 24;
        }
        if (moveId(move) === 'taunt' || moveId(move) === 'encore') score = opp.status ? 18 : 34;
        // 已知对手本回合可以直接击杀时，状态和强化通常不应覆盖生存动作。
        if (incoming && activeHp && incoming.max >= activeHp &&
            !isRecoveryMove(move) && moveIdValue !== 'protect' && moveIdValue !== 'detect') score -= 110;
        if (incoming && activeHp && incomingOrder === true &&
            incoming.max + residualDamageFor(me, state, gen) >= activeHp &&
            !isRecoveryMove(move) && moveIdValue !== 'protect' && moveIdValue !== 'detect') {
            score -= 145;
        }
        if (state.oppRemaining !== null && state.oppRemaining !== undefined &&
            Number(state.oppRemaining) <= 1 &&
            !isRecoveryMove(move) &&
            moveIdValue !== 'protect' && moveIdValue !== 'detect') {
            score -= 60;
        }
        if (statusResidualLethal(me) &&
            !isRecoveryMove(move) &&
            moveIdValue !== 'protect' && moveIdValue !== 'detect') {
            score -= 120;
        }
    } else {
        var damage = damageRange(action, me, opp, state, gen, 'me', {
            isDynamaxed: !!action.dynamax,
            teraType: action.teraType || (action.tera && typeof state.me.canTerastallize === 'string' ? state.me.canTerastallize : null)
        });
        if (damage) {
            var actsFirst = moveActsFirst(action, me, opp, state, gen, 'me');
            // 同时看绝对伤害和百分比，避免只偏好打厚血目标的招式。
            score = (damage.avg + (damage.percentMax === null ? 0 : damage.percentMax * 0.7)) *
                accuracy;
            if (damageCanKo(damage, opp, state, 'opp', gen) && !delayedDamage) {
                score += (actsFirst === false ? 70 : 180) * accuracy;
            }
            if (damageStableKo(damage, opp, state, 'opp', gen) && !delayedDamage) {
                score += (actsFirst === false ? 60 : 120) * accuracy;
            }
            if (damageCanKo(damage, opp, state, 'opp', gen) &&
                !damageStableKo(damage, opp, state, 'opp', gen) && !delayedDamage) score += 35;
            if (damage.percentMax !== null && damage.percentMax < 20) score -= 35;
            if (accuracy < 0.9) score -= (0.9 - accuracy) * 140;
            if (isRecoilMove(move) && me.hpPct !== null && me.hpPct < 45) {
                score -= 35;
                var recoilDamage = damage.avg / 3;
                if ((!damageCanKo(damage, opp, state, 'opp', gen)) &&
                    activeHp && recoilDamage >= activeHp) {
                    score -= 180;
                } else if (!damageCanKo(damage, opp, state, 'opp', gen)) {
                    score -= 70;
                }
            } else if (isRecoilMove(move) && damageCanKo(damage, opp, state, 'opp', gen) &&
                activeHp && damage.avg / 3 >= activeHp) {
                // A recoil KO is a trade, not a free win. Avoid it when the
                // opponent still has multiple remaining Pokemon and another
                // legal line can preserve the active.
                if (state.oppRemaining === null || state.oppRemaining === undefined ||
                    Number(state.oppRemaining) > 1) {
                    score -= 160;
                }
            }
            var contactChip = contactChipDamage(move, opp, state, gen);
            if (contactChip && activeHp && contactChip >= activeHp &&
                !damageCanKo(damage, opp, state, 'opp', gen)) {
                score -= 190;
            } else if (contactChip && activeHp && contactChip >= activeHp * 0.7 &&
                !damageStableKo(damage, opp, state, 'opp', gen)) {
                score -= 60;
            }
            if (delayedDamage) {
                // Future Sight/Doom Desire do not resolve this turn, while
                // two-turn attacks can still lose the active Pokemon before
                // their damage lands. Do not treat their raw overkill as an
                // immediate KO.
                score = Math.min(score,
                    (damage.avg + Math.min(100, damage.percentMax === null ? 0 : damage.percentMax) * 0.7) *
                    accuracy * (moveIdValue === 'futuresight' || moveIdValue === 'doomdesire' ? 0.55 : 0.75));
            }
            if (actsFirst === false && incoming && activeHp &&
                incoming.max >= activeHp && !damageCanKo(damage, opp, state, 'opp', gen)) {
                score -= 65;
            }
            if (incoming && activeHp &&
                (incoming.max >= activeHp || (incoming.percentMax !== null && incoming.percentMax >= 85)) &&
                !(damageCanKo(damage, opp, state, 'opp', gen) && !delayedDamage) && !isPivotMove(move)) score -= 80;
            if (statusResidualLethal(me) && !damageCanKo(damage, opp, state, 'opp', gen)) score -= 120;
            if (isPivotMove(move) && incoming && incoming.percentMax !== null &&
                incoming.percentMax >= 50) score += 24;
            if (action.tera) {
                // Tera is a limited resource. Do not select a Tera variant
                // merely because it receives the generic move bonus; require
                // a meaningful damage or KO improvement over the normal move.
                var normalAction = {};
                var actionKeys = Object.keys(action);
                for (var ak = 0; ak < actionKeys.length; ak++) normalAction[actionKeys[ak]] = action[actionKeys[ak]];
                normalAction.tera = false;
                delete normalAction.teraType;
                var normalDamage = damageRange(normalAction, me, opp, state, gen, 'me');
                var teraImprovesKo = damageCanKo(damage, opp, state, 'opp', gen) &&
                    !damageCanKo(normalDamage, opp, state, 'opp', gen);
                var teraImprovesDamage = normalDamage && damage.avg >= normalDamage.avg * 1.15;
                if (!teraImprovesKo && !teraImprovesDamage) score -= 45;
            }
        } else {
            score = power * multiplier * stab * accuracy;
        }
        if (move.priority > 0) score += 20;
        if (multiplier >= 2) score += 18;
        if (multiplier < 1) score -= 12;
        if (opp.hpPct !== null && opp.hpPct !== undefined && opp.hpPct <= 35 && score >= 90) score += 80;
    }
    if (action.dynamax) score += power > 0 ? 8 : -5;
    if (state.oppRemaining !== null && state.oppRemaining !== undefined &&
        Number(state.oppRemaining) <= 1 && isDamagingAction(action, state, gen)) {
        score += 28;
    }
    return score;
}

function scoreSwitch(action, state, gen) {
    var bench = state.bench || [];
    var candidate = null;
    for (var i = 0; i < bench.length; i++) {
        if (Number(bench[i].slot) === Number(action.slot)) {
            candidate = bench[i];
            break;
        }
    }
    if (!candidate || candidate.fainted) return -100000;
    var opp = state.opp || {};
    var oppMoves = Array.isArray(opp.moves) ? opp.moves : [];
    var score = 55 + Number(candidate.hpPct || 100) * 0.35;
    var hazardPct = entryHazardPercent(candidate, state, gen);
    var candidateHp = currentHp(candidate, state, 'me', gen);
    var candidateHpAfterEntry = candidateHp ? candidateHp * (1 - hazardPct / 100) : candidateHp;
    score -= hazardPct * 1.4;
    var incoming = incomingThreat(opp, candidate, state, gen, 'opp');
    if (incoming && incoming.percentMax !== null) {
        score += Math.max(0, 100 - incoming.percentMax) * 1.65;
        if (candidateHpAfterEntry && incoming.max >= candidateHpAfterEntry) score -= 220;
        else if (candidateHpAfterEntry && incoming.max >= candidateHpAfterEntry * 0.7) score -= 75;
        if (incoming.percentMax >= 100) score -= 90;
        else if (incoming.percentMax >= 70) score -= 42;
        else if (incoming.percentMax <= 35) score += 20;
    }
    // When the opponent has not revealed all attacks, its STAB types are
    // still reliable defensive information for a switch target.
    var opponentTypes = getTypes(opp);
    for (var ot = 0; ot < opponentTypes.length; ot++) {
        var stabMultiplier = typeMultiplier(opponentTypes[ot], getTypes(candidate), gen);
        if (stabMultiplier === 0) score += 60;
        else if (stabMultiplier < 1) score += 30;
        else if (stabMultiplier >= 4) score -= 80;
        else if (stabMultiplier >= 2) score -= 50;
        else score -= 8;
    }
    for (var m = 0; m < oppMoves.length; m++) {
        var move = getDex(gen).moves.get(toId(oppMoves[m].id || oppMoves[m].name));
        if (!move) continue;
        var multiplier = typeMultiplier(effectiveMoveType(move, opp), getTypes(candidate), gen);
        if (multiplier === 0) score += 35;
        else if (multiplier < 1) score += 18;
        else if (multiplier > 1) score -= 22;
    }
    var hazards = Array.isArray(state.myHazards) ? state.myHazards : [];
    for (var hi = 0; hi < hazards.length; hi++) {
        var hazardId = toId(hazards[hi]);
        if (hazardId.indexOf('stealthrock') !== -1) {
            var rockMultiplier = typeMultiplier('Rock', getTypes(candidate), gen);
            if (rockMultiplier > 1) score -= 28;
            else if (rockMultiplier === 0) score += 12;
        } else if (hazardId.indexOf('spikes') !== -1 &&
            !hasType(getTypes(candidate), 'Flying') &&
            String(candidate.ability || '').toLowerCase() !== 'levitate') {
            score -= 12;
        } else if (hazardId.indexOf('toxicspikes') !== -1 &&
            !hasType(getTypes(candidate), 'Poison') &&
            !hasType(getTypes(candidate), 'Steel') &&
            !hasType(getTypes(candidate), 'Flying') &&
            String(candidate.ability || '').toLowerCase() !== 'levitate') {
            score -= 10;
        }
    }
    if (state.me && state.me.hpPct !== null && state.me.hpPct < 30) score += 25;
    var outgoing = bestKnownDamage(candidate, opp, candidate.moves, state, gen, 'me');
    if (outgoing && outgoing.percentMax !== null) {
        score += outgoing.percentMax * 1.05;
        if (currentHp(opp, state, 'opp', gen) && outgoing.max >= currentHp(opp, state, 'opp', gen)) score += 60;
    }
    if (candidate.ability === 'regenerator') score += 18;
    var recentSlots = recentOwnSwitchSlots(state);
    var previousSlot = recentSlots.length >= 2 ? recentSlots[recentSlots.length - 2] : null;
    if (previousSlot !== null && Number(candidate.slot) === Number(previousSlot) &&
        state.me && !state.me.fainted) {
        var candidateHpPct = Number(candidate.hpPct || 0);
        var activeHpPct = Number(state.me.hpPct || 0);
        // Avoid immediately switching back to the previous active Pokemon when
        // neither side gained a meaningful advantage.
        if (candidateHpPct <= activeHpPct + 15) score -= 220;
        else score -= 80;
    }
    return score;
}

function switchSurvives(action, state, gen) {
    var bench = state && Array.isArray(state.bench) ? state.bench : [];
    var candidate = null;
    for (var i = 0; i < bench.length; i++) {
        if (Number(bench[i].slot) === Number(action && action.slot)) {
            candidate = bench[i];
            break;
        }
    }
    if (!candidate || candidate.fainted) return false;
    var hp = currentHp(candidate, state, 'me', gen);
    if (!hp) return false;
    var hazardPct = entryHazardPercent(candidate, state, gen);
    var hpAfterEntry = hp * (1 - hazardPct / 100);
    if (hpAfterEntry <= 0) return false;
    var incoming = incomingThreat(state.opp || {}, candidate, state, gen, 'opp');
    if (!incoming || incoming.max === null || incoming.max === undefined) return true;
    // Leave room for damage-roll rounding, residual damage and secondary
    // effects. A switch that survives only on the absolute max-HP boundary is
    // not a reliable defensive line.
    return incoming.max < hpAfterEntry * 0.9;
}

function scoreTeamLead(action, state) {
    var candidate = leadCandidate(state, action);
    if (!candidate) return 0;
    var opponents = Array.isArray(state.oppTeam) ? state.oppTeam : [];
    var moveIds = candidate.moveIds || [];
    var score = Number(candidate.hpPct || 100) * 0.1 + getTypes(candidate).length * 3;
    if (!opponents.length) return score + moveIds.length * 8;

    var total = 0;
    var covered = 0;
    for (var i = 0; i < opponents.length; i++) {
        var opponent = opponents[i];
        var best = 0;
        for (var j = 0; j < moveIds.length; j++) {
            var value = leadMoveScore(moveIds[j], candidate, opponent, state.gen || 9);
            if (value > best) best = value;
        }
        total += best;
        if (best >= 150) covered++;
    }
    score += total / opponents.length;
    score += covered * 10;
    // 开局没有对手招式信息时，用对手属性估算首发被压制的最坏情况。
    // 这能避免只看进攻覆盖而把明显怕 Fairy、Steel、Ground 等属性的成员送上场。
    var defensivePenalty = 0;
    var defensiveSamples = 0;
    var defensiveTotal = 0;
    for (var oi = 0; oi < opponents.length; oi++) {
        var opponentTypes = getTypes(opponents[oi]);
        var worstMultiplier = 1;
        for (var ot = 0; ot < opponentTypes.length; ot++) {
            var incomingMultiplier = typeMultiplier(opponentTypes[ot], getTypes(candidate), state.gen || 9);
            if (incomingMultiplier > worstMultiplier) worstMultiplier = incomingMultiplier;
            defensiveTotal += incomingMultiplier;
            defensiveSamples++;
        }
        if (worstMultiplier >= 4) defensivePenalty += 100;
        else if (worstMultiplier >= 2) defensivePenalty += 45;
        else if (worstMultiplier === 0) score += 8;
    }
    // 只处罚最坏属性会把一只脆弱的高输出成员误选成 lead；加入平均
    // incoming multiplier，让能稳定接住对手 STAB 的成员获得更合理的首发分。
    var averageIncoming = defensiveSamples ? defensiveTotal / defensiveSamples : 1;
    score -= defensivePenalty / Math.max(1, opponents.length / 2);
    score -= Math.max(0, averageIncoming - 1) * 55;
    // 首发优先考虑能制造压力，并且拥有 pivot 或布置能力的成员。
    for (var m = 0; m < moveIds.length; m++) {
        var leadMove = { id: toId(moveIds[m]) };
        if (isPivotMove(leadMove)) score += 10;
        if (['stealthrock', 'spikes'].indexOf(toId(moveIds[m])) !== -1) score += 8;
    }
    return score;
}

function chooseBest(candidates, score) {
    if (!candidates.length) return null;
    var best = candidates[0];
    var bestScore = score(best);
    for (var i = 1; i < candidates.length; i++) {
        var currentScore = score(candidates[i]);
        if (currentScore > bestScore) {
            best = candidates[i];
            bestScore = currentScore;
        }
    }
    return best;
}

function moveDamage(action, state, gen) {
    if (!action || action.type !== 'move') return null;
    var me = state && state.me;
    var opp = state && state.opp;
    if (!me || !opp) return null;
    return damageRange(action, me, opp, state, gen, 'me', {
        isDynamaxed: !!action.dynamax,
        teraType: action.teraType ||
            (action.tera && typeof me.canTerastallize === 'string' ? me.canTerastallize : null)
    });
}

function isDamagingAction(action, state, gen) {
    var move = getMove(action, state, gen);
    return !!(move && move.category !== 'Status' && Number(move.basePower || 0) > 0);
}

function observedMoveOrder(state, attacker, defender) {
    var history = state && Array.isArray(state.fullHistory) ? state.fullHistory : [];
    var lastTurn = -1;
    for (var i = history.length - 1; i >= 0; i--) {
        if (String(history[i]).indexOf('|turn|') === 0) {
            lastTurn = i;
            break;
        }
    }
    if (lastTurn < 0) lastTurn = 0;
    var attackerIndex = -1;
    var defenderIndex = -1;
    var attackerName = toId(attacker && attacker.name);
    var defenderName = toId(defender && defender.name);
    for (var j = lastTurn + 1; j < history.length; j++) {
        var line = String(history[j] || '');
        if (line.indexOf('|move|') !== 0) continue;
        var parts = line.split('|');
        var source = parts[2] || '';
        var sourceName = toId(source.replace(/^p[12][a-z]:\s*/i, ''));
        if (sourceName === attackerName || sourceName.indexOf(attackerName) === 0 ||
            attackerName.indexOf(sourceName) === 0) attackerIndex = j;
        if (sourceName === defenderName || sourceName.indexOf(defenderName) === 0 ||
            defenderName.indexOf(sourceName) === 0) defenderIndex = j;
    }
    if (attackerIndex < 0 || defenderIndex < 0 || attackerIndex === defenderIndex) return null;
    return attackerIndex < defenderIndex;
}

function moveActsFirst(action, attacker, defender, state, gen, attackerSide) {
    var move = getMove(action, state, gen);
    if (!move) return null;
    var atk = makeCalcPokemon(attacker, state, gen, attackerSide);
    var defSide = attackerSide === 'me' ? 'opp' : 'me';
    var def = makeCalcPokemon(defender, state, gen, defSide);
    if (!atk || !def || !atk.stats || !def.stats) return null;
    var priority = Number(move.priority || 0);
    var defenderPriority = 0;
    var defenderMoves = defender && Array.isArray(defender.moves) ? defender.moves : [];
    for (var i = 0; i < defenderMoves.length; i++) {
        var known = getDex(gen).moves.get(toId(defenderMoves[i].id || defenderMoves[i].name));
        if (known && Number(known.priority || 0) > defenderPriority) {
            defenderPriority = Number(known.priority || 0);
        }
    }
    if (priority !== defenderPriority) return priority > defenderPriority;
    var observed = observedMoveOrder(state, attacker, defender);
    if (observed !== null) return observed;
    return Number(atk.stats.spe || 0) >= Number(def.stats.spe || 0);
}

function foeThreatScore(state, gen) {
    var me = state && state.me;
    var opp = state && state.opp;
    if (!me || !opp || me.fainted || opp.fainted) return 0;
    var incoming = incomingThreat(opp, me, state, gen, 'opp');
    var threat = 0;
    if (incoming && incoming.percentMax !== null) {
        if (incoming.percentMax >= 100) threat += 45;
        else if (incoming.percentMax >= 80) threat += 32;
        else if (incoming.percentMax >= 60) threat += 15;
        else if (incoming.percentMax >= 45) threat += 6;
    }
    var maxHp = maxHpFor(me, state, 'me', gen);
    var hp = currentHp(me, state, 'me', gen);
    var hpRatio = maxHp ? hp / maxHp : 1;
    if (hpRatio < 0.35) threat += 15;
    else if (hpRatio < 0.5) threat += 8;
    else if (hpRatio < 0.7) threat += 3;
    if (countBoosts(opp) >= 2) threat += 15;
    else if (countBoosts(opp) === 1) threat += 8;
    return Math.min(100, threat);
}

function rulesAction(state) {
    var candidates = contract.getActionCandidates(state || {});
    if (!candidates.length) return null;
    state = state || {};
    var me = state.me || {};
    var opp = state.opp || {};
    var gen = state && state.gen;
    var teamActions = candidates.filter(function (action) { return action.type === 'team'; });
    if (teamActions.length) return chooseBest(teamActions, function (action) { return scoreTeamLead(action, state); });

    var moveActions = candidates.filter(function (action) { return action.type === 'move'; });
    var switchActions = candidates.filter(function (action) { return action.type === 'switch'; });
    var bestMove = chooseBest(moveActions, function (action) { return scoreMove(action, state, gen); });
    var bestSwitch = chooseBest(switchActions, function (action) { return scoreSwitch(action, state, gen); });
    var safeSwitchActions = switchActions.filter(function (action) {
        return switchSurvives(action, state, gen);
    });
    var bestSafeSwitch = chooseBest(safeSwitchActions, function (action) {
        return scoreSwitch(action, state, gen);
    });
    // A voluntary switch that is immediately KOed only throws away another
    // team member. Keep such switches available for forced replacement, but
    // never use them as a tactical escape when a direct move is still legal.
    if (!state.me || !state.me.fainted) bestSwitch = bestSafeSwitch;
    if (!bestMove) return bestSwitch || candidates[0];
    if (!bestSwitch) {
        // 没有可用替补且当前只剩 Protect/回复等非伤害动作时，低血量继续
        // 等待通常只会把回合交给对手。至少尝试伤害最高的合法招式，
        // 特别是 Aqua Jet、Sucker Punch 等优先级招式仍可能完成击杀。
        if (state.me && Number(state.me.hpPct) <= 25 &&
            !isDamagingAction(bestMove, state, gen)) {
            var selectedMove = getMove(bestMove, state, gen);
            if (selectedMove && isRecoveryMove(selectedMove)) {
                var recoveryIncoming = incomingThreat(opp, me, state, gen, 'opp');
                var recoveryHp = recoveryTargetHp(selectedMove, me, state, 'me', gen);
                // If recovery raises the active above the next expected hit,
                // preserving the active is better than making a low-value
                // damage attempt and losing the Pokemon immediately.
                if (recoveryIncoming && recoveryHp &&
                    recoveryIncoming.max < recoveryHp) {
                    return bestMove;
                }
            }
            var desperateMoves = moveActions.filter(function (action) {
                return isDamagingAction(action, state, gen);
            });
            var bestDesperateMove = chooseBest(desperateMoves, function (action) {
                return scoreMove(action, state, gen);
            });
            if (bestDesperateMove) return bestDesperateMove;
        }
        return bestMove;
    }

    var activeHpPct = me && me.hpPct !== null && me.hpPct !== undefined ?
        Number(me.hpPct) : null;
    var activeHp = currentHp(me, state, 'me', gen);
    var activeIncoming = incomingThreat(opp, me, state, gen, 'opp');
    // 强化后的对手面前，Protect/铺场等非伤害动作容易形成“每回合
    // 保护但永远不反击”的循环。若有可用伤害招式且没有安全替补，
    // 优先用伤害招式争取击杀或压低对手血量。
    if (!isDamagingAction(bestMove, state, gen) && countBoosts(opp) >= 2 &&
        (activeHpPct !== null && activeHpPct < 40 ||
            (activeIncoming && activeIncoming.max >= currentHp(me, state, 'me', gen)))) {
        var damagingMoves = moveActions.filter(function (action) {
            return isDamagingAction(action, state, gen);
        });
        var bestDamagingMove = chooseBest(damagingMoves, function (action) {
            return scoreMove(action, state, gen);
        });
        if (bestDamagingMove && scoreMove(bestDamagingMove, state, gen) > -120) {
            bestMove = bestDamagingMove;
        }
    }
    var activeWillBeKo = activeIncoming && currentHp(me, state, 'me', gen) > 0 &&
        activeIncoming.max >= currentHp(me, state, 'me', gen);
    var switchScore = scoreSwitch(bestSwitch, state, gen);
    var moveScore = scoreMove(bestMove, state, gen);
    var bestDamage = moveDamage(bestMove, state, gen);
    var moveOrder = moveActsFirst(bestMove, me, opp, state, gen, 'me');
    var canKo = !!(damageCanKo(bestDamage, opp, state, 'opp', gen) &&
        moveOrder !== false);
    var stableKo = !!(damageStableKo(bestDamage, opp, state, 'opp', gen) &&
        moveOrder !== false);
    var immediateThreat = activeIncoming && activeIncoming.percentMax !== null &&
        activeIncoming.percentMax >= 85;
    var threatScore = foeThreatScore(state, gen);
    var activeResidual = residualDamageFor(me, state, gen);
    var incomingLethal = activeIncoming && activeHp &&
        (activeIncoming.max + activeResidual >= activeHp ||
            (activeIncoming.percentMax !== null && activeHpPct !== null &&
                activeIncoming.percentMax >= activeHpPct));
    var emergencySwitch = activeHpPct !== null && activeHpPct <= 45 &&
        switchScore >= 45 && switchScore > moveScore - 25 &&
        !(damageCanKo(bestDamage, opp, state, 'opp', gen) && moveOrder !== false);
    var strongEmergencySwitch = activeHpPct !== null && activeHpPct <= 45 &&
        switchScore >= 120 &&
        !(damageCanKo(bestDamage, opp, state, 'opp', gen) && moveOrder !== false);
    var lethalThreatSwitch = incomingLethal && !canKo &&
        switchScore >= 25 && switchScore > -50;
    var residualSwitch = statusResidualLethal(me) && !canKo &&
        switchScore >= 45;
    // 先处理能直接结束当前对局分支的动作。之前只看 incoming 的必杀判断，
    // 会在对手残血时放弃必杀，或者在所有替补都不安全时反复换人。
    if (stableKo || (canKo && switchScore < 140)) return bestMove;
    // A low-HP active should not spend its last turn on a non-KO attack when
    // a bench member has a materially better chance to take the hit.
    if (emergencySwitch) return bestSwitch;
    if (strongEmergencySwitch) return bestSwitch;
    if (lethalThreatSwitch) return bestSwitch;
    if (residualSwitch) return bestSwitch;
    // 对手已经完成多级强化时，不能因为当前攻击分数略高就继续留场。
    // 只要当前招式不能击杀，且替补分数接近，就优先保存交换次数。
    if (countBoosts(opp) >= 2 && switchScore >= 100 &&
        switchScore > moveScore - 40 &&
        !damageCanKo(bestDamage, opp, state, 'opp', gen)) {
        return bestSwitch;
    }
    // 已知或属性估算的高威胁招式下，仅当替补本身有合理的接战价值，
    // 且当前招式不能造成足够压力时才换人。低分替补通常只是把损失延后一回合。
    if (activeWillBeKo && switchScore >= 100) return bestSwitch;
    if (threatScore >= 75 && switchScore > -50 &&
        !damageCanKo(bestDamage, opp, state, 'opp', gen)) {
        return bestSwitch;
    }
    if (threatScore >= 55 && activeHpPct !== null && activeHpPct < 50 &&
        switchScore > moveScore - 30 &&
        !damageCanKo(bestDamage, opp, state, 'opp', gen)) {
        return bestSwitch;
    }
    if (immediateThreat && moveScore < 220 &&
        switchScore >= 100 && switchScore > moveScore + 55) return bestSwitch;
    if (countBoosts(opp) >= 2 && moveOrder === false &&
        switchScore >= 100 && (!bestDamage ||
            !damageCanKo(bestDamage, opp, state, 'opp', gen) ||
            (opp.hpPct !== null && opp.hpPct <= 35))) {
        return bestSwitch;
    }
    if (activeHpPct !== null && activeHpPct < 60 &&
        switchScore >= 100 && switchScore > moveScore + 35) return bestSwitch;
    if (activeIncoming && activeHp && activeIncoming.percentMax !== null &&
        activeIncoming.percentMax >= 70 && switchScore >= 100 &&
        switchScore > moveScore + 55) return bestSwitch;
    // 没有立即必杀威胁时，也要允许从“打不动且替补明显更好”的位置主动转场。
    // 只在当前生命值充足、当前攻击低于约四分之一目标满血、替补分数较高时触发，
    // 避免恢复到此前那种每回合无条件换人的行为。
    var lowPressure = !bestDamage || bestDamage.percentMax === null || bestDamage.percentMax < 25;
    var lockedIntoStrongMove = me.item === 'choiceband' || me.item === 'choicespecs' ||
        me.item === 'choicescarf';
    var opponentSetupKnown = countBoosts(opp) > 0 || (Array.isArray(opp.moves) &&
        opp.moves.some(function (knownMove) { return isSetupMove(knownMove); }));
    if (activeHpPct !== null && activeHpPct >= 60 && lowPressure && !lockedIntoStrongMove &&
        opponentSetupKnown &&
        switchScore >= 180 && switchScore > moveScore + 90 &&
        (!opp.hpPct || opp.hpPct > 35)) return bestSwitch;
    // If the current attack is only moderate and a clearly better answer is
    // available, switch even when the opponent has not revealed a setup move.
    // This covers previewed threats such as an unknown super-effective STAB.
    if (activeHpPct !== null && activeHpPct >= 60 && !lockedIntoStrongMove &&
        bestDamage && bestDamage.percentMax !== null &&
        bestDamage.percentMax < 60 && switchScore >= 180 &&
        switchScore > moveScore + 80 &&
        (!activeIncoming || activeIncoming.percentMax === null ||
            activeIncoming.percentMax >= 25) &&
        (!opp.hpPct || opp.hpPct > 35)) return bestSwitch;
    if (!bestDamage && switchScore >= 80 && switchScore > moveScore + 40) {
        return bestSwitch;
    }
    return bestMove;
}

module.exports = {
    rulesAction: rulesAction,
    typeMultiplier: typeMultiplier,
    scoreMove: scoreMove,
    scoreSwitch: scoreSwitch,
    scoreTeamLead: scoreTeamLead,
    foeThreatScore: foeThreatScore,
    damageRange: damageRange,
    currentHp: currentHp
};
