/**
 * リリース・リスクレポートを1件生成するCLI（週次とは独立）。
 *   npm run report:release -- release.json [--export]
 * release.json の形式は docs/release-schema.md を参照。
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { generateReleaseReport, type ReleaseObservation } from "../src/report/release";
import { exportReport } from "./export";

interface ReleaseInput {
  project: { key: string; name?: string };
  release: ReleaseObservation;
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("使い方: npm run report:release -- <release.json> [--export]");
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(file, "utf-8")) as ReleaseInput;
  if (!input.project?.key || !input.release?.ref) throw new Error("project.key と release.ref は必須です");

  const now = new Date();
  const report = await generateReleaseReport(input.project.key, { start: now, end: now }, input.release, input.project.name);
  console.log(`✔ リリースリスク生成: [${report.level}] 危険度=${report.score}`);
  console.log(`  ${report.headline}  id=${report.id}`);

  if (process.argv.includes("--export")) {
    const f = await exportReport(report.id);
    console.log(`✔ HTML出力: ${f}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
