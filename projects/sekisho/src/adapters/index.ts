import { emptyObservations, type DataSource, type Observations, type Period } from "./types";
import { MockDataSource } from "./mock";
import { GitHubDataSource } from "./github";
import { AwsCloudWatchDataSource } from "./aws";
import { SnowflakeDataSource } from "./snowflake";

export * from "./types";

/** SEKISHO_MODE に応じて使うアダプタ群を返す */
export function activeSources(): DataSource[] {
  const mode = (process.env.SEKISHO_MODE ?? "mock").toLowerCase();
  if (mode === "live") {
    return [new GitHubDataSource(), new AwsCloudWatchDataSource(), new SnowflakeDataSource()];
  }
  return [new MockDataSource()];
}

/** 全アダプタの観測を1つの Observations にマージする（欠損源は明示） */
export async function collectObservations(period: Period): Promise<Observations> {
  const merged = emptyObservations();
  const results = await Promise.allSettled(activeSources().map((s) => s.collect(period)));

  for (const res of results) {
    if (res.status !== "fulfilled") continue;
    const part = res.value;
    if (part.quality) Object.assign(merged.quality, part.quality);
    if (part.users) Object.assign(merged.users, part.users);
    if (part.work) Object.assign(merged.work, part.work);
    if (part.infra) Object.assign(merged.infra, part.infra);
    if (part.dataPlatform) Object.assign(merged.dataPlatform, part.dataPlatform);
    if (part.incidentLog?.length) merged.incidentLog.push(...part.incidentLog);
    if (part.missingSources?.length) merged.missingSources.push(...part.missingSources);
  }
  merged.missingSources = [...new Set(merged.missingSources)];
  return merged;
}
