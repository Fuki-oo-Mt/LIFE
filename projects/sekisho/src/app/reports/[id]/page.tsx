import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../db";
import { previousReport } from "../../../report/weekly";
import type { WeeklyPayload } from "../../../report/weekly";
import type { Kpi } from "../../../report/scoring";
import { Radar } from "../../_components/Radar";
import { ReleaseView } from "../../_components/ReleaseView";
import { RingGauge } from "../../_components/RingGauge";
import type { ReleasePayload } from "../../../report/release";
import { delta, fmt, levelWord, type Level } from "../../../lib/view";

export const dynamic = "force-dynamic";

const SECTIONS: { title: string; keys: string[] }[] = [
  { title: "ユーザー", keys: ["activeUsers", "newUsers", "growthRate", "affectedUsers"] },
  { title: "アプリ品質（ユーザー体感）", keys: ["availability", "errorRate", "latencyP95", "deployCaused"] },
  { title: "運用対応（障害＋手運用）", keys: ["incidents", "manualOps", "opsBacklog", "oldestOpen", "mttr", "alertsFired", "earlyDetection", "alertNoise"] },
  { title: "恒久対策・再発防止", keys: ["recurrenceRate", "permanentFixRate"] },
  { title: "改善の余力", keys: ["firefighting", "improvement", "firefightingRatio"] },
  { title: "データ基盤", keys: ["pipelineSuccess", "freshness", "failedJobs"] },
];

function KpiCard({ cur, prev }: { cur: Kpi; prev?: Kpi }) {
  const d = prev ? delta(cur.value, prev.value, cur.good) : null;
  return (
    <div className="kpi">
      <div className="k-label">{cur.label}</div>
      <div className="k-val">{fmt(cur.value)}<span className="u">{cur.value === null ? "" : cur.unit}</span></div>
      {d && <div className={`k-delta ${d.cls}`}>{d.text} <span style={{ color: "var(--ink-mut)" }}>前週</span></div>}
    </div>
  );
}

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id }, include: { project: true } });
  if (!report) notFound();
  const level = report.level as Level;

  // リリースリスクレポートは専用ビューに分岐
  if (report.type === "release") {
    const rp = JSON.parse(report.payload) as ReleasePayload;
    return (
      <div className="wrap">
        <div className="crumb"><Link href="/">← 一覧に戻る</Link></div>
        <ReleaseView projectName={report.project.name} level={level} payload={rp} />
      </div>
    );
  }

  const payload = JSON.parse(report.payload) as WeeklyPayload;
  const prev = await previousReport(report.projectId, "weekly", report.periodStart);
  const prevPayload = prev ? (JSON.parse(prev.payload) as WeeklyPayload) : null;

  const ff = payload.metrics.firefightingRatioPct;
  const prevFf = prevPayload?.metrics.firefightingRatioPct ?? null;
  const ffDelta = ff !== null && prevFf !== null ? Math.round((ff - prevFf) * 10) / 10 : null;
  const ffTone = ff === null ? "var(--ink)" : ff > 60 ? "var(--bad)" : ff > 45 ? "var(--warn)" : "var(--good)";
  const weakest = payload.metrics.dimensions.slice().sort((a, b) => a.score - b.score)[0];
  const allDeductions = payload.metrics.dimensions.flatMap((d) => d.deductions.map((x) => ({ ...x, dim: d.label })));

  return (
    <div className="wrap">
      <div className="crumb"><Link href="/">← 一覧に戻る</Link></div>

      {/* ヒーロー: 健全性レーダー ＋ 総合読み */}
      <div className="panel pad">
        <div className="panel-head">
          <span className="eyebrow">{report.project.name} · 週次システム状態</span>
          <span className="mono" style={{ marginLeft: "auto", color: "var(--ink-mut)", fontSize: 12 }}>
            {report.headline.split(" ")[0]}
          </span>
        </div>
        <div className="hero">
          <Radar dims={payload.metrics.dimensions} prev={prevPayload?.metrics.dimensions} />
          <div className="hero-read">
            <RingGauge value={report.score} level={level} size={172} />
            <div><span className={`lamp lv-${level}`} style={{ fontSize: 13 }}><span className="bulb" />{levelWord[level]}</span></div>
            <div className="cap">
              最も弱い次元は <strong>{weakest.label}</strong>（{weakest.score}点）。
              {prevPayload && <> 破線は前週の形。</>}
            </div>
          </div>
        </div>
      </div>

      {/* 火消し vs 改善（署名指標） */}
      <div className="panel pad">
        <div className="panel-head"><span className="eyebrow">Firefighting vs Improvement · 時間配分</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div className="readout" style={{ fontSize: 40, color: ffTone }}>{ff === null ? "—" : `${ff}%`}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${ff ?? 0}%`, background: ffTone }} />
            </div>
            <div className="dim-text mono" style={{ marginTop: 8 }}>
              火消し {fmt(payload.observations.work.firefightingItems)} / 改善 {fmt(payload.observations.work.improvementItems)}
              {ffDelta !== null && <> · <span className={ffDelta > 0 ? "d-bad" : "d-good"}>{ffDelta > 0 ? "▲" : "▼"}{Math.abs(ffDelta)}pt 前週</span></>}
            </div>
          </div>
        </div>
        <div className="dim-text" style={{ marginTop: 10 }}>
          対応工数のうち<strong>火消し（障害対応＋手運用トイル）</strong>が占める割合。高いほど改善に時間が回らない。
        </div>
      </div>

      {/* SLO・エラーバジェット */}
      {payload.metrics.sloBudgetRemainingPct !== null && (
        <div className="panel pad">
          <div className="panel-head">
            <span className="eyebrow">SLO・エラーバジェット</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mut)" }}>
              可用性SLO {payload.metrics.sloTargetPct}%
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {(() => {
              const rem = payload.metrics.sloBudgetRemainingPct!;
              const tone = rem < 20 ? "var(--bad)" : rem < 50 ? "var(--warn)" : "var(--good)";
              return (
                <>
                  <div className="readout" style={{ fontSize: 40, color: tone }}>{rem}%</div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="gauge-track">
                      <div className="gauge-fill" style={{ width: `${rem}%`, background: tone }} />
                    </div>
                    <div className="dim-text" style={{ marginTop: 8 }}>
                      今週のエラーバジェット残量。使い切る（0%）とSLO未達＝リリースを止めて信頼性回復に充てる判断材料。
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* インシデント・アラート台帳 */}
      {payload.incidents && payload.incidents.total > 0 && (
        <div className="panel pad">
          <div className="panel-head">
            <span className="eyebrow">インシデント・アラート台帳</span>
            {payload.incidents.oldestOpenDays !== null && (
              <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mut)" }}>
                最古の未対応 {payload.incidents.oldestOpenDays}日
              </span>
            )}
          </div>
          <div className="inc-summary">
            <div className="inc-stat"><span className="n">{payload.incidents.total}</span><span className="l">発生</span></div>
            <div className="inc-stat"><span className="n st-open" style={{ color: payload.incidents.open ? "var(--bad)" : "var(--ink)" }}>{payload.incidents.open}</span><span className="l">未対応</span></div>
            <div className="inc-stat"><span className="n" style={{ color: "var(--good)" }}>{payload.incidents.resolved}</span><span className="l">対応済み</span></div>
            <div className="inc-stat"><span className="n">{payload.incidents.mttrMinutes ?? "—"}</span><span className="l">MTTR(分)</span></div>
            {(["P1", "P2", "P3", "P4"] as const).filter((s) => payload.incidents.openBySeverity[s]).map((s) => (
              <div className="inc-stat" key={s}><span className="n">{payload.incidents.openBySeverity[s]}</span><span className="l">未対応 {s}</span></div>
            ))}
          </div>
          <div className="inc-table">
            {payload.incidents.rows.map((r, idx) => {
              const hot = r.status === "open" && r.ageDays !== null && r.ageDays >= 5;
              return (
                <div className={`inc-row ${r.status}`} key={idx}>
                  <span className={`sev sev-${r.severity ?? "P4"}`}>{r.severity ?? "—"}</span>
                  <span className={`inc-status ${r.status === "open" ? "st-open" : "st-resolved"}`}>
                    {r.status === "open" ? "● 未対応" : "✓ 対応済"}
                  </span>
                  <span className="inc-title">
                    {r.title}
                    {r.recurring && <span className="rec">再燃</span>}
                  </span>
                  <span className="inc-meta">
                    {r.source ?? ""}{r.ageDays !== null && <> · <span className={hot ? "inc-age-hot" : ""}>{r.ageDays}日</span></>}
                    {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer">{r.ref ?? "link"}</a></>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 所見 */}
      <div className="panel pad">
        <div className="panel-head"><span className="eyebrow">今週の所見・来週のアクション</span></div>
        <div className="prose">{report.narrative}</div>
        {payload.observations.missingSources.length > 0 && (
          <div className="note" style={{ marginTop: 14 }}>
            未接続のデータ源: {payload.observations.missingSources.join(", ")}（該当指標は 0 / — 表示）
          </div>
        )}
      </div>

      {/* KPI（前週比つき） */}
      {SECTIONS.map((sec) => (
        <div className="panel pad" key={sec.title}>
          <div className="panel-head"><span className="eyebrow">{sec.title}</span></div>
          <div className="kpi-grid">
            {sec.keys.map((k) => {
              const cur = payload.metrics.kpis[k];
              if (!cur) return null;
              return <KpiCard key={k} cur={cur} prev={prevPayload?.metrics.kpis[k]} />;
            })}
          </div>
        </div>
      ))}

      {/* スコア内訳 */}
      <div className="panel pad">
        <div className="panel-head"><span className="eyebrow">スコア内訳 · 100点からの減点</span></div>
        {allDeductions.length === 0 ? (
          <p className="dim-text">減点なし（満点）。</p>
        ) : (
          allDeductions
            .slice()
            .sort((a, b) => a.points - b.points)
            .map((p, idx) => (
              <div className="ded" key={idx}>
                <span><span className="dim">{p.dim}</span>{p.reason}</span>
                <span className="pts">{p.points}</span>
              </div>
            ))
        )}
      </div>

      <div className="dim-text mono" style={{ marginTop: 16, fontSize: 12 }}>
        生成 {new Date(payload.generatedAt).toLocaleString("ja-JP")} · モード {payload.mode}
        {prev && <> · <Link href={`/reports/${prev.id}`} style={{ color: "var(--accent)" }}>前週レポート →</Link></>}
      </div>
    </div>
  );
}
