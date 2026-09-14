#!/usr/bin/env python3
"""Automatically export repo-scoped Codex Desktop prompt/final transcript items.

Native JSONL is version-dependent. Only user text after turn_context and explicit
final_answer messages are exported; reasoning, tools and commentary are excluded.
Existing entries use the hook writer's session/turn deduplication and are immutable.
"""
import argparse
import fcntl
import json
import sys
import time
from pathlib import Path

from codex_capture import ROOT, capture


def export_session(path, root, since):
    meta = None
    context = None
    turn = None
    prompted = False
    count = 0
    with path.open() as stream:
        for line in stream:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                # A producer can be halfway through appending its last JSONL row.
                break
            data = record.get('payload', {})
            kind = record.get('type')
            timestamp = record.get('timestamp', '')
            if kind == 'session_meta':
                meta = data
                if (data.get('originator') != 'Codex Desktop'
                        or data.get('source') != 'vscode'
                        or data.get('thread_source') != 'user'
                        or Path(data.get('cwd', '/')).resolve() != root.resolve()
                        or data.get('timestamp', '') < since):
                    return 0
            if meta is None:
                continue
            if kind == 'event_msg' and data.get('type') == 'task_started':
                turn = data['turn_id']
                context = None
                prompted = False
            elif kind == 'turn_context':
                context = data
                turn = data.get('turn_id', turn)
            elif (kind == 'response_item' and data.get('type') == 'message'
                  and context and turn):
                role = data.get('role')
                content = data.get('content', [])
                if role == 'user':
                    if prompted:
                        raise ValueError('Multiple user messages in one turn; review transcript schema')
                    if any(item.get('type') != 'input_text' for item in content):
                        raise ValueError('Non-text user input; full media capture needs review')
                    body = ''.join(item['text'] for item in content)
                    event = 'UserPromptSubmit'
                    prompted = True
                elif role == 'assistant' and data.get('phase') == 'final_answer' and prompted:
                    body = ''.join(item['text'] for item in content if item.get('type') == 'output_text')
                    event = 'Stop'
                else:
                    continue
                payload = dict(session_id=meta['id'], turn_id=turn,
                               model=context['model'], hook_event_name=event)
                payload['prompt' if event == 'UserPromptSubmit' else 'last_assistant_message'] = body
                capture(payload, root=root, timestamp=timestamp)
                count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sessions', type=Path, default=Path.home() / '.codex/sessions')
    parser.add_argument('--since', required=True, help='Earliest session creation timestamp in UTC')
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    state = ROOT / '.capture-state'
    state.mkdir(exist_ok=True)
    with (state / 'desktop-exporter.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        seen = {}
        while True:
            for path in args.sessions.rglob('*.jsonl'):
                stat = path.stat()
                stamp = (stat.st_mtime_ns, stat.st_size)
                if seen.get(path) == stamp:
                    continue
                try:
                    count = export_session(path, ROOT, args.since)
                    seen[path] = stamp
                    if count:
                        print(f'Checked {path.name}: {count} prompt/final items', flush=True)
                except Exception as exc:
                    print(f'Capture error in {path.name}: {exc}', file=sys.stderr, flush=True)
            if args.once:
                return
            time.sleep(2)


if __name__ == '__main__':
    main()
