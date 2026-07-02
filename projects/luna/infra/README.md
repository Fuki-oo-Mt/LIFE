# Luna インフラ

## ローカルMVP

**不要**。`apps/agent` は教師データを `data/store/`（SQLite + JSONL）に蓄積し、
追加インフラなしで動作します。

## スケール時（本番/ステージング）

```bash
docker compose -f infra/docker-compose.yml up -d
```

| サービス | 用途 | 移行先 |
|---|---|---|
| PostgreSQL + pgvector | 長期記憶（RAG）・教師データ正本 | `app/core/memory/store.py` の差し替え先 |
| Redis | 自律タスクのキュー・エージェント状態 | バックグラウンド業務の常駐実行 |

> シークレットは環境変数（`.env` / Secrets Manager）で注入し、コードには埋め込まない。

## デプロイ指針

- 顔（apps/web）… Vercel（静的＋エッジ）
- 頭脳（apps/agent）… Cloud Run / Fly.io（WebSocket常駐、オートスケール）
- CI/CD … push毎に `npm run build`（顔）と バックエンドのスモークテストを実行
