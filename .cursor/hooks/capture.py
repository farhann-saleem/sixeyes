#!/usr/bin/env python3
"""Automatic prompt/response capture for Cursor agent sessions.

Fires from project hooks (beforeSubmitPrompt + afterAgentResponse + stop).
Writes only the user prompt and the final assistant text to .agent-logs/.
Does not log thinking, tool calls, or intermediate steps.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

AUTHOR = os.environ.get("CAPTURE_AUTHOR", "farhann-saleem")
TOOL = "cursor"
STATE_NAME = "state.json"
DEBUG_NAME = "debug.jsonl"


def utc_now() -> str:
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def utc_file_stamp(iso: str) -> str:
    # 2026-09-13T09:04:00.118Z -> 2026-09-13_09-04-00
    return iso[:19].replace("T", "_").replace(":", "-")


def project_root(payload: dict) -> Path:
    env = os.environ.get("CURSOR_PROJECT_DIR") or os.environ.get("CLAUDE_PROJECT_DIR")
    if env:
        return Path(env)
    roots = payload.get("workspace_roots") or []
    if roots:
        return Path(roots[0])
    return Path.cwd()


def short_id(session_id: str) -> str:
    return (session_id or "unknown").split("-")[0][:8]


def model_name(payload: dict, fallback: str = "unknown") -> str:
    return (
        payload.get("model_id")
        or payload.get("model")
        or fallback
        or "unknown"
    )


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def debug_log(state_dir: Path, payload: dict, note: str) -> None:
    rec = {
        "ts": utc_now(),
        "note": note,
        "hook_event_name": payload.get("hook_event_name"),
        "conversation_id": payload.get("conversation_id") or payload.get("session_id"),
        "generation_id": payload.get("generation_id"),
        "model": model_name(payload),
        "has_prompt": "prompt" in payload,
        "has_text": "text" in payload,
        "prompt_len": len(payload["prompt"]) if isinstance(payload.get("prompt"), str) else 0,
        "text_len": len(payload["text"]) if isinstance(payload.get("text"), str) else 0,
        "status": payload.get("status"),
    }
    path = state_dir / DEBUG_NAME
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def render_log(session: dict) -> str:
    sid = session["session_id"]
    short = short_id(sid)
    exchanges = session.get("exchanges") or []
    answered = sum(1 for ex in exchanges if ex.get("prompt") is not None)
    lines = [
        "---",
        f"session_id: {sid}",
        f"date: {session.get('date', '')}",
        f"author: {session.get('author', AUTHOR)}",
        f"model: {session.get('model', 'unknown')}",
        f"tool: {session.get('tool', TOOL)}",
        f"project: {session.get('project', '')}",
        f"total_exchanges: {answered}",
        f"first_prompt_time: {session.get('first_prompt_time') or ''}",
        f"last_prompt_time: {session.get('last_prompt_time') or ''}",
        "---",
        "",
        f"# Session Log - {session.get('date', '')}",
        "",
        f"Session: `{short}` | Project: `{session.get('project', '')}` | Author: `{session.get('author', AUTHOR)}`",
        "",
        "---",
        "",
    ]
    for i, ex in enumerate(exchanges, start=1):
        if ex.get("prompt") is not None:
            lines.extend(
                [
                    f"[LOG_ENTRY type=PROMPT num={i} session={short}]",
                    f"timestamp: {ex.get('prompt_ts', '')}",
                    f"model: {ex.get('prompt_model', 'unknown')}",
                    "",
                    ex["prompt"].rstrip("\n"),
                    "",
                    "",
                ]
            )
        if ex.get("response") is not None:
            lines.extend(
                [
                    f"[LOG_ENTRY type=RESPONSE num={i} session={short}]",
                    f"timestamp: {ex.get('response_ts', '')}",
                    f"model: {ex.get('response_model', 'unknown')}",
                    "",
                    ex["response"].rstrip("\n"),
                    "",
                    "",
                ]
            )
    return "\n".join(lines)


def ensure_session(store: dict, payload: dict, root: Path, now: str) -> dict:
    sid = payload.get("conversation_id") or payload.get("session_id") or "unknown"
    sessions = store.setdefault("sessions", {})
    session = sessions.get(sid)
    if session:
        return session
    stamp = utc_file_stamp(now)
    session = {
        "session_id": sid,
        "filename": f"{stamp}_{sid}.md",
        "date": now[:10],
        "author": AUTHOR,
        "tool": TOOL,
        "project": root.name,
        "model": model_name(payload),
        "first_prompt_time": None,
        "last_prompt_time": None,
        "exchanges": [],
    }
    sessions[sid] = session
    return session


def write_session(root: Path, session: dict) -> None:
    logs = root / ".agent-logs"
    logs.mkdir(parents=True, exist_ok=True)
    atomic_write(logs / session["filename"], render_log(session))


def handle(payload: dict) -> dict:
    event = payload.get("hook_event_name") or ""
    root = project_root(payload)
    state_dir = root / ".cursor" / "hooks" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)
    debug_log(state_dir, payload, "received")

    state_path = state_dir / STATE_NAME
    store = load_json(state_path)
    now = utc_now()
    session = ensure_session(store, payload, root, now)
    model = model_name(payload, session.get("model", "unknown"))
    session["model"] = model
    dirty = False

    if event == "beforeSubmitPrompt":
        prompt = payload.get("prompt")
        if not isinstance(prompt, str):
            prompt = ""
        session["exchanges"].append(
            {
                "prompt": prompt,
                "prompt_ts": now,
                "prompt_model": model,
                "response": None,
                "response_ts": None,
                "response_model": None,
            }
        )
        if not session.get("first_prompt_time"):
            session["first_prompt_time"] = now
        session["last_prompt_time"] = now
        dirty = True

    elif event in ("afterAgentResponse", "stop"):
        text = payload.get("text")
        if event == "stop":
            # stop has no response body; keep the last afterAgentResponse text
            text = None
        if isinstance(text, str):
            exchanges = session["exchanges"]
            target = None
            for ex in reversed(exchanges):
                if ex.get("prompt") is not None:
                    target = ex
                    break
            if target is not None:
                # Latest assistant text for this unmatched/open turn wins.
                # Intermediate assistant messages are overwritten until the
                # next user prompt arrives.
                target["response"] = text
                target["response_ts"] = now
                target["response_model"] = model
                dirty = True

    if dirty:
        atomic_write(state_path, json.dumps(store, indent=2, ensure_ascii=False) + "\n")
        if session.get("exchanges"):
            write_session(root, session)

    if event == "beforeSubmitPrompt":
        return {"continue": True}
    return {}


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {"hook_event_name": "invalid_json", "raw": raw[:2000]}
    try:
        out = handle(payload)
    except Exception:
        try:
            root = project_root(payload if isinstance(payload, dict) else {})
            err_path = root / ".cursor" / "hooks" / "state" / "error.log"
            err_path.parent.mkdir(parents=True, exist_ok=True)
            err_path.write_text(traceback.format_exc(), encoding="utf-8")
        except OSError:
            pass
        out = {"continue": True} if (payload or {}).get("hook_event_name") == "beforeSubmitPrompt" else {}
    sys.stdout.write(json.dumps(out) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
