import { NextResponse } from "next/server";
import { generateWeekly } from "../../../report/weekly";
import { weekPeriod } from "../../../report/period";

/**
 * 今週分の週次レポートを生成する。
 * 本番では cron から叩く（例: 毎週月曜 09:00）。UIの手動ボタンからも利用。
 */
export async function POST() {
  try {
    const projectKey = process.env.SEKISHO_PROJECT_KEY ?? "demo-system";
    const projectName = process.env.SEKISHO_PROJECT_NAME ?? "デモ運用システム";
    const period = weekPeriod(new Date(), 0);
    const report = await generateWeekly(projectKey, period, projectName);
    return NextResponse.json({ ok: true, id: report.id, score: report.score, level: report.level });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
