"""
Diana - フォルダ監視モジュール

watchdogを使用して01_Learningフォルダを常時監視し、
ファイル追加を検知して自律学習パイプラインを起動する。
"""

import asyncio
import logging
import shutil
import time
from datetime import datetime
from pathlib import Path

from watchdog.events import FileCreatedEvent, FileSystemEventHandler
from watchdog.observers import Observer

from memory.base import VectorStore
from output.output_manager import OutputManager
from output.schema import DianaResponse
from parser.document_parser import (
    extract_text,
    generate_doc_id,
    is_supported_file,
    split_into_chunks,
)

logger = logging.getLogger(__name__)


class LearningHandler(FileSystemEventHandler):
    """01_Learningフォルダのファイル作成イベントを処理するハンドラ。"""

    def __init__(
        self,
        vector_store: VectorStore,
        output_manager: OutputManager,
        analyzed_dir: Path,
        loop: asyncio.AbstractEventLoop,
    ):
        """ハンドラを初期化する。

        Args:
            vector_store: ベクトルストアインスタンス。
            output_manager: 出力管理インスタンス。
            analyzed_dir: 02_Analyzedフォルダのパス。
            loop: asyncioイベントループ（非同期処理の実行用）。
        """
        super().__init__()
        self.vector_store = vector_store
        self.output_manager = output_manager
        self.analyzed_dir = analyzed_dir
        self.loop = loop
        self._processing = set()  # 処理中のファイルパス

    def on_created(self, event: FileCreatedEvent) -> None:
        """ファイル作成イベントのハンドラ。"""
        if event.is_directory:
            return

        filepath = Path(event.src_path)

        # 隠しファイルやテンポラリファイルを除外
        if filepath.name.startswith(".") or filepath.name.startswith("~"):
            return

        # サポートされていない形式を除外
        if not is_supported_file(filepath):
            logger.debug(f"非対応形式をスキップ: {filepath.name}")
            return

        # 重複処理を防止
        if str(filepath) in self._processing:
            return
        self._processing.add(str(filepath))

        logger.info(f"新しいファイルを検知: {filepath.name}")

        # 非同期処理をイベントループにスケジュール
        asyncio.run_coroutine_threadsafe(
            self._process_file(filepath), self.loop
        )

    async def _process_file(self, filepath: Path) -> None:
        """ファイルを読み込み、学習し、移動する。

        Args:
            filepath: 処理対象のファイルパス。
        """
        try:
            # ファイルの書き込み完了を待つ（安定待ち）
            await self._wait_for_stable(filepath)

            if not filepath.exists():
                logger.warning(f"ファイルが見つかりません: {filepath}")
                return

            # 1. テキスト抽出
            text = extract_text(filepath)
            if not text.strip():
                logger.warning(f"テキスト抽出結果が空: {filepath.name}")
                return

            # 2. チャンク分割
            chunks = split_into_chunks(text)
            logger.info(f"チャンク分割完了: {filepath.name} → {len(chunks)}チャンク")

            # 3. ベクトルDB登録
            doc_ids = [generate_doc_id(filepath, i) for i in range(len(chunks))]
            metadatas = [
                {
                    "source": filepath.name,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "learned_at": datetime.now().isoformat(),
                }
                for i in range(len(chunks))
            ]
            await self.vector_store.add_documents(doc_ids, chunks, metadatas)

            # 4. ファイルを02_Analyzedへ移動
            dest = self.analyzed_dir / filepath.name
            # 同名ファイルが存在する場合はタイムスタンプ付加
            if dest.exists():
                stem = filepath.stem
                suffix = filepath.suffix
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                dest = self.analyzed_dir / f"{stem}_{timestamp}{suffix}"

            shutil.move(str(filepath), str(dest))
            logger.info(f"ファイル移動完了: {filepath.name} → 02_Analyzed/")

            # 5. 学習完了の自発的報告
            report = DianaResponse(
                ui_visibility="hide",
                need_permission=False,
                emotion="happy",
                action="nodding",
                text=(
                    f"あっ、新しいお勉強のデータが来たの！"
                    f"「{filepath.name}」をちゃんと読んで覚えたよ！"
                    f"（{len(chunks)}個のチャンクに分けて記憶したの）"
                ),
                internal_thought=(
                    f"自律学習完了: {filepath.name}, "
                    f"{len(chunks)}チャンク, ベクトルDB登録済み, "
                    f"02_Analyzedへ移動完了"
                ),
            )
            self.output_manager.emit(report)

        except Exception as e:
            logger.error(f"ファイル処理エラー: {filepath.name} - {e}")
            # エラー報告
            error_report = DianaResponse(
                ui_visibility="hide",
                need_permission=False,
                emotion="apologetic",
                action="tilting_head",
                text=(
                    f"ごめんね、「{filepath.name}」を読もうとしたんだけど、"
                    f"うまくいかなかったの…"
                ),
                internal_thought=f"ファイル処理エラー: {filepath.name} - {str(e)}",
            )
            self.output_manager.emit(error_report)

        finally:
            self._processing.discard(str(filepath))

    async def _wait_for_stable(
        self, filepath: Path, timeout: float = 10.0, interval: float = 0.5
    ) -> None:
        """ファイルの書き込みが完了するまで待つ。

        Args:
            filepath: 待機対象のファイル。
            timeout: 最大待機時間（秒）。
            interval: チェック間隔（秒）。
        """
        start = time.time()
        last_size = -1

        while time.time() - start < timeout:
            if not filepath.exists():
                await asyncio.sleep(interval)
                continue

            current_size = filepath.stat().st_size
            if current_size == last_size and current_size > 0:
                return  # サイズが安定した
            last_size = current_size
            await asyncio.sleep(interval)


class FolderWatcher:
    """01_Learningフォルダの監視を管理するクラス。"""

    def __init__(
        self,
        learning_dir: Path,
        analyzed_dir: Path,
        vector_store: VectorStore,
        output_manager: OutputManager,
        loop: asyncio.AbstractEventLoop,
    ):
        """FolderWatcherを初期化する。

        Args:
            learning_dir: 01_Learningフォルダのパス。
            analyzed_dir: 02_Analyzedフォルダのパス。
            vector_store: ベクトルストアインスタンス。
            output_manager: 出力管理インスタンス。
            loop: asyncioイベントループ。
        """
        self.learning_dir = learning_dir
        self.observer = Observer()
        self.handler = LearningHandler(
            vector_store=vector_store,
            output_manager=output_manager,
            analyzed_dir=analyzed_dir,
            loop=loop,
        )

    def start(self) -> None:
        """フォルダ監視を開始する（バックグラウンドスレッド）。"""
        self.observer.schedule(
            self.handler, str(self.learning_dir), recursive=False
        )
        self.observer.daemon = True
        self.observer.start()
        logger.info(f"フォルダ監視開始: {self.learning_dir}")

    def stop(self) -> None:
        """フォルダ監視を停止する。"""
        self.observer.stop()
        self.observer.join(timeout=5)
        logger.info("フォルダ監視停止")
