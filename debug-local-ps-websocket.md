# Debug Session: local-ps-websocket

Status: [OPEN]

## Symptom

The local Pokémon Showdown page at `http://127.0.0.1:8000/` loads, but the browser reports `Couldn't connect to server!`.

## Hypotheses

1. The local page uses an official-server WebSocket endpoint.
2. The local WebSocket path/protocol is incompatible with the loaded client.
3. The local server process is listening on HTTP but its WebSocket worker is unhealthy.
4. Browser cache is loading stale official client assets/configuration.

## Evidence

- HTTP port 8000 was listening.
- `http://127.0.0.1:8000/` returned HTTP 200.
- `http://127.0.0.1:8000/showdown/` returned HTTP 200.
- The battle URL returned HTTP 200.

## Findings

- The local WebSocket handshake to `ws://127.0.0.1:8000/showdown/websocket` succeeded and returned `Guest` plus `challstr`.
- The HTTP homepage contains a redirect script that maps non-`localhost` hosts to a `*.psim.us` host.
- `http://localhost:8000/` returns the local page without redirecting.
- Therefore the failure is caused by opening the local server as `127.0.0.1`, which redirects the browser away from the local server.

## Verification

User confirmed that `http://localhost:8000/` opens the local lobby successfully. The remaining check is opening the battle room from that lobby.

