# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pokemon Battle AI for **Pokemon-Online (PO)**, a Qt-based Pokemon battle simulator. The AI performs automated battle analysis and decision-making: type matchup calculation, opponent stat inference, damage calculation, and switch/move selection via 28 callback hooks.

## Runtime Environment

**This is NOT a Node.js application.** The core AI runs inside PO's Qt ScriptEngine (QScript). The `src/` directory is an early-stage Node.js refactoring effort with only stubs — the actual logic lives in the monolith.

## How to Run

1. Copy the contents of `20201227.js` into PO's battle script window
2. Place `movedata.json` in PO's root directory
3. The Qt ScriptEngine executes the callbacks when battles start

`npm start` only runs the skeletal `src/index.js` stub — not the actual AI.

## Code Conventions (Qt ScriptEngine Constraint)

All code in `20201227.js` must be **pre-ES6 JavaScript** compatible with Qt's QScript engine:

- Use `var` only — no `let`/`const`
- No arrow functions — use `function` declarations
- No template literals — use string concatenation
- Use `indexOf()` not `startsWith()`/`includes()`
- Use `print()` not `console.log()`
- No `forEach` — use `for` loops

## Architecture

### Monolith: `20201227.js` (3,708 lines, UTF-16 LE)

Single file containing the entire AI, structured as:

1. **Utility functions** — `typechart()` (18x19 type effectiveness matrix), `calcBaseStats()`, `statsCalcFromBase()`, `calcStatWhenBoost()`, `recordBug()`, etc.
2. **Core battle logic** — Type matchup, stat estimation (EV/IV/nature inference), speed analysis, damage calculation, switch evaluation, move selection
3. **Callback object** (lines ~3397-end) — 28 PO battle event hooks. AI decisions happen primarily in `onOfferChoice` and `onChoiceSelection`

### PO Runtime Globals

The AI depends on objects provided by PO's Qt ScriptEngine (not available in Node.js):

- **`sys`** — Pokemon data lookups, file I/O, timers, networking (90+ methods; documented in `docs/reference/sys-object.md`)
- **`battle`** — Battle control and data access (`data.field`, `data.team`, `data.avatar`; documented in `docs/reference/battle-object.md`)
- **`client`** — PO client window control
- **`Qt`** — Qt utility methods
- **`script`** — Holds all callback functions

### Key Global Variables

- `useAI` — toggle AI on/off
- `battleEnd` — flag to stop processing after battle ends
- `canCloseWindow` — flag for auto-closing battle window

### Planned Modular Architecture (not yet implemented)

Described in `docs/architecture/modular-ai-architecture.md` — a 5-module design:

| Module | Responsibility |
|--------|---------------|
| Game Rules | Simulate battle mechanics (type chart, damage formula, status effects) |
| Information Gathering | Extract public info from `battle.data` and callbacks |
| Information Inference | Deduce hidden opponent info (moveset, EVs, item, ability) |
| Reasoning/Calculation | Compute damage distributions, hit/crit probabilities |
| Decision | Evaluate actions, select optimal play |

Data flow: Info Gathering → Info Inference → Reasoning → Decision, with Game Rules as foundation. The `src/` directory contains stubs for this refactoring.

## Key Files

- `20201227.js` — The monolith containing all battle AI logic
- `movedata.json` — Full move database (JSON array with num, power, accuracy, category, priority, effect, flags)
- `test_callbacks.js` — Test harness that stubs all 28 callbacks with logging; includes `/eval` command for in-battle debugging
- `docs/api/` — API references for `sys`, `battle`, callbacks, and battle rules
- `docs/reference/` — Detailed introspection of PO runtime objects
- `TODO.md` — Development roadmap
