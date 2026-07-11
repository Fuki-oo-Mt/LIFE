# 観測データ（Observation）スキーマ

関所は**クライアント／社内システムに接続しない**。アクセス権を持つ収集役
（Cursorエージェント・スクリプト・手動）が生データを取得し、この形式のJSONにして
取り込む（`POST /api/ingest` または `npm run ingest -- file.json`）。

**取れた指標だけ埋めればよい**。未提供の値は0/nullとして扱われ、取れなかったデータ源は
`missingSources` に書けばレポートに「未接続」と明示される（推測で埋めない）。

## 形式

```jsonc
{
  "project": { "key": "client-portal", "name": "クライアントポータル" },
  // period を省略すると「先週（月〜日）」で集計
  "period": { "start": "2026-07-06T00:00:00Z", "end": "2026-07-13T00:00:00Z" },

  "observations": {
    "quality": {           // アプリ品質（ユーザーが体感する品質）— AWS等
      "availabilityPct": 99.95,     // 可用性(%)
      "errorRatePct": 0.42,         // エラー率(%)
      "latencyP95Ms": 680,          // p95応答時間(ms)
      "deployCausedIncidents": 1,   // リリース/hotfix起因の障害数
      "sloTargetPct": 99.9          // 可用性SLOの目標(%)。エラーバジェット残量の算出に使う
    },
    "users": {             // ユーザー（開発者に見えにくい利用実態）— Snowflake/計測
      "activeUsers": 48200,
      "newUsers": 940,
      "growthRatePct": 1.8,         // 前週比 増加率(%)
      "affectedUsers": 1200         // インシデントで影響を受けたユーザー数
    },
    "work": {              // GitHub Issue 由来（運用対応＝障害 or 手運用・作業分類）
      "manualOpsTasks": 12,     // 手運用・データ修正(DB直接入力等)の件数 ＝ トイル
      "opsBacklog": 14,         // 未完了の運用対応(障害＋手運用)の残数
      "oldestOpenDays": 12,     // 最古の未完了の滞留日数
      "firefightingItems": 33,  // 火消し合計(障害対応＋手運用)の件数
      "improvementItems": 9     // 改善・信頼性向上タスクの件数
    },
    "infra": {             // AWS CloudWatch 由来（インシデント対応）
      "alertsFired": 42,
      "incidents": 5,
      "mttrMinutes": 63,
      "earlyDetectionRatePct": 78
    },
    "dataPlatform": {      // Snowflake 由来
      "pipelineSuccessRatePct": 98.5,
      "freshnessLagMinutes": 22,
      "rowsProcessed": 1350000,
      "failedJobs": 2
    }
  },

  "incidentLog": [         // インシデント/アラートを1件ずつ（台帳になる）
    {
      "ref": "#4821",              // Issue番号やアラーム名
      "title": "API 5xxエラー急増（決済サービス）",  // 何のエラーか
      "source": "aws",             // aws / github / datadog ...
      "severity": "P1",            // P1(最重要)〜P4
      "status": "open",            // open=未対応 / resolved=対応済(Issueクローズ)
      "openedAt": "2026-07-07T02:14:00Z",
      "resolvedAt": null,          // 対応済のときのみ（MTTR算出に使う）
      "url": "https://github.com/example/repo/issues/4821",
      "permanentFix": false        // 恒久対策済みか（任意。恒久対策率の算出に使う）
    }
  ],

  "missingSources": []     // 例: ["snowflake（今週は権限取得できず）"]
}
```

自動で算出されるもの（入力不要）:
- `incidentLog` から: 発生/未対応/対応済の件数、優先度別の未対応数、MTTR、最古の滞留日数、
  **再発率**（同タイトルの再燃）、**恒久対策率**（permanentFixがある場合）
- `infra.alertsFired` と `incidents` から: **アラートノイズ率**（実障害にならなかったアラームの割合）
- `quality.availabilityPct` と `sloTargetPct` から: **エラーバジェット残量**
未対応の重大(P1/P2)や再発・低い恒久対策率は、健全性スコアの減点にも反映される。

## 取り込み方法
- API: `curl -X POST http://localhost:3000/api/ingest -H 'content-type: application/json' -d @observations.json`
- CLI: `npm run ingest -- observations.json`

サンプル: [`docs/observation.example.json`](observation.example.json)
