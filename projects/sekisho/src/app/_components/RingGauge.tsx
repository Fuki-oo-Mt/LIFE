import type { Level } from "../../lib/view";

/**
 * リング・ゲージ ＝ 署名要素（精密観測儀の読み）。
 * 細い軌道リングに、判定色の発光アークでスコアを刻む。中心に数値。
 * weekly=健全性(高いほど良), release=危険度(高いほど危) どちらも「score%」を弧長にする。
 */
export function RingGauge({
  value, level, size = 168, sublabel,
}: { value: number; level: Level; size?: number; sublabel?: string }) {
  const color = level === "green" ? "var(--good)" : level === "yellow" ? "var(--warn)" : "var(--bad)";
  const cx = 60, r = 52;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const dash = `${(pct * C).toFixed(2)} ${(C).toFixed(2)}`;

  return (
    <span className="ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`スコア ${value} / 100${sublabel ? ` ・ ${sublabel}` : ""}`}>
        {/* 軌道 */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--ring)" strokeWidth="7" />
        {/* 目盛りの微光アーク */}
        <g transform={`rotate(-90 ${cx} ${cx})`} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeLinecap="round" strokeDasharray={dash} />
        </g>
      </svg>
      <span className="ring-center">
        <span className="rv" style={{ fontSize: size * 0.3, color }}>{value}</span>
        <span className="rl">{sublabel ?? "/ 100"}</span>
      </span>
    </span>
  );
}
