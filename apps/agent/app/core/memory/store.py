"""セッション単位の短期会話メモリ。

MVPはプロセス内に直近の履歴を保持するだけ。将来は PostgreSQL + pgvector へ
置き換え、長期記憶（RAG）として意味検索できるようにする。インターフェースを
保てばエージェント側の改修は要らない。
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Deque, Dict

from ..llm.base import Message


class ConversationMemory:
    def __init__(self, max_turns: int = 12) -> None:
        self._max = max_turns
        self._store: Dict[str, Deque[Message]] = defaultdict(
            lambda: deque(maxlen=self._max * 2)
        )

    def history(self, session_id: str) -> list[Message]:
        return list(self._store[session_id])

    def append(self, session_id: str, message: Message) -> None:
        self._store[session_id].append(message)

    def clear(self, session_id: str) -> None:
        self._store.pop(session_id, None)


memory = ConversationMemory()
