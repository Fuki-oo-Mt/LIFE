# Luna 通信プロトコル v1（顔 ⇄ 頭脳の契約）

顔（`apps/web`）と頭脳（`apps/agent`）は、この WebSocket メッセージ契約**のみ**で連携する。
互いの内部実装には依存しない（疎結合）。

- エンドポイント: `ws://localhost:8000/ws`
- 形式: JSON テキストフレーム（1メッセージ = 1 JSON オブジェクト）

---

## クライアント → サーバ（顔 → 頭脳）

### `user_message`
社長の発話／指示。
```json
{ "type": "user_message", "session_id": "abc123", "text": "今日のAIニュースを3つ調べて要約して" }
```

---

## サーバ → クライアント（頭脳 → 顔）

ストリーミングで複数イベントが順次届く。1ターンは必ず `done` で終わる。

### `agent_thinking` — 思考の途中経過（任意・複数可）
```json
{ "type": "agent_thinking", "text": "ニュースソースを検索しています…" }
```

### `tool_call` — 業務ツールの実行開始（任意・複数可）
```json
{ "type": "tool_call", "name": "web_search", "args": { "query": "AI news" } }
```

### `tool_result` — ツールの実行結果（任意・複数可）
```json
{ "type": "tool_result", "name": "web_search", "ok": true, "summary": "3件取得" }
```

### `agent_token` — 応答テキストのストリーム断片（任意・複数可）
```json
{ "type": "agent_token", "text": "承知" }
```

### `agent_message` — 最終応答（必須・1回）
`emotion` は Live2D の表情・モーション切替に使う。
```json
{
  "type": "agent_message",
  "text": "社長、本日のAIニュースを3点にまとめました。…",
  "emotion": "happy"
}
```

`emotion` の取り得る値（顔はこれを表情にマッピングする）:
| 値 | 用途 |
|---|---|
| `neutral` | 通常 |
| `happy` | 報告完了・好結果 |
| `thinking` | 思考中・調査中 |
| `surprised` | 想定外・要確認 |
| `apologetic` | 失敗・お詫び |

### `done` — ターン終了（必須・1回、最後）
```json
{ "type": "done", "session_id": "abc123" }
```

### `error` — 異常通知
```json
{ "type": "error", "message": "LLMプロバイダに接続できませんでした" }
```

---

## 1ターンの典型シーケンス

```
顔 → 頭脳 : user_message
頭脳 → 顔 : agent_thinking
頭脳 → 顔 : tool_call
頭脳 → 顔 : tool_result
頭脳 → 顔 : agent_token (×N, ストリーム)
頭脳 → 顔 : agent_message (emotion 付き最終応答)
頭脳 → 顔 : done
```

顔側は `agent_message.emotion` で Luna の表情を変え、`agent_token`／`agent_message.text`
の流入中は口パク（リップシンク）を有効化する。
