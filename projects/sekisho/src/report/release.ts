import { prisma } from "../db";
import { ensureProject } from "./weekly";
import type { Period } from "../adapters/types";

/**
 * リリース・リスクレポート。
 * 週次システムレポートとは独立して、1件のリリース(またはPR束)の危険度を採点し、
 * 分割/カナリアの提案を出す。危険度は 0-100（高いほど危険＝週次とは色の意味が逆）。
 */

export type ReleaseTiming = "normal" | "friday" | "late_night" | "freeze";

/** 分割提案用の変更ユニット（任意。あると精度が上がる） */
export interface ChangeUnit {
  name: string;
  type: "db" | "infra" | "critical" | "feature" | "other";
  dependsOn?: string[];
}

export interface ReleaseObservation {
  ref: string; // 例: "v1.2.3" / "PR #456"
  title: string; // リリースの概要
  url?: string;
  // 変更規模
  changedLines?: number; // 追加+削除
  changedFiles?: number;
  bundledPRs?: number; // 束ねたPR数
  // 影響範囲
  servicesTouched?: number; // 触ったサービス/デプロイ単位
  criticalPaths?: string[]; // 該当したクリティカルパス名（決済/認証/課金 等）
  // 変更種別
  hasDbMigration?: boolean;
  hasInfraChange?: boolean;
  dependencyMajorBump?: boolean;
  // 品質
  ciGreen?: boolean; // CIが通っているか（未指定=true扱い）
  reviewers?: number;
  testsChanged?: boolean;
  // 切り戻し
  hasRollbackPlan?: boolean;
  // タイミング
  timing?: ReleaseTiming;
  // 分割提案の材料（任意）
  units?: ChangeUnit[];
}

export interface RiskSignal {
  group: string;
  reason: string;
  points: number; // プラス値（危険度への加点）
}

export interface SplitStep {
  order: number;
  title: string;
  mechanism: string; // "先行リリース(Expand/Contract)" | "カナリア" | "フラグ漸増" | "通常"
  note?: string;
}

export interface ReleaseRisk {
  score: number; // 0-100（高いほど危険）
  level: "green" | "yellow" | "red"; // green=GO / yellow=分割推奨 / red=要レビュー
  verdict: string; // "GO" | "分割推奨" | "要レビュー"
  signals: RiskSignal[];
  hardFlags: string[]; // ハードオーバーライドの理由
  splitPlan: SplitStep[];
  recommendation: string; // 一行の推奨
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const band = (v: number, steps: [number, number][]): number => {
  for (const [threshold, pts] of steps) if (v >= threshold) return pts;
  return 0;
};

/** リリース危険度を採点する（説明可能な加点式） */
export function scoreRelease(r: ReleaseObservation): ReleaseRisk {
  const signals: RiskSignal[] = [];
  const add = (group: string, reason: string, points: number) => {
    if (points > 0) signals.push({ group, reason, points: Math.round(points * 10) / 10 });
  };

  // 変更規模（hotfix中心なら小さく出る）
  if (r.bundledPRs && r.bundledPRs >= 2) add("規模", `束ねたPR ${r.bundledPRs}件`, band(r.bundledPRs, [[7, 12], [4, 8], [2, 4]]));
  if (r.changedLines) add("規模", `変更 ${r.changedLines}行`, band(r.changedLines, [[2000, 15], [800, 11], [300, 7], [100, 3]]));

  // 影響範囲
  if (r.servicesTouched && r.servicesTouched >= 2) add("影響範囲", `${r.servicesTouched}サービスに変更`, band(r.servicesTouched, [[5, 12], [3, 8], [2, 4]]));
  const crit = r.criticalPaths ?? [];
  if (crit.length) add("影響範囲", `クリティカルパス該当: ${crit.join(", ")}`, Math.min(16, crit.length * 8));

  // 変更種別（不可逆性）
  if (r.hasDbMigration) add("変更種別", "DBマイグレーションを含む", 12);
  if (r.hasInfraChange) add("変更種別", "インフラ(IaC)変更を含む", 8);
  if (r.dependencyMajorBump) add("変更種別", "依存のメジャー更新", 5);

  // 品質
  const ciGreen = r.ciGreen !== false;
  if (!ciGreen) add("品質", "CIが未通過(赤)", 14);
  if (r.reviewers === 0) add("品質", "レビュワー0", 6);
  if (r.testsChanged === false) add("品質", "テストの変更なし", 4);

  // 切り戻し
  const rollback = r.hasRollbackPlan === true;
  if (!rollback) add("切り戻し", "ロールバック手順なし", r.hasDbMigration ? 12 : 8);

  // タイミング
  if (r.timing === "friday") add("タイミング", "金曜/連休前のリリース", 6);
  else if (r.timing === "late_night") add("タイミング", "深夜のリリース", 4);
  else if (r.timing === "freeze") add("タイミング", "フリーズ期間中", 10);

  let score = clamp(signals.reduce((s, x) => s + x.points, 0));

  // ハードオーバーライド
  const hardFlags: string[] = [];
  if (!ciGreen) { score = Math.max(score, 60); hardFlags.push("CI赤のためリリース不可（要修正）"); }
  if (r.timing === "freeze") { score = Math.max(score, 60); hardFlags.push("フリーズ期間中（hotfix以外は停止）"); }
  if (r.hasDbMigration && !rollback) { score = Math.max(score, 30); hardFlags.push("DBマイグレに切り戻し手順が必要"); }

  const level: ReleaseRisk["level"] = score < 30 ? "green" : score < 60 ? "yellow" : "red";
  const verdict = level === "green" ? "GO" : level === "yellow" ? "分割推奨" : "要レビュー";

  const splitPlan = buildSplitPlan(r, level);
  const recommendation = buildRecommendation(r, level, verdict, splitPlan);

  return { score, level, verdict, signals, hardFlags, splitPlan, recommendation };
}

/** 安全順の分割リリース計画を作る */
export function buildSplitPlan(r: ReleaseObservation, level: ReleaseRisk["level"]): SplitStep[] {
  if (level === "green") return []; // 低リスクなら分割不要

  const steps: SplitStep[] = [];
  let order = 1;

  if (r.units && r.units.length > 1) {
    // ユニットがあれば type で安全順に並べる
    const rank: Record<ChangeUnit["type"], number> = { db: 0, infra: 1, critical: 2, feature: 3, other: 4 };
    const mech: Record<ChangeUnit["type"], string> = {
      db: "先行リリース(Expand/Contract)", infra: "先行リリース＋監視", critical: "単独カナリア", feature: "フラグOFFで投入→漸増", other: "通常",
    };
    for (const u of [...r.units].sort((a, b) => rank[a.type] - rank[b.type])) {
      steps.push({ order: order++, title: u.name, mechanism: mech[u.type] });
    }
    return steps;
  }

  // ユニットが無い場合はフラグから汎用プランを組む
  if (r.hasDbMigration) steps.push({ order: order++, title: "DBスキーマ変更を先行", mechanism: "Expand/Contract", note: "後方互換の追加のみ先に。旧コードも動く状態を保つ" });
  if (r.hasInfraChange) steps.push({ order: order++, title: "インフラ変更を単独で", mechanism: "先行リリース＋監視" });
  for (const c of r.criticalPaths ?? []) steps.push({ order: order++, title: `${c} の変更`, mechanism: "単独カナリア(5%→50%→100%)" });
  steps.push({ order: order++, title: "残りの機能変更", mechanism: "フラグOFFで投入→段階的にON" });
  return steps;
}

function buildRecommendation(r: ReleaseObservation, level: ReleaseRisk["level"], verdict: string, plan: SplitStep[]): string {
  if (level === "green") return `${verdict}: リスクは低め。通常リリースで問題ありません。`;
  const head = level === "red" ? "要レビュー: このまま出すのは危険です。" : "分割推奨: 一度に出さず段階リリースを推奨します。";
  const planText = plan.length ? ` 推奨手順: ${plan.map((s) => `${s.order}) ${s.title}[${s.mechanism}]`).join(" → ")}` : "";
  return head + planText;
}

export interface ReleasePayload {
  release: ReleaseObservation;
  risk: ReleaseRisk;
  generatedAt: string;
  mode: string;
}

/** リリースリスクレポートを生成してDBに保存（type=release） */
export async function generateReleaseReport(projectKey: string, period: Period, release: ReleaseObservation, projectName?: string) {
  const project = await ensureProject(projectKey, projectName);
  const risk = scoreRelease(release);
  const payload: ReleasePayload = {
    release,
    risk,
    generatedAt: new Date().toISOString(),
    mode: (process.env.SEKISHO_MODE ?? "mock").toLowerCase(),
  };
  return prisma.report.create({
    data: {
      projectId: project.id,
      type: "release",
      periodStart: period.start,
      periodEnd: period.end,
      score: risk.score,
      level: risk.level,
      headline: `${release.ref} ${release.title} ・ ${risk.verdict}(危険度${risk.score})`,
      narrative: risk.recommendation,
      payload: JSON.stringify(payload),
    },
  });
}
