import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { normalizeTagList } from "../../lib/tags";

vi.mock("../../lib/db", () => ({
  insertRepo: vi.fn(),
  updateRepoMeta: vi.fn(),
}));

import { insertRepo, updateRepoMeta } from "../../lib/db";
import { SCENARIOS, findScenario, runScenario, toGitHubRepo } from "../index";
import {
  SCOPE_PATTERN,
  isScenarioFullName,
  makeScope,
  randomSuffix,
  scopeFilterFromQuery,
} from "../../lib/scenario-scope";

const mockD1 = {} as D1Database;

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

  it("includes the required empty / typical / large scenarios", () => {
    expect(findScenario("empty")?.seeds()).toHaveLength(0);
    const typical = findScenario("typical")!.seeds().length;
    expect(typical).toBeGreaterThanOrEqual(3);
    expect(typical).toBeLessThanOrEqual(15);
    expect(findScenario("large")!.seeds().length).toBeGreaterThanOrEqual(40);
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

describe("scope", () => {
  it("produces scopes that the query filter accepts", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SCENARIOS.map((s) => s.name)), (name) => {
        const scope = makeScope(name, randomSuffix());
        expect(scope).toMatch(SCOPE_PATTERN);
        expect(scopeFilterFromQuery(scope)).toBe(`${scope}/`);
      })
    );
  });

  it("recognises every full_name a scenario can produce, and nothing else", () => {
    // 通常の一覧はこれで除外する。取りこぼすと本番の公開ページにシナリオ行が混ざる
    fc.assert(
      fc.property(
        fc.constantFrom(...SCENARIOS.map((s) => s.name)),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        (name, repoName) => {
          const scope = makeScope(name, randomSuffix());
          expect(isScenarioFullName(toGitHubRepo(scope, { name: repoName }).full_name)).toBe(true);
        }
      )
    );
    expect(isScenarioFullName("hashrock/repos.hashrock.info")).toBe(false);
    expect(isScenarioFullName("scenario-typical-abc123")).toBe(false);
    expect(isScenarioFullName("scenarios/scenario-typical-abc123")).toBe(false);
  });

  it("ignores values that are not a scenario scope", () => {
    expect(scopeFilterFromQuery(undefined)).toBeUndefined();
    expect(scopeFilterFromQuery("")).toBeUndefined();
    expect(scopeFilterFromQuery("hashrock")).toBeUndefined();
    expect(scopeFilterFromQuery("scenario-typical-abc")).toBeUndefined();
  });
});

describe("toGitHubRepo", () => {
  it("places the repo under the scope with a negative github id", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.stringMatching(/^[a-z0-9]{6}$/),
        (name, suffix) => {
          const scope = makeScope("typical", suffix);
          const repo = toGitHubRepo(scope, { name });
          expect(repo.full_name).toBe(`${scope}/${name}`);
          expect(repo.full_name.startsWith(`${scope}/`)).toBe(true);
          // 正の ID は GitHub の実在リポジトリと突き合わされてしまう
          expect(repo.id).toBeLessThan(0);
        }
      )
    );
  });
});

describe("runScenario", () => {
  it("inserts every seed under a fresh scope and redirects into that scope", async () => {
    const typical = findScenario("typical")!;
    const run = await runScenario(mockD1, typical, "abc123");

    expect(run.scope).toBe("scenario-typical-abc123");
    expect(insertRepo).toHaveBeenCalledTimes(typical.seeds().length);
    for (const [, repo] of vi.mocked(insertRepo).mock.calls) {
      expect(repo.full_name.startsWith("scenario-typical-abc123/")).toBe(true);
    }
    expect(run.repos).toHaveLength(typical.seeds().length);
    expect(run.url).toBe("/?scenario=scenario-typical-abc123");
    expect(run.repos[0].adminUrl).toBe(`/admin/repos/${run.repos[0].id}`);
  });

  it("writes hand-edited columns only for seeds that set them", async () => {
    const typical = findScenario("typical")!;
    await runScenario(mockD1, typical, "abc123");

    const withMeta = typical
      .seeds()
      .filter((s) => [s.notes, s.star, s.hide, s.logoSvg].some((v) => v !== undefined));
    expect(updateRepoMeta).toHaveBeenCalledTimes(withMeta.length);
  });

  it("creates nothing for the empty scenario but still redirects into its scope", async () => {
    const run = await runScenario(mockD1, findScenario("empty")!, "zzz999");
    expect(insertRepo).not.toHaveBeenCalled();
    expect(updateRepoMeta).not.toHaveBeenCalled();
    expect(run.url).toBe("/?scenario=scenario-empty-zzz999");
  });

  it("points admin-edit at the created row", async () => {
    const run = await runScenario(mockD1, findScenario("admin-edit")!, "abc123");
    expect(run.requiresAdmin).toBe(true);
    expect(run.url).toBe(`/admin/repos/${run.repos[0].id}`);
  });
});
