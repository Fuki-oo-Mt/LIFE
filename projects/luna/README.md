# Project "Luna" 🌙

> Cradle社 第一号プロダクト —
> **Vtuber型コンパニオン（Live2D）× AaaS（自律型業務代行エージェント）**

画面の中で寄り添う2Dキャラクター「Luna」の"皮"の裏側で、AIエージェントが
社長の実務（リサーチ・文書作成・各種ツール操作）を自律的に代行します。

---

## アーキテクチャ

```
[社長] ⇄ apps/web (Next.js + Live2D「Luna」 + Chat UI)
            │  WebSocket（思考・発話・感情をリアルタイム配信）
            ▼
       apps/agent (FastAPI + LangGraph 自律エージェント)
            │   ├─ core/llm   ★LLM抽象化レイヤー (Claude / Gemini / 自社モデル を差し替え可能)
            │   ├─ core/graph  自律思考ループ
            │   ├─ core/tools  Tool / MCP 連携 (業務実行)
            │   └─ data        ★データ・フライホイール (教師データ蓄積 → 独立への燃料)
            ▼
       バックグラウンドで業務を自律遂行 → Lunaが報告
```

### 設計上の二大思想

| 思想 | 実装箇所 | 狙い |
|---|---|---|
| **LLM抽象化レイヤー** | `apps/agent/core/llm/` | 特定LLMに依存しない。Claude/Gemini を設定だけで差し替え、将来 `SelfHostedProvider` を足すだけで**他社LLMから独立**できる |
| **データ・フライホイール** | `apps/agent/data/` | 全業務ログを「入力→思考→行動→結果」の教師データ形式で蓄積。**自社の頭脳を育てる燃料庫** |

---

## ディレクトリ構成

```
LIFE/                         # Cradle社ワークスペース
├── .company/                 # 会社の統治ルール・各部署ペルソナ
├── apps/
│   ├── web/                  # 顔: Next.js + Live2D + Chat UI
│   └── agent/                # 頭脳: FastAPI + LangGraph
├── packages/
│   └── shared/               # 顔と頭脳で共有する通信プロトコル定義
└── infra/                    # 本番用 Docker / Postgres / Redis 構成
```

---

## クイックスタート（ローカルMVP）

ローカルMVPは Docker/Postgres 不要。教師データは JSONL + SQLite に蓄積されます。

### 1. 頭脳（Backend）

```bash
cd apps/agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # APIキーを記入（無くてもエコーモードで起動可）
uvicorn app.main:app --reload --port 8000
```

### 2. 顔（Frontend）

```bash
cd apps/web
npm install
npm run dev                   # http://localhost:3000
```

---

## LLMプロバイダの切り替え

`apps/agent/.env` の一行を変えるだけです。

```env
LLM_PROVIDER=claude     # claude | gemini | echo | self_hosted
```

将来、自社モデルが育ったら `LLM_PROVIDER=self_hosted` にするだけで他社から独立します。

---

## 通信プロトコル

`packages/shared/protocol.md` を参照。顔と頭脳はこの契約のみで疎結合に連携します。
