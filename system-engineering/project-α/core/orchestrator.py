"""
Diana - メインオーケストレーター

全コンポーネントを協調させ、ユーザー入力に対する処理フローを制御する。
会話履歴管理、メタ認知→LLM呼出→出力のパイプラインを統括。
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from config import DianaConfig
from core.intent_detector import IntentDetector
from core.metacognition import Metacognition
from llm.base import LLMProvider
from memory.base import VectorStore
from output.schema import DianaResponse
from search.base import SearchProvider

logger = logging.getLogger(__name__)


class DianaOrchestrator:
    """ディアナのメイン制御フローを管理するオーケストレーター。"""

    def __init__(
        self,
        llm: LLMProvider,
        memory: VectorStore,
        search: SearchProvider,
        config: DianaConfig,
    ):
        """オーケストレーターを初期化する。

        Args:
            llm: LLMプロバイダー。
            memory: ベクトルストア。
            search: 検索プロバイダー。
            config: アプリケーション設定。
        """
        self.llm = llm
        self.memory = memory
        self.search = search
        self.config = config
        self.intent_detector = IntentDetector()
        self.metacognition = Metacognition(memory, config.knowledge_threshold)

        # 会話履歴
        self.conversation_history: list[dict] = []
        self.max_history = config.max_conversation_turns

        # 許可要求の待機状態
        self._awaiting_permission = False
        self._pending_query: str = ""

    # 情報検索が必要な質問パターン
    _KNOWLEDGE_QUERY_PATTERNS = [
        "って何", "とは", "について", "教えて", "知ってる",
        "わかる？", "どうやって", "なぜ", "どうして", "いつ",
        "どこ", "誰が", "何が", "どのくらい", "方法",
        "やり方", "仕組み", "意味", "違い", "比較",
        "おすすめ", "メリット", "デメリット", "原因", "理由",
    ]

    def _is_knowledge_query(self, user_input: str) -> bool:
        """入力が知識検索を必要とする質問かどうかを判定する。

        挨拶・雑談・感情表現等はLLMに直接渡し、
        具体的な情報を求める質問のみメタ認知を通す。
        """
        return any(pattern in user_input for pattern in self._KNOWLEDGE_QUERY_PATTERNS)

    async def process_input(self, user_input: str) -> DianaResponse:
        """ユーザー入力を処理し、DianaResponseを返す。

        メイン制御フロー:
        1. 許可応答の処理（待機中の場合）
        2. UI意図検出
        3. 入力分類（一般会話 or 知識クエリ）
        4. 知識クエリの場合: メタ認知 → LLM呼出 or 許可要求
        5. 一般会話の場合: LLMに直接渡す
        6. DianaResponse生成

        Args:
            user_input: ユーザーの入力テキスト。

        Returns:
            ディアナの応答データ。
        """
        user_input = user_input.strip()
        if not user_input:
            return DianaResponse(
                ui_visibility="hide",
                need_permission=False,
                emotion="neutral",
                action="tilting_head",
                text="ん？なにか言った？",
                internal_thought="空の入力を受信",
            )

        # --- 許可応答の処理 ---
        if self._awaiting_permission:
            return await self._handle_permission_response(user_input)

        # --- UI意図検出 ---
        ui_intent = self.intent_detector.detect_ui_visibility(user_input)

        # --- 入力分類: 知識クエリか一般会話か ---
        if self._is_knowledge_query(user_input):
            # 知識クエリ → メタ認知で知識充足判定
            evaluation = await self.metacognition.evaluate(user_input)

            if evaluation["has_knowledge"]:
                # ローカル知識で回答可能 → コンテキスト付きLLM呼出
                response = await self._generate_with_context(
                    user_input, evaluation["relevant_context"], ui_intent
                )
            else:
                # 知識不足 → 許可要求
                response = self._request_permission(user_input, ui_intent)
        else:
            # 一般会話（挨拶・雑談等）→ LLMに直接渡す
            # ただし知識ベースに関連情報があれば補足コンテキストとして使う
            evaluation = await self.metacognition.evaluate(user_input)
            context = evaluation.get("relevant_context", "")
            response = await self._generate_with_context(
                user_input, context, ui_intent
            )

        # 会話履歴に追加
        self._add_to_history("user", user_input)
        self._add_to_history("model", response.text)

        return response

    async def _generate_with_context(
        self, user_input: str, context: str, ui_intent: str | None
    ) -> DianaResponse:
        """コンテキスト付きでLLMを呼び出し、応答を生成する。"""
        system_prompt = self.config.get_system_prompt()

        raw_response = await self.llm.generate(
            system_prompt=system_prompt,
            user_message=user_input,
            context=context,
            conversation_history=self.conversation_history,
        )

        response = self._parse_response(raw_response)

        # UI意図が明示的に検出された場合は上書き
        if ui_intent:
            response.ui_visibility = ui_intent

        return response

    def _request_permission(
        self, user_input: str, ui_intent: str | None
    ) -> DianaResponse:
        """知識不足のため、インターネット検索の許可を要求する。"""
        self._awaiting_permission = True
        self._pending_query = user_input

        return DianaResponse(
            ui_visibility=ui_intent or "hide",
            need_permission=True,
            emotion="apologetic",
            action="tilting_head",
            text=(
                f"ごめんね、その情報はわたしの中にはないみたい…。"
                f"インターネットで調べてみてもいい？"
            ),
            internal_thought=(
                f"ローカル知識ベースに'{user_input[:50]}'に関する十分な情報がない。"
                f"ユーザーに検索許可を要求。"
            ),
        )

    async def _handle_permission_response(self, user_input: str) -> DianaResponse:
        """許可/拒否応答を処理する。"""
        permission = self.intent_detector.detect_permission_response(user_input)

        if permission is True:
            # 許可 → 検索実行
            self._awaiting_permission = False
            return await self._execute_search_and_learn(self._pending_query)
        elif permission is False:
            # 拒否
            self._awaiting_permission = False
            self._pending_query = ""
            return DianaResponse(
                ui_visibility="hide",
                need_permission=False,
                emotion="neutral",
                action="nodding",
                text="わかったよ！じゃあ、わたしの知ってる範囲で頑張るね！",
                internal_thought="ユーザーが検索を拒否。ローカル知識のみで対応。",
            )
        else:
            # 判定不能 → もう一度確認
            return DianaResponse(
                ui_visibility="hide",
                need_permission=True,
                emotion="thinking",
                action="tilting_head",
                text=(
                    "えっと…インターネットで調べてもいい？"
                    "「いいよ」か「やめて」って教えてね！"
                ),
                internal_thought="許可応答を判定できなかった。再確認。",
            )

    async def _execute_search_and_learn(self, query: str) -> DianaResponse:
        """検索を実行し、結果を学習データとして保存する。"""
        logger.info(f"検索実行: '{query}'")

        # 1. 検索実行
        search_result = await self.search.search(query)

        # 2. 検索結果を01_Learningに保存（自律学習トリガー）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"search_{timestamp}.txt"
        learning_path = self.config.learning_dir / filename
        learning_path.write_text(
            f"# 検索クエリ: {query}\n\n{search_result}",
            encoding="utf-8",
        )
        logger.info(f"検索結果を01_Learningに保存: {filename}")

        # 3. 検索結果をコンテキストとしてLLM再呼出
        system_prompt = self.config.get_system_prompt()
        raw_response = await self.llm.generate(
            system_prompt=system_prompt,
            user_message=query,
            context=search_result,
            conversation_history=self.conversation_history,
        )

        response = self._parse_response(raw_response)
        response.internal_thought = (
            f"検索完了: '{query}' → 結果をローカル知識に保存（{filename}）。"
            f"機能Cのフォルダ監視が自動で学習処理を実行する。"
        )

        self._pending_query = ""
        return response

    def _parse_response(self, raw_json: str) -> DianaResponse:
        """LLMのJSON出力をDianaResponseにパースする。"""
        try:
            # JSON文字列をクリーニング
            cleaned = raw_json.strip()
            # マークダウンコードブロックの除去
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])

            data = json.loads(cleaned)
            return DianaResponse(**data)

        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"JSON解析失敗、フォールバック適用: {e}")
            # 生テキストをそのまま応答として使用
            return DianaResponse(
                ui_visibility="hide",
                need_permission=False,
                emotion="neutral",
                action="smiling",
                text=raw_json if raw_json else "うーん、ちょっとうまく考えられなかったの…",
                internal_thought=f"JSONパースエラー: {str(e)}",
            )

    def _add_to_history(self, role: str, content: str) -> None:
        """会話履歴に追加する（最大ターン数を超えたら古いものを削除）。"""
        self.conversation_history.append({"role": role, "content": content})

        # 最大ターン数の2倍（user + model で1ターン）を超えたら古いものを削除
        max_entries = self.max_history * 2
        if len(self.conversation_history) > max_entries:
            self.conversation_history = self.conversation_history[-max_entries:]

    async def get_status(self) -> dict:
        """システムの状態情報を返す。"""
        memory_stats = await self.memory.get_stats()
        return {
            "llm_provider": self.config.llm_provider,
            "memory": memory_stats,
            "conversation_turns": len(self.conversation_history) // 2,
            "awaiting_permission": self._awaiting_permission,
        }
