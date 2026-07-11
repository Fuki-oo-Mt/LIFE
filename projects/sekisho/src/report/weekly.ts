import { prisma } from "../db";
import { collectObservations, type Observations, type Period } from "../adapters";
import { scoreWeekly, type WeeklyMetrics } from "./scoring";
import { buildNarrative } from "./narrative";
import { analyzeIncidents, type IncidentAnalysis } from "./incidents";
import { ymd } from "./period";

/** レポートのpayloadに保存する構造（UIはこれを読む） */
export interface WeeklyPayload {
  observations: Observations;
  metrics: WeeklyMetrics;
  incidents: IncidentAnalysis;
  generatedAt: string;
  mode: string;
}

/** プロジェクトを取得（無ければ作成） */
export async function ensureProject(key: string, name?: string) {
  return prisma.project.upsert({
    where: { key },
    update: {},
    create: { key, name: name ?? key },
  });
}

/**
 * すでに集めた観測データから週次レポートを生成・保存する（取り込み経路）。
 * アプリがデータ源に接続しない場合（権限が無い等）はこちらを使う。
 */
export async function generateFromObservations(
  projectKey: string,
  period: Period,
  observations: Observations,
  projectName?: string,
) {
  const project = await ensureProject(projectKey, projectName);
  const metrics = scoreWeekly(observations);
  const narrative = await buildNarrative(observations, metrics);
  const payload: WeeklyPayload = {
    observations,
    metrics,
    incidents: analyzeIncidents(observations.incidentLog, period.end),
    generatedAt: new Date().toISOString(),
    mode: (process.env.SEKISHO_MODE ?? "mock").toLowerCase(),
  };
  return prisma.report.create({
    data: {
      projectId: project.id,
      type: "weekly",
      periodStart: period.start,
      periodEnd: period.end,
      score: metrics.score,
      level: metrics.level,
      headline: `${ymd(period.start)}〜${ymd(period.end)} ${narrative.headline}`,
      narrative: narrative.body,
      payload: JSON.stringify(payload),
    },
  });
}

/**
 * 週次レポートを生成してDBへ保存する（アダプタ収集経路）。
 * 収集 → 採点 → 所見 → 永続化。cron/CLI/APIから呼ばれる共通処理。
 */
export async function generateWeekly(projectKey: string, period: Period, projectName?: string) {
  const project = await ensureProject(projectKey, projectName);
  const observations = await collectObservations(period);
  const metrics = scoreWeekly(observations);
  const narrative = await buildNarrative(observations, metrics);

  const payload: WeeklyPayload = {
    observations,
    metrics,
    incidents: analyzeIncidents(observations.incidentLog, period.end),
    generatedAt: new Date().toISOString(),
    mode: (process.env.SEKISHO_MODE ?? "mock").toLowerCase(),
  };

  const report = await prisma.report.create({
    data: {
      projectId: project.id,
      type: "weekly",
      periodStart: period.start,
      periodEnd: period.end,
      score: metrics.score,
      level: metrics.level,
      headline: `${ymd(period.start)}〜${ymd(period.end)} ${narrative.headline}`,
      narrative: narrative.body,
      payload: JSON.stringify(payload),
    },
  });
  return report;
}

/** 同プロジェクト・同種の「1つ前」のレポートを返す（前週比較用） */
export async function previousReport(projectId: string, type: string, periodStart: Date) {
  return prisma.report.findFirst({
    where: { projectId, type, periodStart: { lt: periodStart } },
    orderBy: { periodStart: "desc" },
  });
}
