/**
 * レポートを自己完結HTMLとして tmp/sekisho/ に書き出すCLI。
 *   npm run export -- <reportId>     指定レポート
 *   npm run export -- latest         最新レポート
 *   npm run export -- latest --project client-portal
 * サーバーを起動せず1枚のHTMLで共有したいとき用。
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../src/db";
import { renderReportHtml } from "../src/report/export-html";
import { previousReport } from "../src/report/weekly";
import type { WeeklyPayload } from "../src/report/weekly";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function exportReport(idOrLatest: string): Promise<string> {
  const projectKey = arg("project");
  let report;
  if (idOrLatest === "latest") {
    const project = projectKey ? await prisma.project.findUnique({ where: { key: projectKey } }) : null;
    report = await prisma.report.findFirst({
      where: { type: "weekly", ...(project ? { projectId: project.id } : {}) },
      orderBy: { periodStart: "desc" }, include: { project: true },
    });
  } else {
    report = await prisma.report.findUnique({ where: { id: idOrLatest }, include: { project: true } });
  }
  if (!report) throw new Error("レポートが見つかりません");

  const payload = JSON.parse(report.payload) as WeeklyPayload;
  const prev = await previousReport(report.projectId, "weekly", report.periodStart);
  const prevPayload = prev ? (JSON.parse(prev.payload) as WeeklyPayload) : undefined;

  const html = renderReportHtml(
    { projectName: report.project.name, score: report.score, level: report.level as any, headline: report.headline, narrative: report.narrative },
    payload, prevPayload,
  );

  const outDir = process.env.SEKISHO_OUT_DIR ?? "./tmp/sekisho";
  mkdirSync(outDir, { recursive: true });
  const period = report.headline.split(" ")[0].replace(/[〜/]/g, "_");
  const file = `${outDir}/${report.project.key}_${period}.html`;
  writeFileSync(file, html, "utf-8");
  return file;
}

async function main() {
  const target = process.argv[2];
  if (!target) { console.error("使い方: npm run export -- <reportId|latest>"); process.exit(1); }
  const file = await exportReport(target);
  console.log(`✔ HTML出力: ${file}`);
}

// 直接実行されたときだけ main を走らせる（ingest からの import 時は走らせない）
if (process.argv[1] && /export\.ts$/.test(process.argv[1])) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
