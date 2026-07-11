import type { DataSource, Observations, Period } from "./types";

/**
 * モックアダプタ: 実データ源に接続せず、現実味のあるサンプル観測を返す。
 * SEKISHO_MODE=mock のときに使用。動作確認・デモ用。
 *
 * period の週番号で数値を少し揺らし、「週ごとに違うレポート」「前週比較」を
 * 体験できるようにしている（乱数は使わず、日付から決定的に生成＝再現可能）。
 */
export class MockDataSource implements DataSource {
  readonly name = "mock";

  async collect(period: Period): Promise<Partial<Observations>> {
    // 週インデックス（エポックからの週数）で決定的に変化させる
    const wk = Math.floor(period.start.getTime() / (7 * 24 * 3600 * 1000));
    const wobble = (base: number, amp: number, phase = 0) =>
      Math.max(0, Math.round(base + amp * Math.sin((wk + phase) / 2.3)));

    const incidents = wobble(5, 4, 1);
    const alerts = wobble(42, 18);

    // インシデント台帳を決定的に生成（何のエラー・対応状況・優先度）
    const TITLES = [
      "API 5xxエラー急増（決済サービス）",
      "DBコネクションプール枯渇",
      "CloudWatch: CPU使用率 90%超アラーム",
      "画像アップロードのタイムアウト多発",
      "Snowflake 取り込みジョブ失敗",
      "ログイン失敗率の上昇",
      "配信キューの滞留",
      "証明書期限切れ間近アラート",
    ];
    const SEV: ("P1" | "P2" | "P3" | "P4")[] = ["P1", "P2", "P2", "P3", "P3", "P3", "P4", "P4"];
    const dayMs = 86_400_000;
    const incidentLog = Array.from({ length: incidents }, (_, k) => {
      const idx = (wk * 3 + k) % TITLES.length;
      const openedOffset = ((wk + k) % 6) * dayMs + 3 * 3600_000;
      const openedAt = new Date(period.start.getTime() + openedOffset).toISOString();
      // 約65%を対応済みに（決定的）
      const resolved = (wk + k) % 3 !== 0;
      const durMin = 40 + ((wk + k) % 5) * 55;
      return {
        ref: `#${1200 + wk * 7 + k}`,
        title: TITLES[idx],
        source: k % 2 === 0 ? "aws" : "github",
        severity: SEV[idx],
        status: resolved ? ("resolved" as const) : ("open" as const),
        openedAt,
        resolvedAt: resolved ? new Date(period.start.getTime() + openedOffset + durMin * 60_000).toISOString() : undefined,
        url: `https://github.com/example/repo/issues/${1200 + wk * 7 + k}`,
        permanentFix: resolved ? (wk + k) % 2 === 0 : undefined, // 対応済みの約半分を恒久対策済みに
      };
    });
    const manualOps = wobble(12, 7, 2); // 手運用・データ修正(トイル)
    const backlog = wobble(14, 6, 4);
    const firefighting = incidents * 3 + manualOps + wobble(8, 5, 1);
    const improvement = wobble(9, 5, 5);
    const activeUsers = 42_000 + wk * 380 + wobble(2000, 1500);

    return {
      quality: {
        availabilityPct: Math.round((99.98 - 0.06 * Math.abs(Math.sin(wk / 1.7))) * 1000) / 1000,
        errorRatePct: Math.round((0.4 + 0.3 * Math.abs(Math.sin(wk / 2))) * 100) / 100,
        latencyP95Ms: 420 + wobble(260, 200, 1),
        deployCausedIncidents: wobble(1, 2, 3),
        sloTargetPct: 99.9,
      },
      users: {
        activeUsers,
        newUsers: wobble(900, 350, 2),
        growthRatePct: Math.round((1.2 + 1.1 * Math.sin(wk / 2.1)) * 10) / 10,
        affectedUsers: incidents * (120 + wobble(300, 250, 1)),
      },
      work: {
        manualOpsTasks: manualOps,
        opsBacklog: backlog,
        oldestOpenDays: 8 + wobble(10, 6),
        firefightingItems: firefighting,
        improvementItems: improvement,
      },
      infra: {
        alertsFired: alerts,
        incidents,
        mttrMinutes: 45 + wobble(60, 40, 2),
        earlyDetectionRatePct: Math.min(100, 60 + wobble(30, 20, 3)),
      },
      dataPlatform: {
        pipelineSuccessRatePct: 95 + wobble(4, 4),
        freshnessLagMinutes: 12 + wobble(25, 20, 1),
        rowsProcessed: 1_200_000 + wobble(500_000, 400_000),
        failedJobs: wobble(3, 3, 2),
      },
      incidentLog,
      missingSources: [],
    };
  }
}
