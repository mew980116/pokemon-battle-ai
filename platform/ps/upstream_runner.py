"""Run the untouched upstream Foul Play bot with a local comparison mirror."""

from __future__ import annotations

import argparse
import asyncio
from copy import deepcopy
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BASELINE_ROOT = Path(os.environ.get("FOUL_PLAY_BASELINE", r"D:\Other\ai\foul-play"))
MIRROR_SCRIPT = Path(__file__).with_name("upstream-protocol-mirror.js")

if str(BASELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(BASELINE_ROOT))

from config import BotModes, FoulPlayConfig, init_logging  # noqa: E402
from data import all_move_json, pokedex  # noqa: E402
from data.mods.apply_mods import apply_mods  # noqa: E402
from fp.run_battle import pokemon_battle  # noqa: E402
import fp.run_battle as upstream_run_battle  # noqa: E402
from fp.websocket_client import PSWebsocketClient  # noqa: E402
from teams import TeamListIterator, load_team  # noqa: E402


def parse_wrapper_args(argv: list[str]) -> tuple[argparse.Namespace, list[str]]:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "--reference-url",
        default="http://127.0.0.1:8093/reference",
    )
    parser.add_argument(
        "--comparison-log",
        default=str(
            ROOT.parent.parent
            / "pokemon-battle-experiments"
            / "dual-view-v0"
            / "upstream-calibration"
            / "upstream-comparison.jsonl"
        ),
    )
    parser.add_argument("--control-host", default="127.0.0.1")
    parser.add_argument("--control-port", type=int, default=8095)
    parser.add_argument("--no-control", action="store_true")
    parser.add_argument("--result-dir", default="")
    parser.add_argument("--settle-ms", type=int, default=10000)
    parser.add_argument("--mirror-quiet", action="store_true")
    parser.add_argument("--setup-timeout-ms", type=int, default=45000)
    parser.add_argument("--battle-timeout-ms", type=int, default=180000)
    return parser.parse_known_args(argv)


class Mirror:
    def __init__(
        self,
        reference_url: str,
        comparison_log: str,
        username: str,
        quiet: bool = False,
    ) -> None:
        self.process = subprocess.Popen(
            [
                "node",
                str(MIRROR_SCRIPT),
                "--reference-url",
                reference_url,
                "--log-file",
                comparison_log,
            ] + (["--quiet"] if quiet else []),
            cwd=str(ROOT),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env={**os.environ, "PS_USERNAME": username},
        )
        self._reader = threading.Thread(target=self._read_output, daemon=True)
        self._reader.start()

    def _read_output(self) -> None:
        if self.process.stdout is None:
            return
        for line in self.process.stdout:
            print("[mirror] " + line.rstrip(), flush=True)

    def send(self, payload: dict[str, Any]) -> None:
        if self.process.stdin is None or self.process.poll() is not None:
            return
        try:
            self.process.stdin.write(json.dumps(payload, ensure_ascii=True) + "\n")
            self.process.stdin.flush()
        except (BrokenPipeError, OSError):
            # mirror 只负责 shadow 对照，不能因为 mirror 异常中断 upstream 实战。
            return

    def protocol(self, raw: str) -> None:
        self.send({"kind": "protocol", "raw": raw})

    def actual(self, room: str, rqid: int | None, command: str) -> None:
        self.send(
            {
                "kind": "actual",
                "room": room,
                "rqid": rqid,
                "command": command,
            }
        )

    def baseline(
        self,
        room: str,
        rqid: int | None,
        state: dict[str, Any],
    ) -> None:
        self.send(
            {
                "kind": "baseline",
                "room": room,
                "rqid": rqid,
                "baseline": state,
            }
        )

    def close(self) -> None:
        if self.process.stdin is not None:
            try:
                self.process.stdin.close()
            except OSError:
                pass
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()


def request_info(raw: str) -> tuple[str | None, int | None]:
    lines = raw.splitlines()
    room = None
    if lines and lines[0].startswith(">battle-"):
        room = lines[0][1:].strip()
    for line in lines:
        if not line.startswith("|request|"):
            continue
        try:
            request = json.loads(line[len("|request|") :])
        except json.JSONDecodeError:
            return room, None
        rqid = request.get("rqid")
        return room, int(rqid) if rqid is not None else None
    return room, None


def choice_command(message_list: list[str]) -> str | None:
    for item in message_list:
        text = str(item)
        if text.startswith("/choose ") or text.startswith("/switch ") or text.startswith("/team "):
            return text
    return None


class InstrumentedPSWebsocketClient(PSWebsocketClient):
    mirror: Mirror | None = None
    last_request: dict[str, tuple[int | None, str]] = {}
    request_times: dict[tuple[str, int | None], float] = {}
    raw_protocol_file: Any = None
    current_battle_room: str | None = None

    @classmethod
    async def create(
        cls,
        username: str,
        password: str | None,
        address: str,
    ) -> "InstrumentedPSWebsocketClient":
        self = cls()
        self.username = username
        self.password = password
        self.address = address
        self.websocket = await __import__("websockets").connect(self.address)
        self.login_uri = ""
        return self

    async def receive_message(self) -> str:
        message = await super().receive_message()
        first_line = message.splitlines()[0] if message.splitlines() else ""
        if first_line.startswith(">battle-"):
            self.current_battle_room = first_line[1:].strip()
        if self.current_battle_room and "|deinit|" in message:
            self.current_battle_room = None
        if self.raw_protocol_file is not None:
            safe_message = re.sub(r"\|challstr\|[^\r\n]*", "|challstr|[redacted]", message)
            self.raw_protocol_file.write(
                json.dumps(
                    {"timestamp": time.time(), "raw": safe_message},
                    ensure_ascii=True,
                )
                + "\n"
            )
            self.raw_protocol_file.flush()
        if self.mirror is not None:
            self.mirror.protocol(message)
        room, rqid = request_info(message)
        if room is not None and rqid is not None:
            self.last_request[room] = (rqid, message)
            self.request_times[(room, rqid)] = time.perf_counter()
        return message

    async def login(self) -> str:
        await self.get_id_and_challstr()
        await self.send_message("", ["/trn " + self.username + ",0,"])
        await asyncio.sleep(1)
        return self.username

    async def send_message(self, room: str, message_list: list[str]) -> None:
        await super().send_message(room, message_list)
        command = choice_command(message_list)
        if command is None or self.mirror is None or not room.startswith("battle-"):
            return
        rqid = None
        if message_list and str(message_list[-1]).isdigit():
            rqid = int(message_list[-1])
        if rqid is None and room in self.last_request:
            rqid = self.last_request[room][0]
        self.mirror.actual(room, rqid, command)

    async def forfeit_active_battle(self) -> None:
        if not self.current_battle_room:
            return
        room = self.current_battle_room
        try:
            try:
                await self.send_message(room, ["/forfeit"])
            except Exception:
                pass
            await asyncio.sleep(1)
        finally:
            self.current_battle_room = None


def check_dictionaries_are_unmodified(original_pokedex: Any, original_move_json: Any) -> None:
    if original_move_json != all_move_json:
        raise RuntimeError("upstream Foul Play modified move data")
    if original_pokedex != pokedex:
        raise RuntimeError("upstream Foul Play modified pokedex data")


def pokemon_summary(pokemon: Any) -> dict[str, Any] | None:
    if pokemon is None:
        return None
    moves = []
    for move in getattr(pokemon, "moves", []) or []:
        moves.append(
            {
                "name": getattr(move, "name", None),
                "pp": getattr(move, "pp", None),
                "maxPp": getattr(move, "max_pp", None),
                "disabled": bool(getattr(move, "disabled", False)),
            }
        )
    return {
        "name": getattr(pokemon, "name", None),
        "hp": getattr(pokemon, "hp", None),
        "maxHp": getattr(pokemon, "max_hp", None),
        "status": getattr(pokemon, "status", None),
        "boosts": {
            str(key): int(value)
            for key, value in dict(getattr(pokemon, "boosts", {}) or {}).items()
        },
        "moves": moves,
        "item": getattr(pokemon, "item", None),
        "ability": getattr(pokemon, "ability", None),
        "teraType": getattr(pokemon, "tera_type", None),
        "terastallized": bool(getattr(pokemon, "terastallized", False)),
        "fainted": bool(getattr(pokemon, "fainted", False)),
    }


def battler_summary(battler: Any) -> dict[str, Any]:
    return {
        "name": getattr(battler, "name", None),
        "active": pokemon_summary(getattr(battler, "active", None)),
        "reserve": [
            item
            for item in (
                pokemon_summary(pokemon)
                for pokemon in (getattr(battler, "reserve", []) or [])
            )
            if item is not None
        ],
        "sideConditions": {
            str(key): int(value)
            for key, value in dict(getattr(battler, "side_conditions", {}) or {}).items()
            if value
        },
    }


def battle_summary(battle: Any, decision: list[str]) -> dict[str, Any]:
    return {
        "battleId": getattr(battle, "battle_tag", None),
        "turn": int(getattr(battle, "turn", 0) or 0),
        "rqid": getattr(battle, "rqid", None),
        "userSide": getattr(battle.user, "name", None),
        "opponentSide": getattr(battle.opponent, "name", None),
        "weather": getattr(battle, "weather", None),
        "weatherTurnsRemaining": getattr(battle, "weather_turns_remaining", None),
        "weatherSource": getattr(battle, "weather_source", None),
        "field": getattr(battle, "field", None),
        "fieldTurnsRemaining": getattr(battle, "field_turns_remaining", None),
        "trickRoom": bool(getattr(battle, "trick_room", False)),
        "trickRoomTurnsRemaining": getattr(
            battle, "trick_room_turns_remaining", None
        ),
        "gravity": bool(getattr(battle, "gravity", False)),
        "user": battler_summary(battle.user),
        "opponent": battler_summary(battle.opponent),
        "decision": decision[0] if decision else None,
    }


async def run(args: argparse.Namespace) -> None:
    FoulPlayConfig.configure()
    init_logging(FoulPlayConfig.log_level, FoulPlayConfig.log_to_file)
    apply_mods(FoulPlayConfig.pokemon_format)

    original_pokedex = json.loads(json.dumps(pokedex))
    original_move_json = json.loads(json.dumps(all_move_json))
    mirror = Mirror(
        args.reference_url,
        args.comparison_log,
        FoulPlayConfig.username,
        quiet=args.mirror_quiet,
    )
    InstrumentedPSWebsocketClient.mirror = mirror

    if args.result_dir:
        result_dir = Path(args.result_dir)
        result_dir.mkdir(parents=True, exist_ok=True)
        raw_protocol_path = result_dir / "upstream-protocol.jsonl"
        raw_protocol_file = raw_protocol_path.open("a", encoding="utf-8")
    else:
        raw_protocol_file = None
    InstrumentedPSWebsocketClient.raw_protocol_file = raw_protocol_file

    original_pick_move = upstream_run_battle.async_pick_move

    async def instrumented_pick_move(battle: Any) -> list[str]:
        started = time.perf_counter()
        baseline_battle = deepcopy(battle)
        if not baseline_battle.team_preview:
            baseline_battle.user.update_from_request_json(
                baseline_battle.request_json
            )
        decision = await original_pick_move(battle)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
        if mirror is not None:
            summary = battle_summary(baseline_battle, decision)
            summary["decisionLatencyMs"] = elapsed_ms
            mirror.baseline(
                battle.battle_tag,
                getattr(battle, "rqid", None),
                summary,
            )
        return decision

    upstream_run_battle.async_pick_move = instrumented_pick_move

    client = await InstrumentedPSWebsocketClient.create(
        FoulPlayConfig.username,
        FoulPlayConfig.password,
        FoulPlayConfig.websocket_uri,
    )
    FoulPlayConfig.user_id = await asyncio.wait_for(
        client.login(),
        timeout=args.setup_timeout_ms / 1000,
    )
    if FoulPlayConfig.avatar is not None:
        await client.avatar(FoulPlayConfig.avatar)

    team_iterator = (
        None
        if FoulPlayConfig.team_list is None
        else TeamListIterator(FoulPlayConfig.team_list)
    )
    battles_run = 0
    attempts = 0
    max_attempts = max(FoulPlayConfig.run_count * 3, FoulPlayConfig.run_count + 5)
    wins = 0
    losses = 0
    try:
        while battles_run < FoulPlayConfig.run_count:
            attempts += 1
            if attempts > max_attempts:
                raise RuntimeError(
                    "upstream calibration exceeded maximum attempts: "
                    f"{attempts - 1}/{max_attempts}"
                )
            team_dict = None
            team_file_name = "None"
            try:
                if FoulPlayConfig.requires_team():
                    team_name = (
                        team_iterator.get_next_team()
                        if team_iterator is not None
                        else FoulPlayConfig.team_name
                    )
                    _team_packed, team_dict, team_file_name = load_team(team_name)
                    await client.update_team(_team_packed)
                else:
                    await client.update_team("None")

                if FoulPlayConfig.bot_mode == BotModes.challenge_user:
                    await client.challenge_user(
                        FoulPlayConfig.user_to_challenge,
                        FoulPlayConfig.pokemon_format,
                    )
                elif FoulPlayConfig.bot_mode == BotModes.accept_challenge:
                    await client.accept_challenge(
                        FoulPlayConfig.pokemon_format,
                        FoulPlayConfig.room_name,
                    )
                elif FoulPlayConfig.bot_mode == BotModes.search_ladder:
                    await client.search_for_match(FoulPlayConfig.pokemon_format)
                else:
                    raise ValueError("invalid bot mode")

                winner = await asyncio.wait_for(
                    pokemon_battle(
                        client,
                        FoulPlayConfig.pokemon_format,
                        team_dict,
                    ),
                    timeout=args.battle_timeout_ms / 1000,
                )
            except asyncio.TimeoutError:
                print(
                    "upstream attempt timed out; forfeiting active battle "
                    f"(attempt={attempts}, completed={battles_run})",
                    flush=True,
                )
                await client.forfeit_active_battle()
                if args.settle_ms > 0:
                    await asyncio.sleep(args.settle_ms / 1000)
                continue
            except Exception as error:
                # 远程私服在旧房间残留、挑战状态异常或返回非标准消息时，
                # upstream baseline 可能在 start_battle 阶段抛出异常。
                # 这类失败不应中断整个批次，也不应把失败尝试计入胜负。
                print(
                    "upstream attempt failed; forfeiting active battle "
                    f"(attempt={attempts}, completed={battles_run}, "
                    f"error={type(error).__name__}: {error})",
                    flush=True,
                )
                await client.forfeit_active_battle()
                if args.settle_ms > 0:
                    await asyncio.sleep(args.settle_ms / 1000)
                continue
            if winner == FoulPlayConfig.username:
                wins += 1
            else:
                losses += 1
            battles_run += 1
            print(
                "upstream battle complete: count={} wins={} losses={} winner={}".format(
                    battles_run,
                    wins,
                    losses,
                    winner,
                ),
                flush=True,
            )
            check_dictionaries_are_unmodified(original_pokedex, original_move_json)
            if battles_run < FoulPlayConfig.run_count and args.settle_ms > 0:
                await asyncio.sleep(args.settle_ms / 1000)
    finally:
        if raw_protocol_file is not None:
            raw_protocol_file.close()
        await client.close()
        mirror.close()


def start_control_server(args: argparse.Namespace) -> None:
    if args.no_control:
        return
    import json as _json
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/health":
                body = _json.dumps(
                    {
                        "ok": True,
                        "service": "upstream-foul-play",
                        "baseline": str(BASELINE_ROOT),
                    }
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_response(404)
            self.end_headers()

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    server = ThreadingHTTPServer((args.control_host, args.control_port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(
        "upstream control listening on http://{}:{}/health".format(
            args.control_host,
            args.control_port,
        ),
        flush=True,
    )


def main() -> None:
    wrapper_args, baseline_args = parse_wrapper_args(sys.argv[1:])
    sys.argv = [sys.argv[0]] + baseline_args
    start_control_server(wrapper_args)
    asyncio.run(run(wrapper_args))


if __name__ == "__main__":
    main()
