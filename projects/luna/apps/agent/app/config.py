"""環境変数から設定を読み込む。秘密情報はコードに埋め込まず .env で管理する。"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

_HERE = os.path.dirname(__file__)
_DEFAULT_DATA_DIR = os.path.normpath(os.path.join(_HERE, "..", "data", "store"))


@dataclass
class Settings:
    """全設定。`LLM_PROVIDER` 一つで頭脳の供給元を切り替えられる。"""

    llm_provider: str = os.getenv("LLM_PROVIDER", "echo").strip().lower()

    # Claude
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "").strip()
    claude_model: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-5").strip()

    # Gemini
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

    # Gemini 無料枠のレート制限(429)対策
    gemini_max_retries: int = int(os.getenv("GEMINI_MAX_RETRIES", "3"))

    # Self-hosted（将来の自社モデル / ローカルLLM）— OpenAI互換
    self_hosted_base_url: str = os.getenv(
        "SELF_HOSTED_BASE_URL", "http://localhost:11434/v1"
    ).strip()
    self_hosted_model: str = os.getenv("SELF_HOSTED_MODEL", "luna-self").strip()
    self_hosted_api_key: str = os.getenv("SELF_HOSTED_API_KEY", "not-needed").strip()

    # データ・フライホイールの出力先
    data_dir: str = os.getenv("LUNA_DATA_DIR", _DEFAULT_DATA_DIR).strip()

    # サーバ
    host: str = os.getenv("HOST", "0.0.0.0").strip()
    port: int = int(os.getenv("PORT", "8000"))


settings = Settings()
