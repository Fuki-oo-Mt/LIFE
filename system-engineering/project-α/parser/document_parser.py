"""
Diana - ドキュメントパーサー

各種ファイル形式からテキストを抽出し、
ベクトルDB登録に適したチャンクに分割する。
"""

import hashlib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# サポートするファイル拡張子
SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf"}

# チャンク分割の設定
DEFAULT_CHUNK_SIZE = 500  # 文字数
DEFAULT_CHUNK_OVERLAP = 50  # オーバーラップ文字数


def is_supported_file(filepath: Path) -> bool:
    """サポートされているファイル形式かチェックする。

    Args:
        filepath: チェック対象のファイルパス。

    Returns:
        サポートされている場合True。
    """
    return filepath.suffix.lower() in SUPPORTED_EXTENSIONS


def extract_text(filepath: Path) -> str:
    """ファイルからテキストを抽出する。

    Args:
        filepath: 読み込むファイルのパス。

    Returns:
        抽出されたテキスト。

    Raises:
        ValueError: サポートされていないファイル形式の場合。
    """
    suffix = filepath.suffix.lower()

    if suffix in (".txt", ".md"):
        return _extract_text_file(filepath)
    elif suffix == ".pdf":
        return _extract_pdf(filepath)
    else:
        raise ValueError(f"未対応のファイル形式: {suffix}")


def _extract_text_file(filepath: Path) -> str:
    """テキストファイル(.txt, .md)からテキストを抽出する。"""
    try:
        return filepath.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # UTF-8で読めない場合はShift-JISを試行
        try:
            return filepath.read_text(encoding="shift_jis")
        except Exception:
            logger.error(f"テキスト読込失敗（エンコーディング不明）: {filepath}")
            return ""


def _extract_pdf(filepath: Path) -> str:
    """PDFファイルからテキストを抽出する。"""
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(str(filepath))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n".join(text_parts)
    except ImportError:
        logger.error("PyPDF2がインストールされていません。PDF読込をスキップします。")
        return ""
    except Exception as e:
        logger.error(f"PDF読込エラー: {filepath} - {e}")
        return ""


def split_into_chunks(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """テキストをチャンクに分割する。

    Args:
        text: 分割対象のテキスト。
        chunk_size: 各チャンクの最大文字数。
        chunk_overlap: チャンク間のオーバーラップ文字数。

    Returns:
        チャンクのリスト。
    """
    if not text or not text.strip():
        return []

    text = text.strip()

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        # 文の途中で切れないよう、最後の句読点で区切る
        if end < len(text):
            for sep in ["。", ".\n", "\n\n", "\n", "、", ". "]:
                last_sep = chunk.rfind(sep)
                if last_sep > chunk_size // 2:
                    chunk = chunk[: last_sep + len(sep)]
                    end = start + len(chunk)
                    break

        chunks.append(chunk.strip())
        start = end - chunk_overlap

    return [c for c in chunks if c]


def generate_doc_id(filepath: Path, chunk_index: int = 0) -> str:
    """ドキュメントIDを生成する。

    Args:
        filepath: ファイルパス。
        chunk_index: チャンクのインデックス。

    Returns:
        一意のドキュメントID。
    """
    file_hash = hashlib.md5(str(filepath).encode()).hexdigest()[:8]
    return f"{filepath.stem}_{file_hash}_chunk{chunk_index}"
