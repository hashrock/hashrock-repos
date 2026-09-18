import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectSignupStats,
  parseStatsSources,
  statsEndpoint,
  takeSignupSnapshot,
  toSnapshotRows,
  type SignupStat,
} from "../signupStats";
import { listSignupSnapshotsSince } from "../db";
import { createSignupSnapshotsD1 } from "./sqlite-d1";

const NOW = new Date("2026-09-18T00:00:03.000Z");
const now = () => NOW;

function statsBody(total: number, new7d: number | null = 1, new30d: number | null = 2, extra = {}) {
  return {
    service: "x",
    generated_at: "2026-09-18T00:00:00.000Z",
    users: { total, new_7d: new7d, new_30d: new30d },
    ...extra,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** URL ごとに応答を決める fetch。呼ばれ方も記録する */
function fakeFetch(routes: Record<string, () => Promise<Response>>) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const handler = routes[String(input)];
    if (!handler) throw new TypeError(`fetch failed: ${String(input)}`);
    return handler();
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("parseStatsSources", () => {
  it("未設定は空配列", () => {
    expect(parseStatsSources(undefined)).toEqual([]);
    expect(parseStatsSources("  ")).toEqual([]);
  });

  it("name と url を読む。url の null と空文字は null", () => {
    expect(
      parseStatsSources(
        '[{"name":"grid24","url":"https://grid.hashrock.info"},{"name":"a","url":null},{"name":"b","url":""}]'
      )
    ).toEqual([
      { name: "grid24", url: "https://grid.hashrock.info" },
      { name: "a", url: null },
      { name: "b", url: null },
    ]);
  });

  it("壊れた設定は投げる", () => {
    expect(() => parseStatsSources("{")).toThrow("JSON");
    expect(() => parseStatsSources('{"name":"a"}')).toThrow("配列");
    expect(() => parseStatsSources('[{"url":null}]')).toThrow("name");
    expect(() => parseStatsSources('[{"name":"a","url":1}]')).toThrow("url");
    expect(() =>
      parseStatsSources('[{"name":"a","url":null},{"name":"a","url":null}]')
    ).toThrow("重複");
  });
});

describe("statsEndpoint", () => {
  it("末尾のスラッシュを重ねない", () => {
    expect(statsEndpoint("https://a.test")).toBe("https://a.test/api/stats");
    expect(statsEndpoint("https://a.test/")).toBe("https://a.test/api/stats");
  });
});

describe("collectSignupStats", () => {
  it("成功と失敗が混ざっても全件を sources の順で返す", async () => {
    const doFetch = fakeFetch({
      "https://ok.test/api/stats": async () => jsonResponse(statsBody(123, 4, 12)),
      "https://nocreated.test/api/stats": async () =>
        jsonResponse(statsBody(7, null, null, { note: "created_at なし" })),
      "https://missing.test/api/stats": async () => jsonResponse({ error: "not found" }, 404),
      "https://badshape.test/api/stats": async () => jsonResponse({ users: { total: "3" } }),
      "https://html.test/api/stats": async () => new Response("<html>", { status: 200 }),
    });

    const results = await collectSignupStats(
      [
        { name: "ok", url: "https://ok.test" },
        { name: "nocreated", url: "https://nocreated.test" },
        { name: "missing", url: "https://missing.test" },
        { name: "down", url: "https://down.test" },
        { name: "badshape", url: "https://badshape.test" },
        { name: "html", url: "https://html.test" },
        { name: "unset", url: null },
      ],
      { token: "secret", fetch: doFetch, now }
    );

    expect(results.map((r) => [r.service, r.total, r.new7d, r.new30d, r.error])).toEqual([
      ["ok", 123, 4, 12, null],
      ["nocreated", 7, null, null, null],
      ["missing", null, null, null, "HTTP 404"],
      ["down", null, null, null, "fetch failed: https://down.test/api/stats"],
      ["badshape", null, null, null, "応答の形が不正"],
      ["html", null, null, null, "JSON でない応答"],
      ["unset", null, null, null, "URL 未設定"],
    ]);
    expect(results[1].note).toBe("created_at なし");
    expect(results.every((r) => r.fetchedAt === NOW.toISOString())).toBe(true);
    // url が null のものは叩かない
    expect(doFetch).toHaveBeenCalledTimes(6);
  });

  it("Bearer トークンを付けて叩く", async () => {
    const doFetch = fakeFetch({
      "https://ok.test/api/stats": async () => jsonResponse(statsBody(1)),
    });
    await collectSignupStats([{ name: "ok", url: "https://ok.test" }], {
      token: "secret",
      fetch: doFetch,
    });
    const init = doFetch.mock.calls[0][1]!;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("STATS_TOKEN が無ければ叩かずにエラーを残す", async () => {
    const doFetch = fakeFetch({});
    const results = await collectSignupStats([{ name: "ok", url: "https://ok.test" }], {
      token: undefined,
      fetch: doFetch,
    });
    expect(results[0].error).toBe("STATS_TOKEN 未設定");
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("5 秒で打ち切り、他のサービスの結果は残す。fetch が signal を無視しても待たない", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const doFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://slow.test")) {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {}); // 永遠に返らない
      }
      return jsonResponse(statsBody(5));
    });

    const pending = collectSignupStats(
      [
        { name: "slow", url: "https://slow.test" },
        { name: "ok", url: "https://ok.test" },
      ],
      { token: "secret", fetch: doFetch, now }
    );
    await vi.advanceTimersByTimeAsync(4999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const results = await pending;

    expect(signal?.aborted).toBe(true);
    expect(results[0]).toMatchObject({ service: "slow", total: null, error: "タイムアウト (5 秒)" });
    expect(results[1]).toMatchObject({ service: "ok", total: 5, error: null });
  });
});

describe("toSnapshotRows", () => {
  it("成功した分だけを行にする", () => {
    const base: SignupStat = {
      service: "a",
      url: "https://a.test",
      fetchedAt: "2026-09-18T00:00:01.000Z",
      total: 10,
      new7d: null,
      new30d: null,
      note: "created_at なし",
      error: null,
    };
    expect(
      toSnapshotRows(
        [base, { ...base, service: "b", total: null, error: "HTTP 500" }],
        "2026-09-18"
      )
    ).toEqual([
      {
        date: "2026-09-18",
        service: "a",
        total: 10,
        new7d: null,
        new30d: null,
        takenAt: "2026-09-18T00:00:01.000Z",
      },
    ]);
  });
});

describe("takeSignupSnapshot", () => {
  const SOURCES = JSON.stringify([
    { name: "a", url: "https://a.test" },
    { name: "b", url: "https://b.test" },
  ]);

  it("同じ日に再実行すると上書きし、失敗した分は前の値を消さない", async () => {
    const DB = createSignupSnapshotsD1();
    const env = { DB, STATS_SOURCES: SOURCES, STATS_TOKEN: "secret" };

    const first = await takeSignupSnapshot(env, {
      now: () => new Date("2026-09-18T00:00:00.000Z"),
      fetch: fakeFetch({
        "https://a.test/api/stats": async () => jsonResponse(statsBody(10, 1, 2)),
        "https://b.test/api/stats": async () => jsonResponse(statsBody(20, 3, 4)),
      }),
    });
    expect(first).toMatchObject({ date: "2026-09-18", saved: 2 });

    // 同日の 2 回目: a は増え、b は落ちている
    const second = await takeSignupSnapshot(env, {
      now: () => new Date("2026-09-18T12:00:00.000Z"),
      fetch: fakeFetch({
        "https://a.test/api/stats": async () => jsonResponse(statsBody(11, 2, 3)),
        "https://b.test/api/stats": async () => jsonResponse({}, 500),
      }),
    });
    expect(second.saved).toBe(1);

    expect(await listSignupSnapshotsSince(DB, "2026-09-01")).toEqual([
      { date: "2026-09-18", service: "a", total: 11, new7d: 2, new30d: 3, takenAt: "2026-09-18T12:00:00.000Z" },
      { date: "2026-09-18", service: "b", total: 20, new7d: 3, new30d: 4, takenAt: "2026-09-18T00:00:00.000Z" },
    ]);
  });

  it("STATS_SOURCES が壊れていれば投げる (Cron のログに出す)", async () => {
    const DB = createSignupSnapshotsD1();
    await expect(
      takeSignupSnapshot({ DB, STATS_SOURCES: "{", STATS_TOKEN: "secret" })
    ).rejects.toThrow("JSON");
  });
});
