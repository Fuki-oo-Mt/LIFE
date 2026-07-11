import Link from "next/link";
import { prisma } from "../db";
import { levelWord, type Level } from "../lib/view";
import { GenerateButton } from "./_components/GenerateButton";

export const dynamic = "force-dynamic";

function Trend({ points }: { points: { score: number; level: Level }[] }) {
  if (points.length < 2) return null;
  const W = 720, H = 96, pad = 10;
  const n = points.length;
  const bw = (W - pad * 2) / n;
  const color = (l: Level) => (l === "green" ? "var(--good)" : l === "yellow" ? "var(--warn)" : "var(--bad)");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="健全性スコアの推移">
      {[25, 50, 75].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={H - pad - (g / 100) * (H - pad * 2)} y2={H - pad - (g / 100) * (H - pad * 2)}
          stroke="var(--ring)" strokeWidth={1} />
      ))}
      {points.map((p, i) => {
        const h = (p.score / 100) * (H - pad * 2);
        return (
          <g key={i}>
            <rect x={i * bw + pad + bw * 0.2} y={H - pad - h} width={bw * 0.6} height={h}
              rx={3} fill={color(p.level)} />
            <text x={i * bw + pad + bw * 0.5} y={H - pad - h - 5} textAnchor="middle"
              fontSize="11" fontFamily="var(--mono)" fill="var(--ink-mut)">{p.score}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function Home() {
  const reports = await prisma.report.findMany({
    where: { type: "weekly" },
    orderBy: { periodStart: "desc" },
    include: { project: true },
    take: 26,
  });
  const trend = reports.slice().reverse().map((r) => ({ score: r.score, level: r.level as Level }));
  const latest = reports[0];

  return (
    <div className="wrap">
      <div className="masthead">
        <div className="wordmark">
          <span className="lantern" />
          <div>
            <h1>関所</h1>
            <div className="en">Sekisho — Ops Watch Station</div>
          </div>
        </div>
        <GenerateButton />
      </div>

      {reports.length === 0 ? (
        <div className="panel pad">
          <p>まだレポートがありません。</p>
          <p className="dim-text">「今週のレポートを生成」を押すか、<span className="mono">npm run seed</span> で過去分のデモを作成できます。</p>
        </div>
      ) : (
        <>
          <div className="panel pad">
            <div className="panel-head">
              <span className="eyebrow">Weekly Health · 直近{trend.length}週</span>
              {latest && (
                <span style={{ marginLeft: "auto" }} className={`lamp lv-${latest.level}`}>
                  <span className="bulb" />今週 {latest.score} · {levelWord[latest.level as Level]}
                </span>
              )}
            </div>
            <Trend points={trend} />
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            {reports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`} className="log-row">
                <div className={`rowscore tone-${r.level}`}>{r.score}</div>
                <span className={`lamp lv-${r.level}`}><span className="bulb" />{levelWord[r.level as Level]}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.project.name}</div>
                  <div className="dim-text mono">{r.headline}</div>
                </div>
                <div className="arrow">→</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
