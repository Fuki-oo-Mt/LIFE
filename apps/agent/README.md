# Luna — 頭脳（Agent Backend）

FastAPI + 自律エージェント + **LLM抽象化レイヤー** + **データ・フライホイール**。

## 起動

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

`LLM_PROVIDER=echo`（既定）なら **APIキー不要**で起動します。

## LLMプロバイダ切り替え（独立への布石）

`.env` の `LLM_PROVIDER` を変えるだけ。アプリ本体のコードは一切変更不要です。

| 値 | 頭脳 | 必要なもの |
|---|---|---|
| `echo` | ローカル擬似応答 | なし（既定） |
| `claude` | Anthropic Claude | `ANTHROPIC_API_KEY` |
| `gemini` | Google Gemini | `GEMINI_API_KEY` |
| `self_hosted` | **自社/ローカルモデル**（OpenAI互換） | `SELF_HOSTED_BASE_URL` |

> キーやSDKが欠けている場合は自動で `echo` に退避するため、MVPは決して止まりません。

## ディレクトリ

```
app/
├── main.py              FastAPI起動・/health・/ws
├── ws.py                WebSocketハンドラ（プロトコルv1）
├── config.py            .env読み込み
└── core/
    ├── llm/             ★LLM抽象化レイヤー（base/claude/gemini/echo/self_hosted/factory）
    ├── graph/agent.py   自律思考グラフ（route→act→respond, LangGraph同型）
    ├── tools/           業務ツール（get_time / web_search…）Tool/MCPの足場
    └── memory/          短期会話メモリ（pgvectorへの足場）
data/
└── flywheel.py          ★教師データ蓄積（JSONL+SQLite）+ SFT書き出し
```

## データ・フライホイール（自社の頭脳を育てる燃料）

全ターンを「入力→思考→ツール→結果」で記録（`data/store/` に JSONL と SQLite）。

```python
from data.flywheel import recorder
recorder.count()          # 蓄積件数
recorder.export_sft()     # 学習用SFT形式(JSONL)へ書き出し
```

これにより「Claude/Geminiで稼ぎながら、裏で自社モデルの教師データを蓄積」が実現します。

## テスト

```bash
# health と WebSocket往復の簡易確認（echoモード）
LLM_PROVIDER=echo python -c "from fastapi.testclient import TestClient; from app.main import app; print(TestClient(app).get('/health').json())"
```
