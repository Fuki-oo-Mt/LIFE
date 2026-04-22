"""
Diana - ChromaDB ベクトルストア実装

ChromaDBを使用したローカル永続化ベクトルストア。
sentence-transformersでembeddingを生成し、類似度検索を提供する。
"""

import asyncio
import logging
from pathlib import Path

import chromadb

from .base import VectorStore

logger = logging.getLogger(__name__)


class ChromaStore(VectorStore):
    """ChromaDBを使用したベクトルストア実装。"""

    def __init__(self, persist_dir: Path, embedding_model: str = "all-MiniLM-L6-v2"):
        """ChromaStoreを初期化する。

        Args:
            persist_dir: ChromaDBの永続化ディレクトリ。
            embedding_model: 使用するembeddingモデル名。
        """
        self.persist_dir = persist_dir
        self.persist_dir.mkdir(parents=True, exist_ok=True)

        # Embedding function をプロジェクト内キャッシュで初期化
        cache_dir = self.persist_dir.parent.parent / ".cache" / "sentence_transformers"
        cache_dir.mkdir(parents=True, exist_ok=True)

        try:
            from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

            self._embedding_fn = SentenceTransformerEmbeddingFunction(
                model_name=embedding_model,
                cache_folder=str(cache_dir),
            )
            logger.info(f"Embedding model 初期化完了: {embedding_model}")
        except Exception as e:
            logger.warning(
                f"Embedding model 初期化失敗（オフライン?）: {e}. "
                f"フォールバックembeddingを使用します。"
            )
            self._embedding_fn = None

        # ChromaDBクライアント初期化（永続化モード）
        self.client = chromadb.PersistentClient(path=str(self.persist_dir))

        # コレクション取得 or 作成（明示的なembedding function付き）
        # embedding_functionがNoneの場合（オフライン）はハッシュベースのフォールバックを使用
        ef = self._embedding_fn
        if ef is None:
            ef = self._create_fallback_embedding_fn()

        self.collection = self.client.get_or_create_collection(
            name="diana_knowledge",
            metadata={"description": "ディアナの知識ベース"},
            embedding_function=ef,
        )

        logger.info(
            f"ChromaDB初期化完了: {self.persist_dir} "
            f"(ドキュメント数: {self.collection.count()})"
        )

    @staticmethod
    def _create_fallback_embedding_fn():
        """ネットワーク不可時のフォールバックembedding function。

        ハッシュベースの簡易ベクトル化を行う。
        セマンティック検索精度は劣るが、パイプライン全体の動作テストは可能。
        """
        import hashlib

        from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

        class FallbackEmbedding(EmbeddingFunction):
            def __call__(self, input: Documents) -> Embeddings:
                embeddings = []
                for text in input:
                    # テキストのハッシュから擬似的な384次元ベクトルを生成
                    hash_bytes = hashlib.sha384(text.encode("utf-8")).digest()
                    vector = [float(b) / 255.0 for b in hash_bytes]
                    embeddings.append(vector)
                return embeddings

        logger.warning("フォールバックembedding使用中（セマンティック検索精度は低下します）")
        return FallbackEmbedding()

    async def add_document(
        self, doc_id: str, text: str, metadata: dict | None = None
    ) -> None:
        """ドキュメントをChromaDBに追加する。"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.collection.upsert(
                ids=[doc_id],
                documents=[text],
                metadatas=[metadata or {}],
            ),
        )
        logger.info(f"ドキュメント追加: {doc_id}")

    async def add_documents(
        self, doc_ids: list[str], texts: list[str], metadatas: list[dict] | None = None
    ) -> None:
        """複数ドキュメントをまとめてChromaDBに追加する。"""
        if not doc_ids:
            return

        metas = metadatas or [{} for _ in doc_ids]
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.collection.upsert(
                ids=doc_ids,
                documents=texts,
                metadatas=metas,
            ),
        )
        logger.info(f"ドキュメント一括追加: {len(doc_ids)}件")

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        """クエリに類似するドキュメントを検索する。"""
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: self.collection.query(
                query_texts=[query],
                n_results=min(top_k, self.collection.count() or 1),
            ),
        )

        documents = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i] if results["distances"] else 0
                # ChromaDBのdistanceは小さいほど類似度が高い
                # 類似度スコアに変換（1 - distance で正規化）
                score = max(0, 1 - distance)
                documents.append(
                    {
                        "id": doc_id,
                        "text": results["documents"][0][i],
                        "score": score,
                        "metadata": (
                            results["metadatas"][0][i] if results["metadatas"] else {}
                        ),
                    }
                )

        return documents

    async def has_relevant_knowledge(
        self, query: str, threshold: float = 0.35
    ) -> tuple[bool, list[dict]]:
        """メタ認知：関連知識が十分にあるか判定する。"""
        if self.collection.count() == 0:
            return False, []

        results = await self.search(query, top_k=3)

        # 閾値以上の類似度を持つドキュメントがあるか
        relevant = [doc for doc in results if doc["score"] >= threshold]
        has_knowledge = len(relevant) > 0

        logger.debug(
            f"メタ認知判定: query='{query[:50]}...' "
            f"has_knowledge={has_knowledge} "
            f"top_score={results[0]['score'] if results else 0:.3f}"
        )

        return has_knowledge, relevant

    async def get_stats(self) -> dict:
        """ChromaDBの統計情報を返す。"""
        return {
            "total_documents": self.collection.count(),
            "persist_dir": str(self.persist_dir),
            "collection_name": self.collection.name,
        }
