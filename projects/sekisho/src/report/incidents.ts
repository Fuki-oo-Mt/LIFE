import type { IncidentRecord } from "../adapters/types";

export interface IncidentRow extends IncidentRecord {
  ageDays: number | null; // 未対応は現在まで、対応済みは復旧までの日数
  recurring: boolean; // 同種タイトルが期間内に複数
}

export interface IncidentAnalysis {
  total: number;
  open: number;
  resolved: number;
  openBySeverity: Record<string, number>; // {P1: n, ...} 未対応のみ
  mttrMinutes: number | null; // 対応済みの平均復旧時間
  oldestOpenDays: number | null;
  recurringTitles: string[];
  recurrenceRatePct: number | null; // 再発（再燃）した件数の割合
  permanentFixRatePct: number | null; // 対応済みのうち恒久対策済みの割合（フラグがある場合のみ）
  rows: IncidentRow[]; // 表示順（未対応→優先度→古い順、その後 対応済み）
}

const SEV_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

function ageDays(rec: IncidentRecord, periodEnd: Date): number | null {
  if (!rec.openedAt) return null;
  const from = new Date(rec.openedAt).getTime();
  const to = rec.status === "resolved" && rec.resolvedAt ? new Date(rec.resolvedAt).getTime() : periodEnd.getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** インシデント台帳を分析する。対応状況・優先度・MTTR・滞留・再燃を出す。 */
export function analyzeIncidents(log: IncidentRecord[], periodEnd: Date): IncidentAnalysis {
  const titleCount = new Map<string, number>();
  for (const r of log) titleCount.set(r.title, (titleCount.get(r.title) ?? 0) + 1);
  const recurringTitles = [...titleCount.entries()].filter(([, n]) => n > 1).map(([t]) => t);

  const rows: IncidentRow[] = log.map((r) => ({
    ...r,
    ageDays: ageDays(r, periodEnd),
    recurring: (titleCount.get(r.title) ?? 0) > 1,
  }));

  rows.sort((a, b) => {
    // 未対応を先に、優先度が高い順、古い順
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    const sa = SEV_ORDER[a.severity ?? "P4"] ?? 3;
    const sb = SEV_ORDER[b.severity ?? "P4"] ?? 3;
    if (sa !== sb) return sa - sb;
    return (b.ageDays ?? 0) - (a.ageDays ?? 0);
  });

  const open = rows.filter((r) => r.status === "open");
  const resolved = rows.filter((r) => r.status === "resolved");

  const openBySeverity: Record<string, number> = {};
  for (const r of open) openBySeverity[r.severity ?? "P4"] = (openBySeverity[r.severity ?? "P4"] ?? 0) + 1;

  const resolvedDurations = resolved
    .filter((r) => r.openedAt && r.resolvedAt)
    .map((r) => (new Date(r.resolvedAt!).getTime() - new Date(r.openedAt!).getTime()) / 60_000);
  const mttrMinutes = resolvedDurations.length
    ? Math.round(resolvedDurations.reduce((s, x) => s + x, 0) / resolvedDurations.length)
    : null;

  const openAges = open.map((r) => r.ageDays).filter((x): x is number => x !== null);
  const oldestOpenDays = openAges.length ? Math.max(...openAges) : null;

  const recurringCount = rows.filter((r) => r.recurring).length;
  const recurrenceRatePct = rows.length ? Math.round((recurringCount / rows.length) * 1000) / 10 : null;
  const withFlag = resolved.filter((r) => typeof r.permanentFix === "boolean");
  const permanentFixRatePct = withFlag.length
    ? Math.round((withFlag.filter((r) => r.permanentFix).length / withFlag.length) * 1000) / 10
    : null;

  return {
    total: rows.length,
    open: open.length,
    resolved: resolved.length,
    openBySeverity,
    mttrMinutes,
    oldestOpenDays,
    recurringTitles,
    recurrenceRatePct,
    permanentFixRatePct,
    rows,
  };
}
