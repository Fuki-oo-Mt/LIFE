"""
Diana - ダミー検索プロバイダー (Phase 1用)

Phase 1ではインターネット検索の代わりにダミーデータを返す。
ユーザーが「調べていいよ」と許可した場合に呼び出される。
"""

import logging
from datetime import datetime

from .base import SearchProvider

logger = logging.getLogger(__name__)


class DummySearchProvider(SearchProvider):
    """Phase 1用のダミー検索プロバイダー。

    実際のWeb検索の代わりにサンプルデータを返す。
    Phase 2以降で実際のSearch APIに差し替える想定。
    """

    async def search(self, query: str) -> str:
        """ダミーの検索結果を返す。

        Args:
            query: 検索クエリ。

        Returns:
            ダミーの検索結果テキスト。
        """
        logger.info(f"ダミー検索実行: '{query}'")

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        result = (
            f"【ダミー検索結果】\n"
            f"検索クエリ: {query}\n"
            f"取得日時: {timestamp}\n"
            f"\n"
            f"--- 検索結果サマリー ---\n"
            f"「{query}」に関する情報です。\n"
            f"これはPhase 1のダミーデータです。\n"
            f"Phase 2以降では実際のインターネット検索結果に置き換わります。\n"
            f"現在のところ、この検索クエリに対する詳細な情報は"
            f"ローカル知識ベースに登録されていませんでした。\n"
            f"今後、この情報が学習データとして保存されます。"
        )

        return result
