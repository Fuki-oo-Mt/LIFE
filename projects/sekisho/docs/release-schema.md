# リリースリスク観測スキーマ

週次レポートとは**独立して**、1件のリリース（またはPR束）の危険度を採点し、
分割/カナリアの提案を出す。危険度は 0-100（**高いほど危険**＝週次とは色の意味が逆）。
判定: 0–29 GO / 30–59 分割推奨 / 60–100 要レビュー。

## 形式

```jsonc
{
  "project": { "key": "client-portal", "name": "クライアントポータル" },
  "release": {
    "ref": "v2.4.0",                 // 識別子（タグ/PR番号）
    "title": "決済フロー刷新＋新機能A/B",
    "url": "https://github.com/...",
    // 変更規模
    "changedLines": 1800,            // 追加+削除
    "changedFiles": 46,
    "bundledPRs": 5,                 // 束ねたPR数
    // 影響範囲
    "servicesTouched": 3,            // 触ったサービス/デプロイ単位
    "criticalPaths": ["決済", "認証"], // 該当したクリティカルパス名
    // 変更種別（不可逆性）
    "hasDbMigration": true,
    "hasInfraChange": false,
    "dependencyMajorBump": false,
    // 品質
    "ciGreen": true,                 // false なら自動で要レビュー
    "reviewers": 2,
    "testsChanged": true,
    // 切り戻し
    "hasRollbackPlan": false,        // DBマイグレ有＋手順無 は自動で警告
    // タイミング
    "timing": "friday",              // normal | friday | late_night | freeze
    // 分割提案の材料（任意。あると精度が上がる）
    "units": [
      { "name": "決済テーブルのスキーマ追加", "type": "db" },
      { "name": "決済フロー刷新", "type": "critical" },
      { "name": "新機能A", "type": "feature" },
      { "name": "新機能B", "type": "feature" }
    ]
  }
}
```

`units[].type` は `db | infra | critical | feature | other`。分割プランはこの順（db→infra→critical→feature）で
安全に並べ替えられ、各ステップに出し方（Expand/Contract・単独カナリア・フラグ漸増）が付く。

## 生成方法（週次とは別）
- CLI: `npm run report:release -- release.json`（`--export` でHTMLも出力）
- API: `curl -X POST http://localhost:3000/api/release -H 'content-type: application/json' -d @release.json`

サンプル: [`docs/release.example.json`](release.example.json)
