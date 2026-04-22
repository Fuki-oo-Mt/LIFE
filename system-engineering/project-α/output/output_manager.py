"""
Diana - 出力管理モジュール

DianaResponseをJSON整形し、ファイル出力と標準出力を管理する。
Phase 4ではWebSocket/OSCエミッターを追加可能な設計。
"""

import json
import logging
from datetime import datetime
from pathlib import Path

import yaml
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from .schema import DianaResponse

logger = logging.getLogger(__name__)


class OutputManager:
    """ディアナの応答出力を管理するクラス。"""

    def __init__(self, workspace_dir: Path, persona_config: dict | None = None):
        """OutputManagerを初期化する。

        Args:
            workspace_dir: 03_Workspaceフォルダのパス。
            persona_config: ペルソナ設定（感情アイコン等）。
        """
        self.workspace_dir = workspace_dir
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        self.console = Console()

        # ペルソナ設定から表示情報を取得
        self.emotion_icons = (persona_config or {}).get(
            "emotion_icons",
            {
                "happy": "😊",
                "thinking": "🤔",
                "neutral": "😌",
                "apologetic": "🥺",
                "surprised": "😲",
            },
        )
        self.action_labels = (persona_config or {}).get(
            "action_labels",
            {
                "nodding": "* こくこく *",
                "looking_around": "* きょろきょろ *",
                "typing": "* かたかた *",
                "smiling": "* にっこり *",
                "tilting_head": "* こてん *",
            },
        )

    def display(self, response: DianaResponse) -> None:
        """応答をリッチなCLI表示で出力する。

        Args:
            response: ディアナの応答データ。
        """
        # 感情アイコンとアクション
        emotion_icon = self.emotion_icons.get(response.emotion, "😌")
        action_label = self.action_labels.get(response.action, "")

        # アクション表示
        if action_label:
            self.console.print(
                f"  [dim italic]{action_label}[/dim italic]"
            )

        # メイン応答テキスト
        header = f"{emotion_icon} ディアナ"
        panel = Panel(
            Text(response.text, style="white"),
            title=header,
            title_align="left",
            border_style="bright_magenta",
            padding=(0, 2),
        )
        self.console.print(panel)

        # 許可要求の場合は追加表示
        if response.need_permission:
            self.console.print(
                "  [yellow]💡 許可が必要です。「いいよ」または「やめて」で応答してください。[/yellow]"
            )

        # UI表示変更の通知
        if response.ui_visibility == "show":
            self.console.print(
                "  [cyan]🪟 [Phase 4] 3Dアバター表示トリガー発火[/cyan]"
            )

    def save_to_file(self, response: DianaResponse) -> Path:
        """応答をJSONファイルとして03_Workspaceに保存する。

        Args:
            response: ディアナの応答データ。

        Returns:
            保存先のファイルパス。
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"diana_response_{timestamp}.json"
        filepath = self.workspace_dir / filename

        # 純粋なJSON文字列（マークダウン修飾なし）
        json_str = response.model_dump_json(indent=2, ensure_ascii=False)

        filepath.write_text(json_str, encoding="utf-8")
        logger.debug(f"応答JSON保存: {filepath}")

        return filepath

    def emit(self, response: DianaResponse) -> Path:
        """応答を表示し、ファイルに保存する（メインの出力メソッド）。

        Args:
            response: ディアナの応答データ。

        Returns:
            保存先のファイルパス。
        """
        self.display(response)
        return self.save_to_file(response)

    def display_system_message(self, message: str, style: str = "dim") -> None:
        """システムメッセージを表示する（学習完了報告等）。

        Args:
            message: 表示するメッセージ。
            style: richのスタイル文字列。
        """
        self.console.print(f"  [{style}]📋 {message}[/{style}]")
