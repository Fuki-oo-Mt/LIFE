"""
Diana - メタ認知モジュール

自己評価：ローカル知識ベースで回答可能かを判定する。
知識不足の場合は推測せず、ユーザーに許可を求める。
"""

import logging

from memory.base import VectorStore

logger = logging.getLogger(__name__)


class Metacognition:
    """ディアナの自己評価（メタ認知）を担当するクラス。"""

    def __init__(self, vector_store: VectorStore, threshold: float = 0.35):
        """メタ認知モジュールを初期化する。

        Args:
            vector_store: ベクトルストアインスタンス。
            threshold: 知識充足判定の類似度閾値。
        """
        self.vector_store = vector_store
        self.threshold = threshold

    async def evaluate(self, query: str) -> dict:
        """クエリに対する知識充足度を評価する。

        Args:
            query: ユーザーの質問テキスト。

        Returns:
            評価結果の辞書:
            - "has_knowledge": 知識があるか
            - "confidence": 確信度（0.0-1.0）
            - "relevant_context": 関連コンテキスト文字列
            - "sources": 参照元情報
        """
        has_knowledge, relevant_docs = await self.vector_store.has_relevant_knowledge(
            query, threshold=self.threshold
        )

        if not relevant_docs:
            return {
                "has_knowledge": False,
                "confidence": 0.0,
                "relevant_context": "",
                "sources": [],
            }

        # 関連ドキュメントをコンテキスト文字列に結合
        context_parts = []
        sources = []
        for doc in relevant_docs:
            context_parts.append(doc["text"])
            if doc.get("metadata", {}).get("source"):
                sources.append(doc["metadata"]["source"])

        context = "\n\n".join(context_parts)
        top_score = relevant_docs[0]["score"] if relevant_docs else 0.0

        logger.info(
            f"メタ認知評価: has_knowledge={has_knowledge}, "
            f"confidence={top_score:.3f}, docs={len(relevant_docs)}"
        )

        return {
            "has_knowledge": has_knowledge,
            "confidence": top_score,
            "relevant_context": context,
            "sources": sources,
        }
