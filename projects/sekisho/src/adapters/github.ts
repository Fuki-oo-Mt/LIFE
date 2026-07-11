import type { DataSource, Observations, Period } from "./types";

/**
 * GitHubアダプタ。
 *  - リリース／PR → デプロイ頻度・変更失敗・ビッグバン比率・リードタイム
 *  - Issue（ラベル分類）→ クライアント問い合わせ、火消し vs 改善
 *
 * 問い合わせはクライアントのシステムから連携が難しいためGitHub Issueにチケット化されている前提。
 * どのラベルを「問い合わせ／インシデント／改善」とみなすかは環境変数で設定（会社ごとに可変）。
 */

const BIG_BANG_CHANGED_LINES = 800; // これを超えるPRはビッグバン候補

function labelsFromEnv(key: string, fallback: string[]): string[] {
  const raw = process.env[key];
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : fallback;
}

export class GitHubDataSource implements DataSource {
  readonly name = "github";

  async collect(period: Period): Promise<Partial<Observations>> {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (!token || !owner || !repo) {
      return { missingSources: ["github"] };
    }

    let Octokit: typeof import("@octokit/rest").Octokit;
    try {
      ({ Octokit } = await import("@octokit/rest"));
    } catch {
      return { missingSources: ["github (@octokit/rest 未インストール)"] };
    }
    const octokit = new Octokit({ auth: token });

    const inquiryLabels = labelsFromEnv("GITHUB_INQUIRY_LABELS", ["inquiry", "問い合わせ"]);
    const incidentLabels = labelsFromEnv("GITHUB_INCIDENT_LABELS", ["incident", "障害"]);
    const improvementLabels = labelsFromEnv("GITHUB_IMPROVEMENT_LABELS", ["improvement", "改善"]);
    const hasAny = (names: string[], set: string[]) =>
      names.some((n) => set.map((s) => s.toLowerCase()).includes(n.toLowerCase()));

    const inPeriod = (d: string | null | undefined) => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= period.start.getTime() && t < period.end.getTime();
    };

    // --- リリース ---
    const releases = await octokit.paginate(octokit.repos.listReleases, {
      owner, repo, per_page: 100,
    }).catch(() => []);
    const releasesInPeriod = releases.filter((r: any) => inPeriod(r.published_at ?? r.created_at));

    // --- PR（closed を新しい順に。マージ済み・期間内のみ採用） ---
    const pulls = await octokit.paginate(octokit.pulls.list, {
      owner, repo, state: "closed", sort: "updated", direction: "desc", per_page: 100,
    }, (res: any, done: any) => {
      // 期間より前まで遡ったら打ち切り
      if (res.data.length && res.data.every((p: any) => new Date(p.updated_at).getTime() < period.start.getTime())) {
        done();
      }
      return res.data;
    }).catch(() => []);

    const merged = pulls.filter((p: any) => p.merged_at && inPeriod(p.merged_at));
    let bigBang = 0;
    let leadSum = 0;
    let leadCount = 0;
    let changeFail = 0;
    for (const p of merged as any[]) {
      const changed = (p.additions ?? 0) + (p.deletions ?? 0);
      if (changed >= BIG_BANG_CHANGED_LINES) bigBang++;
      if (p.created_at && p.merged_at) {
        leadSum += (new Date(p.merged_at).getTime() - new Date(p.created_at).getTime()) / 3_600_000;
        leadCount++;
      }
      const lbls = (p.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name ?? ""));
      if (hasAny(["revert", "rollback", "hotfix"], lbls) || /revert|rollback/i.test(p.title ?? "")) {
        changeFail++;
      }
    }

    // --- Issue（問い合わせ・作業分類） ---
    const openedIssues = await octokit.paginate(octokit.issues.listForRepo, {
      owner, repo, state: "all", since: period.start.toISOString(), per_page: 100,
    }, (res: any) => res.data.filter((i: any) => !i.pull_request)).catch(() => []);

    const sevFromLabels = (lbls: string[]): "P1" | "P2" | "P3" | "P4" | undefined => {
      const low = lbls.map((s) => s.toLowerCase());
      for (const p of ["p1", "p2", "p3", "p4"] as const) if (low.includes(p)) return p.toUpperCase() as any;
      if (low.some((s) => /priority.*(critical|highest)|sev1/.test(s))) return "P1";
      if (low.some((s) => /priority.*high|sev2/.test(s))) return "P2";
      if (low.some((s) => /priority.*medium|sev3/.test(s))) return "P3";
      return undefined;
    };

    const incidentLog: import("./types").IncidentRecord[] = [];
    // 手運用(データ修正等)を識別するラベル
    const manualOpsLabels = labelsFromEnv("GITHUB_MANUALOPS_LABELS", ["運用作業", "データ修正", "toil", "手運用"]);
    let manualOps = 0, firefighting = 0, improvement = 0;
    for (const i of openedIssues as any[]) {
      const lbls = (i.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name ?? ""));
      const isIncident = hasAny(incidentLabels, lbls);
      const isManualOps = hasAny(manualOpsLabels, lbls);
      const isImprovement = hasAny(improvementLabels, lbls);
      if (isManualOps && inPeriod(i.created_at)) manualOps++;
      if ((isIncident || isManualOps) && i.state === "open") firefighting++;
      if (isImprovement) improvement++;
      if (isIncident && (inPeriod(i.created_at) || (i.closed_at && inPeriod(i.closed_at)))) {
        incidentLog.push({
          ref: `#${i.number}`,
          title: i.title ?? "(無題)",
          source: "github",
          severity: sevFromLabels(lbls),
          status: i.state === "closed" ? "resolved" : "open",
          openedAt: i.created_at,
          resolvedAt: i.closed_at ?? undefined,
          url: i.html_url,
        });
      }
    }

    // 未完了の運用対応（障害＋手運用のopen）と最古滞留
    const opsLabels = [...incidentLabels, ...manualOpsLabels].join(",");
    const openOps = await octokit.paginate(octokit.issues.listForRepo, {
      owner, repo, state: "open", labels: opsLabels, per_page: 100,
    }, (res: any) => res.data.filter((i: any) => !i.pull_request)).catch(() => []);
    const backlog = openOps.length;
    let oldestAgeDays: number | null = null;
    for (const i of openOps as any[]) {
      const age = (period.end.getTime() - new Date(i.created_at).getTime()) / 86_400_000;
      oldestAgeDays = oldestAgeDays === null ? age : Math.max(oldestAgeDays, age);
    }

    void releasesInPeriod; void bigBang; void leadSum; void leadCount; // 品質重視のため配信スループット指標は集計対象外
    return {
      quality: {
        availabilityPct: null, // AWS等の可用性メトリクスから取得する想定
        errorRatePct: null,
        latencyP95Ms: null,
        deployCausedIncidents: changeFail, // revert/rollback/hotfix したPR = リリース起因の障害
        sloTargetPct: null,
      },
      work: {
        manualOpsTasks: manualOps,
        opsBacklog: backlog,
        oldestOpenDays: oldestAgeDays === null ? null : Math.round(oldestAgeDays),
        firefightingItems: firefighting,
        improvementItems: improvement,
      },
      incidentLog,
      missingSources: [],
    };
  }
}
