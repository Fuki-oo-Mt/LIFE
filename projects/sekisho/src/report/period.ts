import type { Period } from "../adapters/types";

/** 指定日を含む「先週分」の期間（月曜0:00〜翌月曜0:00）を返す。end 未指定なら今日基準。 */
export function weekPeriod(reference: Date = new Date(), weeksAgo = 0): Period {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  // 月曜を週初めにする（getDay: 0=日,1=月,...）
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day - weeksAgo * 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { start: monday, end: nextMonday };
}

/** "YYYY-MM-DD" 表記 */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
