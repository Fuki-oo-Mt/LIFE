"use client";

import { motion } from "framer-motion";

import type { ChatMessage } from "@/lib/types";

const EMOTION_LABEL: Record<string, string> = {
  neutral: "🙂",
  happy: "😊",
  thinking: "🤔",
  surprised: "😮",
  apologetic: "🙇",
};

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasWorkLog = !isUser && (message.workLog?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5 pl-1 text-xs text-luna-accent">
            <span>{EMOTION_LABEL[message.emotion ?? "neutral"]}</span>
            <span className="font-medium">Luna</span>
          </div>
        )}

        {/* 作業ログ（思考・ツール）*/}
        {hasWorkLog && (
          <div className="mb-1.5 space-y-1 rounded-xl border border-night-600/60 bg-night-800/60 px-3 py-2 text-[11px] text-slate-400">
            {message.workLog!.map((log, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="opacity-70">
                  {log.kind === "thinking"
                    ? "💭"
                    : log.kind === "tool_call"
                    ? "🔧"
                    : log.ok === false
                    ? "⚠️"
                    : "✅"}
                </span>
                <span className="leading-relaxed">{log.text}</span>
              </div>
            ))}
          </div>
        )}

        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-sm bg-luna-accent/90 text-night-900"
              : "rounded-bl-sm bg-night-700/80 text-slate-100"
          }`}
        >
          {message.text || (message.streaming ? "…" : "")}
          {message.streaming && (
            <span className="ml-0.5 inline-block h-3.5 w-1 animate-moon-pulse bg-current align-middle" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
