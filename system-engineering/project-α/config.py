"""
Diana - 設定管理モジュール

.envファイルから設定を読み込み、データフォルダの自動生成を行う。
"""

import os
from pathlib import Path

import yaml
from dotenv import load_dotenv


class DianaConfig:
    """ディアナの設定を管理するクラス。"""

    def __init__(self, env_path: str | None = None):
        """設定を初期化する。

        Args:
            env_path: .envファイルのパス。Noneの場合はプロジェクトルートの.envを使用。
        """
        self.project_root = Path(__file__).parent
        env_file = Path(env_path) if env_path else self.project_root / ".env"
        load_dotenv(env_file)

        # --- LLM Provider ---
        self.llm_provider: str = os.getenv("LLM_PROVIDER", "gemini")
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.claude_api_key: str = os.getenv("CLAUDE_API_KEY", "")
        self.claude_model: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

        # --- Embedding ---
        self.embedding_model: str = os.getenv(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )

        # --- Data Paths ---
        data_dir = os.getenv("DATA_DIR", "./data")
        self.data_dir = self.project_root / data_dir
        self.learning_dir = self.data_dir / "01_Learning"
        self.analyzed_dir = self.data_dir / "02_Analyzed"
        self.workspace_dir = self.data_dir / "03_Workspace"
        self.vectordb_dir = self.analyzed_dir / ".vectordb"

        # --- Metacognition ---
        self.knowledge_threshold: float = float(
            os.getenv("KNOWLEDGE_THRESHOLD", "0.35")
        )

        # --- Conversation ---
        self.max_conversation_turns: int = int(
            os.getenv("MAX_CONVERSATION_TURNS", "20")
        )

        # --- Persona ---
        self.persona = self._load_persona()

    def _load_persona(self) -> dict:
        """persona.yamlからキャラクター設定を読み込む。"""
        persona_path = self.project_root / "persona.yaml"
        if persona_path.exists():
            with open(persona_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        return {
            "name": "ディアナ",
            "system_prompt": "あなたはディアナです。純粋で優しい女の子として振る舞ってください。",
        }

    def get_system_prompt(self) -> str:
        """ペルソナのシステムプロンプトを返す。"""
        return self.persona.get("system_prompt", "")

    def ensure_directories(self) -> None:
        """必要なデータフォルダを自動生成する。"""
        for dir_path in [
            self.learning_dir,
            self.analyzed_dir,
            self.workspace_dir,
            self.vectordb_dir,
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def validate(self) -> list[str]:
        """設定のバリデーションを行い、エラーメッセージのリストを返す。"""
        errors = []
        if self.llm_provider == "gemini" and not self.gemini_api_key:
            errors.append("GEMINI_API_KEY が設定されていません。")
        elif self.llm_provider == "claude" and not self.claude_api_key:
            errors.append("CLAUDE_API_KEY が設定されていません。")
        elif self.llm_provider not in ("gemini", "claude", "mock"):
            errors.append(f"未対応のLLMプロバイダー: {self.llm_provider}")
        return errors
