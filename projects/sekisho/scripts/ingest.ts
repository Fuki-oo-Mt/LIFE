/**
 * 観測JSONファイルを取り込んで週次レポートを生成するCLI。
 *   npm run ingest -- observations.json
 *
 * observations.json の形式は docs/observation-schema.md を参照。
 * アクセス権を持つ収集役（Cursorエージェント等）がこのJSONを吐き、これで取り込む。
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { generateFromObservations } from "../src/report/weekly";
import { normalizeObservations, type IngestInput } from "../src/report/ingest";
import { weekPeriod } from "../src/report/period";
import { exportReport } from "./export";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("使い方: npm run ingest -- <observations.json>");
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(file, "utf-8")) as IngestInput;
  if (!input.project?.key) throw new Error("project.key は必須です");

  const period = input.period
    ? { start: new Date(input.period.start), end: new Date(input.period.end) }
    : weekPeriod(new Date(), 0);
  const observations = normalizeObservations(input.observations ?? {}, input.missingSources ?? []);
  const report = await generateFromObservations(input.project.key, period, observations, input.project.name);

  console.log(`✔ 取り込み完了: [${report.level}] score=${report.score}`);
  console.log(`  ${report.headline}  id=${report.id}`);

  if (process.argv.includes("--export")) {
    const file = await exportReport(report.id);
    console.log(`✔ HTML出力: ${file}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
