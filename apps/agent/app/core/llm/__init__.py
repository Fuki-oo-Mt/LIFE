"""LLM抽象化レイヤー。

特定のLLMベンダに依存しないための層。`get_provider()` が設定に応じて
Claude / Gemini / Echo / Self-Hosted のいずれかを返す。将来、自社で育てた
モデルは `SelfHostedProvider` 経由（OpenAI互換）で差し込むだけで他社から独立できる。
"""

from .base import LLMChunk, LLMProvider, LLMResult, Message
from .factory import get_provider

__all__ = ["LLMChunk", "LLMProvider", "LLMResult", "Message", "get_provider"]
