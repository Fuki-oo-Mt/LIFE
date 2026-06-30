"""Echoプロバイダ — APIキー不要のローカルデモ用頭脳。

外部LLMが無くてもMVP全体（顔⇄頭脳の往復・データ蓄積）が動くことを保証する。
本物のLLMが無い状況でも、Lunaらしい応答を擬似ストリーミングで返す。
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

from .base import LLMChunk, LLMProvider, Message


class EchoProvider(LLMProvider):
    name = "echo"
    model = "luna-echo-v1"

    def __init__(self, note: str = "") -> None:
        self.note = note or "エコーモード（外部LLM未設定）で起動しています"

    async def stream(self, messages: list[Message]) -> AsyncIterator[LLMChunk]:
        user_text = ""
        for m in reversed(messages):
            if m.role == "user":
                user_text = m.content
                break

        reply = (
            f"社長、承知いたしました。「{user_text.strip()}」の件、Lunaが確かに受け取りました。"
            "ただいまはデモ用のエコーモードで応答しております。"
            "本物の頭脳（Claude / Gemini / 自社モデル）を接続すれば、ここで実際の調査や"
            "業務代行を自律的に実行いたします。"
        )

        # 本物のストリーミング体験を再現するため、文節ごとに少しずつ送る。
        buffer = ""
        for ch in reply:
            buffer += ch
            if ch in "、。」！？" or len(buffer) >= 12:
                yield LLMChunk(text=buffer)
                buffer = ""
                await asyncio.sleep(0.02)
        if buffer:
            yield LLMChunk(text=buffer)
