/**
 * 動作確認用シード。過去8週間分の週次レポートをmockデータで生成し、
 * 一覧・詳細・前週比較・トレンドを体験できる状態にする。
 *   npm run seed
 */
import "dotenv/config";
import { generateWeekly } from "../src/report/weekly";
import { generateReleaseReport, type ReleaseObservation } from "../src/report/release";
import { weekPeriod } from "../src/report/period";
import { prisma } from "../src/db";

const DEMO_RELEASES: ReleaseObservation[] = [
  { ref: "hotfix-2914", title: "ログイン画面の文言修正", changedLines: 40, changedFiles: 2, bundledPRs: 1, servicesTouched: 1, ciGreen: true, reviewers: 2, testsChanged: true, hasRollbackPlan: true, timing: "normal" },
  { ref: "v2.4.0", title: "決済フロー刷新＋新機能A/B", changedLines: 1800, changedFiles: 46, bundledPRs: 5, servicesTouched: 3, criticalPaths: ["決済", "認証"], hasDbMigration: true, hasInfraChange: false, ciGreen: true, reviewers: 2, testsChanged: true, hasRollbackPlan: false, timing: "friday",
    units: [
      { name: "決済テーブルのスキーマ追加", type: "db" },
      { name: "決済フロー刷新", type: "critical" },
      { name: "新機能A", type: "feature" },
      { name: "新機能B", type: "feature" },
    ] },
  { ref: "v2.4.1", title: "緊急: 在庫同期バッチの修正", changedLines: 260, changedFiles: 6, bundledPRs: 2, servicesTouched: 2, hasInfraChange: true, ciGreen: false, reviewers: 0, testsChanged: false, hasRollbackPlan: false, timing: "late_night" },
];

async function main() {
  const projectKey = "demo-system";
  const projectName = "デモ運用システム";

  // 既存のデモレポートを消して作り直す（冪等）
  const existing = await prisma.project.findUnique({ where: { key: projectKey } });
  if (existing) {
    await prisma.report.deleteMany({ where: { projectId: existing.id } });
  }

  for (let w = 8; w >= 0; w--) {
    const period = weekPeriod(new Date(), w);
    const r = await generateWeekly(projectKey, period, projectName);
    console.log(`  週(-${w}) [${r.level}] score=${r.score}  ${r.headline}`);
  }

  const now = new Date();
  for (const rel of DEMO_RELEASES) {
    const r = await generateReleaseReport(projectKey, { start: now, end: now }, rel, projectName);
    console.log(`  リリース [${r.level}] 危険度=${r.score}  ${r.headline}`);
  }
  console.log("✔ シード完了: /（一覧）で確認できます");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
