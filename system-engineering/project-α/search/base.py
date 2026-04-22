"""
Diana - 検索プロバイダー抽象基底クラス

Phase 2以降で実際のWeb検索に差し替え可能。
"""

from abc import ABC, abstractmethod


class SearchProvider(ABC):
    """外部検索プロバイダーの抽象基底クラス。"""

    @abstractmethod
    async def search(self, query: str) -> str:
        """検索クエリを実行し、結果のサマリーテキストを返す。

        Args:
            query: 検索クエリ文字列。

        Returns:
            検索結果の要約テキスト。
        """
        pass
