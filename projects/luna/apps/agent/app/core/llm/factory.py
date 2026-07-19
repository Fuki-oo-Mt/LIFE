"""設定に応じて適切なLLMプロバイダを生成する工場。

ここが「差し替えの一点」。アプリの他の部分は具体ベンダを一切知らない。
キー未設定・SDK未導入など、何か欠けていても必ずEchoへ退避し、MVPが止まらない。
"""

from __future__ import annotations

import logging

from .base import LLMProvider
from .echo import EchoProvider

logger = logging.getLogger("luna.llm")


def get_provider(settings) -> LLMProvider:
    provider = (settings.llm_provider or "echo").lower()

    if provider == "echo":
        return EchoProvider()

    if provider == "claude":
        if not settings.anthropic_api_key:
            return EchoProvider(note="ANTHROPIC_API_KEY 未設定 → エコーモードで起動")
        try:
            from .claude import ClaudeProvider

            return ClaudeProvider(
                api_key=settings.anthropic_api_key, model=settings.claude_model
            )
        except Exception as exc:  # SDK未導入・初期化失敗など
            logger.warning("Claude初期化に失敗、エコーへ退避: %s", exc)
            return EchoProvider(note=f"Claude初期化失敗 → エコー退避: {exc}")

    if provider == "gemini":
        if not settings.gemini_api_key:
            return EchoProvider(note="GEMINI_API_KEY 未設定 → エコーモードで起動")
        try:
            from .gemini import GeminiProvider

            return GeminiProvider(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                max_retries=settings.gemini_max_retries,
            )
        except Exception as exc:
            logger.warning("Gemini初期化に失敗、エコーへ退避: %s", exc)
            return EchoProvider(note=f"Gemini初期化失敗 → エコー退避: {exc}")

    if provider == "self_hosted":
        try:
            from .self_hosted import SelfHostedProvider

            return SelfHostedProvider(
                base_url=settings.self_hosted_base_url,
                model=settings.self_hosted_model,
                api_key=settings.self_hosted_api_key,
            )
        except Exception as exc:
            logger.warning("Self-Hosted初期化に失敗、エコーへ退避: %s", exc)
            return EchoProvider(note=f"Self-Hosted初期化失敗 → エコー退避: {exc}")

    return EchoProvider(note=f"未知のプロバイダ '{provider}' → エコーモードで起動")
