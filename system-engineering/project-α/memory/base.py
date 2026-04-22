"""
Diana - ベクトルストア抽象基底クラス

Phase 3でローカル完全移行時にもそのまま使える設計。
別のベクトルDBに差し替える場合は、このクラスを継承した新クラスを作成するだけ。
"""

from abc import ABC, abstractmethod


class VectorStore(ABC):
    """ベクトルストアの抽象基底クラス。

    すべてのベクトルDB実装（ChromaDB, FAISS等）はこのクラスを継承する。
    """

    @abstractmethod
    async def add_document(
        self, doc_id: str, text: str, metadata: dict | None = None
    ) -> None:
        """ドキュメントをベクトルDBに追加する。

        Args:
            doc_id: ドキュメントの一意識別子。
            text: ドキュメントのテキスト内容。
            metadata: 追加のメタデータ（ファイル名、日時等）。
        """
        pass

    @abstractmethod
    async def add_documents(
        self, doc_ids: list[str], texts: list[str], metadatas: list[dict] | None = None
    ) -> None:
        """複数ドキュメントをまとめてベクトルDBに追加する。

        Args:
            doc_ids: ドキュメントIDのリスト。
            texts: テキストのリスト。
            metadatas: メタデータのリスト。
        """
        pass

    @abstractmethod
    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        """クエリに類似するドキュメントを検索する。

        Args:
            query: 検索クエリ。
            top_k: 返却する最大件数。

        Returns:
            類似ドキュメントのリスト。各要素は以下のキーを持つ:
            - "id": ドキュメントID
            - "text": テキスト内容
            - "score": 類似度スコア
            - "metadata": メタデータ
        """
        pass

    @abstractmethod
    async def has_relevant_knowledge(
        self, query: str, threshold: float = 0.35
    ) -> tuple[bool, list[dict]]:
        """メタ認知用：クエリに対する関連知識が十分にあるか判定する。

        Args:
            query: 判定対象のクエリ。
            threshold: 類似度の閾値。

        Returns:
            (十分な知識があるか, 関連ドキュメントのリスト)
        """
        pass

    @abstractmethod
    async def get_stats(self) -> dict:
        """ベクトルDBの統計情報を返す。

        Returns:
            ドキュメント数等の統計情報。
        """
        pass
