import type { Observations } from "../adapters/types";

/** UIに渡す1指標 */
export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  good: "up" | "down" | "flat";
}

/** 減点の1行（なぜ下がったかを説明可能にする） */
export interface Deduction {
  reason: string;
  points: number; // マイナス値
}

/** レーダーの1軸＝健全性の1次元 */
export interface Dimension {
  key: string;
  label: string;
  score: number; // 0-100（高いほど健全）
  deductions: Deduction[];
}

export interface WeeklyMetrics {
  kpis: Record<string, Kpi>;
  dimensions: Dimension[];
  score: number; // 総合健全性 0-100（各次元の平均）
  level: "green" | "yellow" | "red";
  firefightingRatioPct: number | null;
  sloTargetPct: number | null; // 可用性SLOの目標
  sloBudgetRemainingPct: number | null; // エラーバジェット残量(%)
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 減点を積み上げて次元スコアを作るヘルパー */
function dim(key: string, label: string, build: (sub: (reason: string, raw: number, cap: number) => void) => void): Dimension {
  const deductions: Deduction[] = [];
  const sub = (reason: string, raw: number, cap: number) => {
    const p = -Math.min(Math.max(0, raw), cap);
    if (p < 0) deductions.push({ reason, points: Math.round(p * 10) / 10 });
  };
  build(sub);
  const total = deductions.reduce((s, d) => s + d.points, 0);
  return { key, label, score: clamp(100 + total), deductions };
}

/**
 * 週次の健全性を5次元で採点する（レーダー用）。
 * 各次元は100点からの説明可能な減点。総合スコアは5次元の平均。
 * 重みは初期prior。運用データが貯まれば校正する前提で保守的に設定。
 */
export function scoreWeekly(o: Observations): WeeklyMetrics {
  const { quality: q, users: u, work: w, infra: i, dataPlatform: dp } = o;

  const ffTotal = w.firefightingItems + w.improvementItems;
  const firefightingRatio = pct(w.firefightingItems, ffTotal);
  const affectedRatio = u.affectedUsers !== null && u.activeUsers ? pct(u.affectedUsers, u.activeUsers) : null;

  // アラートノイズ率 = 実インシデントにならなかったアラームの割合
  const alertNoiseRate = i.alertsFired > 0 ? pct(Math.max(0, i.alertsFired - i.incidents), i.alertsFired) : null;

  // 再発（再燃）率 = タイトルが期間内に複数回出た件数の割合
  const titleFreq = new Map<string, number>();
  for (const r of o.incidentLog) titleFreq.set(r.title, (titleFreq.get(r.title) ?? 0) + 1);
  const recurringCount = o.incidentLog.filter((r) => (titleFreq.get(r.title) ?? 0) > 1).length;
  const recurrenceRate = o.incidentLog.length ? pct(recurringCount, o.incidentLog.length) : null;
  const flagged = o.incidentLog.filter((r) => r.status === "resolved" && typeof r.permanentFix === "boolean");
  const permanentFixRate = flagged.length ? pct(flagged.filter((r) => r.permanentFix).length, flagged.length) : null;

  // SLO/エラーバジェット（可用性ベース）
  let sloBudgetRemaining: number | null = null;
  if (q.availabilityPct !== null && q.sloTargetPct !== null && q.sloTargetPct < 100) {
    const allowedErr = 100 - q.sloTargetPct; // 許容ダウン率
    const consumed = ((100 - q.availabilityPct) / allowedErr) * 100;
    sloBudgetRemaining = Math.max(0, Math.min(100, Math.round((100 - consumed) * 10) / 10));
  }

  const dimensions: Dimension[] = [
    dim("quality", "可用性・エラー", (sub) => {
      if (q.availabilityPct !== null) sub(`可用性 ${q.availabilityPct}%`, Math.max(0, 99.9 - q.availabilityPct) * 10, 45);
      if (q.errorRatePct !== null) sub(`エラー率 ${q.errorRatePct}%`, q.errorRatePct * 15, 30);
      if (q.latencyP95Ms !== null) sub(`p95応答 ${q.latencyP95Ms}ms`, Math.max(0, q.latencyP95Ms - 500) * 0.03, 20);
      if (q.deployCausedIncidents) sub(`リリース起因の障害 ${q.deployCausedIncidents}件`, q.deployCausedIncidents * 8, 24);
      if (sloBudgetRemaining !== null && sloBudgetRemaining < 50) sub(`エラーバジェット残 ${sloBudgetRemaining}%`, (50 - sloBudgetRemaining) * 0.6, 20);
    }),
    dim("user", "ユーザー影響", (sub) => {
      if (affectedRatio !== null) sub(`影響ユーザー ${affectedRatio}%`, affectedRatio * 4, 55);
      if (u.growthRatePct !== null && u.growthRatePct < 0) sub(`ユーザー減少 ${u.growthRatePct}%`, Math.abs(u.growthRatePct) * 2, 20);
    }),
    // 「障害」と「問い合わせ」を統合した、届く運用対応の負荷
    dim("incident", "障害対応", (sub) => {
      sub(`インシデント ${i.incidents}件`, i.incidents * 6, 42);
      const openP1 = o.incidentLog.filter((r) => r.status === "open" && r.severity === "P1").length;
      const openP2 = o.incidentLog.filter((r) => r.status === "open" && r.severity === "P2").length;
      if (openP1) sub(`未対応P1 ${openP1}件（重大放置）`, openP1 * 10, 30);
      if (openP2) sub(`未対応P2 ${openP2}件`, openP2 * 5, 20);
      sub(`未完了の運用対応 ${w.opsBacklog}件`, Math.max(0, w.opsBacklog - 8) * 1.5, 24);
      if (w.oldestOpenDays !== null) sub(`最古の滞留 ${w.oldestOpenDays}日`, Math.max(0, w.oldestOpenDays - 10) * 1.2, 20);
      if (i.earlyDetectionRatePct !== null) sub(`早期検知率 ${i.earlyDetectionRatePct}%`, Math.max(0, 85 - i.earlyDetectionRatePct) * 0.5, 18);
      if (alertNoiseRate !== null && alertNoiseRate > 80) sub(`アラートノイズ率 ${alertNoiseRate}%`, (alertNoiseRate - 80) * 0.5, 12);
    }),
    // 手運用（DB直接入力等）＝トイル。多いほど自動化余地が大きい＝低スコア
    dim("toil", "手運用・トイル", (sub) => {
      sub(`手運用 ${w.manualOpsTasks}件（自動化余地）`, Math.max(0, w.manualOpsTasks - 3) * 4, 70);
    }),
    // 恒久対策・再発防止: 再発が多い/恒久対策できていないほど低スコア
    dim("recurrence", "再発防止", (sub) => {
      if (recurrenceRate !== null) sub(`再発率 ${recurrenceRate}%`, recurrenceRate * 0.9, 55);
      if (permanentFixRate !== null) sub(`恒久対策率 ${permanentFixRate}%`, Math.max(0, 70 - permanentFixRate) * 0.6, 30);
    }),
    dim("firefighting", "改善の余力", (sub) => {
      if (firefightingRatio !== null) sub(`火消し比率 ${firefightingRatio}%（改善を圧迫）`, Math.max(0, firefightingRatio - 30) * 1.2, 65);
    }),
  ];

  const kpis: Record<string, Kpi> = {
    activeUsers: { key: "activeUsers", label: "アクティブユーザー", value: u.activeUsers, unit: "人", good: "up" },
    newUsers: { key: "newUsers", label: "新規ユーザー", value: u.newUsers, unit: "人", good: "up" },
    growthRate: { key: "growthRate", label: "増加率(前週比)", value: u.growthRatePct, unit: "%", good: "up" },
    affectedUsers: { key: "affectedUsers", label: "影響ユーザー", value: u.affectedUsers, unit: "人", good: "down" },

    availability: { key: "availability", label: "可用性", value: q.availabilityPct, unit: "%", good: "up" },
    errorRate: { key: "errorRate", label: "エラー率", value: q.errorRatePct, unit: "%", good: "down" },
    latencyP95: { key: "latencyP95", label: "p95応答時間", value: q.latencyP95Ms, unit: "ms", good: "down" },
    deployCaused: { key: "deployCaused", label: "リリース起因障害", value: q.deployCausedIncidents, unit: "件", good: "down" },

    manualOps: { key: "manualOps", label: "手運用(データ修正等)", value: w.manualOpsTasks, unit: "件", good: "down" },
    opsBacklog: { key: "opsBacklog", label: "未完了の運用対応", value: w.opsBacklog, unit: "件", good: "down" },
    oldestOpen: { key: "oldestOpen", label: "最古の滞留", value: w.oldestOpenDays, unit: "日", good: "down" },
    firefighting: { key: "firefighting", label: "火消し対応", value: w.firefightingItems, unit: "件", good: "down" },
    improvement: { key: "improvement", label: "改善タスク", value: w.improvementItems, unit: "件", good: "up" },
    firefightingRatio: { key: "firefightingRatio", label: "火消し比率", value: firefightingRatio, unit: "%", good: "down" },

    alertsFired: { key: "alertsFired", label: "アラート発報", value: i.alertsFired, unit: "件", good: "down" },
    incidents: { key: "incidents", label: "インシデント", value: i.incidents, unit: "件", good: "down" },
    mttr: { key: "mttr", label: "平均復旧(MTTR)", value: i.mttrMinutes, unit: "分", good: "down" },
    earlyDetection: { key: "earlyDetection", label: "早期検知率", value: i.earlyDetectionRatePct, unit: "%", good: "up" },
    alertNoise: { key: "alertNoise", label: "アラートノイズ率", value: alertNoiseRate, unit: "%", good: "down" },
    recurrenceRate: { key: "recurrenceRate", label: "再発率", value: recurrenceRate, unit: "%", good: "down" },
    permanentFixRate: { key: "permanentFixRate", label: "恒久対策率", value: permanentFixRate, unit: "%", good: "up" },
    sloTarget: { key: "sloTarget", label: "SLO目標(可用性)", value: q.sloTargetPct, unit: "%", good: "flat" },
    budgetRemaining: { key: "budgetRemaining", label: "エラーバジェット残", value: sloBudgetRemaining, unit: "%", good: "up" },

    pipelineSuccess: { key: "pipelineSuccess", label: "パイプライン成功率", value: dp.pipelineSuccessRatePct, unit: "%", good: "up" },
    freshness: { key: "freshness", label: "データ鮮度遅延", value: dp.freshnessLagMinutes, unit: "分", good: "down" },
    failedJobs: { key: "failedJobs", label: "失敗ジョブ", value: dp.failedJobs, unit: "件", good: "down" },
  };

  const score = clamp(dimensions.reduce((s, x) => s + x.score, 0) / dimensions.length);
  const level: WeeklyMetrics["level"] = score >= 75 ? "green" : score >= 50 ? "yellow" : "red";

  return {
    kpis, dimensions, score, level,
    firefightingRatioPct: firefightingRatio,
    sloTargetPct: q.sloTargetPct,
    sloBudgetRemainingPct: sloBudgetRemaining,
  };
}
