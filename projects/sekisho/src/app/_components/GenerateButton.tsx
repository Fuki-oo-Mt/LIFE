"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** 「今週のレポートを生成」ボタン。APIを叩いて再読込。 */
export function GenerateButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e) {
      alert("生成に失敗しました: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn" onClick={run} disabled={loading}>
      {loading ? "生成中…" : "＋ 今週のレポートを生成"}
    </button>
  );
}
