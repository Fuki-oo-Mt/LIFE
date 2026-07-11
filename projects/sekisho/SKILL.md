---
name: sekisho-weekly-report
description: SREの週次システム状態レポートを生成する。アクセス権を持つエージェントがAWS/Snowflake/GitHubからデータを集め、関所アプリで採点・保存・可視化する。「今週のレポート作って」「週次の運用レポート」等で発火。
---

# 関所 (Sekisho) — 週次システム状態レポート生成スキル

あなた（エージェント）は**収集役**です。関所アプリ自体はクライアント／社内システムへの
アクセス権を持ちません。**アクセスできるのはあなただけ**なので、あなたがデータを集め、
このスキルの手順で関所に取り込みます。

## 前提（初回だけ・このフォルダ内で実行）
```bash
npm install
npm run db:push     # ローカルDB(dev.db)を作成
```

## 手順

### STEP 1 — 先週分のデータを集める
対象期間は「先週の月曜〜日曜」。**アクセスできる範囲だけ**でよい。
取れない項目は空のままにし、後述の missingSources に源の名前を書く。**数値を推測で作らないこと。**

レポートの狙いは**アプリの品質とユーザーの実態**（開発者や外部からは見えず、運用チームしか
分からない部分）。開発スループット（PR数・リードタイム等）は集めない。

集める指標と、収集コマンドの例（環境に合わせて調整する）:

**AWS（ログ/メトリクス → アプリ品質・インシデント）** — AWS CLI
```bash
# 可用性・エラー率・p95応答時間（ユーザーが体感する品質）
aws cloudwatch get-metric-data --start-time <先週月曜> --end-time <先週日曜> ...
# アラート発報・インシデント
aws cloudwatch describe-alarm-history --history-item-type StateUpdate \
  --start-date <先週月曜> --end-date <先週日曜> --max-records 100
```
→ quality.availabilityPct / errorRatePct / latencyP95Ms / sloTargetPct(可用性SLO目標)、
  infra.alertsFired / incidents / mttrMinutes / earlyDetectionRatePct
（アラートノイズ率・エラーバジェット残量は自動算出）

**Snowflake（利用実態＝ユーザー・データ基盤）** — snowsql / CLI
```bash
snowsql -q "select ... as active_users, ... as new_users,
                   ... as growth_rate_pct, ... as affected_users"     # users.*
snowsql -q "select ... as pipeline_success_rate_pct, ... as failed_jobs"  # dataPlatform.*
```

**GitHub（今週のsprintチケット・運用対応・インシデント台帳）** — `gh` CLI
```bash
gh issue list --state all --search "updated:>=<先週月曜>" --limit 200
```
- 届く作業は「障害」か「手運用」。Issueを分類する:
  - incident / 障害 ラベル → **障害対応**（インシデント台帳 `incidentLog` に1件ずつ）
  - 運用作業 / データ修正 / toil / 手運用 ラベル → **手運用(work.manualOpsTasks)** ＝ トイル
  - 障害＋手運用のopen → work.opsBacklog、その最古の滞留 → work.oldestOpenDays
  - 上記どちらも火消し(work.firefightingItems)に合算、feature/improvement/改善 → work.improvementItems
  - revert/rollback/hotfix したPR → quality.deployCausedIncidents（リリース起因の障害）
- **インシデント台帳(`incidentLog`)を1件ずつ埋める**: 何のエラーか(title)、発生源(source)、
  優先度(severity: P1〜P4。ラベルや重大度から判定)、対応状況(status: Issueがopen=未対応 / closed=resolved=対応済)、
  発生日時(openedAt)、対応日時(resolvedAt)、リンク(url)、恒久対策済みか(permanentFix: 任意)。
  → 未対応の優先度順表示・MTTR・再発率・恒久対策率に使われる。

### STEP 2 — observations.json を書く
`docs/observation-schema.md` の形式で、集めた値を埋める。
取れなかった源は `missingSources` に明記（例: `["snowflake（今週は権限取得できず）"]`）。
雛形は `docs/observation.example.json`。

### STEP 3 — 取り込む（採点・保存）
```bash
npm run ingest -- observations.json            # 取り込みのみ
npm run ingest -- observations.json --export   # 取り込み＋HTML書き出し
```
→ スコア・レベル・レポートIDが表示される。`--export` を付けると `tmp/sekisho/` に
サーバー不要で開ける1枚のHTMLレポートも出力される（共有用）。

### STEP 4 — 見る
```bash
npm run dev     # http://localhost:3000  ダッシュボードで見る（レーダー/前週比/台帳）
```
または、書き出したHTML（`tmp/sekisho/<project>_<期間>.html`）をブラウザで直接開く。
既存レポートを後から書き出すには: `npm run export -- latest --project <キー>`

## （別機能）リリースリスクレポート
週次とは独立して、1件のリリースの危険度採点＋分割提案を出せる。
リリース直前に、変更差分・クリティカルパス・DBマイグレ・CI・切り戻し・タイミングを集めて
`docs/release-schema.md` の形式にし、次で生成する:
```bash
npm run report:release -- release.json [--export]   # または POST /api/release
```
判定は GO / 分割推奨 / 要レビュー。要レビュー時は「安全順の分割リリース計画」が出る。

## ルール
- **推測で数値を作らない。** 取れないものは空＋missingSources。
- 期間は先週（月〜日）。特定週を指定するなら observations.json の `period` に入れる。
- `project.key` は対象システムごとに固定する（週をまたいで同じキー＝前週比が効く）。
- 所見を賢く出したい場合は `.env` に `ANTHROPIC_API_KEY` を設定（無くてもテンプレ所見が出る）。

## この設計の要点
関所はデータ源に接続しない。**あなた（アクセス権を持つエージェント）が集め、関所は採点・保存・比較に徹する。**
将来、関所に直接接続の許可が下りたら `.env` の `SEKISHO_MODE=live` に切り替えられる（出力先は同じ）。
