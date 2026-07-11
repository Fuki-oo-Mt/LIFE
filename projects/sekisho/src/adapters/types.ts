/**
 * データ源アダプタの共通インターフェース。
 * GitHub / AWS / Snowflake / Mock はすべてこの形に合わせる（＝会社ごとの差を吸収し汎用化）。
 * 週次レポートエンジンは、この「正規化された観測データ」だけを見る。
 */

export interface Period {
  start: Date;
  end: Date;
}

/** アプリ品質: ユーザーが体感する品質（AWSログ/メトリクス等） */
export interface QualityObservations {
  availabilityPct: number | null; // 可用性(%)
  errorRatePct: number | null; // エラー率(%)
  latencyP95Ms: number | null; // p95 応答時間(ms)
  deployCausedIncidents: number; // リリース/hotfix起因の障害数
  sloTargetPct: number | null; // 可用性SLOの目標(%) 例: 99.9。エラーバジェット算出に使う
}

/** ユーザー: 開発者からは見えにくい利用実態（Snowflake/アプリ計測等） */
export interface UserObservations {
  activeUsers: number | null; // アクティブユーザー数
  newUsers: number | null; // 新規ユーザー数
  growthRatePct: number | null; // 前週比 増加率(%)
  affectedUsers: number | null; // インシデントで影響を受けたユーザー数
}

/** GitHub Issue由来: 運用対応（届く作業＝障害 or 手運用）＆作業分類 */
export interface WorkObservations {
  manualOpsTasks: number; // 手運用・データ修正(DB直接入力等)の件数 ＝ トイル
  opsBacklog: number; // 未完了の運用対応(障害＋手運用)の残数
  oldestOpenDays: number | null; // 最古の未完了の運用対応の滞留日数
  // 「火消し vs 改善」を測るための作業分類（件数ベースの近似）
  firefightingItems: number; // 火消し合計（障害対応＋手運用）
  improvementItems: number; // 改善・信頼性向上タスク
}

/** AWS CloudWatch由来: アラート／インシデント対応 */
export interface InfraObservations {
  alertsFired: number; // 発報したアラーム数
  incidents: number; // インシデント件数
  mttrMinutes: number | null; // 平均復旧時間(分)
  earlyDetectionRatePct: number | null; // 顧客報告より先に検知できた割合(%)
}

/** Snowflake由来: データ基盤の健全性 */
export interface DataPlatformObservations {
  pipelineSuccessRatePct: number | null; // データパイプライン成功率(%)
  freshnessLagMinutes: number | null; // データ鮮度の遅延(分)
  rowsProcessed: number | null; // 処理行数
  failedJobs: number; // 失敗ジョブ数
}

/** インシデント/アラート1件（台帳の行）。どんなエラーが・対応済みか・優先度は、を持つ */
export interface IncidentRecord {
  ref?: string; // 例: GitHub Issue #123 / CloudWatchアラーム名
  title: string; // 何のエラーが起きたか
  source?: string; // "aws" | "github" | "datadog" ...
  severity?: "P1" | "P2" | "P3" | "P4"; // 優先度（P1が最も重い）
  status: "open" | "resolved"; // resolved = 対応済み（GitHub Issueがクローズ）
  openedAt?: string; // ISO日時
  resolvedAt?: string; // ISO日時（対応済みのみ）
  url?: string; // Issue/アラームへのリンク
  permanentFix?: boolean; // 恒久対策済みか（暫定対応でなく根本対策）
}

/** 1プロジェクト・1期間分の、正規化済み観測データ一式 */
export interface Observations {
  quality: QualityObservations;
  users: UserObservations;
  work: WorkObservations;
  infra: InfraObservations;
  dataPlatform: DataPlatformObservations;
  /** インシデント/アラートの台帳（1件ずつ）。無ければ空配列 */
  incidentLog: IncidentRecord[];
  /** 収集に失敗した/未接続のデータ源（レポートに「未接続」と明示するため） */
  missingSources: string[];
}

/** すべてのアダプタが実装する契約 */
export interface DataSource {
  readonly name: string;
  collect(period: Period): Promise<Partial<Observations>>;
}

/** 空の観測（アダプタ結果のマージ初期値） */
export function emptyObservations(): Observations {
  return {
    quality: {
      availabilityPct: null, errorRatePct: null, latencyP95Ms: null,
      deployCausedIncidents: 0, sloTargetPct: null,
    },
    users: {
      activeUsers: null, newUsers: null, growthRatePct: null, affectedUsers: null,
    },
    work: {
      manualOpsTasks: 0, opsBacklog: 0, oldestOpenDays: null,
      firefightingItems: 0, improvementItems: 0,
    },
    infra: {
      alertsFired: 0, incidents: 0, mttrMinutes: null,
      earlyDetectionRatePct: null,
    },
    dataPlatform: {
      pipelineSuccessRatePct: null, freshnessLagMinutes: null,
      rowsProcessed: null, failedJobs: 0,
    },
    incidentLog: [],
    missingSources: [],
  };
}
