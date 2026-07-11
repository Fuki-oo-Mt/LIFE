import type { Observations } from "../adapters/types";
import type { WeeklyMetrics } from "./scoring";

export interface Narrative {
  headline: string;
  body: string; // AI所見 ＋ 来週の推奨アクション
}

const levelWord = { green: "良好", yellow: "注意", red: "危険" } as const;

/** テンプレによる所見（Claude未設定時のフォールバック） */
function templateNarrative(o: Observations, m: WeeklyMetrics): Narrative {
  const ff = m.firefightingRatioPct;
  const lines: string[] = [];
  lines.push(`今週の総合健全性は ${m.score}点（${levelWord[m.level]}）です。`);
  const allDeductions = m.dimensions.flatMap((d) => d.deductions);
  const worst = m.dimensions.slice().sort((a, b) => a.score - b.score)[0];
  if (allDeductions.length) {
    const top = allDeductions.slice().sort((a, b) => a.points - b.points).slice(0, 3);
    lines.push(`最も弱い次元は「${worst.label}」(${worst.score}点)。主な減点: ` + top.map((p) => `${p.reason}(${p.points})`).join(" / ") + "。");
  } else {
    lines.push("目立った減点要因はありませんでした。");
  }
  if (ff !== null && ff > 50) {
    lines.push(
      `対応工数の約${ff}%が火消しに充てられており、改善タスク（${o.work.improvementItems}件）が圧迫されています。` +
        `来週は、繰り返し発生する問い合わせ・インシデントの根本原因を1つ選び、改善タスクとして着手することを推奨します。`,
    );
  } else if (ff !== null) {
    lines.push(`火消し比率は${ff}%で、改善に時間を割ける状態です。信頼性向上タスクを前進させる好機です。`);
  }
  if (o.quality.availabilityPct !== null && o.quality.availabilityPct < 99.9) {
    lines.push(`可用性が${o.quality.availabilityPct}%に低下しています。ユーザー影響の大きいエラーから優先的に潰してください。`);
  }
  if (o.quality.deployCausedIncidents > 0) {
    lines.push(`リリース/hotfix起因の障害が${o.quality.deployCausedIncidents}件。リリース前チェックの強化を検討してください。`);
  }
  if (o.missingSources.length) {
    lines.push(`※未接続のデータ源: ${o.missingSources.join(", ")}（数値は過小評価の可能性があります）。`);
  }
  return {
    headline: `健全性${m.score}点・${levelWord[m.level]}${ff !== null ? `／火消し比率${ff}%` : ""}`,
    body: lines.join("\n"),
  };
}

/** Claudeがあれば所見を生成、なければテンプレにフォールバック */
export async function buildNarrative(o: Observations, m: WeeklyMetrics): Promise<Narrative> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return templateNarrative(o, m);

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
    const prompt =
      `あなたはSREチームの週次レポートを書くアシスタントです。以下のJSONは今週のシステム観測データとスコアです。\n` +
      `2〜4文で今週の状態を要約し、続けて「来週の推奨アクション」を最大3つ、箇条書きで挙げてください。\n` +
      `火消しに時間が取られ改善が進まない構造があれば、それを断つ具体策を優先してください。日本語で。\n\n` +
      JSON.stringify({ observations: o, metrics: { score: m.score, level: m.level, dimensions: m.dimensions, firefightingRatioPct: m.firefightingRatioPct } });
    const msg = await client.messages.create({
      model,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n").trim();
    if (!text) return templateNarrative(o, m);
    return { headline: templateNarrative(o, m).headline, body: text };
  } catch {
    return templateNarrative(o, m);
  }
}
