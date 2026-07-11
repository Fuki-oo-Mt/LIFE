/**
 * 週次レポートを1本生成するCLI。
 *   npm run report:weekly -- --project client-portal --weeks-ago 0
 * cron から毎週月曜に叩く想定。
 */
import "dotenv/config";
import { generateWeekly } from "../src/report/weekly";
import { weekPeriod } from "../src/report/period";

function arg(name: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : def;
}

async function main() {
  const projectKey = arg("project", "demo-system")!;
  const projectName = arg("name", "デモ運用システム");
  const weeksAgo = Number(arg("weeks-ago", "0"));
  const period = weekPeriod(new Date(), weeksAgo);

  const report = await generateWeekly(projectKey, period, projectName);
  console.log(`✔ 週次レポート生成: ${projectKey} [${report.level}] score=${report.score}`);
  console.log(`  ${report.headline}`);
  console.log(`  id=${report.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
