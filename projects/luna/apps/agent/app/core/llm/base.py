"""LLMプロバイダの共通インターフェース（契約）。

頭脳の他の部分は、この抽象（`LLMProvider`）にのみ依存する。具体的なベンダ実装
（Claude/Gemini/自社モデル）はこの契約を満たす限り自由に差し替えられる。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Literal

Role = Literal["system", "user", "assistant"]


@dataclass
class Message:
    """会話の1メッセージ。"""

    role: Role
    content: str


@dataclass
class LLMChunk:
    """ストリーミングで届くテキスト断片。"""

    text: str


@dataclass
class LLMResult:
    """確定した最終応答（メタ情報付き）。"""

    text: str
    provider: str
    model: str
    raw: dict = field(default_factory=dict)


class LLMProvider(ABC):
    """全LLMプロバイダが満たすべき契約。

    実装すべきは `stream()` のみ。`complete()` は既定で `stream()` を畳み込む。
    """

    #: 表示用のプロバイダ名（例: "claude"）
    name: str = "base"
    #: 使用モデル名
    model: str = "unknown"
    #: エコー等にフォールバックした理由（あれば）。起動ログ表示に使う。
    note: str = ""

    @abstractmethod
    def stream(self, messages: list[Message]) -> AsyncIterator[LLMChunk]:
        """メッセージ列に対する応答をトークン断片でストリーム配信する。

        async generator を返す（`async for chunk in provider.stream(...)`）。
        """
        raise NotImplementedError

    async def complete(self, messages: list[Message]) -> LLMResult:
        """ストリームを畳み込んで最終テキストを得る便宜メソッド。"""
        parts: list[str] = []
        async for chunk in self.stream(messages):
            parts.append(chunk.text)
        return LLMResult(text="".join(parts), provider=self.name, model=self.model)

    @staticmethod
    def split_system(messages: list[Message]) -> tuple[str, list[Message]]:
        """system メッセージを分離して返す（Claude等は system を別引数で渡すため）。"""
        system_parts = [m.content for m in messages if m.role == "system"]
        rest = [m for m in messages if m.role != "system"]
        return "\n\n".join(system_parts), rest
