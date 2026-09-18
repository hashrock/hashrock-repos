import { upsertSignupSnapshots, type SignupSnapshotInput } from "./db";

/**
 * 各サービスのサインアップ数を集める。
 *
 * 他サービスの D1 は bind しない。各サービスが自分の件数だけを返す
 * `GET /api/stats` (Bearer 認証) を持ち、ここから並列に叩く。
 */

/** STATS_SOURCES の 1 要素。url が null のものは本番 URL が未記入 */
export interface StatsSource {
  name: string;
  url: string | null;
}

/** 1 サービス分の取得結果。失敗しても捨てずに error を付けて残す */
export interface SignupStat {
  service: string;
  url: string | null;
  /** ISO 8601。この結果が確定した時刻 */
  fetchedAt: string;
  total: number | null;
  /** created_at を持たないサービスは null */
  new7d: number | null;
  new30d: number | null;
  /** サービスが返した note (例: "created_at なし") */
  note: string | null;
  error: string | null;
}

export const STATS_FETCH_TIMEOUT_MS = 5000;

/**
 * STATS_SOURCES (JSON 文字列) を読む。未設定は空配列。
 * 形が壊れているときは設定ミスなので投げる (黙って空にすると気付けない)。
 */
export function parseStatsSources(raw: string | undefined): StatsSource[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("STATS_SOURCES が JSON として読めません");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("STATS_SOURCES は配列にしてください");
  }
  const names = new Set<string>();
  return parsed.map((item, i) => {
    const name = (item as { name?: unknown })?.name;
    const url = (item as { url?: unknown })?.url;
    if (typeof name !== "string" || !name) {
      throw new Error(`STATS_SOURCES[${i}] の name がありません`);
    }
    if (url !== null && typeof url !== "string") {
      throw new Error(`STATS_SOURCES[${i}] の url は文字列か null にしてください`);
    }
    if (names.has(name)) {
      throw new Error(`STATS_SOURCES の name "${name}" が重複しています`);
    }
    names.add(name);
    return { name, url: url || null };
  });
}

export function statsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/stats`;
}

export interface CollectOptions {
  token: string | undefined;
  /** テストで差し替える。既定はグローバルの fetch */
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

class TimeoutError extends Error {}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isCountOrNull(v: unknown): v is number | null {
  return v === null || isCount(v);
}

/** /api/stats の応答を検証して数だけ取り出す。形が違えば null */
function readStatsBody(
  body: unknown
): Pick<SignupStat, "total" | "new7d" | "new30d" | "note"> | null {
  const users = (body as { users?: unknown })?.users as
    | { total?: unknown; new_7d?: unknown; new_30d?: unknown }
    | undefined;
  if (!users || typeof users !== "object") return null;
  // new_7d / new_30d は created_at の無いサービスだと null。キー欠落も null 扱い
  const new7d = users.new_7d ?? null;
  const new30d = users.new_30d ?? null;
  if (!isCount(users.total) || !isCountOrNull(new7d) || !isCountOrNull(new30d)) {
    return null;
  }
  const note = (body as { note?: unknown }).note;
  return {
    total: users.total,
    new7d,
    new30d,
    note: typeof note === "string" ? note : null,
  };
}

async function fetchOne(
  source: StatsSource,
  token: string | undefined,
  doFetch: typeof fetch,
  timeoutMs: number,
  now: () => Date
): Promise<SignupStat> {
  const failed = (error: string): SignupStat => ({
    service: source.name,
    url: source.url,
    fetchedAt: now().toISOString(),
    total: null,
    new7d: null,
    new30d: null,
    note: null,
    error,
  });

  if (!source.url) return failed("URL 未設定");
  if (!token) return failed("STATS_TOKEN 未設定");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // fetch が signal を無視しても待ち続けないよう、タイマー側からも reject する
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);
  });

  try {
    const body = await Promise.race([
      (async () => {
        const res = await doFetch(statsEndpoint(source.url!), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        try {
          return await res.json();
        } catch {
          throw new Error("JSON でない応答");
        }
      })(),
      timeout,
    ]);
    const counts = readStatsBody(body);
    if (!counts) return failed("応答の形が不正");
    return {
      service: source.name,
      url: source.url,
      fetchedAt: now().toISOString(),
      ...counts,
      error: null,
    };
  } catch (e) {
    if (e instanceof TimeoutError) {
      return failed(`タイムアウト (${timeoutMs / 1000} 秒)`);
    }
    return failed(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * sources を並列に取得する。結果は sources と同じ順で、失敗も error 付きで残す。
 * 1 件の失敗やタイムアウトで全体を落とさない。
 */
export async function collectSignupStats(
  sources: StatsSource[],
  options: CollectOptions
): Promise<SignupStat[]> {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? STATS_FETCH_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());
  return Promise.all(
    sources.map((s) => fetchOne(s, options.token, doFetch, timeoutMs, now))
  );
}

/** 収集を始めた時刻の UTC 日付。スナップショットの date 列 */
export function snapshotDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * 取得に成功した分だけを行にする。失敗した分は書かない
 * (同じ日の成功済みの行を失敗で潰さないため)。
 */
export function toSnapshotRows(
  results: SignupStat[],
  date: string
): SignupSnapshotInput[] {
  return results
    .filter((r) => r.error === null && r.total !== null)
    .map((r) => ({
      date,
      service: r.service,
      total: r.total,
      new7d: r.new7d,
      new30d: r.new30d,
      takenAt: r.fetchedAt,
    }));
}

export interface StatsEnv {
  DB: D1Database;
  STATS_SOURCES?: string;
  STATS_TOKEN?: string;
}

export interface SnapshotResult {
  date: string;
  saved: number;
  results: SignupStat[];
}

/**
 * 収集して signup_snapshots に upsert する。Cron と手動 refresh の共通処理。
 * 同じ日に再実行すると成功した分が上書きされる。
 */
export async function takeSignupSnapshot(
  env: StatsEnv,
  deps: Pick<CollectOptions, "fetch" | "timeoutMs" | "now"> = {}
): Promise<SnapshotResult> {
  const now = deps.now ?? (() => new Date());
  const date = snapshotDate(now());
  const sources = parseStatsSources(env.STATS_SOURCES);
  const results = await collectSignupStats(sources, {
    ...deps,
    now,
    token: env.STATS_TOKEN,
  });
  const rows = toSnapshotRows(results, date);
  await upsertSignupSnapshots(env.DB, rows);
  return { date, saved: rows.length, results };
}
