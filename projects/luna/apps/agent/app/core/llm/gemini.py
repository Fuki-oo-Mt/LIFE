"""Gemini（Google）プロバイダ。

`google-genai` 非導入時やキー未設定時は呼び出し側（factory）がEchoへ退避させる。

無料枠のレート制限（429 / RESOURCE_EXHAUSTED）は、ストリーム開始前であれば
指数バックオフで自動リトライし、会話が途切れないようにする。
（ストリーム開始後の失敗は、リトライすると応答が重複するため行わない）
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncIterator

from .base import LLMChunk, LLMProvider, Message

logger = logging.getLogger("luna.llm.gemini")

#: リトライ時の基本待機秒数（無料枠はRPM制限が主因のため、やや長めに置く）
_BASE_DELAY_SEC = 5.0


def _is_rate_limited(exc: Exception) -> bool:
    """429（無料枠のレート制限）由来の例外かをSDK非依存で判定する。"""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code == 429:
        return True
    text = str(exc)
    return "429" in text or "RESOURCE_EXHAUSTED" in text


def _suggested_delay(exc: Exception) -> float | None:
    """APIが retryDelay（例: "retryDelay": "12s"）を返していれば秒数を取り出す。"""
    m = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", str(exc))
    return float(m.group(1)) if m else None


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, max_retries: int = 3) -> None:
        from google import genai  # 遅延インポート

        self.model = model
        self.max_retries = max(0, max_retries)
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

        stream = None
        for attempt in range(self.max_retries + 1):
            try:
                stream = await self._client.aio.models.generate_content_stream(
                    model=self.model,
                    contents=contents,
                    config=config,
                )
                break
            except Exception as exc:
                if not _is_rate_limited(exc) or attempt >= self.max_retries:
                    raise
                delay = _suggested_delay(exc) or _BASE_DELAY_SEC * (2**attempt)
                logger.warning(
                    "Geminiレート制限(429)。%.1f秒後にリトライします（%d/%d回目）",
                    delay,
                    attempt + 1,
                    self.max_retries,
                )
                await asyncio.sleep(delay)

        async for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield LLMChunk(text=text)
