# Luna AI画像生成プロンプト集

> 「Luna」の原画をAIで試作するためのプロンプト集。
> [CHARACTER_SHEET.md](./CHARACTER_SHEET.md) の設定に準拠。
> 推奨ツール: **NijiJourney**（アニメ調に最適）/ Midjourney / Stable Diffusion系（Animagine, Pony等）。

---

## 0. 大前提（Live2D化のコツ）

Live2Dにするには、後で**パーツ分け（PSDレイヤー化）**できる絵が要ります。AI生成時は:

- **正面・直立・左右対称**のポーズを狙う（横向き・複雑なポーズは避ける）。
- **背景は白/単色**（切り抜き・レイヤー分解が楽）。
- 髪・腕・服が体に大きく重ならない、すっきりした構図。
- 顔まわりがはっきり見える構図（表情差分を作りやすい）。
- 気に入った1枚が出たら **seedを固定**し、同一キャラのまま表情や角度だけ振る。

> ⚠️ Lunaは幼い少女です。**健全・清楚・全身しっかり着衣**の、マスコット/キャラクター
> デザイン文脈で生成してください（露出・性的表現は厳禁。会社の公式キャラです）。

---

## ★ Gemini（Nano Banana）— 本プロジェクト採用ツール

Geminiは**キャラの一貫性・会話での編集**が得意。「まず1枚の基準Lunaを作り、それを土台に
表情や角度だけ振っていく」流れが最適です。`--niji` のようなフラグは不要で、**自然な日本語の
指示**で構いません。

### STEP 1 — 基準となるLunaを1枚作る

Geminiに次を指示（アプリでもAPIでも可）:

```
オリジナルのマスコットキャラクター「Luna」を1枚描いてください。
・西洋系の女の子、7歳くらい、色白
・金髪のショートボブ（毛先は軽く内巻き、短いサイド毛束）、右サイドに三日月の髪飾り
・大きくて丸い空色の瞳
・月夜をイメージした青紫のワンピース、淡いラベンダーのエプロン、襟もとに小さなピンクのリボン
・穏やかな微笑み、4〜5頭身のデフォルメ
・正面向き・直立・左右対称のポーズ
・背景は真っ白（無地）、全身が入る構図
・柔らかいセルシェード、綺麗な線画、公式キャラクターデザイン画のように
配色の目安：髪 #f4d06a / 肌 #ffe7d4 / 瞳 #5b8def / 服 #9aa7e8 / リボン #ef9bb3
※健全で清楚、しっかり着衣のデザインにしてください。
```

気に入った1枚が出るまで微修正（「もう少し幼く」「髪飾りを大きく」等）。**これが基準Luna**。

### STEP 2 — 基準Lunaを固定して"編集"する

出た基準画像を**そのまま次の指示の土台**にします（Geminiは直前画像を覚えている／画像を
添付して指示も可）。ここがGeminiの真骨頂です。合言葉は「**このLunaのまま**」。

```
このLunaのまま、髪型・髪飾り・瞳の色・服・配色は一切変えず、
表情だけ「にっこり笑った顔（happy）」に変えてください。背景は白のまま。
```

### STEP 3 — 表情差分を5種そろえる

STEP 2を繰り返し、以下5種を**同じLunaのまま**生成（ファイル名は英字を推奨）:

| emotion | 指示する表情 |
|---|---|
| `neutral` | 通常。穏やかな微笑み |
| `happy` | 目を弓なりに細めた満面の笑み、頬を赤く |
| `thinking` | 視線を少し上に、口は真横の小さな線、少し考え込む眉 |
| `surprised` | 目を大きく見開き、口は小さく「お」の形 |
| `apologetic` | 眉を八の字にした困り笑い、少し伏し目 |

> コツ: 毎回「**このLunaのまま／髪型・髪飾り・瞳の色・服は変えない**」を必ず添える。
> ブレたら基準画像を添付し直して「この子に戻して」と指示。

### STEP 4 — リギング用の立ち絵

```
このLunaのまま、全身・直立・正面向きで、腕を体から少し離した自然な立ちポーズにしてください。
背景は真っ白、頭から靴まで全身が入る構図、左右対称でお願いします。
```

### Geminiでのコツ

- 縦長が欲しい場合は「**縦長（3:4）で**」と口頭指定（アスペクト比も日本語でOK）。
- 一貫性が崩れたら、**基準画像を添付**して「この子をベースに」と指示し直すのが最速。
- 生成後、**背景の白を透過に**したい時は「背景を透明にして」または後処理（`rembg`等）。
- レイヤー分けPSDは自動生成されない点は他ツールと同じ（手分解が必要）。

---

## 1. メインビジュアル（NijiJourney / Midjourney）

```
original mascot character design, a cheerful little blonde girl named Luna,
western/european child, around 7 years old, fair pale skin, big round sky-blue eyes,
short blonde bob haircut with soft inward curls and short side locks, a small
crescent-moon hairpin on the right side, wearing a modest moonlit blue-purple
one-piece dress with a light lavender apron and a small pink ribbon at the collar,
gentle smile, chibi proportions (4-5 heads tall), soft cel-shading, clean line art,
front view, standing straight, symmetrical, simple plain white background,
official character sheet art, wholesome, high quality
--niji 6 --ar 2:3 --style expressive
```

**カラー指定を強めたい場合**は末尾に追記:
```
color palette: hair #f4d06a, skin #ffe7d4, eyes #5b8def, dress #9aa7e8, ribbon #ef9bb3
```

---

## 2. 立ち絵（リギング用・全身Tポーズ寄り）

Live2Dの土台にする、全身・直立の1枚。
```
full body, original chibi mascot girl "Luna", blonde short bob, crescent-moon hairpin,
sky-blue eyes, pale skin, moonlit blue-purple one-piece dress with lavender apron and
pink collar ribbon, standing straight and facing front, arms slightly away from body,
neutral relaxed pose, symmetrical, flat soft cel-shading, clean outlines,
plain white background, full figure visible head to shoes, character reference sheet
--niji 6 --ar 3:4
```

---

## 3. 表情差分シート（5種）

同一キャラで表情だけ振る。seedを固定して各 emotion を生成。
```
expression sheet of the same character "Luna" (blonde bob, crescent hairpin, blue eyes),
five head-and-shoulders portraits, front view, consistent design, plain white background:
1) neutral, calm gentle smile
2) happy, big bright smile with closed arched eyes, rosy cheeks
3) thinking, looking slightly upward, small straight mouth, faint concerned brows
4) surprised, wide open eyes, small round "o" mouth, raised eyebrows
5) apologetic, troubled smile, eyebrows raised inward (worried), slightly downcast eyes
soft cel-shading, clean line art --niji 6 --ar 3:2
```

> 実運用では、1表情ずつ個別生成→良い物を採用する方が破綻しにくいです。

---

## 4. Stable Diffusion系（タグ式・Animagine/Pony 等）

**Positive:**
```
masterpiece, best quality, official art, 1girl, child, chibi, blonde hair,
short bob cut, sidelocks, crescent moon hair ornament, blue eyes, big eyes,
pale skin, light purple one-piece dress, apron, pink ribbon, gentle smile,
standing, facing viewer, symmetrical, simple background, white background,
full body, cel shading, clean lineart
```

**Negative:**
```
lowres, bad anatomy, bad hands, extra fingers, extra limbs, missing limbs,
worst quality, low quality, jpeg artifacts, signature, watermark, text,
cropped, out of frame, cluttered background, dark background, nsfw, cleavage,
revealing clothes, long hair, twintails, adult, mature
```

**推奨設定**: Steps 28-35 / CFG 6-8 / Sampler DPM++ 2M Karras / 解像度 832x1216（縦）。
背景透過が要る場合は生成後に `rembg` 等で切り抜き。

---

## 5. 生成後の流れ

1. 気に入った1枚を確定（seedメモ）。
2. 表情差分5種・立ち絵を同一キャラで揃える。
3. Photoshop/CLIP STUDIOで **パーツ別レイヤーに分解**（[CHARACTER_SHEET.md](./CHARACTER_SHEET.md) 6-1 参照）。
4. Live2D Cubism Editor でリギング → `.moc3` 一式を書き出し。
5. このフォルダ（`apps/web/public/live2d/luna/`）に配置 → [../README.md](../README.md) の手順で有効化。

---

## 6. 権利の注意

- AI生成物であっても、**第三者の既存キャラクターに酷似させない**こと。
- 使用する生成サービスの**商用利用規約**を必ず確認すること（Cradleの商用プロダクトで使用するため）。
