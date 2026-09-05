import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  addTag,
  normalizeTag,
  normalizeTagList,
  parseTagList,
  removeTag,
} from "../tags";

/**
 * タグ編集の property-based test。
 *
 * タグは「小文字・前後空白なし・重複なし」で持つ約束になっている。この約束は
 * 追加と削除を繰り返した後にも保たれていないと、GitHub の topics に空文字や
 * 重複を送ってしまう。個々の入力ではなく、操作列に対して見る。
 */

/** 実際に人が打つ形。前後空白・大文字・カンマ・空文字を混ぜる */
const inputArb = fc.constantFrom(
  "ops",
  " ops ",
  "OPS",
  "Web Dev",
  "",
  "   ",
  ",",
  "a,b",
  " A , b ,, c "
);

const tagListArb: fc.Arbitrary<string[]> = fc.uniqueArray(
  fc.constantFrom("ops", "web", "docs"),
  { maxLength: 3 }
);

const RUNS = 1000;

describe("normalizeTag / parseTagList のプロパティ", () => {
  it("parseTagList の結果は必ず正規化済みで空要素を含まない", () => {
    fc.assert(
      fc.property(fc.array(inputArb, { maxLength: 4 }), (parts) => {
        for (const tag of parseTagList(parts.join(","))) {
          expect(tag).toBe(normalizeTag(tag));
          expect(tag).not.toBe("");
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("正規化した結果をカンマで繋いで通しても変わらない (往復)", () => {
    // 要素にカンマは残らないので、join と split は情報を落とさない
    fc.assert(
      fc.property(fc.array(inputArb, { maxLength: 4 }), (parts) => {
        const tags = parseTagList(parts.join(","));
        expect(parseTagList(tags.join(","))).toEqual(tags);
      }),
      { numRuns: RUNS }
    );
  });
});

describe("normalizeTagList のプロパティ", () => {
  const rawListArb = fc.array(inputArb, { maxLength: 6 });

  it("出力は正規化済み・非空・重複なし", () => {
    // DB と GitHub の topics に渡る唯一の形。ここが崩れると
    // 「Ops」と「ops」が別タグとして増えていく
    fc.assert(
      fc.property(rawListArb, (raw) => {
        const tags = normalizeTagList(raw);
        expect(new Set(tags).size).toBe(tags.length);
        for (const tag of tags) {
          expect(tag).toBe(normalizeTag(tag));
          expect(tag).not.toBe("");
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("冪等で、初出の並びを保つ", () => {
    fc.assert(
      fc.property(rawListArb, (raw) => {
        const tags = normalizeTagList(raw);
        expect(normalizeTagList(tags)).toEqual(tags);
        const firstSeen = [...new Set(raw.map(normalizeTag).filter(Boolean))];
        expect(tags).toEqual(firstSeen);
      }),
      { numRuns: RUNS }
    );
  });
});

describe("addTag / removeTag のプロパティ", () => {
  it("足すものが無いときだけ null (空文字か、既に付いているとき)", () => {
    // 呼び出し側はこれを見て保存リクエストを止める
    fc.assert(
      fc.property(tagListArb, inputArb, (tags, input) => {
        const tag = normalizeTag(input);
        expect(addTag(tags, input) === null).toBe(!tag || tags.includes(tag));
      }),
      { numRuns: RUNS }
    );
  });

  it("追加しても重複はできず、既存の順序は変わらない", () => {
    fc.assert(
      fc.property(tagListArb, inputArb, (tags, input) => {
        const next = addTag(tags, input) ?? tags;
        expect(new Set(next).size).toBe(next.length);
        expect(next.slice(0, tags.length)).toEqual(tags);
      }),
      { numRuns: RUNS }
    );
  });

  it("removeTag は冪等", () => {
    fc.assert(
      fc.property(tagListArb, inputArb, (tags, input) => {
        const tag = normalizeTag(input);
        const removed = removeTag(tags, tag);
        expect(removeTag(removed, tag)).toEqual(removed);
      }),
      { numRuns: RUNS }
    );
  });

  it("追加してから消すと元に戻る (undo)", () => {
    fc.assert(
      fc.property(tagListArb, inputArb, (tags, input) => {
        const added = addTag(tags, input);
        // 足すものが無かったときは undo する対象も無い
        if (added === null) return;
        expect(removeTag(added, normalizeTag(input))).toEqual(tags);
      }),
      { numRuns: RUNS }
    );
  });
});
