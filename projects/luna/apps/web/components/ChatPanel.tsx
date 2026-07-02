"use client";

import { useEffect, useRef } from "react";

import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import type { ChatMessage, ConnectionState } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  connection: ConnectionState;
  busy: boolean;
  onSend: (text: string) => void;
}

const CONN_LABEL: Record<ConnectionState, { text: string; dot: string }> = {
  connecting: { text: "頭脳に接続中…", dot: "bg-amber-400" },
  open: { text: "オンライン", dot: "bg-emerald-400" },
  closed: { text: "未接続（apps/agent を起動してください）", dot: "bg-rose-400" },
};

export default function ChatPanel({
  messages,
  connection,
  busy,
  onSend,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const conn = CONN_LABEL[connection];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-night-600/50 bg-night-800/40 backdrop-blur">
      {/* ヘッダ */}
      <div className="flex items-center justify-between border-b border-night-600/50 px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-slate-100">
            Luna <span className="text-luna-accent">🌙</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            Cradle社 自律型コンパニオン
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className={`h-2 w-2 rounded-full ${conn.dot}`} />
          {conn.text}
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <p className="text-sm">社長、おはようございます。</p>
            <p className="mt-1 text-xs">
              ご用件をお申し付けくださいませ。Lunaが代行いたします。
            </p>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      {/* 入力 */}
      <Composer onSend={onSend} disabled={busy} />
    </div>
  );
}
