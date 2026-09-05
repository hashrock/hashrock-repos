import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  FORBIDDEN_ELEMENTS,
  MAX_SVG_LENGTH,
  SvgValidationError,
  normalizeLogoSvg,
  sanitizeSvg,
} from "../svg";
import { ALL_KNOWN_BYPASS_PAYLOADS } from "./svg-payloads";

/**
 * sanitizeSvg の property-based test。
 *
 * svg.ts のコメントにある通り、文字列処理でマークアップを安全にすることは
 * できない。ここでの狙いは「安全性を証明する」ことではなく、例示テストが
 * 追いつけない組み合わせを自動で探索し、実装が自分で名乗っている不変条件
 * (冪等・不動点・最後のガード) を破る入力を見つけることにある。
 *
 * 生成器は fc.string() ではなく **断片の合成** で作る。ランダムな文字列は
 * ほぼ全て `<svg` で始まらず入口の検証で弾かれ、何も探索できないため。
 */

/** 危険な断片。禁止要素・イベントハンドラ・スキーム・実体参照・タグの部品 */
const hostileChunk = fc.oneof(
  fc
    .constantFrom(...FORBIDDEN_ELEMENTS)
    .chain((t) =>
      fc.constantFrom(`<${t}>`, `</${t}>`, `<${t}/>`, `<${t} x="1">`)
    ),
  fc.constantFrom(
    // 除去の結果としてタグが組み上がる経路を踏むための部品
    "<", ">", "/", "\"", "'", "=", " ",
    "scr", "ipt", "onload", "onerror",
    "<script", "</script", "<style", "</style",
    // イベントハンドラ (空白区切り / スラッシュ区切り / 値なし)
    " onload=\"alert(1)\"", " onclick='alert(1)'", " onerror=alert(1)",
    "/onload=alert(1)", "/onload=", " onload=",
    // 危険なスキームと、それを隠すための実体参照
    "javascript:", "java&#115;cript:", "&#106;avascript:", "&#x6a;avascript:",
    "href=", "xlink:href=", "href=\"javascript:alert(1)\"",
    // 外部参照
    "@import", "url(", "http://evil.test/x",
    // 無害なマークアップ
    "<circle r=\"5\"/>", "<path d=\"M0 0h24\"/>", "<rect/>", "<g>", "</g>", "<a>", "</a>"
  ),
  fc.string({ maxLength: 4 })
);

/**
 * 敵対的な SVG ドキュメント。入口の検証は通る形に整えておく。
 *
 * 断片の合成に加えて、過去に突破が確認された payload そのものも種にする。
 * 例示テストはその 1 件が直ったかしか見ないが、ここに混ぜれば同じ入力が
 * 冪等・閉じタグ・実体参照といった全プロパティの検査を受ける。
 */
const hostileSvg = fc.oneof(
  fc
    .array(hostileChunk, { maxLength: 24 })
    .map((parts) => `<svg>${parts.join("")}</svg>`),
  fc.constantFrom(...ALL_KNOWN_BYPASS_PAYLOADS)
);

/** 無害な SVG。サニタイズが正常なロゴを壊さないことを見るために使う */
const benignSvg = fc
  .array(
    fc.constantFrom(
      '<path d="M0 0h24v24H0z"/>',
      '<circle cx="12" cy="12" r="5"/>',
      '<rect x="1" y="1" width="4" height="4"/>',
      '<g fill="none"><path d="M1 1L2 2"/></g>',
      '<a href="https://example.test"><circle r="3"/></a>',
      '<a href="#frag"><rect/></a>',
      "<title>logo</title>",
      '<defs><linearGradient id="g"/></defs>'
    ),
    { maxLength: 8 }
  )
  .map((parts) => `<svg viewBox="0 0 24 24">${parts.join("")}</svg>`);

/**
 * 断片の語彙が小さく組み合わせが早期に飽和するので、2000 回で十分。
 * 実際にこのファイルが見つけた 2 件はいずれも 300 回以内に出ている。
 */
const RUNS = 2000;

/** SvgValidationError なら null。それ以外の例外は実装のバグなので伝播させる */
function trySanitize(input: string): string | null {
  try {
    return sanitizeSvg(input);
  } catch (e) {
    if (e instanceof SvgValidationError) return null;
    throw e;
  }
}

/**
 * svg.ts の decodeEntities と同じ処理を **あえて** 持つ。
 *
 * 出力を「ブラウザが読む形」に戻してから検査するための独立した物差しで、
 * 実装側の関数を import してしまうと実装を実装自身で検算することになり、
 * 実体参照の扱いを間違えたときに気付けない。
 */
function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * 敵対的な入力を通し、弾かれなかった出力についてだけ assertion をかける。
 * 5 つのプロパティが共有する「サニタイズ → 弾かれたら飛ばす → 検査」の骨格。
 */
function forEachSanitized(assertion: (output: string) => void): void {
  fc.assert(
    fc.property(hostileSvg, (input) => {
      const output = trySanitize(input);
      if (output === null) return;
      assertion(output);
    }),
    { numRuns: RUNS }
  );
}

const FORBIDDEN_ELEMENT_RE = new RegExp(
  `<(${FORBIDDEN_ELEMENTS.join("|")})\\b`,
  "i"
);

describe("sanitizeSvg のプロパティ", () => {
  it("成功した出力を再度通しても変わらない (冪等)", () => {
    // 実装は除去を最大 20 回まで繰り返す。返ってきた文字列が不動点に達して
    // いなければ、打ち切りの向こう側に未除去の危険が残っているということ
    forEachSanitized((output) => {
      expect(trySanitize(output)).toBe(output);
    });
  });

  it("出力に禁止要素が残らない", () => {
    forEachSanitized((output) => {
      expect(decodeEntities(output)).not.toMatch(FORBIDDEN_ELEMENT_RE);
    });
  });

  it("出力にイベントハンドラが残らない (HTML パーサ同様 / も区切りとして数える)", () => {
    forEachSanitized((output) => {
      expect(decodeEntities(output)).not.toMatch(/[\s/]on[a-z]+\s*=/i);
    });
  });

  it("出力に javascript: スキームが残らない (実体参照を解いた後で判定)", () => {
    forEachSanitized((output) => {
      expect(decodeEntities(output)).not.toMatch(/javascript:/i);
    });
  });

  it("成功した出力は必ず <svg> 要素として閉じている", () => {
    // 途中で末尾まで切り落とす分岐があるため、閉じタグの復元が効いているか
    forEachSanitized((output) => {
      expect(output).toMatch(/^<svg[\s>]/i);
      expect(output).toMatch(/<\/svg>$/i);
    });
  });

  it("無害なマークアップは書き換えない", () => {
    fc.assert(
      fc.property(benignSvg, (input) => {
        expect(sanitizeSvg(input)).toBe(input);
      }),
      { numRuns: RUNS }
    );
  });

  it("上限を超える入力は必ず SvgValidationError で弾く", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4096 }), (over) => {
        const body = "a".repeat(MAX_SVG_LENGTH + over);
        expect(() => sanitizeSvg(`<svg>${body}</svg>`)).toThrow(
          SvgValidationError
        );
      }),
      { numRuns: 200 }
    );
  });
});

describe("normalizeLogoSvg のプロパティ", () => {
  it("空白のみの入力は必ず null になる", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(" ", "\t", "\n", "\r"), maxLength: 16 }),
        (blank) => {
          expect(normalizeLogoSvg(blank)).toBeNull();
        }
      ),
      { numRuns: RUNS }
    );
  });

  it("空白のみでない入力は sanitizeSvg と一致する", () => {
    fc.assert(
      fc.property(hostileSvg, (input) => {
        const expected = trySanitize(input);
        if (expected === null) {
          expect(() => normalizeLogoSvg(input)).toThrow(SvgValidationError);
          return;
        }
        expect(normalizeLogoSvg(input)).toBe(expected);
      }),
      { numRuns: RUNS }
    );
  });
});
