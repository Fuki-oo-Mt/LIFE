"""
Diana - Gemini API LLMプロバイダー

google-genai SDKを使用してGemini APIを呼び出す実装。
JSON出力を強制するプロンプトエンジニアリングを含む。
"""

import json
import logging

from google import genai
from google.genai import types

from .base import LLMProvider

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    """Gemini APIを使用したLLMプロバイダー。"""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        """Geminiプロバイダーを初期化する。

        Args:
            api_key: Gemini APIキー。
            model: 使用するGeminiモデル名。
        """
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        context: str = "",
        conversation_history: list[dict] | None = None,
    ) -> str:
        """Gemini APIでテキスト生成を実行する。

        Args:
            system_prompt: システムプロンプト。
            user_message: ユーザーメッセージ。
            context: RAGコンテキスト。
            conversation_history: 会話履歴。

        Returns:
            生成されたJSON文字列。
        """
        # メッセージ組み立て
        contents = []

        # 会話履歴を追加
        if conversation_history:
            for turn in conversation_history:
                role = turn.get("role", "user")
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=turn["content"])],
                    )
                )

        # 現在のユーザーメッセージを組み立て
        current_message = user_message
        if context:
            current_message = (
                f"【参考情報（ローカル知識ベースから取得）】\n{context}\n\n"
                f"【ユーザーの質問】\n{user_message}"
            )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=current_message)],
            )
        )

        # JSON出力を強制する指示をシステムプロンプトに追加
        json_instruction = """

【出力形式の厳格なルール】
あなたの応答は必ず以下のJSON形式のみで返してください。マークダウン修飾やコードブロックは含めないでください。
純粋なJSON文字列のみを出力してください。

{
  "ui_visibility": "show または hide",
  "need_permission": true または false,
  "emotion": "happy, thinking, neutral, apologetic, surprised のいずれか",
  "action": "nodding, looking_around, typing, smiling, tilting_head のいずれか",
  "text": "ユーザーへの応答テキスト",
  "internal_thought": "内部思考ログ"
}
"""
        full_system_prompt = system_prompt + json_instruction

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=full_system_prompt,
                    response_mime_type="application/json",
                    temperature=0.7,
                    max_output_tokens=1024,
                ),
            )
            result = response.text
            logger.debug(f"Gemini raw response: {result}")
            return result

        except Exception as e:
            logger.error(f"Gemini API呼び出しエラー: {e}")
            # エラー時のフォールバックJSON
            fallback = {
                "ui_visibility": "hide",
                "need_permission": False,
                "emotion": "apologetic",
                "action": "tilting_head",
                "text": "ごめんね、うまく考えられなかったの…もう一回言ってくれる？",
                "internal_thought": f"Gemini APIエラー: {str(e)}",
            }
            return json.dumps(fallback, ensure_ascii=False)

    async def health_check(self) -> bool:
        """Gemini APIの接続確認を行う。"""
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents="ping",
                config=types.GenerateContentConfig(
                    max_output_tokens=10,
                ),
            )
            return response.text is not None
        except Exception as e:
            logger.error(f"Gemini health check失敗: {e}")
            return False
