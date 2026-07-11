/**
 * 動作確認用シード。過去8週間分の週次レポートをmockデータで生成し、
 * 一覧・詳細・前週比較・トレンドを体験できる状態にする。
 *   npm run seed
 */
import "dotenv/config";
import { generateWeekly } from "../src/report/weekly";
import { weekPeriod } from "../src/report/period";
import { prisma } from "../src/db";

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
  console.log("✔ シード完了: /（一覧）で確認できます");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
