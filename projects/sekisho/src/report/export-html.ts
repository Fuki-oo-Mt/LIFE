import type { WeeklyPayload } from "./weekly";
import type { Dimension } from "./scoring";

/** HTML特殊文字のエスケープ */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Cradle Instrument（深宇宙の計器盤）配色。ダーク固定で共有物として一貫させる。
const TONE = { green: "#35d9a6", yellow: "#e7ba5c", red: "#ff6b81" } as const;
const ACC = "#8b7dff";

/** レーダーを自己完結SVG文字列で描く（UIコンポーネントと同じ幾何・発光） */
function radarSvg(dims: Dimension[], prev?: Dimension[]): string {
  const N = dims.length, cx = 180, cy = 150, R = 104;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (v: number, i: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  };
  const polyOf = (arr: Dimension[]) => arr.map((d, i) => pt(d.score, i).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1]
    .map((t) => `<polygon points="${dims.map((_, i) => pt(t * 100, i).join(",")).join(" ")}" fill="none" stroke="rgba(150,165,215,0.13)" stroke-width="1"/>`)
    .join("");
  const spokes = dims.map((_, i) => { const [x, y] = pt(100, i); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(150,165,215,0.08)" stroke-width="1"/>`; }).join("");
  const ghost = prev && prev.length === N ? `<polygon points="${polyOf(prev)}" fill="none" stroke="#656d8c" stroke-width="1.5" stroke-dasharray="4 4"/>` : "";
  const cur = `<polygon points="${polyOf(dims)}" fill="rgba(139,125,255,0.16)" stroke="${ACC}" stroke-width="2" style="filter:drop-shadow(0 0 5px rgba(139,125,255,0.5))"/>`;
  const dots = dims.map((d, i) => { const [x, y] = pt(d.score, i); return `<circle cx="${x}" cy="${y}" r="3" fill="${ACC}" stroke="#0f1220" stroke-width="1.5"/>`; }).join("");
  const labels = dims.map((d, i) => {
    const a = ang(i), lx = cx + (R + 20) * Math.cos(a), ly = cy + (R + 20) * Math.sin(a);
    const anchor = Math.cos(a) > 0.35 ? "start" : Math.cos(a) < -0.35 ? "end" : "middle";
    return `<text x="${lx}" y="${ly - 4}" text-anchor="${anchor}" font-size="11" fill="#a4abc8">${esc(d.label)}</text>` +
      `<text x="${lx}" y="${ly + 9}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="#eef1fb" font-family="ui-monospace,monospace">${d.score}</text>`;
  }).join("");
  return `<svg viewBox="0 0 360 300" width="360" style="max-width:100%">${rings}${spokes}${ghost}${cur}${dots}${labels}</svg>`;
}

/** リング・ゲージ（署名）を自己完結SVGで描く */
function ringSvg(value: number, tone: string, sublabel = "/ 100"): string {
  const r = 52, C = 2 * Math.PI * r, dash = ((Math.max(0, Math.min(100, value)) / 100) * C).toFixed(1);
  return `<svg viewBox="0 0 120 120" width="150" height="150">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(150,165,215,0.14)" stroke-width="7"/>
    <g transform="rotate(-90 60 60)" style="filter:drop-shadow(0 0 6px ${tone})">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${tone}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dash} ${C.toFixed(1)}"/>
    </g>
    <text x="60" y="58" text-anchor="middle" dominant-baseline="central" font-size="34" font-weight="600" fill="${tone}" font-family="ui-monospace,monospace">${value}</text>
    <text x="60" y="82" text-anchor="middle" font-size="9" letter-spacing="1.5" fill="#656d8c" font-family="ui-monospace,monospace">${esc(sublabel)}</text>
  </svg>`;
}

export interface ReportMeta {
  projectName: string;
  score: number;
  level: "green" | "yellow" | "red";
  headline: string;
  narrative: string;
}

/** 1レポートを自己完結HTML（インラインCSS/SVG・外部通信なし）に描く */
export function renderReportHtml(meta: ReportMeta, payload: WeeklyPayload, prev?: WeeklyPayload): string {
  const tone = TONE[meta.level];
  const ff = payload.metrics.firefightingRatioPct;
  const inc = payload.incidents;
  const levelWord = { green: "良好", yellow: "注意", red: "危険" }[meta.level];

  const kpiCards = payload.metrics.dimensions.map((d) =>
    `<div class="kpi"><div class="kl">${esc(d.label)}</div><div class="kv">${d.score}<span>/100</span></div></div>`).join("");

  const incRows = inc && inc.total > 0 ? inc.rows.map((r) => {
    const sevColor = r.severity === "P1" ? "background:#ff6b81;color:#0b0b12" :
      r.severity === "P2" ? "background:#e7ba5c;color:#241400" :
      r.severity === "P3" ? "background:#2a2410;color:#e7ba5c" : "background:#161a2b;color:#a4abc8";
    const st = r.status === "open" ? `<span style="color:#ff6b81">● 未対応</span>` : `<span style="color:#656d8c">✓ 対応済</span>`;
    return `<tr style="opacity:${r.status === "resolved" ? 0.62 : 1}">
      <td><span class="sev" style="${sevColor}">${r.severity ?? "—"}</span></td>
      <td>${st}</td>
      <td>${esc(r.title)}${r.recurring ? ' <span class="rec">再燃</span>' : ""}</td>
      <td class="meta">${esc(r.source ?? "")}${r.ageDays !== null ? ` · ${r.ageDays}日` : ""}${r.ref ? ` · ${esc(r.ref)}` : ""}</td>
    </tr>`;
  }).join("") : "";

  const incidentBlock = inc && inc.total > 0 ? `
    <section class="card">
      <div class="eyebrow">インシデント・アラート台帳</div>
      <div class="incsum">
        <b>${inc.total}</b> 発生 · <b style="color:#ff6b81">${inc.open}</b> 未対応 · <b style="color:#35d9a6">${inc.resolved}</b> 対応済 · MTTR <b>${inc.mttrMinutes ?? "—"}</b>分
        ${inc.oldestOpenDays !== null ? ` · 最古の未対応 <b>${inc.oldestOpenDays}</b>日` : ""}
      </div>
      <table class="inc"><tbody>${incRows}</tbody></table>
    </section>` : "";

  const missing = payload.observations.missingSources.length
    ? `<div class="note">未接続のデータ源: ${esc(payload.observations.missingSources.join(", "))}（該当指標は 0 / — 表示）</div>` : "";

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>関所レポート · ${esc(meta.projectName)}</title>
<style>
  :root{--ink:#eef1fb;--ink2:#a4abc8;--mut:#656d8c;--acc:#8b7dff;--surf:#0f1220;--surf2:#161a2b;--plane:#070912;--bd:rgba(150,165,215,0.13)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--plane);color:var(--ink);font-family:system-ui,-apple-system,"Inter","Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.6;letter-spacing:.005em}
  .wrap{max-width:900px;margin:0 auto;padding:40px 22px 72px;background:radial-gradient(60% 30% at 84% -6%, rgba(139,125,255,0.16), transparent 60%)}
  .mono{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}
  .head{display:flex;align-items:center;gap:13px;margin-bottom:28px}
  .mark{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#b3aaff,#8b7dff 70%);box-shadow:0 0 18px 1px rgba(139,125,255,0.45)}
  h1{font-size:19px;margin:0;font-weight:500;letter-spacing:.14em}
  .en{font-family:ui-monospace,monospace;font-size:10px;color:var(--mut);letter-spacing:.3em;text-transform:uppercase}
  .card{background:var(--surf);border:1px solid var(--bd);border-radius:18px;padding:24px 26px;margin-bottom:16px;background-image:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))}
  .eyebrow{font-family:ui-monospace,monospace;font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--ink2);margin-bottom:16px}
  .hero{display:flex;gap:22px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .lamp{font-family:ui-monospace,monospace;font-weight:600;color:${tone}}
  .cap{color:var(--ink2);font-size:13px;margin-top:8px;text-align:center;max-width:180px}
  .gauge{height:10px;border-radius:99px;background:var(--surf2);border:1px solid var(--bd);overflow:hidden}
  .gfill{height:100%;box-shadow:0 0 14px -2px currentColor}
  .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:11px}
  .kpi{background:var(--surf2);border:1px solid rgba(150,165,215,0.07);border-radius:12px;padding:13px 15px}
  .kl{font-size:11.5px;color:var(--ink2)} .kv{font-family:ui-monospace,monospace;font-size:22px;font-weight:600;margin-top:4px} .kv span{font-size:12px;color:var(--mut)}
  .prose{white-space:pre-wrap;font-size:14px;line-height:1.72}
  table.inc{width:100%;border-collapse:collapse;font-size:13px} table.inc td{padding:10px 8px;border-top:1px solid rgba(150,165,215,0.07);vertical-align:top}
  .sev{font-family:ui-monospace,monospace;font-size:11px;font-weight:700;padding:3px 7px;border-radius:6px}
  .rec{font-family:ui-monospace,monospace;font-size:10px;color:#e7ba5c;background:#2a2410;padding:1px 5px;border-radius:4px}
  .meta{font-family:ui-monospace,monospace;font-size:11px;color:var(--mut);white-space:nowrap;text-align:right}
  .incsum{font-size:13.5px;color:var(--ink2);margin-bottom:12px}
  .note{font-size:12.5px;color:#e7ba5c;background:#2a2410;padding:10px 13px;border-radius:10px;margin-top:12px}
  .foot{font-family:ui-monospace,monospace;font-size:11px;color:var(--mut);margin-top:8px;letter-spacing:.06em}
</style></head><body><div class="wrap">
  <div class="head"><span class="mark"></span><div><h1>関所 · ${esc(meta.projectName)}</h1><div class="en">Sekisho — Weekly Ops Report</div></div></div>

  <section class="card">
    <div class="eyebrow">${esc(meta.headline)}</div>
    <div class="hero">
      ${radarSvg(payload.metrics.dimensions, prev?.metrics.dimensions)}
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
        ${ringSvg(meta.score, tone)}
        <div class="lamp">● ${levelWord}</div>
        <div class="cap">最も弱い次元は <b>${esc(payload.metrics.dimensions.slice().sort((a, b) => a.score - b.score)[0].label)}</b>。${prev ? "破線は前週の形。" : ""}</div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="eyebrow">Firefighting vs Improvement · 時間配分</div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="mono" style="font-size:36px;font-weight:600;color:${ff !== null && ff > 60 ? "#ff6b81" : "#eef1fb"}">${ff === null ? "—" : ff + "%"}</div>
      <div style="flex:1;min-width:200px"><div class="gauge"><div class="gfill" style="width:${ff ?? 0}%;color:${ff !== null && ff > 60 ? "#ff6b81" : ff !== null && ff > 45 ? "#e7ba5c" : "#35d9a6"};background:currentColor"></div></div>
      <div class="mono" style="font-size:12px;color:var(--ink2);margin-top:7px">火消し ${payload.observations.work.firefightingItems} / 改善 ${payload.observations.work.improvementItems}</div></div>
    </div>
  </section>

  ${incidentBlock}

  <section class="card">
    <div class="eyebrow">今週の所見・来週のアクション</div>
    <div class="prose">${esc(meta.narrative)}</div>
    ${missing}
  </section>

  <section class="card">
    <div class="eyebrow">健全性の5次元</div>
    <div class="kpis">${kpiCards}</div>
  </section>

  <div class="foot">生成 ${esc(payload.generatedAt)} · モード ${esc(payload.mode)} · 関所 (Sekisho)</div>
</div></body></html>`;
}
