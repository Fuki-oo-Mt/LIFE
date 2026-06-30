"use client";

// Lunaのフォールバック・アバター（Live2Dモデルが無くても動く高品質SVG）。
// キャラ: 西洋系・金髪・ショートボブ・色白・大きな瞳の7歳くらいの少女「Luna」。
// - emotion で表情（目・眉・口）が変化
// - speaking=true で口パク（リップシンク）
// - 待機中はまばたき & ゆっくり上下に揺れる
//
// これはCradleのオリジナルキャラクターであり、既存の商用キャラクターの模倣ではない。

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import type { Emotion } from "@/lib/types";

interface FallbackAvatarProps {
  emotion: Emotion;
  speaking: boolean;
}

const SKIN = "#ffe7d4";
const SKIN_SHADOW = "#f7cdb2";
const HAIR = "#f4d06a";
const HAIR_SHADOW = "#e0b347";
const HAIR_LIGHT = "#ffe49b";
const EYE = "#5b8def";
const EYE_DARK = "#3461c4";
const BLUSH = "#ffb3b3";
const MOUTH = "#c95b6a";

export default function FallbackAvatar({ emotion, speaking }: FallbackAvatarProps) {
  const [blink, setBlink] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);

  // まばたき（ランダム間隔）
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const delay = 2200 + Math.random() * 2600;
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, delay);
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  // 口パク（発話中のみ）
  useEffect(() => {
    if (!speaking) {
      setMouthOpen(false);
      return;
    }
    const interval = setInterval(() => {
      setMouthOpen((v) => !v);
    }, 140);
    return () => clearInterval(interval);
  }, [speaking]);

  const eyesClosed = blink || emotion === "happy";

  // 眉の位置・角度を感情で変える
  const browY =
    emotion === "surprised" ? -6 : emotion === "apologetic" ? 4 : 0;
  const browAngle =
    emotion === "apologetic" ? 10 : emotion === "thinking" ? -6 : 0;

  // 口の形を感情・発話で変える
  const renderMouth = () => {
    if (speaking) {
      return (
        <motion.ellipse
          cx="100"
          cy="150"
          rx="9"
          ry={mouthOpen ? 9 : 3}
          fill={MOUTH}
          animate={{ ry: mouthOpen ? 9 : 3 }}
          transition={{ duration: 0.1 }}
        />
      );
    }
    switch (emotion) {
      case "happy":
        return (
          <path
            d="M88 147 Q100 162 112 147"
            stroke={MOUTH}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
        );
      case "surprised":
        return <ellipse cx="100" cy="151" rx="7" ry="8" fill={MOUTH} />;
      case "apologetic":
        return (
          <path
            d="M90 153 Q100 146 110 153"
            stroke={MOUTH}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
        );
      case "thinking":
        return (
          <path
            d="M92 151 L108 149"
            stroke={MOUTH}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
        );
      default:
        return (
          <path
            d="M91 149 Q100 155 109 149"
            stroke={MOUTH}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        );
    }
  };

  const renderEye = (cx: number) => {
    if (eyesClosed) {
      return (
        <path
          d={`M${cx - 11} 112 Q${cx} 119 ${cx + 11} 112`}
          stroke={EYE_DARK}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    const lookUp = emotion === "thinking";
    const irisY = lookUp ? 108 : 113;
    return (
      <g>
        {/* 白目 */}
        <ellipse cx={cx} cy="112" rx="12" ry="14" fill="#ffffff" />
        {/* 虹彩 */}
        <circle cx={cx} cy={irisY} r="9" fill={EYE} />
        <circle cx={cx} cy={irisY} r="5" fill={EYE_DARK} />
        {/* ハイライト */}
        <circle cx={cx - 3} cy={irisY - 4} r="2.6" fill="#ffffff" />
        <circle cx={cx + 3} cy={irisY + 3} r="1.4" fill="#ffffff" opacity="0.8" />
      </g>
    );
  };

  return (
    <motion.div
      className="flex h-full w-full items-center justify-center"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      aria-label="Lunaアバター"
      role="img"
    >
      <svg
        viewBox="0 0 200 230"
        className="h-full max-h-[78vh] w-auto drop-shadow-[0_0_40px_rgba(165,180,252,0.35)]"
      >
        <defs>
          <radialGradient id="lunaGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 背後の月光グロー */}
        <circle cx="100" cy="120" r="95" fill="url(#lunaGlow)" />

        {/* 体・服（淡い月夜カラーのワンピース）— Lunaのオリジナル衣装 */}
        <path
          d="M62 230 Q60 180 78 168 L122 168 Q140 180 138 230 Z"
          fill="#9aa7e8"
        />
        <path d="M78 168 L122 168 L116 188 L84 188 Z" fill="#b7c1f2" />
        {/* 襟もとのリボン */}
        <path d="M94 170 L106 170 L103 180 L97 180 Z" fill="#ef9bb3" />
        <circle cx="100" cy="172" r="3" fill="#f6b6cd" />

        {/* 首 */}
        <rect x="92" y="150" width="16" height="22" rx="7" fill={SKIN_SHADOW} />

        {/* 後ろ髪 */}
        <path
          d="M52 96 Q50 158 70 176 L130 176 Q150 158 148 96 Z"
          fill={HAIR_SHADOW}
        />

        {/* 顔 */}
        <ellipse cx="100" cy="116" rx="40" ry="42" fill={SKIN} />
        {/* 頬の影 */}
        <ellipse cx="100" cy="128" rx="34" ry="26" fill={SKIN} />

        {/* 頬の赤み */}
        <ellipse cx="74" cy="130" rx="8" ry="5" fill={BLUSH} opacity="0.55" />
        <ellipse cx="126" cy="130" rx="8" ry="5" fill={BLUSH} opacity="0.55" />

        {/* 眉 */}
        <g transform={`translate(0 ${browY})`}>
          <path
            d="M70 98 q11 -5 22 -1"
            stroke={HAIR_SHADOW}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            transform={`rotate(${-browAngle} 81 96)`}
          />
          <path
            d="M108 97 q11 -4 22 1"
            stroke={HAIR_SHADOW}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            transform={`rotate(${browAngle} 119 96)`}
          />
        </g>

        {/* 目 */}
        {renderEye(80)}
        {renderEye(120)}

        {/* 鼻 */}
        <circle cx="100" cy="130" r="1.6" fill={SKIN_SHADOW} />

        {/* 口 */}
        {renderMouth()}

        {/* 前髪（金髪ショートボブ）*/}
        <path
          d="M58 100 Q56 64 100 62 Q144 64 142 100 Q142 86 128 84 Q132 100 120 102 Q120 84 104 84 Q108 102 96 102 Q92 84 80 88 Q84 102 72 102 Q60 92 58 100 Z"
          fill={HAIR}
        />
        {/* 前髪のハイライト */}
        <path
          d="M88 70 Q100 66 112 70 Q104 74 100 74 Q96 74 88 70 Z"
          fill={HAIR_LIGHT}
          opacity="0.7"
        />
        {/* サイドの毛束 */}
        <path d="M58 100 Q52 130 60 150 Q68 132 64 104 Z" fill={HAIR} />
        <path d="M142 100 Q148 130 140 150 Q132 132 136 104 Z" fill={HAIR} />

        {/* 髪飾り（三日月）— Lunaの象徴 */}
        <path
          d="M128 74 a9 9 0 1 0 4 16 a7 7 0 1 1 -4 -16 Z"
          fill={HAIR_LIGHT}
          stroke="#fff2c2"
          strokeWidth="0.6"
        />
      </svg>
    </motion.div>
  );
}
