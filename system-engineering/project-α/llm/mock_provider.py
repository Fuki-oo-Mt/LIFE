"""
Diana - モックLLMプロバイダー（オフラインテスト用）

ネットワーク接続なしでシステム全体の動作検証を可能にする。
入力に応じた適切なJSON応答をローカルで生成する。
"""

import json
import logging
import re

from .base import LLMProvider

logger = logging.getLogger(__name__)


class MockProvider(LLMProvider):
    """オフラインテスト用のモックLLMプロバイダー。

    ネットワークなしでも全フロー（挨拶、UI制御、許可要求、検索後回答）を
    テストできるよう、入力パターンに応じた定型JSON応答を返す。
    """

    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        context: str = "",
        conversation_history: list[dict] | None = None,
    ) -> str:
        """入力パターンに応じたモック応答を返す。"""
        logger.info(f"モックLLM呼出: '{user_message[:50]}'")

        msg = user_message.lower()

        # コンテキスト付き（検索結果からの回答）
        if context:
            response = {
                "ui_visibility": "hide",
                "need_permission": False,
                "emotion": "happy",
                "action": "nodding",
                "text": (
                    f"調べてきたよ！えっとね…{context[:100]}…"
                    f"っていう感じみたい！わたしもひとつ賢くなっちゃった！"
                ),
                "internal_thought": "検索結果をコンテキストとして応答を生成（モック）",
            }
        # 挨拶パターン
        elif any(w in msg for w in ["やあ", "おはよう", "こんにちは", "こんばんは", "ただいま", "はじめ"]):
            response = {
                "ui_visibility": "hide",
                "need_permission": False,
                "emotion": "happy",
                "action": "smiling",
                "text": "わあ！来てくれたんだね！えへへ、嬉しいな！今日はどんなことするの？",
                "internal_thought": "ユーザーからの挨拶を検出。喜んで応答。",
            }
        # お礼
        elif any(w in msg for w in ["ありがとう", "さんきゅ", "助かった"]):
            response = {
                "ui_visibility": "hide",
                "need_permission": False,
                "emotion": "happy",
                "action": "nodding",
                "text": "えへへ、役に立てて嬉しいの！いつでも頼ってね！",
                "internal_thought": "ユーザーからのお礼。喜びを表現。",
            }
        # 体調・気分
        elif any(w in msg for w in ["元気", "調子", "気分"]):
            response = {
                "ui_visibility": "hide",
                "need_permission": False,
                "emotion": "happy",
                "action": "nodding",
                "text": "わたしはいつでも元気だよ！あなたのこと、待ってたの！",
                "internal_thought": "体調に関する質問。ポジティブに応答。",
            }
        # デフォルト
        else:
            response = {
                "ui_visibility": "hide",
                "need_permission": False,
                "emotion": "neutral",
                "action": "smiling",
                "text": f"うんうん、「{user_message[:30]}」だね！わたしに何かできることある？",
                "internal_thought": f"一般的な入力を受信: '{user_message[:50]}'",
            }

        return json.dumps(response, ensure_ascii=False)

    async def health_check(self) -> bool:
        """モックは常に正常。"""
        return True
