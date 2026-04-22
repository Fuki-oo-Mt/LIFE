"""
Diana - CLI対話インターフェース

asyncioベースの対話ループ。richによるリッチ表示。
"""

import asyncio
import logging

from rich.console import Console
from rich.text import Text

from core.orchestrator import DianaOrchestrator
from output.output_manager import OutputManager

logger = logging.getLogger(__name__)


class DianaCLI:
    """CLI対話インターフェース。"""

    def __init__(self, orchestrator: DianaOrchestrator, output_manager: OutputManager):
        self.orchestrator = orchestrator
        self.output_manager = output_manager
        self.console = Console()
        self._running = False

    async def run(self) -> None:
        """メイン対話ループ。"""
        self._running = True
        self._print_welcome()

        while self._running:
            try:
                user_input = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: input("\n 🌙 あなた > ")
                )
                user_input = user_input.strip()

                if not user_input:
                    continue

                if user_input.lower() in ("exit", "quit", "終了", "おわり"):
                    self._print_goodbye()
                    self._running = False
                    break

                if user_input.lower() in ("status", "ステータス"):
                    await self._show_status()
                    continue

                response = await self.orchestrator.process_input(user_input)
                self.output_manager.emit(response)

            except EOFError:
                self._print_goodbye()
                break
            except KeyboardInterrupt:
                self.console.print("\n")
                self._print_goodbye()
                break
            except Exception as e:
                logger.error(f"対話ループエラー: {e}")
                self.console.print(f"  [red]エラーが発生しました: {e}[/red]")

    def _print_welcome(self) -> None:
        """起動メッセージ。"""
        self.console.print()
        self.console.print("  [bright_magenta]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/]")
        self.console.print("  [bright_magenta]  ✨ Diana - AI Partner System ✨  [/]")
        self.console.print("  [bright_magenta]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/]")
        self.console.print()
        self.console.print("  [dim]コマンド: exit/quit=終了, status=状態表示[/dim]")
        self.console.print("  [dim]01_Learning にファイルを追加すると自動学習します[/dim]")
        self.console.print()

    def _print_goodbye(self) -> None:
        """終了メッセージ。"""
        self.console.print()
        self.console.print("  [bright_magenta]😊 ディアナ: またね！待ってるよ！[/]")
        self.console.print()

    async def _show_status(self) -> None:
        """システム状態表示。"""
        status = await self.orchestrator.get_status()
        self.console.print("\n  [cyan]📊 システム状態[/cyan]")
        self.console.print(f"  [dim]LLMプロバイダー: {status['llm_provider']}[/dim]")
        self.console.print(
            f"  [dim]知識ベース: {status['memory'].get('total_documents', 0)}件[/dim]"
        )
        self.console.print(
            f"  [dim]会話ターン: {status['conversation_turns']}[/dim]"
        )
