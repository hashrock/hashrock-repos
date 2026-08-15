import { describe, it, expect } from "vitest";
import { sortByUpdatedDesc, toPublicRepo } from "../public-api";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "repo",
    fullName: "user/repo",
    url: "https://github.com/user/repo",
    description: "desc",
    updatedAt: "2024-01-01",
    language: "TypeScript",
    starCount: 3,
    isPrivate: false,
    notes: "note",
    coverImageKey: null,
    homepage: null,
    logoSvg: null,
    tags: ["editor"],
    ...overrides,
  } as Parameters<typeof toPublicRepo>[0];
}

const ORIGIN = "https://repos.hashrock.info";

describe("toPublicRepo", () => {
  it("exposes the repository URL for public repos", () => {
    const out = toPublicRepo(row(), ORIGIN);
    expect(out.repositoryUrl).toBe("https://github.com/user/repo");
    expect(out.url).toBe("https://github.com/user/repo");
    expect(out.isPrivate).toBe(false);
  });

  it("never exposes the repository URL for private repos", () => {
    const out = toPublicRepo(row({ isPrivate: true }), ORIGIN);
    expect(out.repositoryUrl).toBeNull();
    expect(out.url).toBeNull();
  });

  it("never leaks fullName in the payload", () => {
    const json = JSON.stringify(toPublicRepo(row({ isPrivate: true }), ORIGIN));
    expect(json).not.toContain("user/repo");
  });

  it("prefers homepage as the link target", () => {
    const out = toPublicRepo(row({ homepage: "https://example.test" }), ORIGIN);
    expect(out.url).toBe("https://example.test");
    expect(out.repositoryUrl).toBe("https://github.com/user/repo");
  });

  it("lets a private repo link to its homepage", () => {
    const out = toPublicRepo(
      row({ isPrivate: true, homepage: "https://example.test" }),
      ORIGIN
    );
    expect(out.url).toBe("https://example.test");
    expect(out.repositoryUrl).toBeNull();
  });

  it("makes the cover image an absolute URL", () => {
    const out = toPublicRepo(row({ coverImageKey: "abc.png" }), ORIGIN);
    expect(out.image).toBe("https://repos.hashrock.info/images/abc.png");
  });

  it("returns null image when no cover is set", () => {
    expect(toPublicRepo(row(), ORIGIN).image).toBeNull();
  });

  it("normalises nullable columns", () => {
    const out = toPublicRepo(row({ starCount: null, isPrivate: null }), ORIGIN);
    expect(out.starCount).toBe(0);
    expect(out.isPrivate).toBe(false);
  });
});

describe("sortByUpdatedDesc", () => {
  it("puts the most recently updated first", () => {
    const items = [
      toPublicRepo(row({ id: 1, updatedAt: "2024-01-01" }), ORIGIN),
      toPublicRepo(row({ id: 2, updatedAt: "2026-05-01" }), ORIGIN),
      toPublicRepo(row({ id: 3, updatedAt: "2025-03-01" }), ORIGIN),
    ];
    expect(sortByUpdatedDesc(items).map((r) => r.id)).toEqual([2, 3, 1]);
  });
});
