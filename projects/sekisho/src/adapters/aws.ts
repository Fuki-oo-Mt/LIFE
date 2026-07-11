import type { DataSource, Observations, Period } from "./types";

/**
 * AWS CloudWatch アダプタ（ログ→アラート／早期インシデント検知）。
 * SDK(@aws-sdk/client-cloudwatch)は任意インストール。未導入なら "未接続" として明示する。
 *
 * 有効化: npm i @aws-sdk/client-cloudwatch  かつ .env に AWS 認証情報を設定。
 */
export class AwsCloudWatchDataSource implements DataSource {
  readonly name = "aws";

  async collect(period: Period): Promise<Partial<Observations>> {
    const region = process.env.AWS_REGION;
    const key = process.env.AWS_ACCESS_KEY_ID;
    const secret = process.env.AWS_SECRET_ACCESS_KEY;
    if (!region || !key || !secret) {
      return { missingSources: ["aws"] };
    }

    // 未インストールでもビルドを通すため、モジュール指定子を変数化して静的解決を回避
    const modName = "@aws-sdk/client-cloudwatch";
    let cw: any;
    try {
      cw = await import(/* webpackIgnore: true */ modName);
    } catch {
      return { missingSources: ["aws (@aws-sdk/client-cloudwatch 未インストール)"] };
    }

    const client = new cw.CloudWatchClient({ region });
    const history = await client.send(
      new cw.DescribeAlarmHistoryCommand({
        HistoryItemType: "StateUpdate",
        StartDate: period.start,
        EndDate: period.end,
        MaxRecords: 100,
      }),
    );
    const items: any[] = history.AlarmHistoryItems ?? [];
    const prefix = process.env.AWS_ALARM_PREFIX ?? "";
    const alarmToState = items.filter(
      (h: any) =>
        (!prefix || (h.AlarmName ?? "").startsWith(prefix)) &&
        /"newState":\{"stateValue":"ALARM"/.test(h.HistoryData ?? ""),
    );

    return {
      infra: {
        alertsFired: alarmToState.length,
        incidents: new Set(alarmToState.map((h: any) => h.AlarmName)).size,
        mttrMinutes: null,
        earlyDetectionRatePct: null,
      },
      // 可用性/エラー率/レイテンシは GetMetricData で引く拡張余地（ここでは未取得）
      quality: { availabilityPct: null, errorRatePct: null, latencyP95Ms: null, deployCausedIncidents: 0, sloTargetPct: null },
      missingSources: [],
    };
  }
}
