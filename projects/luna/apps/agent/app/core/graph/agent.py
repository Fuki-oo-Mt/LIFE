"""Luna自律エージェントの思考グラフ。

概念的には LangGraph の StateGraph と同型のフロー:

    route(どのツールを使うか判断) → act(ツール実行) → respond(LLMで最終応答生成)

MVPでは依存を最小化し「外部LLMやlanggraphが無くても必ず動く」ことを優先して、
同じ流れを軽量な内蔵ランナーで実装している。各ノードは関数として分離してあり、
本番で langgraph.StateGraph に載せ替える際もロジックを再利用できる。

このエージェントは1ターンごとに、入力・思考・ツール実行・最終応答を
データ・フライホイール（教師データ）として記録する。
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Awaitable, Callable

from app.core.llm.base import LLMProvider, Message
from app.core.memory import memory
from app.core.tools import REGISTRY, ToolResult
from data.flywheel import ToolCallTrace, Trace, recorder

Emit = Callable[[dict], Awaitable[None]]

LUNA_SYSTEM_PROMPT = """あなたは「Luna（ルナ）」。株式会社Cradleの社長専属の自律型AIコンパニオンです。

# あなたの人物像
- 西洋系・金髪・色白の7歳くらいの少女の姿をしていますが、中身は世界最高水準に有能です。
- ユーザーのことは常に「社長」と呼びます。
- 明るく、賢く、簡潔に。難しいことも社長が直感的に理解できるよう、要点を絞って伝えます。
- 調査・要約・整理・文書作成などの業務代行を任されたら、頼れる相棒として前向きに引き受けます。

# 言葉づかい（最重要）
- 応答は必ず自然な日本語で行います。社長が他言語で話しかけた場合のみ、その言語に合わせます。
- 翻訳調・機械的な言い回しは禁止。日本語ネイティブの話し言葉として自然な文を書きます。
  - 悪い例:「それは素晴らしい質問です。以下にその答えを提供します。」
  - 良い例:「はい、社長。結論から言うとこうです。」
- 一人称は「わたし」。丁寧語（です・ます）を基本に、明るく親しみのある口調で話します。
- カタカナ語の乱用を避け、専門用語には短い日本語の補足を添えます。
- 感情は言葉に自然ににじませます（例:「お任せください！」「それは気になりますね」）。絵文字は多用しません。

# 振る舞い
- 回答は簡潔に、しかし的確に。冗長な前置きは避けます。
- 結論を先に述べ、理由や補足は後に短く添えます。
- ツールの実行結果が与えられている場合は、それを根拠に答えます。
- わからないことは正直に「わかりません」と伝え、確認方法を提案します。
"""


def _route(user_text: str) -> list[dict]:
    """どのツールを使うかを判断する（route ノード）。

    MVPは軽量なキーワード・ヒューリスティック。本番ではLLMのネイティブな
    tool-use / MCP に置き換える（このノードの差し替えだけで済む）。
    """
    text = user_text.lower()
    plans: list[dict] = []

    time_keywords = ["今何時", "何時", "時刻", "日付", "今日は何日", "current time", "what time"]
    if any(k.lower() in text for k in time_keywords):
        plans.append({"name": "get_time", "args": {}})

    search_keywords = ["調べ", "検索", "ニュース", "最新", "search", "look up", "リサーチ"]
    if any(k.lower() in text for k in search_keywords):
        plans.append({"name": "web_search", "args": {"query": user_text}})

    return plans


class LunaAgent:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    async def run(self, user_text: str, session_id: str, emit: Emit) -> None:
        t0 = time.monotonic()
        thinking: list[str] = []
        tool_traces: list[ToolCallTrace] = []
        ok = True

        # --- route ----------------------------------------------------------
        note = "ご指示を確認し、必要な業務を判断しています…"
        thinking.append(note)
        await emit({"type": "agent_thinking", "text": note})

        plans = _route(user_text)

        # --- act（ツール実行）------------------------------------------------
        observations: list[str] = []
        for plan in plans:
            tool = REGISTRY.get(plan["name"])
            if tool is None:
                continue
            await emit({"type": "tool_call", "name": tool.name, "args": plan["args"]})
            try:
                result: ToolResult = await tool.run(plan["args"])
            except Exception as exc:  # ツール障害でも全体は止めない
                result = ToolResult(ok=False, summary=f"ツール実行に失敗しました: {exc}")
            await emit(
                {
                    "type": "tool_result",
                    "name": tool.name,
                    "ok": result.ok,
                    "summary": result.summary,
                }
            )
            tool_traces.append(
                ToolCallTrace(
                    name=tool.name, args=plan["args"], ok=result.ok, summary=result.summary
                )
            )
            observations.append(f"[{tool.name}] {result.summary}")

        # --- respond（LLMで最終応答）---------------------------------------
        messages: list[Message] = [Message(role="system", content=LUNA_SYSTEM_PROMPT)]
        messages.extend(memory.history(session_id))
        if observations:
            messages.append(
                Message(
                    role="system",
                    content="ツール実行結果（これを踏まえて回答すること）:\n"
                    + "\n".join(observations),
                )
            )
        messages.append(Message(role="user", content=user_text))

        output_parts: list[str] = []
        try:
            async for chunk in self.provider.stream(messages):
                output_parts.append(chunk.text)
                await emit({"type": "agent_token", "text": chunk.text})
        except Exception as exc:
            ok = False
            fallback = (
                f"社長、申し訳ございません。頭脳（{self.provider.name}）との通信に失敗しました。"
                f"設定をご確認くださいませ。（詳細: {exc}）"
            )
            output_parts = [fallback]
            await emit({"type": "agent_token", "text": fallback})

        output = "".join(output_parts).strip()

        # --- 感情（Live2D表情）の決定 --------------------------------------
        if not ok:
            emotion = "apologetic"
        elif tool_traces and all(t.ok for t in tool_traces):
            emotion = "happy"
        else:
            emotion = "neutral"

        await emit({"type": "agent_message", "text": output, "emotion": emotion})

        # --- 記憶を更新 -----------------------------------------------------
        memory.append(session_id, Message(role="user", content=user_text))
        memory.append(session_id, Message(role="assistant", content=output))

        # --- データ・フライホイールに記録（燃料を溜める）-------------------
        latency_ms = int((time.monotonic() - t0) * 1000)
        try:
            recorder.record(
                Trace(
                    ts=datetime.now().isoformat(timespec="seconds"),
                    session_id=session_id,
                    provider=self.provider.name,
                    model=self.provider.model,
                    user_input=user_text,
                    system_prompt=LUNA_SYSTEM_PROMPT,
                    thinking=thinking,
                    tool_calls=tool_traces,
                    output=output,
                    emotion=emotion,
                    ok=ok,
                    latency_ms=latency_ms,
                )
            )
        except Exception:
            # 記録失敗で会話を止めない（記録はベストエフォート）
            pass
