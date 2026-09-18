import { describe, expect, it } from "vitest";
import {
  CHART_HEIGHT,
  buildAdminStatsPageProps,
  buildSeries,
  buildStatsTableRows,
  chartGeometry,
  dateRange,
  formatJst,
} from "../signup-stats-view";
import type { SignupStat } from "../signupStats";

function stat(overrides: Partial<SignupStat> = {}): SignupStat {
  return {
    service: "grid24",
    url: "https://grid.hashrock.info",
    fetchedAt: "2026-09-18T00:00:03.000Z",
    total: 1234,
    new7d: 4,
    new30d: 12,
    note: null,
    error: null,
    ...overrides,
  };
}

describe("buildStatsTableRows", () => {
  it("数は桁区切り、欠損は —、時刻は JST", () => {
    const rows = buildStatsTableRows([
      stat(),
      stat({ service: "ganttpad-cf", url: null, total: 5, new7d: null, new30d: null, note: "created_at なし" }),
      stat({ service: "jam", total: null, new7d: null, new30d: null, error: "HTTP 401" }),
    ]);
    expect(rows).toEqual([
      {
        service: "grid24",
        url: "https://grid.hashrock.info",
        total: "1,234",
        new7d: "4",
        new30d: "12",
        fetchedAt: "2026-09-18 09:00",
        note: null,
        error: null,
      },
      {
        service: "ganttpad-cf",
        url: null,
        total: "5",
        new7d: "—",
        new30d: "—",
        fetchedAt: "2026-09-18 09:00",
        note: "created_at なし",
        error: null,
      },
      {
        service: "jam",
        url: "https://grid.hashrock.info",
        total: "—",
        new7d: "—",
        new30d: "—",
        fetchedAt: "2026-09-18 09:00",
        note: null,
        error: "HTTP 401",
      },
    ]);
  });

  it("読めない時刻はそのまま出す", () => {
    expect(formatJst("unknown")).toBe("unknown");
    expect(formatJst("2026-09-18T15:30:00Z")).toBe("2026-09-19 00:30");
  });
});

describe("dateRange", () => {
  it("today で終わる days 日分を古い順に返す (月またぎ)", () => {
    expect(dateRange("2026-03-02", 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
    const r = dateRange("2026-09-18", 30);
    expect(r).toHaveLength(30);
    expect(r[0]).toBe("2026-08-20");
    expect(r[29]).toBe("2026-09-18");
  });
});

describe("buildSeries", () => {
  it("設定順に並べ、記録の無い日は null、設定外の記録は後ろに足す", () => {
    const dates = ["2026-09-16", "2026-09-17", "2026-09-18"];
    const series = buildSeries(
      [
        { date: "2026-09-16", service: "b", total: 1 },
        { date: "2026-09-18", service: "b", total: 3 },
        { date: "2026-09-17", service: "old", total: 9 },
      ],
      ["b", "a"],
      dates
    );
    expect(series).toEqual([
      {
        service: "b",
        points: [
          { date: "2026-09-16", total: 1 },
          { date: "2026-09-17", total: null },
          { date: "2026-09-18", total: 3 },
        ],
      },
      { service: "a", points: dates.map((date) => ({ date, total: null })) },
      {
        service: "old",
        points: [
          { date: "2026-09-16", total: null },
          { date: "2026-09-17", total: 9 },
          { date: "2026-09-18", total: null },
        ],
      },
    ]);
  });
});

describe("chartGeometry", () => {
  it("記録が無ければ空", () => {
    expect(chartGeometry([{ date: "d", total: null }])).toEqual({
      min: null,
      max: null,
      path: "",
      dots: [],
    });
  });

  it("最小が下端、最大が上端。欠けた日で線を切る", () => {
    const g = chartGeometry(
      [
        { date: "1", total: 10 },
        { date: "2", total: 20 },
        { date: "3", total: null },
        { date: "4", total: 15 },
        { date: "5", total: 20 },
      ],
      408,
      116
    );
    // 幅 408 - 余白 8*2 を 4 等分 = 98 刻み。高さ 116 - 余白 8*2 = 100
    expect(g.min).toBe(10);
    expect(g.max).toBe(20);
    expect(g.path).toBe("M8 108 L106 8 M302 58 L400 8");
    expect(g.dots.map((d) => d.date)).toEqual(["1", "2", "4", "5"]);
  });

  it("値が一定なら中央の水平線", () => {
    const g = chartGeometry([
      { date: "1", total: 5 },
      { date: "2", total: 5 },
    ]);
    expect(g.dots.every((d) => d.y === CHART_HEIGHT / 2)).toBe(true);
  });
});

describe("buildAdminStatsPageProps", () => {
  it("表・折れ線・期間をまとめる", () => {
    const props = buildAdminStatsPageProps({
      results: [stat(), stat({ service: "jam", total: null, error: "HTTP 401" })],
      snapshots: [
        { date: "2026-09-17", service: "grid24", total: 1200 },
        { date: "2026-09-18", service: "grid24", total: 1234 },
        { date: "2026-08-19", service: "grid24", total: 1 }, // 期間外は無視
      ],
      today: "2026-09-18",
    });
    expect(props.from).toBe("2026-08-20");
    expect(props.to).toBe("2026-09-18");
    expect(props.configError).toBeNull();
    expect(props.rows.map((r) => [r.service, r.total, r.error])).toEqual([
      ["grid24", "1,234", null],
      ["jam", "—", "HTTP 401"],
    ]);
    expect(props.charts.map((c) => [c.service, c.latest, c.min, c.max, c.dots.length])).toEqual([
      ["grid24", 1234, 1200, 1234, 2],
      ["jam", null, null, null, 0],
    ]);
  });

  it("設定エラーを渡す", () => {
    const props = buildAdminStatsPageProps({
      results: [],
      snapshots: [],
      today: "2026-09-18",
      configError: "STATS_SOURCES は配列にしてください",
    });
    expect(props.configError).toBe("STATS_SOURCES は配列にしてください");
    expect(props.rows).toEqual([]);
  });
});
