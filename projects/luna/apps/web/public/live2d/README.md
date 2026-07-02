# Live2D モデルの差し込み手順

本MVPは既定で**SVGのLunaアバター**（追加依存ゼロ）で動作します。
本物のLive2Dモデルに差し替えたい場合のみ、以下を実施してください。

## 1. 追加パッケージを導入

```bash
cd apps/web
npm install pixi.js@6 pixi-live2d-display@0.4
```

> `apps/web/.npmrc` に `legacy-peer-deps=true` を設定済みのため peer 競合は起きません。

## 2. Cubism Core を配置

Live2D公式から `live2dcubismcore.min.js` を入手し、ここに置きます:

```
apps/web/public/live2d/core/live2dcubismcore.min.js
```

そして `apps/web/app/layout.tsx` の `<body>` 直前に次を追加してCoreを読み込みます:

```tsx
<script src="/live2d/core/live2dcubismcore.min.js" strategy="beforeInteractive" />
```

（`next/script` の `Script` コンポーネントを使用）

## 3. Lunaのモデルを配置

Cradleがデザインした「Luna」のCubismモデル一式を置きます:

```
apps/web/public/live2d/luna/luna.model3.json
apps/web/public/live2d/luna/luna.moc3
apps/web/public/live2d/luna/textures/...
apps/web/public/live2d/luna/motions/...
apps/web/public/live2d/luna/expressions/...   # neutral/happy/thinking/surprised/apologetic
```

> ⚠️ ライセンス注意: 第三者の商用Live2Dモデル（既存キャラクター）を流用しないこと。
> Lunaは自社オリジナルキャラクターとして制作・権利保有する。

## 4. 有効化

`apps/web/.env.local` に次を設定すると、起動時にLive2Dを試みます（失敗時は自動でSVGへ戻ります）:

```env
NEXT_PUBLIC_LUNA_LIVE2D_MODEL=/live2d/luna/luna.model3.json
```

## 表情マッピング

頭脳から届く `emotion`（neutral / happy / thinking / surprised / apologetic）を
`Live2DStage.tsx` が `model.expression(emotion)` に渡します。モデルの expressions の
名前を上記5種に合わせておくと、自動で表情が切り替わります。
