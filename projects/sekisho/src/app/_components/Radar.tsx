import type { Dimension } from "../../report/scoring";

/**
 * 健全性レーダー（見張り所のスコープ風）。
 * 今週の多角形を塗り、前週を破線ゴーストで重ねて「形が縮んだ/広がった」を一目で読む。
 * 精密な値はKPIカード側にあるので、ここは形の把握＋各軸に値を直接ラベルする。
 */
export function Radar({ dims, prev }: { dims: Dimension[]; prev?: Dimension[] }) {
  const N = dims.length;
  const W = 360, H = 300, cx = 180, cy = 150, R = 104;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (v: number, i: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const ringPts = (t: number) =>
    dims.map((_, i) => pt(t * 100, i).join(",")).join(" ");
  const poly = (arr: Dimension[]) => arr.map((d, i) => pt(d.score, i).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={"健全性レーダー: " + dims.map((d) => `${d.label}${d.score}`).join(", ")}>
      {/* 目盛りリング */}
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <polygon key={t} points={ringPts(t)} fill="none"
          stroke="var(--border)" strokeWidth={1} />
      ))}
      {/* スポーク */}
      {dims.map((_, i) => {
        const [x, y] = pt(100, i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--ring)" strokeWidth={1} />;
      })}

      {/* 前週ゴースト */}
      {prev && prev.length === N && (
        <polygon points={poly(prev)} fill="none" stroke="var(--ink-mut)"
          strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
      )}

      {/* 今週（発光） */}
      <g className="radar-poly" style={{ filter: "drop-shadow(0 0 5px var(--accent-glow))" }}>
        <polygon points={poly(dims)} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={2} />
        {dims.map((d, i) => {
          const [x, y] = pt(d.score, i);
          return <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />;
        })}
      </g>

      {/* 軸ラベル＋値 */}
      {dims.map((d, i) => {
        const a = angle(i);
        const lx = cx + (R + 20) * Math.cos(a);
        const ly = cy + (R + 20) * Math.sin(a);
        const anchor = Math.cos(a) > 0.35 ? "start" : Math.cos(a) < -0.35 ? "end" : "middle";
        return (
          <g key={i}>
            <text x={lx} y={ly - 4} textAnchor={anchor}
              fontSize="11" fill="var(--ink-2)" fontFamily="var(--sans)">{d.label}</text>
            <text x={lx} y={ly + 9} textAnchor={anchor}
              fontSize="12" fontWeight="700" fill="var(--ink)"
              fontFamily="var(--mono)">{d.score}</text>
          </g>
        );
      })}
    </svg>
  );
}
