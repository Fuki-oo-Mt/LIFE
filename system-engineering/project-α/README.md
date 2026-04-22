# ✨ Diana — 完全自律型AIパートナーシステム

<div align="center">

**Phase 1: 頭脳とデータパイプラインの基礎構築**

`asyncio` × `watchdog` × `ChromaDB` × `Gemini API`

</div>

---

## 概要

**ディアナ**は、ユーザーと共に対話・業務を遂行し、自律的に学習して成長するAIパートナーシステムです。

Phase 1では、以下のコア機能をCLI上で実現しています：

- 🧠 **自律学習ループ** — フォルダ監視によるバックグラウンド学習
- 🔍 **許可制インターネット検索** — ハルシネーション排除のHuman-in-the-loop
- 💬 **構造化JSON出力** — 3Dエンジン連携を見据えた制御信号フォーマット
- 🪟 **オンデマンドUI制御** — 発話意図に基づくアバター表示トリガー

> キャラクター設定: **プラグマタのディアナ** — 純粋で心優しい女の子

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                     main.py (DI Root)                    │
├──────────┬──────────┬──────────┬──────────┬──────────────┤
│  CLI     │  Core    │  LLM     │  Memory  │  Watcher     │
│ (asyncio)│ Orchest. │ Provider │ VectorDB │ (thread)     │
│          │ Intent   │ Abstract │ Abstract │ folder_watch │
│          │ Meta-cog │ → Gemini │ → Chroma │ doc_parser   │
├──────────┴──────────┴──────────┴──────────┴──────────────┤
│  01_Learning/  →  02_Analyzed/  →  03_Workspace/         │
└─────────────────────────────────────────────────────────┘
```

**拡張ポイント**: LLM / VectorStore / Search はすべて抽象基底クラス。  
Phase 3でローカルLLMに移行する際は新クラスを追加して`.env`を1行変更するだけ。

---

## セットアップ

### 1. 仮想環境の作成

```bash
cd /path/to/project-α
python3 -m venv .venv
source .venv/bin/activate
```

### 2. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 3. 環境変数の設定

```bash
cp .env.template .env
```

`.env` を編集して **Gemini APIキー** を設定：

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-api-key-here
```

---

## 起動

```bash
source .venv/bin/activate
python main.py
```

### オフラインモード（ネットワーク不要）

`.env` の `LLM_PROVIDER` を `mock` に変更：

```env
LLM_PROVIDER=mock
```

---

## 使い方

### 基本的な対話

```
 🌙 あなた > やあ、ディアナ
  * にっこり *
╭─ 😊 ディアナ ─────────────────────────╮
│  わあ！来てくれたんだね！えへへ、嬉しいな！ │
╰───────────────────────────────────────╯
```

### UI呼び出し（Phase 4 トリガー）

```
 🌙 あなた > ディアナ、こっち来て
  🪟 [Phase 4] 3Dアバター表示トリガー発火
```

### 未知の質問 → 許可制検索 → 自律学習

```
 🌙 あなた > 量子コンピューターって何？
╭─ 🥺 ディアナ ─────────────────────────╮
│  ごめんね、その情報はわたしの中にはない  │
│  みたい…。インターネットで調べてもいい？  │
╰───────────────────────────────────────╯
  💡 許可が必要です。「いいよ」または「やめて」で応答してください。

 🌙 あなた > いいよ
  → ダミー検索実行 → 01_Learning に保存
  → フォルダ監視が自動検知 → ベクトルDB登録
  → 02_Analyzed へ移動 → 学習完了報告
```

### 特殊コマンド

| コマンド | 説明 |
|---|---|
| `status` | システム状態（知識ベース件数、会話ターン数等）を表示 |
| `exit` / `quit` | ディアナを終了 |

### 手動学習

`data/01_Learning/` フォルダにファイル（`.txt`, `.md`, `.pdf`）を追加すると、自動的に読み込み・学習が行われます。

---

## ディレクトリ構成

```
project-α/
├── main.py                 # エントリーポイント（asyncio + DI）
├── config.py               # 設定管理（.env 読込、フォルダ自動生成）
├── persona.yaml            # キャラクター設定（口調・性格）
├── requirements.txt        # 依存パッケージ
├── .env.template           # 環境変数テンプレート
│
├── core/                   # コアロジック
│   ├── orchestrator.py     #   メイン制御フロー
│   ├── intent_detector.py  #   ユーザー意図検出（UI表示等）
│   └── metacognition.py    #   自己評価（知識充足判定）
│
├── llm/                    # LLMプロバイダー（抽象化）
│   ├── base.py             #   抽象基底クラス
│   ├── gemini_provider.py  #   Gemini API 実装
│   └── mock_provider.py    #   オフラインテスト用モック
│
├── memory/                 # ベクトルDB（抽象化）
│   ├── base.py             #   抽象基底クラス
│   └── chroma_store.py     #   ChromaDB 実装
│
├── search/                 # 検索プロバイダー（抽象化）
│   ├── base.py             #   抽象基底クラス
│   └── dummy_provider.py   #   ダミー検索（Phase 1）
│
├── watcher/                # フォルダ監視
│   └── folder_watcher.py   #   watchdog による自律学習トリガー
│
├── parser/                 # ドキュメント解析
│   └── document_parser.py  #   txt/md/pdf テキスト抽出 + チャンク分割
│
├── output/                 # 出力管理
│   ├── schema.py           #   JSON出力スキーマ（Pydantic）
│   └── output_manager.py   #   CLI表示 + ファイル出力
│
├── interface/              # ユーザーインターフェース
│   └── cli.py              #   非同期CLI対話ループ
│
└── data/                   # 自動生成されるデータフォルダ
    ├── 01_Learning/        #   学習用（ここにファイルを置く）
    ├── 02_Analyzed/        #   解析済み（学習完了ファイル）
    └── 03_Workspace/       #   JSON出力の保存先
```

---

## JSON出力フォーマット

すべての応答は以下の構造化JSONで `03_Workspace/` に保存されます：

```json
{
  "ui_visibility": "show | hide",
  "need_permission": true | false,
  "emotion": "happy | thinking | neutral | apologetic | surprised",
  "action": "nodding | looking_around | typing | smiling | tilting_head",
  "text": "ユーザーへの応答テキスト",
  "internal_thought": "AIの内部思考ログ"
}
```

---

## 開発ロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| **Phase 1** | 頭脳とデータパイプライン（CLI対話・自律学習） | ✅ 完了 |
| **Phase 2** | 音声UI統合（STT / TTS） | 🔲 未着手 |
| **Phase 3** | 完全ローカル化（MLX / Ollama） | 🔲 未着手 |
| **Phase 4** | 超リアル3D・アニメーション連動（UE5） | 🔲 未着手 |

---

## トラブルシューティング

### `Collection expecting embedding with dimension of 48, got 384`

オフラインテスト後にオンラインで起動した場合に発生。vectordbを削除して再起動：

```bash
rm -rf data/02_Analyzed/.vectordb
python main.py
```

### `command not found: python`

venvを有効化してください：

```bash
source .venv/bin/activate
python main.py
```

### Gemini API エラー（ネットワーク不可）

`.env` で `LLM_PROVIDER=mock` に切り替えればオフラインで動作確認可能です。

---

## ライセンス

Private — 個人プロジェクト
