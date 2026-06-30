"use client";

import LunaAvatar from "@/components/LunaAvatar";
import ChatPanel from "@/components/ChatPanel";
import { useLunaSocket } from "@/hooks/useLunaSocket";

export default function Home() {
  const { connection, messages, emotion, speaking, busy, send } =
    useLunaSocket();

  return (
    <main className="flex h-screen w-screen flex-col gap-4 p-4 md:flex-row md:p-6">
      {/* 顔: Lunaアバター */}
      <section className="relative flex min-h-[40vh] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-night-600/40 bg-gradient-to-b from-night-800/40 to-night-900/60 md:min-h-0">
        {/* 月 */}
        <div className="pointer-events-none absolute right-8 top-8 h-16 w-16 animate-moon-pulse rounded-full bg-moon-100/90 blur-[1px] shadow-[0_0_60px_20px_rgba(244,233,201,0.25)]" />
        <LunaAvatar emotion={emotion} speaking={speaking} />

        {/* 状態バッジ */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-night-600/50 bg-night-900/70 px-3 py-1 text-[11px] text-slate-400 backdrop-blur">
          {speaking ? "Luna が話しています…" : emotion === "thinking" ? "Luna が考えています…" : "Luna は待機中"}
        </div>
      </section>

      {/* チャット */}
      <section className="flex h-full min-h-[45vh] w-full flex-col md:max-w-md md:min-h-0">
        <ChatPanel
          messages={messages}
          connection={connection}
          busy={busy}
          onSend={send}
        />
      </section>
    </main>
  );
}
