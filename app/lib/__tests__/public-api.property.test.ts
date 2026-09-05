import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { sortByUpdatedDesc, toPublicRepo, type RepoRow } from "../public-api";

/**
 * 公開 API の整形の property-based test。
 *
 * ここは唯一「private リポジトリの情報を外に出すかどうか」を決める場所で、
 * 間違えると誰でも見られる JSON に非公開リポジトリのパスが載る。例示テストは
 * 代表的な 1 行しか見ないので、null と空文字と homepage の有無の組み合わせを
 * 自動で当てる。
 *
 * 生成器の要は **漏れてはいけない文字列と、漏れてよい文字列を語彙ごと分ける**
 * こと。fullName に使う語を description や notes に混ぜてしまうと、正当な
 * 出力を「漏洩」と誤検出して、プロパティが嘘をつく。
 */

/** 出てはいけない語。fullName と、そこから組み立てた URL にだけ現れる */
const SECRET_SLUG = "hidden-owner/secret-repo";
/** 出てよい語。人が書いた文章に使う */
const PUBLIC_WORDS = ["memo", "an editor", "", "notes here"];

const rowArb: fc.Arbitrary<RepoRow> = fc
  .record({
    id: fc.integer({ min: 1, max: 999 }),
    description: fc.constantFrom(...PUBLIC_WORDS, null),
    notes: fc.constantFrom(...PUBLIC_WORDS, null),
    updatedAt: fc.constantFrom("2024-01-01", "2025-06-01", "2026-02-02"),
    language: fc.constantFrom("TypeScript", "Rust", null),
    starCount: fc.constantFrom(0, 7, 500, null),
    isPrivate: fc.constantFrom(true, false, null),
    coverImageKey: fc.constantFrom("cover.png", "a b.png", null),
    homepage: fc.constantFrom("https://example.test", "", null),
    logoSvg: fc.constantFrom("<svg/>", null),
    tags: fc.uniqueArray(fc.constantFrom("ops", "web"), { maxLength: 2 }),
  })
  .map((row) => ({
    ...row,
    name: "secret-repo",
    fullName: SECRET_SLUG,
    url: `https://github.com/${SECRET_SLUG}`,
  }));

const ORIGIN = "https://repos.hashrock.info";
const RUNS = 1000;

describe("toPublicRepo の不変条件", () => {
  it("private なら、どこにも fullName 由来の文字列が出ない", () => {
    // 訪問者には 404 にしかならない上、リポジトリのパスを晒すことになる
    fc.assert(
      fc.property(rowArb, (row) => {
        const out = toPublicRepo({ ...row, isPrivate: true }, ORIGIN);
        expect(JSON.stringify(out)).not.toContain(SECRET_SLUG);
      }),
      { numRuns: RUNS }
    );
  });

  it("public なら、リポジトリ URL は必ず出る", () => {
    // 隠しすぎて公開リポジトリのリンクが消えていないこと (逆向きの歯止め)
    fc.assert(
      fc.property(rowArb, (row) => {
        const out = toPublicRepo({ ...row, isPrivate: false }, ORIGIN);
        expect(out.repositoryUrl).toBe(row.url);
      }),
      { numRuns: RUNS }
    );
  });

  it("リンク先は homepage 優先で、無ければ公開時のみリポジトリ URL", () => {
    fc.assert(
      fc.property(rowArb, (row) => {
        const out = toPublicRepo(row, ORIGIN);
        const expected = row.homepage || out.repositoryUrl;
        expect(out.url).toBe(expected);
        // private で homepage が無ければ、開ける先は無い
        if (out.isPrivate && !row.homepage) {
          expect(out.url).toBeNull();
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("画像とロゴは、元の列がある時だけ絶対 URL で出る", () => {
    // 生の SVG を返さないこと。受け取った CMS がインライン展開すると、
    // 貼り付けた内容がその CMS のオリジンで動く
    fc.assert(
      fc.property(rowArb, (row) => {
        const out = toPublicRepo(row, ORIGIN);
        expect(out.image !== null).toBe(row.coverImageKey !== null);
        expect(out.logo !== null).toBe(row.logoSvg !== null);
        for (const url of [out.image, out.logo]) {
          if (url !== null) expect(url.startsWith(`${ORIGIN}/`)).toBe(true);
        }
        if (row.logoSvg !== null) {
          expect(out.logo).toBe(`${ORIGIN}/logos/${row.id}`);
          expect(JSON.stringify(out)).not.toContain("<svg");
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("nullable な列は既定値に潰す", () => {
    fc.assert(
      fc.property(rowArb, (row) => {
        const out = toPublicRepo(row, ORIGIN);
        expect(out.starCount).toBe(row.starCount ?? 0);
        expect(out.isPrivate).toBe(row.isPrivate ?? false);
      }),
      { numRuns: RUNS }
    );
  });
});

describe("sortByUpdatedDesc の不変条件", () => {
  it("中身を保存し、冪等で、新しい順に並ぶ", () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 6 }), (rows) => {
        const items = rows.map((row, i) =>
          toPublicRepo({ ...row, id: i + 1 }, ORIGIN)
        );
        const sorted = sortByUpdatedDesc(items);
        expect(sorted.map((r) => r.id).sort()).toEqual(
          items.map((r) => r.id).sort()
        );
        expect(sortByUpdatedDesc(sorted)).toEqual(sorted);
        for (let i = 0; i + 1 < sorted.length; i++) {
          expect(sorted[i].updatedAt >= sorted[i + 1].updatedAt).toBe(true);
        }
      }),
      { numRuns: RUNS }
    );
  });
});
