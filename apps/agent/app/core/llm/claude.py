"""Claude（Anthropic）プロバイダ。

`anthropic` 非導入時やキー未設定時は呼び出し側（factory）がEchoへ退避させる。
コスト最適化のため Prompt Caching を将来差し込みやすい構造にしてある。
"""

from __future__ import annotations

from typing import AsyncIterator

from .base import LLMChunk, LLMProvider, Message


class ClaudeProvider(LLMProvider):
    name = "claude"

    def __init__(self, api_key: str, model: str, max_tokens: int = 1024) -> None:
        from anthropic import AsyncAnthropic  # 遅延インポート（未導入でも他モードは動く）

        self.model = model
        self.max_tokens = max_tokens
        self._client = AsyncAnthropic(api_key=api_key)

    async def stream(self, messages: list[Message]) -> AsyncIterator[LLMChunk]:
        system, rest = self.split_system(messages)
        api_messages = [{"role": m.role, "content": m.content} for m in rest]

        kwargs = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "messages": api_messages,
        }
        if system:
            kwargs["system"] = system

        async with self._client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                if text:
                    yield LLMChunk(text=text)
