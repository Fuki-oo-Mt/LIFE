import { emptyObservations, type Observations } from "../adapters/types";

/**
 * 取り込み（Ingest）: アクセス権を持つ収集役（Cursorエージェント／手動／スクリプト）が
 * 集めた観測データを受け取り、正規化する。
 *
 * 関所アプリ自体はクライアント／社内システムへの接続権限を必要としない。
 * 「取得」と「評価」を分離することで、権限が下りない環境でも成立させる。
 *
 * 入力は「部分的」でよい（取れた指標だけ埋める）。未提供の値は0/nullのまま。
 */
export interface IngestInput {
  project: { key: string; name?: string };
  period?: { start: string; end: string }; // 省略時は「先週」
  observations: DeepPartial<Observations>;
  /** 取れなかった/権限が無かったデータ源の名前（レポートに明示される） */
  missingSources?: string[];
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** 部分入力を完全な Observations にマージ（欠損は既定値） */
export function normalizeObservations(input: DeepPartial<Observations>, missing: string[] = []): Observations {
  const base = emptyObservations();
  if (input.quality) Object.assign(base.quality, input.quality);
  if (input.users) Object.assign(base.users, input.users);
  if (input.work) Object.assign(base.work, input.work);
  if (input.infra) Object.assign(base.infra, input.infra);
  if (input.dataPlatform) Object.assign(base.dataPlatform, input.dataPlatform);
  if (Array.isArray(input.incidentLog)) base.incidentLog = input.incidentLog as typeof base.incidentLog;
  const fromInput = Array.isArray(input.missingSources) ? (input.missingSources as string[]) : [];
  base.missingSources = [...new Set([...fromInput, ...missing])];
  return base;
}
