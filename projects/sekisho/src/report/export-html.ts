import type { WeeklyPayload } from "./weekly";
import type { Dimension } from "./scoring";

/** HTML特殊文字のエスケープ */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const TONE = { green: "#0f8f3f", yellow: "#c98500", red: "#d03b3b" } as const;

/** レーダーを自己完結SVG文字列で描く（UIコンポーネントと同じ幾何） */
function radarSvg(dims: Dimension[], prev?: Dimension[]): string {
  const N = dims.length, cx = 180, cy = 150, R = 104;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (v: number, i: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  };
  const polyOf = (arr: Dimension[]) => arr.map((d, i) => pt(d.score, i).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1]
    .map((t) => `<polygon points="${dims.map((_, i) => pt(t * 100, i).join(",")).join(" ")}" fill="none" stroke="#e2e5ea" stroke-width="1"/>`)
    .join("");
  const spokes = dims.map((_, i) => { const [x, y] = pt(100, i); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#eef0f3" stroke-width="1"/>`; }).join("");
  const ghost = prev && prev.length === N ? `<polygon points="${polyOf(prev)}" fill="none" stroke="#9aa0ab" stroke-width="1.5" stroke-dasharray="4 4"/>` : "";
  const cur = `<polygon points="${polyOf(dims)}" fill="rgba(199,127,22,0.15)" stroke="#c77f16" stroke-width="2"/>`;
  const dots = dims.map((d, i) => { const [x, y] = pt(d.score, i); return `<circle cx="${x}" cy="${y}" r="3.2" fill="#c77f16" stroke="#fff" stroke-width="1.5"/>`; }).join("");
  const labels = dims.map((d, i) => {
    const a = ang(i), lx = cx + (R + 20) * Math.cos(a), ly = cy + (R + 20) * Math.sin(a);
    const anchor = Math.cos(a) > 0.35 ? "start" : Math.cos(a) < -0.35 ? "end" : "middle";
    return `<text x="${lx}" y="${ly - 4}" text-anchor="${anchor}" font-size="11" fill="#5c6270">${esc(d.label)}</text>` +
      `<text x="${lx}" y="${ly + 9}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="#171922" font-family="ui-monospace,monospace">${d.score}</text>`;
  }).join("");
  return `<svg viewBox="0 0 360 300" width="360" style="max-width:100%">${rings}${spokes}${ghost}${cur}${dots}${labels}</svg>`;
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
    const sevColor = r.severity === "P1" ? "background:#d03b3b;color:#fff" :
      r.severity === "P2" ? "background:#c98500;color:#241400" :
      r.severity === "P3" ? "background:#f8efd7;color:#c98500" : "background:#eef0f3;color:#5c6270";
    const st = r.status === "open" ? `<span style="color:#d03b3b">● 未対応</span>` : `<span style="color:#8b909c">✓ 対応済</span>`;
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
        <b>${inc.total}</b> 発生 · <b style="color:#d03b3b">${inc.open}</b> 未対応 · <b style="color:#0f8f3f">${inc.resolved}</b> 対応済 · MTTR <b>${inc.mttrMinutes ?? "—"}</b>分
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
  :root{--ink:#171922;--ink2:#5c6270;--mut:#8b909c;--acc:#c77f16;--surf:#fff;--plane:#f5f6f8;--bd:#e2e5ea}
  *{box-sizing:border-box}
  body{margin:0;background:var(--plane);color:var(--ink);font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.62}
  .wrap{max-width:900px;margin:0 auto;padding:36px 22px 72px}
  .mono{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}
  .head{display:flex;align-items:center;gap:12px;margin-bottom:26px}
  .lantern{width:14px;height:14px;border-radius:3px;background:var(--acc);transform:rotate(45deg);box-shadow:0 0 0 4px rgba(199,127,22,.13)}
  h1{font-size:19px;margin:0;letter-spacing:.04em}
  .en{font-family:ui-monospace,monospace;font-size:10px;color:var(--mut);letter-spacing:.2em;text-transform:uppercase}
  .card{background:var(--surf);border:1px solid var(--bd);border-radius:14px;padding:22px 24px;margin-bottom:16px}
  .eyebrow{font-family:ui-monospace,monospace;font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink2);margin-bottom:14px}
  .hero{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  .score{font-family:ui-monospace,monospace;font-weight:700;font-size:70px;line-height:.9;color:${tone}}
  .score span{font-size:26px;color:var(--mut)}
  .lamp{font-family:ui-monospace,monospace;font-weight:700;color:${tone}}
  .cap{color:var(--ink2);font-size:13px;margin-top:8px;max-width:280px}
  .gauge{height:12px;border-radius:99px;background:var(--plane);border:1px solid var(--bd);overflow:hidden}
  .gfill{height:100%;background:${ff !== null && ff > 60 ? "#d03b3b" : ff !== null && ff > 45 ? "#c98500" : "#0f8f3f"}}
  .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
  .kpi{background:var(--plane);border:1px solid var(--bd);border-radius:10px;padding:12px 14px}
  .kl{font-size:12px;color:var(--ink2)} .kv{font-family:ui-monospace,monospace;font-size:22px;font-weight:700;margin-top:3px} .kv span{font-size:12px;color:var(--mut)}
  .prose{white-space:pre-wrap;font-size:14px}
  table.inc{width:100%;border-collapse:collapse;font-size:13px} table.inc td{padding:9px 8px;border-top:1px solid var(--bd);vertical-align:top}
  .sev{font-family:ui-monospace,monospace;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px}
  .rec{font-family:ui-monospace,monospace;font-size:10px;color:#c98500;background:#f8efd7;padding:1px 5px;border-radius:4px}
  .meta{font-family:ui-monospace,monospace;font-size:11px;color:var(--mut);white-space:nowrap;text-align:right}
  .incsum{font-size:13.5px;color:var(--ink2);margin-bottom:12px}
  .note{font-size:12.5px;color:#c98500;background:#f8efd7;padding:9px 12px;border-radius:9px;margin-top:12px}
  .foot{font-family:ui-monospace,monospace;font-size:11px;color:var(--mut);margin-top:8px}
</style></head><body><div class="wrap">
  <div class="head"><span class="lantern"></span><div><h1>関所 · ${esc(meta.projectName)}</h1><div class="en">Sekisho — Weekly Ops Report</div></div></div>

  <section class="card">
    <div class="eyebrow">${esc(meta.headline)}</div>
    <div class="hero">
      ${radarSvg(payload.metrics.dimensions, prev?.metrics.dimensions)}
      <div>
        <div class="score">${meta.score}<span>/100</span></div>
        <div class="lamp">● ${levelWord}</div>
        <div class="cap">最も弱い次元は <b>${esc(payload.metrics.dimensions.slice().sort((a, b) => a.score - b.score)[0].label)}</b>。${prev ? "破線は前週の形。" : ""}</div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="eyebrow">Firefighting vs Improvement · 時間配分</div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="mono" style="font-size:36px;font-weight:700;color:${ff !== null && ff > 60 ? "#d03b3b" : "#171922"}">${ff === null ? "—" : ff + "%"}</div>
      <div style="flex:1;min-width:200px"><div class="gauge"><div class="gfill" style="width:${ff ?? 0}%"></div></div>
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
