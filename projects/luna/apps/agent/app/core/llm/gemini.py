"""Gemini（Google）プロバイダ。

`google-genai` 非導入時やキー未設定時は呼び出し側（factory）がEchoへ退避させる。
"""

from __future__ import annotations

from typing import AsyncIterator

from .base import LLMChunk, LLMProvider, Message


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        from google import genai  # 遅延インポート

        self.model = model
        self._client = genai.Client(api_key=api_key)

    async def stream(self, messages: list[Message]) -> AsyncIterator[LLMChunk]:
        from google.genai import types

        system, rest = self.split_system(messages)

        contents = []
        for m in rest:
            role = "user" if m.role == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=m.content)])
            )

        config = types.GenerateContentConfig(
            system_instruction=system or None,
        )

        stream = await self._client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        )
        async for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield LLMChunk(text=text)
