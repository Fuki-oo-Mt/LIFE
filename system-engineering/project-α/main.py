"""
Diana - エントリーポイント

asyncioメインループでCLI対話とフォルダ監視を並行稼働させる。
依存性注入（DI）パターンで全コンポーネントを組み立てる。
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# プロジェクトルートをsys.pathに追加
_project_root = str(Path(__file__).parent)
sys.path.insert(0, _project_root)

# ChromaDB/sentence-transformers のキャッシュをプロジェクト内に設定
_cache_dir = os.path.join(_project_root, "data", ".cache")
os.makedirs(_cache_dir, exist_ok=True)
os.environ.setdefault("CHROMA_CACHE_DIR", _cache_dir)
os.environ.setdefault("HF_HOME", _cache_dir)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", os.path.join(_cache_dir, "sentence_transformers"))

from config import DianaConfig
from core.orchestrator import DianaOrchestrator
from interface.cli import DianaCLI
from llm.gemini_provider import GeminiProvider
from llm.mock_provider import MockProvider
from memory.chroma_store import ChromaStore
from output.output_manager import OutputManager
from search.dummy_provider import DummySearchProvider
from watcher.folder_watcher import FolderWatcher

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="  %(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    """ディアナのメインエントリーポイント。"""

    # 1. 設定読込 & バリデーション
    config = DianaConfig()
    errors = config.validate()
    if errors:
        for err in errors:
            logger.error(f"設定エラー: {err}")
        logger.error("設定を確認してください。.env.template を参考に .env を作成してください。")
        sys.exit(1)

    # 2. データフォルダの自動生成
    config.ensure_directories()
    logger.info("データフォルダの確認・生成完了")

    # 3. コンポーネント初期化（DI: 依存性注入パターン）
    # --- LLMプロバイダー ---
    if config.llm_provider == "gemini":
        llm = GeminiProvider(
            api_key=config.gemini_api_key,
            model=config.gemini_model,
        )
    elif config.llm_provider == "mock":
        llm = MockProvider()
        logger.info("モックLLMプロバイダーで起動（オフラインモード）")
    else:
        # 将来のプロバイダー追加ポイント
        logger.error(f"未実装のLLMプロバイダー: {config.llm_provider}")
        sys.exit(1)

    # --- ベクトルストア ---
    memory = ChromaStore(
        persist_dir=config.vectordb_dir,
        embedding_model=config.embedding_model,
    )

    # --- 検索プロバイダー ---
    search = DummySearchProvider()

    # --- 出力管理 ---
    output_manager = OutputManager(
        workspace_dir=config.workspace_dir,
        persona_config=config.persona,
    )

    # --- オーケストレーター ---
    orchestrator = DianaOrchestrator(
        llm=llm,
        memory=memory,
        search=search,
        config=config,
    )

    # 4. フォルダ監視をバックグラウンドで起動
    loop = asyncio.get_event_loop()
    watcher = FolderWatcher(
        learning_dir=config.learning_dir,
        analyzed_dir=config.analyzed_dir,
        vector_store=memory,
        output_manager=output_manager,
        loop=loop,
    )
    watcher.start()

    # 5. CLI対話ループ（asyncio）を起動
    cli = DianaCLI(orchestrator, output_manager)
    try:
        await cli.run()
    finally:
        watcher.stop()
        logger.info("ディアナを終了します")


if __name__ == "__main__":
    asyncio.run(main())
