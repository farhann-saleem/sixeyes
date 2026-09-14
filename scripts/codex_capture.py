#!/usr/bin/env python3
"""Codex UserPromptSubmit/Stop capture. Never stores tool or reasoning payloads."""
import fcntl
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def capture(payload, root=ROOT, timestamp=None):
    event = payload.get("hook_event_name")
    if event not in ("UserPromptSubmit", "Stop"):
        return
    sid = payload["session_id"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", sid):
        raise ValueError("Invalid session id")
    turn = payload["turn_id"]
    model = payload["model"]
    text = payload.get("prompt" if event == "UserPromptSubmit" else "last_assistant_message")
    if not isinstance(text, str):
        raise ValueError("Hook did not include message text")
    now = timestamp or datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    state_dir = root / ".capture-state"
    state_dir.mkdir(exist_ok=True)
    with (state_dir / (sid + ".lock")).open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state_file = state_dir / (sid + ".json")
        state = json.loads(state_file.read_text()) if state_file.exists() else {
            "filename": now[:19].replace("T", "_").replace(":", "-") + "_" + sid + ".md",
            "turns": {}, "first": now,
        }
        turns = state["turns"]
        if event == "Stop" and turn not in turns:
            raise ValueError("No captured prompt for this turn; capture is incomplete")
        if turn not in turns:
            turns[turn] = {"num": len(turns) + 1, "events": []}
        exchange = turns[turn]
        if event in exchange["events"]:
            return
        logs = root / ".agent-logs"
        logs.mkdir(exist_ok=True)
        output = logs / state["filename"]
        short = sid[:8]
        if output.exists():
            existing = output.read_text()
        else:
            existing = (
                f"---\nsession_id: {sid}\ndate: {now[:10]}\nauthor: farhann-saleem\n"
                f"model: {model}\ntool: codex\nproject: {root.name}\n"
                f"total_exchanges: 0\nfirst_prompt_time: {state['first']}\nlast_prompt_time: {now}\n---\n\n"
                f"# Session Log - {now[:10]}\n\nSession: `{short}` | Project: `{root.name}` | Author: `farhann-saleem`\n\n---\n\n"
            )
        # Update metadata only; existing log entry bytes are preserved verbatim.
        header, body = existing.split("\n---\n", 1)
        if event == "UserPromptSubmit":
            header = re.sub(r"(?m)^total_exchanges: .*", f"total_exchanges: {len(turns)}", header)
            header = re.sub(r"(?m)^last_prompt_time: .*", f"last_prompt_time: {now}", header)
        kind = "PROMPT" if event == "UserPromptSubmit" else "RESPONSE"
        entry = f"[LOG_ENTRY type={kind} num={exchange['num']} session={short}]\ntimestamp: {now}\nmodel: {model}\n\n{text}\n\n\n"
        temp = output.with_suffix(".tmp")
        temp.write_text(header + "\n---\n" + body + entry)
        temp.replace(output)
        exchange["events"].append(event)
        temp_state = state_file.with_suffix(".tmp")
        temp_state.write_text(json.dumps(state))
        temp_state.replace(state_file)


if __name__ == "__main__":
    try:
        capture(json.load(sys.stdin))
        print("{}")
    except Exception as exc:
        print(json.dumps({"systemMessage": f"Codex capture failed: {exc}"}))
        sys.exit(1)
