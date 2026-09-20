import type { StatsSource } from "./signupStats";
import type { SignupSnapshotRow } from "./db";

/**
 * /admin/stats の props 組み立て。描画側は受け取った値をそのまま出すだけにし、
 * 表示の規則 (欠損の見せ方・時刻の書式・折れ線の座標) はここに置く。
 *
 * 画面は signup_snapshots だけを見る。開くたびに各サービスへ取りに行くと
 * 落ちているサービスのタイムアウトを毎回待つことになるので、収集は
 * Cron と「今すぐ記録」に任せる。
 */

export const STATS_CHART_DAYS = 30;
export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 120;
const CHART_PAD = 8;

export interface StatsTableRow {
  service: string;
  url: string | null;
  total: string;
  new7d: string;
  new30d: string;
  /** 最後に記録した時刻。JST の "YYYY-MM-DD HH:mm"。記録が無ければ — */
  takenAt: string;
}

/** 表に要る列だけ。折れ線は date/service/total しか見ない */
export type SnapshotForRow = Pick<
  SignupSnapshotRow,
  "date" | "service" | "total" | "new7d" | "new30d" | "takenAt"
>;
export type SnapshotForChart = Pick<SignupSnapshotRow, "date" | "service" | "total">;

export interface ChartPoint {
  date: string;
  total: number | null;
}

export interface ChartDot {
  x: number;
  y: number;
  date: string;
  total: number;
}

export interface ServiceChart {
  service: string;
  /** 期間内の最後の記録。無ければ null */
  latest: number | null;
  min: number | null;
  max: number | null;
  /** 欠けた日で線を切る。記録が無ければ空文字 */
  path: string;
  dots: ChartDot[];
}

export interface AdminStatsPageProps {
  rows: StatsTableRow[];
  charts: ServiceChart[];
  /** 折れ線の期間 (両端含む, YYYY-MM-DD) */
  from: string;
  to: string;
  configError: string | null;
}

const EMPTY = "—";

export function formatCount(n: number | null): string {
  return n === null ? EMPTY : n.toLocaleString("en-US");
}

/** ISO 8601 を JST の "YYYY-MM-DD HH:mm" にする。読めなければそのまま返す */
export function formatJst(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

/**
 * 設定順のサービスを先に並べ、設定から外れたが記録の残るサービスを後ろに足す。
 * 設定から消したサービスの記録を黙って落とさないため。
 */
export function orderServices(
  recorded: Iterable<string>,
  serviceOrder: string[]
): string[] {
  const extra = [...new Set(recorded)]
    .filter((name) => !serviceOrder.includes(name))
    .sort();
  return [...serviceOrder, ...extra];
}

/** サービスごとの最後の記録。同じ日が複数あれば後から来たものを採る */
function latestByService(snapshots: SnapshotForRow[]): Map<string, SnapshotForRow> {
  const latest = new Map<string, SnapshotForRow>();
  for (const s of snapshots) {
    const cur = latest.get(s.service);
    if (!cur || s.date >= cur.date) latest.set(s.service, s);
  }
  return latest;
}

/** 表は記録済みの最新行。取りに行かないので、まだ記録が無いサービスは — になる */
export function buildLatestRows(
  snapshots: SnapshotForRow[],
  sources: StatsSource[]
): StatsTableRow[] {
  const latest = latestByService(snapshots);
  const urls = new Map(sources.map((s) => [s.name, s.url]));
  return orderServices(latest.keys(), sources.map((s) => s.name)).map((service) => {
    const row = latest.get(service);
    return {
      service,
      url: urls.get(service) ?? null,
      total: formatCount(row?.total ?? null),
      new7d: formatCount(row?.new7d ?? null),
      new30d: formatCount(row?.new30d ?? null),
      takenAt: row ? formatJst(row.takenAt) : EMPTY,
    };
  });
}

/** today (UTC の YYYY-MM-DD) で終わる days 日分の日付。古い順 */
export function dateRange(today: string, days: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}

/** 日ごとの総数を dates に揃える。記録の無い日は null。並びは orderServices と同じ */
export function buildSeries(
  snapshots: SnapshotForChart[],
  serviceOrder: string[],
  dates: string[]
): { service: string; points: ChartPoint[] }[] {
  const byService = new Map<string, Map<string, number | null>>();
  for (const s of snapshots) {
    let m = byService.get(s.service);
    if (!m) byService.set(s.service, (m = new Map()));
    m.set(s.date, s.total);
  }
  return orderServices(byService.keys(), serviceOrder).map((service) => {
    const m = byService.get(service);
    return {
      service,
      points: dates.map((date) => ({ date, total: m?.get(date) ?? null })),
    };
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 折れ線の座標。縦軸は期間内の最小〜最大 (総数は大きく動かないので 0 起点にしない)。
 * 値が一定なら中央に水平線を引く。
 */
export function chartGeometry(
  points: ChartPoint[],
  width = CHART_WIDTH,
  height = CHART_HEIGHT
): Pick<ServiceChart, "min" | "max" | "path" | "dots"> {
  const values = points
    .map((p) => p.total)
    .filter((v): v is number => v !== null);
  if (values.length === 0) {
    return { min: null, max: null, path: "", dots: [] };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = points.length > 1 ? (width - CHART_PAD * 2) / (points.length - 1) : 0;
  const yOf = (v: number) =>
    max === min
      ? height / 2
      : CHART_PAD + (1 - (v - min) / (max - min)) * (height - CHART_PAD * 2);

  const dots: ChartDot[] = [];
  const segments: string[] = [];
  let penDown = false;
  points.forEach((p, i) => {
    if (p.total === null) {
      penDown = false;
      return;
    }
    const x = round1(CHART_PAD + i * step);
    const y = round1(yOf(p.total));
    dots.push({ x, y, date: p.date, total: p.total });
    segments.push(`${penDown ? "L" : "M"}${x} ${y}`);
    penDown = true;
  });
  return { min, max, path: segments.join(" "), dots };
}

export function buildAdminStatsPageProps(input: {
  /** STATS_SOURCES。並び順とリンク先にだけ使う (ここでは取りに行かない) */
  sources: StatsSource[];
  snapshots: SnapshotForRow[];
  /** 折れ線の最終日 (UTC の YYYY-MM-DD) */
  today: string;
  configError?: string | null;
  days?: number;
}): AdminStatsPageProps {
  const dates = dateRange(input.today, input.days ?? STATS_CHART_DAYS);
  const serviceOrder = input.sources.map((s) => s.name);
  const series = buildSeries(input.snapshots, serviceOrder, dates);
  return {
    rows: buildLatestRows(input.snapshots, input.sources),
    charts: series.map(({ service, points }) => {
      const recorded = points.filter((p) => p.total !== null);
      return {
        service,
        latest: recorded.length > 0 ? recorded[recorded.length - 1].total : null,
        ...chartGeometry(points),
      };
    }),
    from: dates[0],
    to: dates[dates.length - 1],
    configError: input.configError ?? null,
  };
}
