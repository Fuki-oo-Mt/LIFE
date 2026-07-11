import type { Kpi } from "../report/scoring";

export type Level = "green" | "yellow" | "red";
export const levelWord: Record<Level, string> = { green: "良好", yellow: "注意", red: "危険" };

/** 前週比の差分と、その差分が「良い変化か」を判定して表示情報を返す */
export function delta(cur: number | null, prev: number | null, good: Kpi["good"]) {
  if (cur === null || prev === null) return null;
  const diff = Math.round((cur - prev) * 10) / 10;
  if (diff === 0) return { text: "±0", cls: "delta-flat" as const };
  const sign = diff > 0 ? "▲" : "▼";
  const better = good === "flat" ? null : (good === "up" ? diff > 0 : diff < 0);
  const cls = better === null ? "delta-flat" : better ? "delta-good" : "delta-bad";
  return { text: `${sign}${Math.abs(diff)}`, cls } as const;
}

/** 数値を見やすく整形（大きい数はカンマ区切り） */
export function fmt(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("ja-JP");
}
