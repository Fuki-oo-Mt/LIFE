"""データ・フライホイール（教師データ蓄積基盤）。

全業務を「入力 → 思考 → 行動(ツール) → 結果」の構造で記録する。これが将来
自社モデルを微調整(Fine-tuning)するための燃料になる。記録先は二系統:

1. JSONL（`traces-YYYYMMDD.jsonl`）… 生ログ。1行1トレース。
2. SQLite（`luna.sqlite3`）… 集計・検索用。

さらに `export_sft()` で、そのまま学習に使えるSFT形式（messages配列）へ書き出す。
これが「Claudeで稼ぎつつ、裏で自社の頭脳を育てる」設計の実体である。
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Optional

from app.config import settings


@dataclass
class ToolCallTrace:
    name: str
    args: dict
    ok: bool
    summary: str


@dataclass
class Trace:
    """1ターン分の完全な業務記録。"""

    ts: str
    session_id: str
    provider: str
    model: str
    user_input: str
    system_prompt: str
    thinking: list[str]
    tool_calls: list[ToolCallTrace]
    output: str
    emotion: str
    ok: bool
    latency_ms: int = 0
    extra: dict = field(default_factory=dict)


class TraceRecorder:
    def __init__(self, data_dir: Optional[str] = None) -> None:
        self._dir = data_dir or settings.data_dir
        self._lock = threading.Lock()
        os.makedirs(self._dir, exist_ok=True)
        self._db_path = os.path.join(self._dir, "luna.sqlite3")
        self._init_db()

    # --- 内部 ---------------------------------------------------------------
    def _init_db(self) -> None:
        with self._lock, sqlite3.connect(self._db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS traces (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts           TEXT NOT NULL,
                    session_id   TEXT NOT NULL,
                    provider     TEXT NOT NULL,
                    model        TEXT NOT NULL,
                    user_input   TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    thinking     TEXT NOT NULL,
                    tool_calls   TEXT NOT NULL,
                    output       TEXT NOT NULL,
                    emotion      TEXT NOT NULL,
                    ok           INTEGER NOT NULL,
                    latency_ms   INTEGER NOT NULL,
                    extra        TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _jsonl_path(self, ts: datetime) -> str:
        return os.path.join(self._dir, f"traces-{ts.strftime('%Y%m%d')}.jsonl")

    # --- 公開API ------------------------------------------------------------
    def record(self, trace: Trace) -> None:
        now = datetime.now()
        payload = asdict(trace)

        # 1) JSONL（生ログ）
        line = json.dumps(payload, ensure_ascii=False)
        with self._lock:
            with open(self._jsonl_path(now), "a", encoding="utf-8") as f:
                f.write(line + "\n")

            # 2) SQLite（検索・集計）
            with sqlite3.connect(self._db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO traces
                    (ts, session_id, provider, model, user_input, system_prompt,
                     thinking, tool_calls, output, emotion, ok, latency_ms, extra)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        trace.ts,
                        trace.session_id,
                        trace.provider,
                        trace.model,
                        trace.user_input,
                        trace.system_prompt,
                        json.dumps(trace.thinking, ensure_ascii=False),
                        json.dumps(
                            [asdict(tc) for tc in trace.tool_calls], ensure_ascii=False
                        ),
                        trace.output,
                        trace.emotion,
                        1 if trace.ok else 0,
                        trace.latency_ms,
                        json.dumps(trace.extra, ensure_ascii=False),
                    ),
                )
                conn.commit()

    def count(self) -> int:
        with self._lock, sqlite3.connect(self._db_path) as conn:
            cur = conn.execute("SELECT COUNT(*) FROM traces")
            return int(cur.fetchone()[0])

    def export_sft(self, out_path: Optional[str] = None) -> str:
        """成功トレースをSFT（教師あり微調整）形式のJSONLへ書き出す。

        将来、自社モデルを育てる際の学習データとして直接利用できる。
        """
        out_path = out_path or os.path.join(self._dir, "sft_export.jsonl")
        with self._lock, sqlite3.connect(self._db_path) as conn:
            rows = conn.execute(
                "SELECT system_prompt, user_input, output FROM traces WHERE ok = 1"
            ).fetchall()

        with open(out_path, "w", encoding="utf-8") as f:
            for system_prompt, user_input, output in rows:
                record = {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input},
                        {"role": "assistant", "content": output},
                    ]
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return out_path


recorder = TraceRecorder()
