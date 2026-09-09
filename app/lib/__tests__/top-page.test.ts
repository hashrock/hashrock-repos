import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { KANBAN_COLUMNS } from "../constants";
import { buildTopPageProps, cardHref, extraTags, type TopPageRepo } from "../top-page";

function repo(overrides: Partial<TopPageRepo> & { id: number }): TopPageRepo {
  return {
    name: `repo-${overrides.id}`,
    url: `https://github.com/u/repo-${overrides.id}`,
    description: null,
    notes: null,
    language: null,
    starCount: 0,
    isPrivate: false,
    homepage: null,
    coverImageKey: null,
    logoSvg: null,
    tags: [],
    star: false,
    ...overrides,
  };
}

const arbRepo = fc
  .record({
    id: fc.integer({ min: 1, max: 10_000 }),
    star: fc.boolean(),
    tags: fc.uniqueArray(
      fc.oneof(fc.constantFrom(...KANBAN_COLUMNS), fc.constantFrom("web", "cli")),
      { maxLength: 4 }
    ),
  })
  .map(repo);

describe("buildTopPageProps", () => {
  it("derives the cards from the star flag and the columns from the column tags", () => {
    fc.assert(
      fc.property(fc.array(arbRepo, { maxLength: 30 }), fc.boolean(), (repos, signedIn) => {
        const props = buildTopPageProps(repos, signedIn);

        expect(props.signedIn).toBe(signedIn);
        expect(props.starred).toEqual(repos.filter((r) => r.star));
        expect(props.columns.map((c) => c.name)).toEqual([...KANBAN_COLUMNS]);
        for (const column of props.columns) {
          expect(column.repos).toEqual(repos.filter((r) => r.tags.includes(column.name)));
        }
      })
    );
  });

  it("puts a repo nowhere when it has neither a star nor a column tag", () => {
    const props = buildTopPageProps([repo({ id: 1, tags: ["web"] })], false);
    expect(props.starred).toEqual([]);
    expect(props.columns.every((c) => c.repos.length === 0)).toBe(true);
  });
});

describe("cardHref", () => {
  it("never links a private repo to GitHub", () => {
    expect(cardHref(repo({ id: 1, isPrivate: true }))).toBeNull();
    expect(cardHref(repo({ id: 1, isPrivate: true, homepage: "https://x" }))).toBe("https://x");
    expect(cardHref(repo({ id: 1, homepage: "https://x" }))).toBe("https://x");
    expect(cardHref(repo({ id: 1 }))).toBe("https://github.com/u/repo-1");
  });
});

describe("extraTags", () => {
  it("strips column names and keeps the rest in order", () => {
    expect(extraTags(["done", "web", "backlog", "cli"])).toEqual(["web", "cli"]);
  });
});
