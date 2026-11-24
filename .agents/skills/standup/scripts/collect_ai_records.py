"""당일(KST) 이 레포에서 나눈 AI 대화 글만 모아 출력한다.

도구 호출과 실행 결과는 비밀 값이 섞이기 쉬워 읽지 않는다.
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))
MAX_CHARS = 1500

REDACTIONS = [
    (re.compile(r"-----BEGIN [^-]*PRIVATE KEY-----.*?(-----END [^-]*-----|\Z)", re.S), "[가림]"),
    (re.compile(r"(\w+://)[^\s/@]+:[^\s/]+@"), r"\1[가림]@"),
    (re.compile(r"(https?://[^\s?)\]]+)\?[^\s)\]]+"), r"\1?[가림]"),
    (re.compile(r"(?i)(\bBearer\s+)\S+"), r"\1[가림]"),
    (
        re.compile(
            r"(?i)((?:password|passwd|pwd|secret|token|api[_-]?key|account[_-]?key|access[_-]?key"
            r"|비밀번호|비번|토큰|시크릿)[\"'`]?(?:\s*[:=]\s*|(?:은|는|이|가)\s+))"
            r"(\"[^\"\n]*\"|'[^'\n]*'|[^\s,;]+)"
        ),
        r"\1[가림]",
    ),
    (
        re.compile(
            r"(?i)(--?[\w-]*(?:password|secret|token|key)\s+)(\"[^\"\n]*\"|'[^'\n]*'|[^\s]+)"
        ),
        r"\1[가림]",
    ),
    (re.compile(r"\b(?:sk-|gh[pousr]_|github_pat_|xox[a-z]-|AKIA|AIza)[\w-]{8,}"), "[가림]"),
    (re.compile(r"\beyJ[\w-]+\.[\w-]+(?:\.[\w-]+)?"), "[가림]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[이메일]"),
    (re.compile(r"\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b"), "[전화번호]"),
    (re.compile(r"(?<![\w/])[A-Za-z0-9+_-]{40,}={0,2}"), "[가림]"),
]
INJECTED = re.compile(
    r"<(system-reminder|environment_context|local-command-[\w-]+|INSTRUCTIONS)>.*?</\1>", re.S
)


def redact(text):
    for pattern, replacement in REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def clean(text):
    text = INJECTED.sub("", text).strip()
    if text.startswith("# AGENTS.md instructions"):
        return ""
    # 자른 뒤에 가리면 잘린 비밀 값을 놓치므로 먼저 가린다.
    text = redact(text)
    return text if len(text) <= MAX_CHARS else text[:MAX_CHARS] + " …(생략)"


def text_of(content):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    kinds = ("text", "input_text", "output_text")
    return "\n".join(
        str(part.get("text") or "")
        for part in content
        if isinstance(part, dict) and part.get("type") in kinds
    )


def repo_roots():
    output = subprocess.run(
        ["git", "worktree", "list", "--porcelain"], capture_output=True, text=True, check=True
    ).stdout
    prefix = "worktree "
    return [
        Path(line.removeprefix(prefix)) for line in output.splitlines() if line.startswith(prefix)
    ]


def in_repo(cwd, roots):
    return bool(cwd) and any(Path(cwd).is_relative_to(root) for root in roots)


def read_jsonl(path):
    with path.open(encoding="utf-8", errors="replace") as file:
        for line in file:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue  # 진행 중인 세션은 마지막 줄이 덜 써졌을 수 있다.
            if isinstance(row, dict):
                yield row


def claude_message(row, cwd):
    """(작업 폴더, 역할, 글)을 돌려준다."""
    if row.get("type") not in ("user", "assistant"):
        return cwd, None, ""
    if row.get("isMeta") or row.get("isSidechain") or row.get("isCompactSummary"):
        return cwd, None, ""
    message = row.get("message") or {}
    return row.get("cwd"), message.get("role"), text_of(message.get("content"))


def codex_message(row, cwd):
    payload = row.get("payload")
    if not isinstance(payload, dict):
        return cwd, None, ""
    if row.get("type") in ("session_meta", "turn_context"):
        return payload.get("cwd") or cwd, None, ""
    if row.get("type") != "response_item" or payload.get("type") != "message":
        return cwd, None, ""
    return cwd, payload.get("role"), text_of(payload.get("content"))


def collect(path, parse, day, roots):
    cwd = None
    for row in read_jsonl(path):
        cwd, role, text = parse(row, cwd)
        if role not in ("user", "assistant") or not in_repo(cwd, roots):
            continue
        try:
            at = datetime.fromisoformat(row["timestamp"]).astimezone(KST)
        except (KeyError, TypeError, ValueError):
            continue
        if at.date() == day and (text := clean(text)):
            yield at, role, text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", type=date.fromisoformat, default=datetime.now(KST).date())
    parser.add_argument("--home", type=Path, default=Path.home(), help="기록을 찾을 홈 폴더")
    args = parser.parse_args()

    roots = repo_roots()
    day_start = datetime.combine(args.date, datetime.min.time(), KST).timestamp()
    sources = [
        ("Claude Code", args.home / ".claude/projects", "*/*.jsonl", claude_message),
        ("Codex", args.home / ".codex/sessions", "**/*.jsonl", codex_message),
        ("Codex", args.home / ".codex/archived_sessions", "**/*.jsonl", codex_message),
    ]
    seen = set()
    for name, folder, pattern, parse in sources:
        messages = []
        for path in folder.glob(pattern) if folder.is_dir() else []:
            try:
                if path.stat().st_mtime >= day_start:
                    messages += collect(path, parse, args.date, roots)
            except OSError as error:
                print(f"읽지 못한 기록: {path.name} ({error})", file=sys.stderr)
        # 이어서 연 세션은 앞선 대화를 복사해 둔다.
        unique = sorted(set(messages) - seen)
        seen.update(unique)
        print(f"# {name} ({folder.name}): {args.date} 메시지 {len(unique)}개")
        for at, role, text in unique:
            print(f"\n[{at:%H:%M} {role}] {text}")
        print()


if __name__ == "__main__":
    main()
