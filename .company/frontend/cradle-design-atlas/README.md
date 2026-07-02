# Cradle Design Atlas 🎨

Cradle社フロントエンドの**デザイン知の地図（Design Atlas）**。
UI/UXの設計判断を、勘ではなくデータで支えるための社内リソース。

## これは何か

50+のUIスタイル、161のカラーパレット、57のフォントペア、161の製品タイプ（推論ルール付き）、
99のUXガイドライン、25種のチャートを、React / Next.js / Vue / Svelte / SwiftUI / Flutter /
Tailwind / shadcn/ui など複数スタック横断で提供する、検索可能な設計インテリジェンス集。

## 構成

```
cradle-design-atlas/
├── skills/
│   ├── ui-ux-pro-max/     ← 中核：設計DB（data/*.csv）+ 検索スクリプト
│   ├── ui-styling/        ← Tailwind/shadcn 実装ガイド（フォント実体は除外）
│   ├── design-system/     ← デザイントークン設計
│   ├── brand/             ← ブランド定義
│   ├── design/            ← ロゴ/アイコン/CIP 等
│   ├── slides/            ← スライド
│   └── banner-design/     ← バナー
├── skill.json
└── LICENSE
```

## 使い方（Frontendエンジニア向け）

UIの設計判断（配色・タイポグラフィ・レイアウト・スタイル選定・UX品質）を行う際、
`.company/frontend/frontend-design.md`（全社デザイン指針）と併せて、本Atlasの該当
`skills/*/SKILL.md` / `references/` / `data/*.csv` を参照し、根拠ある選択を行うこと。

## 除外したもの（意図的）

- `skills/ui-styling/canvas-fonts/`（約5.5MBの `.ttf` フォント実体）は会社リポジトリ肥大化を
  避けるため除外。canvas描画で実フォントが必要になった場合のみ別途取得する。

---

### ライセンスと出典

本Atlasは、MITライセンスで公開されている設計データベースを基盤に、Cradle社の社内リソース
として再構成したものです。MITライセンスの条件に基づき、原著作権表示を同梱 `LICENSE` に
保持しています（法令遵守のため削除・改変しないこと）。
