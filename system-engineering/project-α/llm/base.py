"""
Diana - LLMプロバイダー抽象基底クラス

Phase 3でローカルLLM（MLX/Ollama）に差し替える際は、
このクラスを継承した新クラスを作成し、configのLLM_PROVIDERを変更するだけ。
"""

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """LLMプロバイダーの抽象基底クラス。

    すべてのLLM実装（Gemini, Claude, ローカルLLM等）はこのクラスを継承する。
    """

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        context: str = "",
        conversation_history: list[dict] | None = None,
    ) -> str:
        """テキスト生成を実行する。

        Args:
            system_prompt: システムプロンプト（ペルソナ設定等）。
            user_message: ユーザーの入力メッセージ。
            context: RAG検索結果等の追加コンテキスト。
            conversation_history: 会話履歴のリスト。

        Returns:
            LLMの生成テキスト（JSON文字列を想定）。
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """プロバイダーの接続状態を確認する。

        Returns:
            接続可能な場合True。
        """
        pass
