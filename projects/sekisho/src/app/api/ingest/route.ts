import { NextResponse } from "next/server";
import { generateFromObservations } from "../../../report/weekly";
import { normalizeObservations, type IngestInput } from "../../../report/ingest";
import { weekPeriod } from "../../../report/period";

/**
 * 取り込みエンドポイント。
 * アクセス権を持つ収集役（Cursorエージェント／スクリプト／手動）が集めた観測JSONを受け取り、
 * 採点してレポートを保存する。関所自体はデータ源に接続しない。
 *
 * 例:
 *   curl -X POST /api/ingest -H 'content-type: application/json' -d @observations.json
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IngestInput;
    if (!body?.project?.key) {
      return new NextResponse("project.key は必須です", { status: 400 });
    }
    const period = body.period
      ? { start: new Date(body.period.start), end: new Date(body.period.end) }
      : weekPeriod(new Date(), 0);

    const observations = normalizeObservations(body.observations ?? {}, body.missingSources ?? []);
    const report = await generateFromObservations(body.project.key, period, observations, body.project.name);

    return NextResponse.json({
      ok: true,
      id: report.id,
      score: report.score,
      level: report.level,
      headline: report.headline,
    });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
