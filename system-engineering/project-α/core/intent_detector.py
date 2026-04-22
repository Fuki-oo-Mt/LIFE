"""
Diana - ユーザー意図検出モジュール

ユーザー入力からUI表示/非表示、許可応答等の意図を検出する。
キーワードマッチを優先し、LLMコール最小化を図る。
"""

import logging
import re

logger = logging.getLogger(__name__)


class IntentDetector:
    """ユーザー入力から意図を検出するクラス。"""

    # UI表示トリガーのキーワードパターン
    SHOW_PATTERNS: list[re.Pattern] = [
        re.compile(r"ディアナ.{0,5}(来て|きて|おいで)"),
        re.compile(r"(こっち|こちら).{0,5}(来て|きて|おいで)"),
        re.compile(r"顔.{0,5}(見せて|みせて)"),
        re.compile(r"(出て|でて).{0,5}(来て|きて)"),
        re.compile(r"(会いたい|あいたい)"),
        re.compile(r"(姿|すがた).{0,5}(見せて|みせて)"),
    ]

    # UI非表示トリガーのキーワードパターン
    HIDE_PATTERNS: list[re.Pattern] = [
        re.compile(r"(戻って|もどって).{0,5}(いい|良い)"),
        re.compile(r"バイバイ|ばいばい"),
        re.compile(r"(また|あと).{0,3}(ね|で)"),
        re.compile(r"(下がって|さがって).{0,5}(いい|良い)"),
        re.compile(r"(休んで|やすんで).{0,5}(いい|良い)"),
    ]

    # 許可応答のキーワード
    PERMISSION_GRANT_KEYWORDS: list[str] = [
        "いいよ",
        "いいです",
        "お願い",
        "おねがい",
        "調べて",
        "しらべて",
        "検索して",
        "はい",
        "うん",
        "OK",
        "ok",
        "オーケー",
        "頼む",
        "たのむ",
        "やって",
        "どうぞ",
    ]

    PERMISSION_DENY_KEYWORDS: list[str] = [
        "いらない",
        "だめ",
        "ダメ",
        "やめて",
        "大丈夫",
        "いい",  # 「もういい」等
        "結構",
        "けっこう",
        "いいえ",
        "ううん",
        "やめ",
    ]

    def detect_ui_visibility(self, user_input: str) -> str | None:
        """UI表示/非表示の意図を検出する。

        Args:
            user_input: ユーザーの入力テキスト。

        Returns:
            "show", "hide", またはNone（意図なし）。
        """
        for pattern in self.SHOW_PATTERNS:
            if pattern.search(user_input):
                logger.debug(f"UI表示意図を検出: '{user_input}'")
                return "show"

        for pattern in self.HIDE_PATTERNS:
            if pattern.search(user_input):
                logger.debug(f"UI非表示意図を検出: '{user_input}'")
                return "hide"

        return None

    def detect_permission_response(self, user_input: str) -> bool | None:
        """許可/拒否の応答を検出する。

        Args:
            user_input: ユーザーの入力テキスト。

        Returns:
            True（許可）, False（拒否）, None（判定不能）。
        """
        input_lower = user_input.strip().lower()

        # 許可キーワードチェック
        for keyword in self.PERMISSION_GRANT_KEYWORDS:
            if keyword in input_lower:
                logger.debug(f"許可応答を検出: '{user_input}'")
                return True

        # 拒否キーワードチェック
        for keyword in self.PERMISSION_DENY_KEYWORDS:
            if keyword in input_lower:
                logger.debug(f"拒否応答を検出: '{user_input}'")
                return False

        return None
