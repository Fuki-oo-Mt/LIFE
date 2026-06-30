"use client";

import { useState } from "react";

interface ComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function Composer({ onSend, disabled }: ComposerProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="flex items-end gap-2 border-t border-night-600/50 bg-night-800/70 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Lunaに指示を出す（例: 今日のAIニュースを3つ調べて要約して）"
        aria-label="Lunaへの指示入力"
        className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-night-600/60 bg-night-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-luna-accent focus:outline-none focus:ring-1 focus:ring-luna-accent/60"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="h-[44px] shrink-0 rounded-xl bg-luna-accent px-4 text-sm font-semibold text-night-900 transition hover:bg-luna-glow disabled:cursor-not-allowed disabled:opacity-40"
      >
        送信
      </button>
    </div>
  );
}
