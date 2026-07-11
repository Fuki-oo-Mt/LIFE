# 関所 (Sekisho) — SRE運用レポーティング基盤

週次の「システム状態レポート」を **採点・保存・比較** するWebアプリ。
リリース時だけでなく、運用チームが**最低でも週1回**システムの健康状態を振り返るために使う。
どの会社でも使えるよう、データ源は**アダプタ差し替え**で吸収する。

## 何ができるか
- **週次システム状態レポート**を自動生成し、総合健全性スコア（0–100）で評価
- **健全性レーダー**で5次元（リリース品質／改善の余力／問い合わせ対応／インフラ安定／データ基盤）を可視化。前週の形を破線で重ね、健全性が縮んだ/広がったを一目で読む
- **インシデント・アラート台帳**：1件ずつ「何のエラーか／優先度(P1〜P4)／対応済み(Issueクローズ)か未対応か／滞留日数／再燃」。未対応を優先度順に上へ。発生/未対応/対応済・MTTR・最古の未対応も集計
- ⭐ **火消し vs 改善の時間配分**を可視化（「改善が進まない」構造を数字で突きつける）
- リリース／デプロイ、クライアント問い合わせ、インフラ、データ基盤の指標を集約
- レポートをDBに保存し、**前週比・トレンド**で比較
- **自己完結HTMLエクスポート**：サーバー無しで開ける1枚を `tmp/` に出力（`npm run export -- latest` / `ingest --export`）
- Claude による今週の所見と来週の推奨アクション（未設定時はテンプレにフォールバック）

## データの入れ方（2経路）

関所は**「取得」と「評価」を分離**している。アプリ自体はクライアント／社内システムへの
接続権限を必要としない。

### 経路A: 取り込み（推奨・権限が下りない環境向け）
アクセス権を持つ収集役（**Cursorエージェント**／スクリプト／手動）が生データを集め、
決まった形式のJSONにして取り込む。関所はそれを採点・保存・比較するだけ。
- スキーマ: [`docs/observation-schema.md`](docs/observation-schema.md)
- 収集役エージェント用プロンプト: [`docs/agent-collector-prompt.md`](docs/agent-collector-prompt.md)
- 取り込み: `npm run ingest -- observations.json` または `POST /api/ingest`

### 経路B: 直接接続（許可が下りる環境向け）
`SEKISHO_MODE=live` でアダプタが直接データ源に接続する。出力先は経路Aと同じ。

| データ源 | 取得指標 | 有効化 |
|---|---|---|
| **GitHub** | リリース/PR、クライアント問い合わせIssue、火消しvs改善 | `GITHUB_*` を設定 |
| **AWS CloudWatch** | アラート発報・インシデント検知 | `npm i @aws-sdk/client-cloudwatch` ＋ `AWS_*` |
| **Snowflake** | データ基盤の健全性・SLI | `npm i snowflake-sdk` ＋ `SNOWFLAKE_*` |
| **Mock** | 動作確認用サンプル | 既定（`SEKISHO_MODE=mock`） |

どちらの経路でも、未接続のデータ源はレポートに「未接続」と明示され、推測では埋めない。

## セットアップ
```bash
npm install
cp .env.example .env      # 必要に応じて編集
npm run db:push           # DB(SQLite dev.db)を作成
npm run seed              # 過去8週分のデモレポートを生成（mock）
npm run dev               # http://localhost:3000
```

## 実データに接続する
1. `.env` の `SEKISHO_MODE=live` に変更
2. `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` と、問い合わせ/インシデント/改善のラベルを設定
3. （任意）AWS・Snowflake の SDK をインストールし認証情報を設定
4. `npm run report:weekly -- --project <キー> --name <表示名>`

## 週次自動生成（cron 例）
毎週月曜 09:00 に前週分を生成：
```
0 9 * * 1  cd /path/to/sekisho && npm run report:weekly -- --project client-portal
```
（UIの「今週のレポートを生成」ボタン、または `POST /api/generate` でも生成可能）

## 本番デプロイ
- DBを PostgreSQL にする場合は `prisma/schema.prisma` の `provider` を `postgresql` にし、`DATABASE_URL` を差し替え → `npm run db:push`
- `npm run build && npm run start`、または Docker 化して自前ホスト

## スコアの考え方
100点満点から、各シグナル（インシデント数・変更失敗率・ビッグバン比率・火消し比率・問い合わせ滞留・エラー率・データ基盤の失敗など）を**説明可能に減点**する線形モデル。
重みは初期prior（`src/report/scoring.ts`）。運用データが貯まれば校正する前提で、外れても納得できる保守的な配分にしている。

## 構成
```
src/
  adapters/   データ源（github/aws/snowflake/mock）＋共通インターフェース
  report/     採点(scoring)・所見(narrative)・週次生成(weekly)・期間(period)
  app/        Next.js App Router（一覧 / 詳細+前週比較 / 生成API）
  lib/        表示ヘルパー
scripts/      seed / generate-weekly（cron用）
```

## リリースリスクレポート（週次とは別機能）
リリース直前の1件を採点し、分割/カナリアを提案する。危険度0-100（高いほど危険）。
- 生成: `npm run report:release -- release.json` または `POST /api/release`
- 判定: 0–29 GO / 30–59 分割推奨 / 60–100 要レビュー。要レビュー時は安全順の分割計画を出力
- 形式: [`docs/release-schema.md`](docs/release-schema.md)

## ロードマップ
- Slack通知レンダラー（導入決定後。レポートデータは共通、出力先を差し替えるだけ）
- インシデント/MTTRの取り込み精度向上、スコア重みの学習校正
