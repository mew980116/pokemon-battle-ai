# Debug Session: ps-8092-exit

Status: [OPEN]

## Symptom

The PS decision service on port 8092 is healthy before a battle, but exits or becomes unreachable when a real `/choice` request arrives. PS then reports `ECONNREFUSED` and uses fallback actions.

## Hypotheses

1. An uncaught exception occurs in `server.js` while handling a real `/choice` request.
2. The Mify response is empty, malformed, or an HTTP/API error that is not contained by the request path.
3. A tool-loop or simulator error escapes the decision handler and terminates the Node process.
4. The service is being terminated externally by its launch/parent process rather than crashing internally.

## Evidence plan

- Run the service in the foreground with stdout/stderr captured.
- Check process and port state before and after a controlled request.
- Inspect existing tool and PS logs for the matching battle/request.
- Do not change business logic before runtime evidence identifies the cause.

## Findings

- `battle-gen8randombattle-12` shows `decision_error` at 2026-09-28T10:03:28.798Z with `connect ECONNREFUSED 127.0.0.1:8092`; the following decisions are explicitly `fallback:true`.
- The PS request state itself contains valid Gen8 request data, including Kingler's direct stats and legal move list.
- No `crash.log` exists under the project or `po-pokellmon-tool` directories.
- A foreground launch of `server.js` starts successfully with Mify/MiMo configuration and remains alive with port 8092 listening. Captured stderr is empty.
- The current evidence does not prove an uncaught exception or Mify/tool-loop crash. It proves only that the service was unavailable when the battle client sent its request. The earlier service disappearance may have been caused by process lifecycle/launch management or an external stop; this needs a controlled request while the foreground process remains attached.
- The debug server is running at `http://127.0.0.1:7777`, but no application instrumentation has been added yet.
- A controlled `/choice` request was run while `server.js` was started in the same PowerShell operation. The request reached the Mify/tool loop and produced tool results; the captured server output shows 4 tool rounds and a final `fallbackReason=budget_exhausted` after a `deepseek hard timeout` with the turn deadline clamped.
- The captured stderr contained only Node's `url.parse()` deprecation warning; no uncaught exception or rejection.
- The controlled process reached `respond()` and was then explicitly stopped by the test harness. This run did not reproduce a spontaneous process crash.
- The synthetic state omitted `myStats`, so `get_my_stats` returned `no myStats in state`; this is a test-fixture issue, not evidence of a server crash.
- Lifecycle reproduction: `server.js` was started with `Start-Process` in one terminal command and reported PID 36548 plus a healthy `/health`. In the next terminal command, before `selfplay.ps1` could start, port 8092 was already gone and the command aborted with `8092 disappeared before battle start`. The captured server stdout contains only startup lines; stderr contains only the deprecation warning. No battle client was started in this reproduction.
- This strongly confirms the failure is related to how the background Node process is launched/retained by the terminal execution environment, not an application crash during a PS request. A persistent foreground terminal/session is required for the next battle test.
