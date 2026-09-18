import { describe, it, expect } from "vitest";
import {
  CACHE_TTL_MS,
  findCurrentIndex,
  isFresh,
  matchesLocation,
  parseCache,
  pickLink,
  placeMenu,
  serializeCache,
  sortByName,
  toItems,
} from "../v1.js";

type Item = Parameters<typeof sortByName>[0][number];

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    name: "repo",
    description: null,
    logo: null,
    href: "https://example.test/",
    ...overrides,
  };
}

describe("sortByName", () => {
  it("sorts by name regardless of the API's updated-at order", () => {
    const sorted = sortByName([
      item({ id: 1, name: "nansuka" }),
      item({ id: 2, name: "edane" }),
      item({ id: 3, name: "Jam" }),
      item({ id: 4, name: "carve-daw" }),
    ]);
    expect(sorted.map((i) => i.name)).toEqual(["carve-daw", "edane", "Jam", "nansuka"]);
  });

  it("compares numbers numerically and breaks ties by id", () => {
    const sorted = sortByName([
      item({ id: 9, name: "grid24" }),
      item({ id: 5, name: "grid3" }),
      item({ id: 2, name: "grid3" }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual([2, 5, 9]);
  });

  it("does not mutate its input", () => {
    const input = [item({ name: "b" }), item({ name: "a" })];
    sortByName(input);
    expect(input.map((i) => i.name)).toEqual(["b", "a"]);
  });
});

describe("pickLink", () => {
  it("prefers url, then homepage, then repositoryUrl", () => {
    expect(
      pickLink({ url: "https://a.test/", homepage: "https://b.test/", repositoryUrl: "https://c.test/" })
    ).toBe("https://a.test/");
    expect(pickLink({ url: null, homepage: "https://b.test/", repositoryUrl: "https://c.test/" })).toBe(
      "https://b.test/"
    );
    expect(pickLink({ url: "", homepage: null, repositoryUrl: "https://github.com/hashrock/x" })).toBe(
      "https://github.com/hashrock/x"
    );
  });

  it("returns null when there is nowhere to go", () => {
    expect(pickLink({ url: null, homepage: null, repositoryUrl: null })).toBeNull();
  });

  it("never links to non-http URLs", () => {
    expect(pickLink({ url: "javascript:alert(1)", homepage: "https://b.test/" })).toBe("https://b.test/");
    expect(pickLink({ url: "data:text/html,x", homepage: "not a url" })).toBeNull();
  });
});

describe("toItems", () => {
  it("maps the API response, drops unlinkable repos and sorts by name", () => {
    const items = toItems({
      count: 3,
      repos: [
        { id: 3, name: "nansuka", description: "対訳ツール", url: "https://nansuka.hashrock.info/", logo: "https://repos.hashrock.info/logos/3" },
        { id: 2, name: "secret", description: null, url: null, homepage: null, repositoryUrl: null, logo: null },
        { id: 1, name: "edane", description: "", url: "https://edane.hashrock.info/", logo: "javascript:x" },
      ],
    });
    expect(items).toEqual([
      { id: 1, name: "edane", description: null, logo: null, href: "https://edane.hashrock.info/" },
      {
        id: 3,
        name: "nansuka",
        description: "対訳ツール",
        logo: "https://repos.hashrock.info/logos/3",
        href: "https://nansuka.hashrock.info/",
      },
    ]);
  });

  it("throws on an unexpected shape so the caller can show the failure", () => {
    expect(() => toItems({ error: "x" })).toThrow();
    expect(() => toItems(null)).toThrow();
  });
});

describe("matchesLocation", () => {
  it("ignores the scheme (ganttpad-cf is still registered as http://)", () => {
    expect(matchesLocation("http://ganttpad.app/", "https://ganttpad.app/notes/42")).toBe(true);
    expect(matchesLocation("https://ganttpad.app/", "http://ganttpad.app/")).toBe(true);
  });

  it("tells GitHub Pages sites on the same host apart by path", () => {
    const carve = "https://hashrock.github.io/carve-daw/";
    const media = "https://hashrock.github.io/mediabunny-ui/";
    const here = "https://hashrock.github.io/carve-daw/index.html?x=1#top";
    expect(matchesLocation(carve, here)).toBe(true);
    expect(matchesLocation(media, here)).toBe(false);
  });

  it("does not match a sibling path that merely shares a prefix", () => {
    expect(matchesLocation("https://hashrock.github.io/carve-daw/", "https://hashrock.github.io/carve-daw-2/")).toBe(
      false
    );
  });

  it("treats trailing slashes as the same place", () => {
    expect(matchesLocation("https://hashrock.github.io/carve-daw", "https://hashrock.github.io/carve-daw/")).toBe(true);
    expect(matchesLocation("https://hashrock.github.io/carve-daw/", "https://hashrock.github.io/carve-daw")).toBe(true);
  });

  it("requires the same host", () => {
    expect(matchesLocation("https://edane.hashrock.info/", "https://jam.hashrock.info/")).toBe(false);
    expect(matchesLocation("https://edane.hashrock.info/", "http://localhost:5191/")).toBe(false);
  });

  it("compares hosts case-insensitively", () => {
    expect(matchesLocation("https://Edane.Hashrock.info/", "https://edane.hashrock.info/map/1")).toBe(true);
  });

  it("returns false for unparsable input", () => {
    expect(matchesLocation("not a url", "https://edane.hashrock.info/")).toBe(false);
  });
});

describe("findCurrentIndex", () => {
  const items = [
    item({ id: 1, name: "carve-daw", href: "https://hashrock.github.io/carve-daw/" }),
    item({ id: 2, name: "ganttpad-cf", href: "http://ganttpad.app/" }),
    item({ id: 3, name: "mediabunny-ui", href: "https://hashrock.github.io/mediabunny-ui/" }),
  ];

  it("finds the site the page is on", () => {
    expect(findCurrentIndex(items, "https://ganttpad.app/notes/1")).toBe(1);
    expect(findCurrentIndex(items, "https://hashrock.github.io/mediabunny-ui/")).toBe(2);
  });

  it("returns -1 when the page is not one of the sites", () => {
    expect(findCurrentIndex(items, "https://repos.hashrock.info/switcher/demo")).toBe(-1);
    expect(findCurrentIndex(items, "https://hashrock.github.io/")).toBe(-1);
  });

  it("prefers the most specific match when a host-wide site also matches", () => {
    const withRoot = [item({ id: 9, name: "home", href: "https://hashrock.github.io/" }), ...items];
    expect(findCurrentIndex(withRoot, "https://hashrock.github.io/carve-daw/")).toBe(1);
    expect(findCurrentIndex(withRoot, "https://hashrock.github.io/other/")).toBe(0);
  });
});

describe("cache", () => {
  const items = [item({ name: "edane", href: "https://edane.hashrock.info/" })];

  it("round-trips through localStorage's string form", () => {
    expect(parseCache(serializeCache(items, 1000))).toEqual({ savedAt: 1000, items });
  });

  it("ignores missing, broken or other-version values", () => {
    expect(parseCache(null)).toBeNull();
    expect(parseCache("")).toBeNull();
    expect(parseCache("{not json")).toBeNull();
    expect(parseCache(JSON.stringify({ v: 2, savedAt: 1, items: [] }))).toBeNull();
    expect(parseCache(JSON.stringify({ v: 1, items: [] }))).toBeNull();
  });

  it("drops entries that would not be safe to render", () => {
    const raw = JSON.stringify({
      v: 1,
      savedAt: 1,
      items: [...items, { id: 2, name: "x", description: null, logo: null, href: "javascript:alert(1)" }],
    });
    expect(parseCache(raw)?.items).toEqual(items);
  });

  it("is fresh only within the TTL", () => {
    expect(isFresh(1000, 1000)).toBe(true);
    expect(isFresh(1000, 1000 + CACHE_TTL_MS - 1)).toBe(true);
    expect(isFresh(1000, 1000 + CACHE_TTL_MS)).toBe(false);
  });

  it("treats a timestamp from the future as stale", () => {
    expect(isFresh(5000, 1000)).toBe(false);
  });
});

describe("placeMenu", () => {
  const viewport = { width: 1280, height: 800 };

  it("aligns the right edge with the button and opens below it", () => {
    const place = placeMenu({ right: 1260, bottom: 48 }, viewport);
    expect(place).toEqual({ top: 54, right: 20, width: 320, maxHeight: 800 - 54 - 8 });
  });

  it("keeps the menu inside the left edge when the button is far left", () => {
    const place = placeMenu({ right: 40, bottom: 48 }, viewport);
    expect(viewport.width - place.right - place.width).toBeGreaterThanOrEqual(8);
  });

  it("shrinks to the viewport on narrow screens", () => {
    const place = placeMenu({ right: 360, bottom: 48 }, { width: 300, height: 600 });
    expect(place.width).toBe(284);
    expect(place.right).toBe(8);
  });
});
