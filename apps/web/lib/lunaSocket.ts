// 頭脳（apps/agent）への WebSocket クライアント。自動再接続つき。

import type { ServerEvent, UserMessage } from "./types";

export interface LunaSocketHandlers {
  onEvent: (event: ServerEvent) => void;
  onOpen: () => void;
  onClose: () => void;
}

export class LunaSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers: LunaSocketHandlers;
  private shouldRun = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, handlers: LunaSocketHandlers) {
    this.url = url;
    this.handlers = handlers;
  }

  connect(): void {
    if (!this.shouldRun) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.handlers.onOpen();
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as ServerEvent;
        this.handlers.onEvent(data);
      } catch {
        // 不正なフレームは無視
      }
    };

    this.ws.onclose = () => {
      this.handlers.onClose();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose が続けて呼ばれるので、ここでは閉じるだけ
      try {
        this.ws?.close();
      } catch {
        // noop
      }
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  send(message: UserMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  close(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      // noop
    }
  }
}

export const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_LUNA_WS_URL ?? "ws://localhost:8000/ws";
