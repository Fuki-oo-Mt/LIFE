"use client";

// 頭脳との対話状態を管理するReactフック。
// 接続状態・チャット履歴・現在のLunaの感情・発話中フラグを返す。

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_WS_URL, LunaSocket } from "@/lib/lunaSocket";
import type {
  ChatMessage,
  ConnectionState,
  Emotion,
  ServerEvent,
} from "@/lib/types";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export interface UseLunaSocket {
  connection: ConnectionState;
  messages: ChatMessage[];
  emotion: Emotion;
  speaking: boolean;
  busy: boolean;
  send: (text: string) => void;
}

export function useLunaSocket(): UseLunaSocket {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);

  const socketRef = useRef<LunaSocket | null>(null);
  const sessionIdRef = useRef<string>("");
  // 現在ストリーミング中のLunaメッセージID
  const activeIdRef = useRef<string | null>(null);

  // Lunaの現在メッセージを更新するヘルパ
  const updateActive = useCallback(
    (mutate: (m: ChatMessage) => ChatMessage) => {
      const id = activeIdRef.current;
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? mutate(m) : m))
      );
    },
    []
  );

  const ensureActive = useCallback(() => {
    if (activeIdRef.current) return;
    const id = uuid();
    activeIdRef.current = id;
    setMessages((prev) => [
      ...prev,
      { id, role: "luna", text: "", streaming: true, workLog: [] },
    ]);
  }, []);

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "agent_thinking": {
          ensureActive();
          setEmotion("thinking");
          updateActive((m) => ({
            ...m,
            workLog: [
              ...(m.workLog ?? []),
              { kind: "thinking", text: event.text },
            ],
          }));
          break;
        }
        case "tool_call": {
          ensureActive();
          updateActive((m) => ({
            ...m,
            workLog: [
              ...(m.workLog ?? []),
              { kind: "tool_call", text: `🔧 ${event.name} を実行中…` },
            ],
          }));
          break;
        }
        case "tool_result": {
          ensureActive();
          updateActive((m) => ({
            ...m,
            workLog: [
              ...(m.workLog ?? []),
              { kind: "tool_result", text: event.summary, ok: event.ok },
            ],
          }));
          break;
        }
        case "agent_token": {
          ensureActive();
          setSpeaking(true);
          updateActive((m) => ({ ...m, text: m.text + event.text }));
          break;
        }
        case "agent_message": {
          ensureActive();
          setEmotion(event.emotion);
          updateActive((m) => ({
            ...m,
            text: event.text || m.text,
            emotion: event.emotion,
          }));
          break;
        }
        case "done": {
          updateActive((m) => ({ ...m, streaming: false }));
          activeIdRef.current = null;
          setSpeaking(false);
          setBusy(false);
          break;
        }
        case "error": {
          ensureActive();
          setEmotion("apologetic");
          updateActive((m) => ({
            ...m,
            text:
              (m.text ? m.text + "\n\n" : "") +
              `⚠️ ${event.message}`,
            emotion: "apologetic",
            streaming: false,
          }));
          activeIdRef.current = null;
          setSpeaking(false);
          setBusy(false);
          break;
        }
        default:
          break;
      }
    },
    [ensureActive, updateActive]
  );

  useEffect(() => {
    sessionIdRef.current = uuid();
    const socket = new LunaSocket(DEFAULT_WS_URL, {
      onEvent: handleEvent,
      onOpen: () => setConnection("open"),
      onClose: () => setConnection("closed"),
    });
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.close();
    };
  }, [handleEvent]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const socket = socketRef.current;
    if (!socket) return;

    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    const ok = socket.send({
      type: "user_message",
      session_id: sessionIdRef.current,
      text: trimmed,
    });

    if (!ok) {
      setBusy(false);
      setEmotion("apologetic");
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "luna",
          text: "⚠️ 頭脳（バックエンド）に接続できていません。`apps/agent` を起動してください。",
          emotion: "apologetic",
        },
      ]);
    }
  }, []);

  return { connection, messages, emotion, speaking, busy, send };
}
