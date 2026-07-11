import type { DataSource, Observations, Period } from "./types";

/**
 * Snowflake アダプタ（データ基盤の健全性・SLI）。
 * SDK(snowflake-sdk)は任意インストール。未導入なら "未接続" として明示する。
 *
 * 有効化: npm i snowflake-sdk  かつ .env に SNOWFLAKE_* を設定。
 * データ基盤の成否・鮮度・処理行数を1行で返すSQLを SNOWFLAKE_HEALTH_QUERY に外出しして差し替え可能。
 */
export class SnowflakeDataSource implements DataSource {
  readonly name = "snowflake";

  async collect(_period: Period): Promise<Partial<Observations>> {
    const account = process.env.SNOWFLAKE_ACCOUNT;
    const username = process.env.SNOWFLAKE_USERNAME;
    const password = process.env.SNOWFLAKE_PASSWORD;
    if (!account || !username || !password) {
      return { missingSources: ["snowflake"] };
    }

    // 未インストールでもビルドを通すため、モジュール指定子を変数化して静的解決を回避
    const modName = "snowflake-sdk";
    let sdk: any;
    try {
      sdk = await import(/* webpackIgnore: true */ modName);
    } catch {
      return { missingSources: ["snowflake (snowflake-sdk 未インストール)"] };
    }

    const connection = sdk.createConnection({
      account,
      username,
      password,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE,
      database: process.env.SNOWFLAKE_DATABASE,
      schema: process.env.SNOWFLAKE_SCHEMA,
    });

    const rows = await new Promise<Record<string, any>[]>((resolve, reject) => {
      connection.connect((err: any) => {
        if (err) return reject(err);
        const sqlText =
          process.env.SNOWFLAKE_HEALTH_QUERY ??
          `select
             null as pipeline_success_rate_pct,
             null as freshness_lag_minutes,
             null as rows_processed,
             0    as failed_jobs`;
        connection.execute({
          sqlText,
          complete: (e: any, _stmt: any, r: any) => (e ? reject(e) : resolve(r ?? [])),
        });
      });
    }).catch(() => null);

    if (!rows || rows.length === 0) {
      return { missingSources: ["snowflake (クエリ結果なし)"] };
    }
    const r = rows[0];
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

    return {
      dataPlatform: {
        pipelineSuccessRatePct: num(r.PIPELINE_SUCCESS_RATE_PCT ?? r.pipeline_success_rate_pct),
        freshnessLagMinutes: num(r.FRESHNESS_LAG_MINUTES ?? r.freshness_lag_minutes),
        rowsProcessed: num(r.ROWS_PROCESSED ?? r.rows_processed),
        failedJobs: Number(r.FAILED_JOBS ?? r.failed_jobs ?? 0),
      },
      missingSources: [],
    };
  }
}
