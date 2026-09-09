import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { KANBAN_COLUMNS } from "../constants";
import {
  buildTopPageProps,
  cardHref,
  cardLinkLabel,
  countVisibleRepos,
  extraTags,
  matchesQuery,
  searchText,
  COLUMN_LABELS,
  type TopPageRepo,
} from "../top-page";

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

describe("cardLinkLabel", () => {
  it("names where the card goes, and is silent when there is no link", () => {
    expect(cardLinkLabel(repo({ id: 1 }))).toBe("GitHub で見る");
    expect(cardLinkLabel(repo({ id: 1, homepage: "https://x" }))).toBe("サイトを開く");
    expect(cardLinkLabel(repo({ id: 1, isPrivate: true, homepage: "https://x" }))).toBe("サイトを開く");
    expect(cardLinkLabel(repo({ id: 1, isPrivate: true }))).toBeNull();
  });

  it("agrees with cardHref: a label exists exactly when a link exists", () => {
    fc.assert(
      fc.property(
        fc.record({
          isPrivate: fc.boolean(),
          homepage: fc.option(fc.webUrl(), { nil: null }),
          url: fc.webUrl(),
        }),
        (r) => {
          expect(cardLinkLabel(r) === null).toBe(cardHref(r) === null);
        }
      )
    );
  });
});

describe("COLUMN_LABELS", () => {
  it("has a Japanese label for every column", () => {
    for (const name of KANBAN_COLUMNS) {
      expect(COLUMN_LABELS[name]).toBeTruthy();
    }
  });
});

describe("searchText / matchesQuery", () => {
  it("matches on name, description and extra tags, case-insensitively", () => {
    const text = searchText(repo({ id: 1, name: "Gantt-CLI", description: "ターミナルで描く", tags: ["ongoing", "cli"] }));
    expect(matchesQuery(text, "gantt")).toBe(true);
    expect(matchesQuery(text, "ターミナル")).toBe(true);
    expect(matchesQuery(text, "CLI")).toBe(true);
    expect(matchesQuery(text, "ongoing")).toBe(false); // 列名は照合しない
    expect(matchesQuery(text, "nope")).toBe(false);
  });

  it("requires every whitespace-separated term (AND)", () => {
    const text = searchText(repo({ id: 1, name: "notes-app", description: "Markdown のメモ帳" }));
    expect(matchesQuery(text, "notes メモ")).toBe(true);
    expect(matchesQuery(text, "notes  \n メモ")).toBe(true);
    expect(matchesQuery(text, "notes 帳簿")).toBe(false);
  });

  it("matches everything on an empty or blank query", () => {
    fc.assert(
      fc.property(fc.string(), fc.stringMatching(/^\s*$/), (hay, blank) => {
        expect(matchesQuery(hay, blank)).toBe(true);
      })
    );
  });

  it("matches itself: every non-blank search text is found by any of its own words", () => {
    fc.assert(
      fc.property(arbRepo, (r) => {
        const text = searchText(r);
        for (const word of text.split(/\s+/).filter(Boolean)) {
          expect(matchesQuery(text, word)).toBe(true);
        }
      })
    );
  });
});

describe("countVisibleRepos", () => {
  it("counts a repo once even when it is both starred and in a column", () => {
    const props = buildTopPageProps(
      [repo({ id: 1, star: true, tags: ["done"] }), repo({ id: 2, tags: ["done", "backlog"] }), repo({ id: 3 })],
      false
    );
    expect(countVisibleRepos(props)).toBe(2);
  });

  it("is zero exactly when nothing is starred or in a column", () => {
    fc.assert(
      fc.property(fc.array(arbRepo, { maxLength: 20 }), (repos) => {
        const props = buildTopPageProps(repos, false);
        const visible = repos.filter((r) => r.star || r.tags.some((t) => (KANBAN_COLUMNS as readonly string[]).includes(t)));
        expect(countVisibleRepos(props)).toBe(new Set(visible.map((r) => r.id)).size);
      })
    );
  });
});
