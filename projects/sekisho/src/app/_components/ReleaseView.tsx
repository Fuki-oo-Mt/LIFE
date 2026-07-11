import type { ReleasePayload } from "../../report/release";
import type { Level } from "../../lib/view";
import { RingGauge } from "./RingGauge";

const verdictWord = { green: "GO", yellow: "分割推奨", red: "要レビュー" } as const;

export function ReleaseView({
  projectName, level, payload,
}: { projectName: string; level: Level; payload: ReleasePayload }) {
  const { release: rel, risk } = payload;

  // 内訳を group ごとにまとめる
  const groups = new Map<string, { reason: string; points: number }[]>();
  for (const s of risk.signals) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group)!.push({ reason: s.reason, points: s.points });
  }

  const facts: [string, string][] = [
    ["変更行数", rel.changedLines != null ? `${rel.changedLines.toLocaleString()}行` : "—"],
    ["変更ファイル", rel.changedFiles != null ? `${rel.changedFiles}` : "—"],
    ["束ねたPR", rel.bundledPRs != null ? `${rel.bundledPRs}` : "—"],
    ["サービス数", rel.servicesTouched != null ? `${rel.servicesTouched}` : "—"],
    ["クリティカルパス", rel.criticalPaths?.length ? rel.criticalPaths.join(", ") : "なし"],
    ["DBマイグレ", rel.hasDbMigration ? "あり" : "なし"],
    ["インフラ変更", rel.hasInfraChange ? "あり" : "なし"],
    ["CI", rel.ciGreen === false ? "赤(未通過)" : "緑"],
    ["レビュワー", rel.reviewers != null ? `${rel.reviewers}人` : "—"],
    ["ロールバック手順", rel.hasRollbackPlan ? "あり" : "なし"],
    ["タイミング", { normal: "通常", friday: "金曜/連休前", late_night: "深夜", freeze: "フリーズ期間" }[rel.timing ?? "normal"]],
  ];

  return (
    <>
      {/* ヒーロー */}
      <div className="panel pad">
        <div className="panel-head">
          <span className="eyebrow">{projectName} · リリースリスクレポート</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mut)" }}>{rel.ref}</span>
        </div>
        <div className="hero">
          <div style={{ padding: "8px 4px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              {rel.url ? <a href={rel.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{rel.title}</a> : rel.title}
            </div>
            <div className="prose" style={{ fontSize: 14 }}>{risk.recommendation}</div>
            {risk.hardFlags.length > 0 && (
              <div className="note" style={{ marginTop: 12 }}>
                {risk.hardFlags.map((f, i) => <div key={i}>⚠ {f}</div>)}
              </div>
            )}
          </div>
          <div className="hero-read">
            <RingGauge value={risk.score} level={level} size={172} sublabel="危険度" />
            <div><span className={`lamp lv-${level}`} style={{ fontSize: 13 }}><span className="bulb" />{verdictWord[level]}</span></div>
            <div className="cap">
              危険度（高いほど危険）。0–29 GO / 30–59 分割推奨 / 60–100 要レビュー。
            </div>
          </div>
        </div>
      </div>

      {/* 分割リリース計画 */}
      {risk.splitPlan.length > 0 && (
        <div className="panel pad">
          <div className="panel-head"><span className="eyebrow">推奨: 分割リリース計画（安全順）</span></div>
          {risk.splitPlan.map((s) => (
            <div className="ded" key={s.order} style={{ alignItems: "flex-start" }}>
              <span>
                <span className="dim">STEP {s.order}</span>{s.title}
                {s.note && <div className="dim-text" style={{ marginTop: 3 }}>{s.note}</div>}
              </span>
              <span className="mono" style={{ color: "var(--accent)", whiteSpace: "nowrap", fontSize: 12 }}>{s.mechanism}</span>
            </div>
          ))}
        </div>
      )}

      {/* 危険度の内訳 */}
      <div className="panel pad">
        <div className="panel-head"><span className="eyebrow">危険度の内訳（加点）</span></div>
        {risk.signals.length === 0 ? (
          <p className="dim-text">加点なし（低リスク）。</p>
        ) : (
          [...groups.entries()].map(([group, items]) => (
            <div key={group} style={{ marginBottom: 8 }}>
              {items.map((it, i) => (
                <div className="ded" key={i}>
                  <span><span className="dim">{group}</span>{it.reason}</span>
                  <span className="pts" style={{ color: "var(--warn)" }}>+{it.points}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* 変更サマリ */}
      <div className="panel pad">
        <div className="panel-head"><span className="eyebrow">変更サマリ</span></div>
        <div className="kpi-grid">
          {facts.map(([k, v]) => (
            <div className="kpi" key={k}>
              <div className="k-label">{k}</div>
              <div className="k-val" style={{ fontSize: 16 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dim-text mono" style={{ marginTop: 16, fontSize: 12 }}>
        生成 {new Date(payload.generatedAt).toLocaleString("ja-JP")} · モード {payload.mode}
      </div>
    </>
  );
}
