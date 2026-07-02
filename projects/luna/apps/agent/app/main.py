"""Project Luna — 頭脳（FastAPI エントリポイント）。

起動: uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.graph import LunaAgent
from app.core.llm import get_provider
from app.ws import handle_connection
from data.flywheel import recorder

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("luna")

app = FastAPI(title="Project Luna — Agent", version="0.1.0")

# 開発用CORS（顔は別オリジン localhost:3000 で動くため）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 頭脳（プロバイダ）とエージェントは起動時に一度だけ構築して再利用する。
provider = get_provider(settings)
agent = LunaAgent(provider)


@app.on_event("startup")
async def _startup() -> None:
    logger.info("🌙 Luna 頭脳 起動")
    logger.info("  LLMプロバイダ: %s (model=%s)", provider.name, provider.model)
    if provider.note:
        logger.info("  備考: %s", provider.note)
    logger.info("  蓄積済み教師データ: %d 件", recorder.count())


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "provider": provider.name,
        "model": provider.model,
        "note": provider.note,
        "traces_collected": recorder.count(),
    }


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    await handle_connection(websocket, agent)
