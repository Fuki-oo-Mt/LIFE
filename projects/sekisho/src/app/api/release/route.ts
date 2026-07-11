import { NextResponse } from "next/server";
import { generateReleaseReport, type ReleaseObservation } from "../../../report/release";

/**
 * リリース・リスクレポートの生成（週次とは独立の経路）。
 *   curl -X POST /api/release -H 'content-type: application/json' -d @release.json
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { project?: { key: string; name?: string }; release?: ReleaseObservation };
    if (!body?.project?.key || !body?.release?.ref) {
      return new NextResponse("project.key と release.ref は必須です", { status: 400 });
    }
    const now = new Date();
    const report = await generateReleaseReport(body.project.key, { start: now, end: now }, body.release, body.project.name);
    return NextResponse.json({ ok: true, id: report.id, score: report.score, level: report.level, headline: report.headline });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
