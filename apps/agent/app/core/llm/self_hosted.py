"""Self-Hostedプロバイダ — 将来の「自社の頭脳」への接続口。

OpenAI互換の `/chat/completions`（Ollama / vLLM / TGI / 自社推論サーバ）へ接続する。
このアダプタが本番運用に乗る日が、Cradleが他社LLMから独立する日である。
追加の専用SDKは不要（httpxでSSEを直接読む）ため、依存を最小に保てる。
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from .base import LLMChunk, LLMProvider, Message


class SelfHostedProvider(LLMProvider):
    name = "self_hosted"

    def __init__(self, base_url: str, model: str, api_key: str = "not-needed") -> None:
        self.model = model
        self.note = f"自社/ローカルモデルに接続中: {base_url}"
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    async def stream(self, messages: list[Message]) -> AsyncIterator[LLMChunk]:
        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self._base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content")
                    if text:
                        yield LLMChunk(text=text)
