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
// 衣装（確定版・モダンカジュアル）
const HOODIE = "#3f6fb5";
const HOODIE_SHADOW = "#31578f";
const CORD = "#ef9bb3";
const CLOTH_WHITE = "#ffffff";
const CLOTH_WHITE_SHADOW = "#e5ebf6";
const TIGHTS = "#eef0fb";
const SNEAKER = "#3f6fb5";
const SNEAKER_SOLE = "#ffffff";

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

        {/* 体・服（確定版：青パーカー×白ショートパンツ×白タイツ×青スニーカー）*/}
        {/* 脚（白タイツ）*/}
        <rect x="87" y="204" width="11" height="20" rx="5" fill={TIGHTS} stroke={CLOTH_WHITE_SHADOW} strokeWidth="0.8" />
        <rect x="102" y="204" width="11" height="20" rx="5" fill={TIGHTS} stroke={CLOTH_WHITE_SHADOW} strokeWidth="0.8" />
        {/* 青スニーカー */}
        <path d="M82 221 Q82 217 88 217 L98 217 L98 226 Q98 229 94 229 L85 229 Q82 229 82 226 Z" fill={SNEAKER} />
        <path d="M102 217 L112 217 Q118 217 118 221 L118 226 Q118 229 115 229 L106 229 Q102 229 102 226 Z" fill={SNEAKER} />
        <rect x="81" y="227" width="18" height="2.6" rx="1.3" fill={SNEAKER_SOLE} />
        <rect x="101" y="227" width="18" height="2.6" rx="1.3" fill={SNEAKER_SOLE} />
        {/* 白のショートパンツ */}
        <path d="M79 194 L121 194 L120 210 L104 210 L100 203 L96 210 L80 210 Z" fill={CLOTH_WHITE} stroke={CLOTH_WHITE_SHADOW} strokeWidth="0.8" />
        {/* 青パーカー（本体）*/}
        <path d="M72 168 Q100 159 128 168 L131 199 Q100 206 69 199 Z" fill={HOODIE} />
        {/* 袖 */}
        <path d="M72 168 Q60 173 62 195 Q62 199 67 199 L77 198 Q74 180 82 171 Z" fill={HOODIE} />
        <path d="M128 168 Q140 173 138 195 Q138 199 133 199 L123 198 Q126 180 118 171 Z" fill={HOODIE} />
        {/* 手 */}
        <circle cx="65" cy="200" r="5.5" fill={SKIN} />
        <circle cx="135" cy="200" r="5.5" fill={SKIN} />
        {/* お腹のポケット */}
        <path d="M83 189 L117 189 L112 199 L88 199 Z" fill={HOODIE_SHADOW} opacity="0.45" />

        {/* 後ろ髪 */}
        <path
          d="M52 96 Q50 158 70 176 L130 176 Q150 158 148 96 Z"
          fill={HAIR_SHADOW}
        />

        {/* 首（後ろ髪より手前）*/}
        <rect x="93" y="150" width="14" height="18" rx="6" fill={SKIN_SHADOW} />
        {/* パーカーのフード襟 */}
        <path d="M83 165 Q100 178 117 165 Q117 172 100 179 Q83 172 83 165 Z" fill={HOODIE_SHADOW} />
        {/* 白Tシャツ（襟のぞき）*/}
        <path d="M92 166 L100 176 L108 166 Q100 171 92 166 Z" fill={CLOTH_WHITE} />
        {/* ジッパー */}
        <line x1="100" y1="176" x2="100" y2="199" stroke={HOODIE_SHADOW} strokeWidth="1.6" />
        <circle cx="100" cy="178" r="1.8" fill={HAIR_LIGHT} />
        {/* フードの紐（ピンクの差し色）*/}
        <path d="M96 177 Q95 185 95.5 191" stroke={CORD} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M104 177 Q105 185 104.5 191" stroke={CORD} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="95.5" cy="192" r="1.8" fill={CORD} />
        <circle cx="104.5" cy="192" r="1.8" fill={CORD} />

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
