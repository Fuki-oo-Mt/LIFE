"use client";

// Live2D モデルの描画ステージ。
//
// 設計方針:
// - pixi.js + pixi-live2d-display は「任意導入」。未導入なら何も描画せず onUnavailable を呼ぶ
//   （呼び出し側 LunaAvatar が自動でSVGフォールバックに切り替える）。
// - これにより、Live2Dモデルや追加パッケージが無くても本MVPは必ずビルド・起動できる。
//
// Live2Dを有効化する手順は public/live2d/README.md を参照。

import { useEffect, useRef } from "react";

import type { Emotion } from "@/lib/types";

interface Live2DStageProps {
  modelUrl: string;
  emotion: Emotion;
  speaking: boolean;
  onUnavailable: () => void;
}

// Cubism Core はグローバルに読み込まれる必要がある（public/live2d/core/ に配置）。
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Live2DCubismCore?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PIXI?: any;
  }
}

export default function Live2DStage({
  modelUrl,
  emotion,
  speaking,
  onUnavailable,
}: Live2DStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;

    async function boot() {
      try {
        // 動的import。未導入ならcatchへ落ちてフォールバックに切り替わる。
        // @ts-expect-error 任意導入パッケージのため型は解決しないことがある
        const PIXI = await import("pixi.js");
        // @ts-expect-error 任意導入パッケージ
        const { Live2DModel } = await import("pixi-live2d-display");

        if (typeof window !== "undefined") {
          window.PIXI = PIXI;
        }
        if (
          typeof window === "undefined" ||
          !window.Live2DCubismCore
        ) {
          // Cubism Core 未配置 → フォールバック
          onUnavailable();
          return;
        }

        if (disposed || !canvasRef.current) return;

        const app = new PIXI.Application({
          view: canvasRef.current,
          autoStart: true,
          backgroundAlpha: 0,
          resizeTo: canvasRef.current.parentElement ?? undefined,
        });
        appRef.current = app;

        const model = await Live2DModel.from(modelUrl);
        if (disposed) return;
        modelRef.current = model;
        app.stage.addChild(model);

        // 画面に合わせて配置
        const parent = canvasRef.current.parentElement;
        if (parent) {
          const scale = Math.min(
            parent.clientWidth / model.width,
            parent.clientHeight / model.height
          );
          model.scale.set(scale * 0.9);
          model.x = parent.clientWidth / 2;
          model.y = parent.clientHeight / 2;
          model.anchor.set(0.5, 0.5);
        }
      } catch {
        // パッケージ未導入・読込失敗 → SVGフォールバックへ
        onUnavailable();
      }
    }

    boot();

    return () => {
      disposed = true;
      try {
        modelRef.current?.destroy?.();
        appRef.current?.destroy?.(true);
      } catch {
        // noop
      }
    };
    // モデルURLが変わったときのみ再構築
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  // 感情・発話をモデルの表情/モーションに反映（モデルが対応している場合）
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    try {
      model.expression?.(emotion);
    } catch {
      // 表情未対応モデルは無視
    }
  }, [emotion]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    try {
      // 発話中は口を開く（パラメータ名はモデル準拠。無ければ無視）
      model.internalModel?.coreModel?.setParameterValueById?.(
        "ParamMouthOpenY",
        speaking ? 1 : 0
      );
    } catch {
      // noop
    }
  }, [speaking]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      aria-label="Luna (Live2D)"
    />
  );
}
