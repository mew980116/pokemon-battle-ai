# PS benchmark

This directory runs the local decision client against the remote PS server and
the remote Foul Play accounts.

Default mapping:

- Gen 9 formats -> `foulplaybot`
- Gen 8 formats -> `foulplaybot-g8`

The runner uses no-password login and connects to:

```text
ws://218.244.153.64:8000/showdown/websocket
```

For non-rating tests, `/timer off` is sent when the battle starts. Use
`--keep-timer` when testing timer behavior.

The runner waits 10 seconds between completed battles by default, allowing the
Foul Play account time to recover after going offline. The runner uses a
separate 45-second login/challenge timeout and a 180-second in-battle timeout.
A setup timeout means that no battle room was created; it is not counted as a
win or loss. Setup diagnostics preserve the
global protocol payloads and command milestones (`challstr`, login, challenge
sent, and connection errors) in `setupSignals` and `connectionEvents`, which
helps distinguish login failure from a challenge that was not accepted.

Use `--completed-games N` when the benchmark must collect N completed battles
instead of merely making N attempts. Setup failures remain in `matches.jsonl`
but do not count toward the completed-game target. `--max-attempts` provides a
safety cap and defaults to three times the target (with at least ten extra
attempts).

By default, the runner allows one additional challenge only when the setup
window ends without any challenge response. Before retrying, it sends
`/cancelchallenge <opponent>` and waits for the configured retry delay, so a
delayed first challenge is not turned into a duplicate challenge. It does not
retry explicit server rejections such as `The user ... was not found`, and it
does not retry after a challenge response or battle search result has been
observed.

The `rules` provider is a deterministic, low-latency baseline implemented in
the decision service. It uses move metadata, type matchups, HP, known opponent
moves and basic switch scoring; it is intentionally not a replacement for
Foul Play's full search engine.

The `foul-play` provider sends decisions through the local Foul Play reference
sidecar and is useful as an actual-action control. It is separate from the
untouched upstream websocket bot in `D:\Other\ai\foul-play`.

## Untouched upstream Foul Play calibration

The untouched upstream bot cannot be represented faithfully as the existing
HTTP `state -> choice` provider. It owns the PS WebSocket, the original Battle
state machine, the original protocol handlers, and the original Random Battle
sampling/search path.

Run it through the integration wrapper:

```powershell
pwsh -File platform\ps\run-upstream.ps1 -RunCount 1
pwsh -File platform\ps\run-upstream.ps1 -RunCount 3
```

The wrapper does not modify `D:\Other\ai\foul-play`. It also starts a local
mirror that feeds the same raw battle frames into the adapter and calls 8093
before recording the upstream action. The upstream action is the only action
sent to PS.

The wrapper uses port 8095 only as an optional health/control label while it
is running. It is not a translated `/choice` service. Do not use the old
`--decision-url http://127.0.0.1:8095/choice` command for upstream
calibration.

## Smoke tests

```powershell
node platform\ps\benchmark\run-series.js --provider random --format gen9randombattle --games 3
node platform\ps\benchmark\run-series.js --provider random --format gen8battlefactory --games 3
node platform\ps\benchmark\run-series.js --provider rules --format gen9randombattle --completed-games 50 --max-attempts 150
node platform\ps\benchmark\summarize.js platform\ps\benchmark\results
```

## LLM tests

Start the decision service first, then run:

```powershell
node platform\ps\benchmark\run-series.js --provider llm --format gen9randombattle --games 3 --decision-url http://127.0.0.1:8092/choice
node platform\ps\benchmark\run-series.js --provider foul-play --format gen9randombattle --games 1 --decision-url http://127.0.0.1:8095/choice
```

Results are appended to `matches.jsonl`. Each completed row also contains
`technicalStats`, calculated from the ordered battle protocol. The per-side
statistics include:

## DualView Static Action-Pair v0.2 tests

The frozen observation candidate runs Foul Play in both perspectives, samples
hidden Random Battle configurations, applies independent self/opponent search
budgets, mixes a small amount of opponent-policy exploration, and applies a
static root action-pair evaluator. It is intentionally separate from the 8093
shadow reference service.

Start the DualView service:

```powershell
Set-Location D:\Other\ai\foul-play-lab
& .\.venv\Scripts\python.exe .\tools\dual_view_server.py --port 8094 --particles 1 --self-search-time-ms 5 --opponent-search-time-ms 5 --opponent-exploration 0.1 --seed 17 --strength 1.0
```

Run one private-server observation battle:

```powershell
Set-Location D:\Other\ai\pokemon-battle-ai
node platform\ps\benchmark\run-series.js --provider dual-view --format gen9randombattle --completed-games 1 --max-attempts 3 --decision-url http://127.0.0.1:8094/choice --observer-url http://127.0.0.1:8093/reference --announce diff-only --observer-log D:\Other\ai\pokemon-battle-experiments\dual-view-v0\live-dual-view-YYYYMMDD\decisions.jsonl --output D:\Other\ai\pokemon-battle-experiments\dual-view-v0\live-dual-view-YYYYMMDD
```

 The 8094 action is the action actually sent to PS. The 8093 result is a
 pre-commit Foul Play shadow decision: it receives the same immutable state
 before the 8094 action is sent, projects its raw result onto the current PS
 legal action set, and never sends that action. This result is used for
 comparison in the room and JSONL log. This phase
does not claim a win-rate improvement; first inspect legality, latency,
reference coverage, particle diagnostics, action-pair diagnostics, and whether
the reweighting changes the Foul Play prior in the expected direction. The
action-pair evaluator is static and does not perform dynamic belief updates
inside hypothetical rollouts.

Opponent prediction outcomes are appended to the observer JSONL after the next
request exposes the opponent action. Each outcome records the predicted top 3,
the actual action, the probability assigned to that action, top-1/top-3
correctness, and cumulative accuracy. Summarize them with:

```powershell
node platform\ps\benchmark\summarize-opponent-predictions.js D:\Other\ai\pokemon-battle-experiments\dual-view-v0\live-dual-view-YYYYMMDD\decisions.jsonl
```

- `finalAlive`: remaining team members based on `teamsize` and `faint`;
- `switches`: non-initial switches; `allSwitches` includes the initial send-out;
- `boostEvents` and `unboostEvents`;
- `moveCount` and `attackMoveCount` (physical/special moves only);
- `teraUses`, `firstTeraTurn` and `teraTurns`;
- `faints` and `residualFaints`;
- `firstStrikeKOs`: the opponent had not used a move in that turn before being
  knocked out;
- `switchInKOs`: a non-initial switch-in was knocked out later in that turn.

`technicalStats.sides.self` and `technicalStats.sides.opponent` are mapped from
the `player` protocol events rather than assuming the bot is always p1.
`teraUses` counts observed `|-terastallize|` events. `firstTeraTurn` is `null`
when that side did not terastallize in the battle, and timing quantiles in the
aggregate summary exclude those `null` values. `teraTurns` retains the full
observed turn list for per-battle review.
Setup timeouts, battle timeouts and errors are retained in `matches.jsonl`, but
are excluded from completed-game technical averages.

`summarize.js` supports old rows without `technicalStats` by recalculating from
their stored protocol. It reports average, p25, median, p75, min and max for
each metric, plus self/opponent differences and provider/format/result groups:

```powershell
node platform\ps\benchmark\summarize.js platform\ps\benchmark\results-final-rules-gen8-state-sync-v26
node platform\ps\benchmark\summarize.js platform\ps\benchmark
```

The second command recursively combines multiple benchmark result directories,
which is useful for large-sample comparisons. Use only compatible benchmark
sets when comparing providers or formats.

For completed games, `technicalStats.normalized.self` and
`technicalStats.normalized.opponent` contain per-turn rates. Final surviving
count is intentionally not normalized; event counts such as switches, boosts,
attacks and KOs are divided by that game's completed turn count. The
`survivalLeadByTurn` array records the actual time series for every turn.
`survivalLeadTimeline` additionally reports the average-ready checkpoints at
0%, 25%, 50%, 75% and 100% of the game, including self alive count, opponent
alive count and self-minus-opponent lead. In the aggregate summary these are
available under `technicalStats.<side>.perTurn` and
`technicalStats.survivalLeadTimeline`.

Offline metric tests:

```powershell
node platform\ps\benchmark\test-battle-stats.js
```

## Live Foul Play shadow observer

The live observer leaves the configured provider as the only actor that sends
choices. It calls a local Foul Play reference sidecar before the configured
choice is sent, using the same immutable state snapshot. The reference action
is projected onto the current PS legal action set and is never sent to PS.
The observer writes a separate JSONL comparison log and can post a short
difference-only message to the battle room.

Start the sidecar first:

```powershell
$python = 'D:\Other\ai\foul-play-lab\.venv\Scripts\python.exe'
& $python D:\Other\ai\foul-play-lab\tools\live_reference_server.py `
  --host 127.0.0.1 `
  --port 8093 `
  --particles 1 `
  --search-time-ms 50
```

Run one Gen 9 Random Battle on the private test server:

```powershell
$out = 'D:\Other\ai\pokemon-battle-experiments\dual-view-v0\live-shadow'
node platform\ps\benchmark\run-series.js `
  --provider llm `
  --format gen9randombattle `
  --opponent foulplaybot `
  --games 1 `
  --observer-url http://127.0.0.1:8093/reference `
  --announce diff-only `
  --observer-log "$out\decisions.jsonl" `
  --output $out
```

The room message is intentionally short, for example:

```text
[OBS T6] NM=woodhammer FP=moonblast DIFF
```

The comparison log contains the full sanitized battle state and the Foul Play
action distribution. The observer is shadow-only: a reference timeout or
failure never replaces the new model action.

## Root reweighting ablation

The first infrastructure comparison uses the current DualView service with
`--strength 1.0`. To disable only root reweighting while keeping the same
belief, oracle, and protocol path, start a second service with
`--strength 0.0` on another port:

```powershell
Set-Location D:\Other\ai\foul-play-lab
& .\.venv\Scripts\python.exe .\tools\dual_view_server.py `
  --port 8096 `
  --particles 1 `
  --self-search-time-ms 50 `
  --opponent-search-time-ms 50 `
  --opponent-exploration 0.1 `
  --seed 17 `
  --strength 0.0
```

Do not combine the pre-fix `ablation-strength-0-20261004` directory with the
post-fix comparison. The valid post-fix batch is
`ablation-strength-0-postfix-20261004`; it had 20 completed games, zero
fallbacks, zero invalid actions, and zero reference errors.

## Local Foul Play control

The `foul-play` provider uses the local Foul Play reference sidecar, not the
remote `foulplaybot` account itself:

```powershell
node platform\ps\benchmark\run-series.js `
  --provider foul-play `
  --format gen9randombattle `
  --opponent foulplaybot `
  --completed-games 20 `
  --max-attempts 30 `
  --decision-url http://127.0.0.1:8095/choice `
  --output D:\Other\ai\pokemon-battle-experiments\dual-view-v0\baseline-foul-play-20-YYYYMMDD
```

This control must be calibrated before interpreting its win rate as the
expected 50% baseline for the remote account. It uses the local state adapter,
the current reference search budget, and sampled opponent configurations.
