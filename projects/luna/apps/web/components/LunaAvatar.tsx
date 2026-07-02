"use client";

// Lunaアバター。Live2Dモデルがあればそれを、無ければSVGフォールバックを自動で出し分ける。
//
// 既定では Live2D を試みず、即座に美しいSVGフォールバックを表示する（追加依存ゼロで動く）。
// 環境変数 NEXT_PUBLIC_LUNA_LIVE2D_MODEL にモデルのパス（例: /live2d/luna/luna.model3.json）
// を設定すると、Live2D の読み込みを試み、失敗時は自動でSVGへ戻る。

import dynamic from "next/dynamic";
import { useState } from "react";

import FallbackAvatar from "./FallbackAvatar";
import type { Emotion } from "@/lib/types";

// Live2Dステージはクライアント専用（SSR無効）で遅延ロード
const Live2DStage = dynamic(() => import("./live2d/Live2DStage"), {
  ssr: false,
});

interface LunaAvatarProps {
  emotion: Emotion;
  speaking: boolean;
}

const MODEL_URL = process.env.NEXT_PUBLIC_LUNA_LIVE2D_MODEL ?? "";

export default function LunaAvatar({ emotion, speaking }: LunaAvatarProps) {
  // Live2Dが使えないと判明したらフォールバックに固定する
  const [useFallback, setUseFallback] = useState(!MODEL_URL);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {useFallback ? (
        <FallbackAvatar emotion={emotion} speaking={speaking} />
      ) : (
        <Live2DStage
          modelUrl={MODEL_URL}
          emotion={emotion}
          speaking={speaking}
          onUnavailable={() => setUseFallback(true)}
        />
      )}
    </div>
  );
}
