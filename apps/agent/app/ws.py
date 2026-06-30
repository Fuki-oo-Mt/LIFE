"""WebSocketハンドラ。プロトコルv1に従い顔（apps/web）と対話する。

1メッセージ=1 JSON。受信した user_message をエージェントに渡し、エージェントが
発するイベント（thinking/tool/token/message）をそのまま転送、最後に done を送る。
"""

from __future__ import annotations

import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.core.graph import LunaAgent

logger = logging.getLogger("luna.ws")


async def handle_connection(websocket: WebSocket, agent: LunaAgent) -> None:
    await websocket.accept()
    logger.info("クライアント接続")

    async def emit(event: dict) -> None:
        await websocket.send_text(json.dumps(event, ensure_ascii=False))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await emit({"type": "error", "message": "不正なJSONを受信しました。"})
                continue

            if msg.get("type") != "user_message":
                # 未知のメッセージ種別は黙って無視（前方互換）
                continue

            session_id = str(msg.get("session_id") or "default")
            text = str(msg.get("text") or "").strip()
            if not text:
                await emit({"type": "done", "session_id": session_id})
                continue

            try:
                await agent.run(text, session_id, emit)
            except Exception as exc:  # エージェント内の想定外障害
                logger.exception("エージェント実行エラー")
                await emit({"type": "error", "message": f"内部エラー: {exc}"})

            await emit({"type": "done", "session_id": session_id})

    except WebSocketDisconnect:
        logger.info("クライアント切断")
