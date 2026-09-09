import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { normalizeTagList } from "../../lib/tags";

vi.mock("../../lib/db", () => ({
  insertRepo: vi.fn(),
  updateRepoMeta: vi.fn(),
  deleteReposByFullNamePrefix: vi.fn(),
}));

import { deleteReposByFullNamePrefix, insertRepo, updateRepoMeta } from "../../lib/db";
import {
  SCENARIOS,
  cleanupScope,
  findScenario,
  isDbSeedingEnabled,
  runDbScenario,
  toGitHubRepo,
} from "../index";
import { seedsToTopPageProps, topPageCandidates } from "../render";
import { SCOPE_PATTERN, isScope, makeScope, randomSuffix } from "../scope";
import type { DbScenario, PropsScenario } from "../types";

const mockD1 = {} as D1Database;

function propsScenario(name: string): PropsScenario {
  const s = findScenario(name);
  if (s?.kind !== "props") throw new Error(`${name} is not a props scenario`);
  return s;
}

function dbScenario(name: string): DbScenario {
  const s = findScenario(name);
  if (s?.kind !== "db") throw new Error(`${name} is not a db scenario`);
  return s;
}

beforeEach(() => {
  vi.clearAllMocks();
  let nextId = 100;
  vi.mocked(insertRepo).mockImplementation(async (_d1, repo) => ({
    id: nextId++,
    githubId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    updatedAt: repo.updated_at,
    language: repo.language,
    starCount: repo.stargazers_count,
    archived: repo.archived,
    isPrivate: repo.private,
    createdAt: repo.created_at,
    notes: null,
    star: false,
    hide: false,
    coverImageKey: null,
    homepage: repo.homepage,
    logoSvg: null,
  }));
});

describe("scenario registry", () => {
  it("has between 3 and 6 scenarios with unique url-safe names", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(3);
    expect(SCENARIOS.length).toBeLessThanOrEqual(6);
    const names = SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("renders empty / typical / large from props without touching the DB", () => {
    expect(propsScenario("empty").seeds()).toHaveLength(0);
    const typical = propsScenario("typical").seeds().length;
    expect(typical).toBeGreaterThanOrEqual(3);
    expect(typical).toBeLessThanOrEqual(15);
    expect(propsScenario("large").seeds().length).toBeGreaterThanOrEqual(40);
  });

  it("keeps repo names unique and tags already normalised within each scenario", () => {
    for (const s of SCENARIOS) {
      const seeds = s.seeds();
      const names = seeds.map((x) => x.name);
      expect(new Set(names).size, s.name).toBe(names.length);
      for (const seed of seeds) {
        // 正規化で変わる表記を種に入れると、DB に入る形と期待が食い違う
        expect(seed.tags ?? [], `${s.name}/${seed.name}`).toEqual(
          normalizeTagList(seed.tags ?? [])
        );
      }
    }
  });

  it("does not know an unregistered name", () => {
    expect(findScenario("nope")).toBeUndefined();
  });
});

describe("props rendering", () => {
  it("builds the empty top page: no cards, five empty columns", () => {
    const props = seedsToTopPageProps(propsScenario("empty").seeds(), false);
    expect(props.starred).toEqual([]);
    expect(props.columns).toHaveLength(5);
    expect(props.columns.every((c) => c.repos.length === 0)).toBe(true);
  });

  it("shows exactly the shown-* repos in the visibility scenario", () => {
    // このシナリオの存在意義。出る/出ないの境界がトップページの規則と一致すること
    const props = seedsToTopPageProps(propsScenario("visibility").seeds(), false);
    const shown = new Set([
      ...props.starred.map((r) => r.name),
      ...props.columns.flatMap((c) => c.repos.map((r) => r.name)),
    ]);
    expect([...shown].sort()).toEqual([
      "shown-bare-minimum",
      "shown-private-star-no-homepage",
      "shown-private-with-homepage",
      "shown-star-and-column",
      "shown-star-only",
    ]);
  });

  it("drops hidden and archived seeds like listRepos does, and keeps private ones", () => {
    const candidates = topPageCandidates(propsScenario("visibility").seeds());
    const names = candidates.map((r) => r.name);
    expect(names).not.toContain("hidden-hide-flag");
    expect(names).not.toContain("hidden-archived");
    expect(names).toContain("hidden-private-untagged");
  });

  it("passes the logo through the same normalisation as the admin API", () => {
    const props = seedsToTopPageProps(
      [{ name: "x", star: true, logoSvg: '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script><circle r="1"/></svg>' }],
      false
    );
    expect(props.starred[0].logoSvg).not.toContain("<script");
    expect(props.starred[0].logoSvg).toContain("<circle");
  });

  it("passes signedIn through so the edit links can be toggled", () => {
    expect(seedsToTopPageProps([], true).signedIn).toBe(true);
    expect(seedsToTopPageProps([], false).signedIn).toBe(false);
  });
});

describe("db seeding gate", () => {
  it("is closed in production unless SCENARIOS_ENABLED=1", () => {
    expect(isDbSeedingEnabled({}, false)).toBe(false);
    expect(isDbSeedingEnabled({ SCENARIOS_ENABLED: "0" }, false)).toBe(false);
    expect(isDbSeedingEnabled({ SCENARIOS_ENABLED: "true" }, false)).toBe(false);
    expect(isDbSeedingEnabled({ SCENARIOS_ENABLED: "1" }, false)).toBe(true);
  });

  it("is open under the vite dev server", () => {
    expect(isDbSeedingEnabled({}, true)).toBe(true);
  });
});

describe("scope", () => {
  it("produces scopes that the page and cleanup routes accept", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SCENARIOS.map((s) => s.name)), (name) => {
        const scope = makeScope(name, randomSuffix());
        expect(scope).toMatch(SCOPE_PATTERN);
        expect(isScope(scope)).toBe(true);
      })
    );
  });

  it("rejects values that are not a scenario scope, so cleanup cannot reach other rows", () => {
    expect(isScope(undefined)).toBe(false);
    expect(isScope("")).toBe(false);
    expect(isScope("hashrock")).toBe(false);
    expect(isScope("scenario-typical-abc")).toBe(false);
    expect(isScope("scenario-typical-abc123/x")).toBe(false);
  });
});

describe("toGitHubRepo", () => {
  it("places the repo under the scope with a negative github id", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.stringMatching(/^[a-z0-9]{6}$/),
        (name, suffix) => {
          const scope = makeScope("admin-list", suffix);
          const repo = toGitHubRepo(scope, { name });
          expect(repo.full_name).toBe(`${scope}/${name}`);
          // 正の ID は GitHub の実在リポジトリと突き合わされてしまう
          expect(repo.id).toBeLessThan(0);
        }
      )
    );
  });
});

describe("runDbScenario", () => {
  it("inserts every seed under a fresh scope and points at the scoped page", async () => {
    const adminList = dbScenario("admin-list");
    const run = await runDbScenario(mockD1, adminList, "abc123");

    expect(run.scope).toBe("scenario-admin-list-abc123");
    expect(insertRepo).toHaveBeenCalledTimes(adminList.seeds().length);
    for (const [, repo] of vi.mocked(insertRepo).mock.calls) {
      expect(repo.full_name.startsWith("scenario-admin-list-abc123/")).toBe(true);
    }
    expect(run.repos).toHaveLength(adminList.seeds().length);
    expect(run.url).toBe("/__scenarios/admin-list/page?scope=scenario-admin-list-abc123");
    expect(run.repos[0].adminUrl).toBe(`/admin/repos/${run.repos[0].id}`);
  });

  it("writes hand-edited columns only for seeds that set them, normalising the logo", async () => {
    const adminEdit = dbScenario("admin-edit");
    await runDbScenario(mockD1, adminEdit, "abc123");

    const withMeta = adminEdit
      .seeds()
      .filter((s) => [s.notes, s.star, s.hide, s.logoSvg].some((v) => v !== undefined));
    expect(updateRepoMeta).toHaveBeenCalledTimes(withMeta.length);
    const [, , patch] = vi.mocked(updateRepoMeta).mock.calls[0];
    expect(patch.logoSvg).toMatch(/^<svg/);
  });

  it("points admin-edit at the created row", async () => {
    const run = await runDbScenario(mockD1, dbScenario("admin-edit"), "abc123");
    expect(run.url).toBe(`/admin/repos/${run.repos[0].id}`);
  });

  it("cleans up by the scope prefix only", async () => {
    vi.mocked(deleteReposByFullNamePrefix).mockResolvedValue({ deleted: 8 });
    const result = await cleanupScope(mockD1, "scenario-admin-list-abc123");
    expect(deleteReposByFullNamePrefix).toHaveBeenCalledWith(mockD1, "scenario-admin-list-abc123/");
    expect(result).toEqual({ deleted: 8 });
  });
});
