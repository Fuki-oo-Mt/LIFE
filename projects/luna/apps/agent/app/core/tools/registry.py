"""ツール・レジストリ。

自律エージェントが呼び出せる「業務の手足」を登録する。MVPでは時刻取得と
Web検索スタブを用意。本番では web_search を実検索API/MCPサーバへ差し替える
（インターフェースは固定なのでエージェント側の改修は不要）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Awaitable, Callable, Optional


@dataclass
class ToolResult:
    ok: bool
    summary: str
    data: dict = field(default_factory=dict)


@dataclass
class Tool:
    name: str
    description: str
    run: Callable[[dict], Awaitable[ToolResult]]


async def _get_time(args: dict) -> ToolResult:
    now = datetime.now()
    stamp = now.strftime("%Y-%m-%d %H:%M:%S")
    return ToolResult(ok=True, summary=f"現在時刻は {stamp} です。", data={"now": stamp})


async def _web_search(args: dict) -> ToolResult:
    """Web検索の足場（スタブ）。

    実APIキー無しでMVPを回すため、ここでは検索を実行したという構造化結果を返す。
    本番では SerpAPI / Tavily / Brave Search / MCP検索サーバ等へ接続する。
    """
    query = (args or {}).get("query", "").strip()
    if not query:
        return ToolResult(ok=False, summary="検索クエリが空でした。", data={})
    return ToolResult(
        ok=True,
        summary=f"「{query}」を検索しました（MVPスタブ）。本番では実検索結果が入ります。",
        data={"query": query, "results": [], "stub": True},
    )


REGISTRY: dict[str, Tool] = {
    "get_time": Tool(
        name="get_time",
        description="現在の日付と時刻を取得する。",
        run=_get_time,
    ),
    "web_search": Tool(
        name="web_search",
        description="Webを検索して最新情報を得る。args: {query: string}",
        run=_web_search,
    ),
}


def get_tool(name: str) -> Optional[Tool]:
    return REGISTRY.get(name)
