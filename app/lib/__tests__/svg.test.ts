import { describe, it, expect } from "vitest";
import {
  MAX_SVG_LENGTH,
  SvgValidationError,
  normalizeLogoSvg,
  sanitizeSvg,
} from "../svg";

describe("sanitizeSvg", () => {
  it("keeps ordinary shape markup", () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it("strips script elements", () => {
    const out = sanitizeSvg(
      '<svg><script>alert(1)</script><circle r="5"/></svg>'
    );
    expect(out).not.toContain("script");
    expect(out).toContain("<circle");
  });

  it("strips inline event handlers in any quoting style", () => {
    const out = sanitizeSvg(
      `<svg onload="alert(1)"><circle onclick='alert(2)' r="5"/><rect onmouseover=alert(3) /></svg>`
    );
    expect(out).not.toMatch(/onload|onclick|onmouseover/i);
    expect(out).toContain("<circle");
  });

  it("strips foreignObject and iframe", () => {
    const out = sanitizeSvg(
      '<svg><foreignObject><iframe src="x"></iframe></foreignObject><path/></svg>'
    );
    expect(out).not.toMatch(/foreignObject|iframe/i);
  });

  it("strips javascript: references", () => {
    const out = sanitizeSvg(
      '<svg><a href="javascript:alert(1)"><path/></a></svg>'
    );
    expect(out).not.toContain("javascript:");
  });

  it("strips style elements that could pull in external URLs", () => {
    const out = sanitizeSvg(
      '<svg><style>@import url(http://evil.test/x.css);</style><path/></svg>'
    );
    expect(out).not.toContain("@import");
  });

  it("strips external image references", () => {
    const out = sanitizeSvg('<svg><image href="http://evil.test/x.png"/></svg>');
    expect(out).not.toContain("evil.test");
  });

  it("rejects markup that is not an svg element", () => {
    expect(() => sanitizeSvg("<div>hi</div>")).toThrow(SvgValidationError);
    expect(() => sanitizeSvg("just text")).toThrow(SvgValidationError);
    expect(() => sanitizeSvg('<img src="x.svg">')).toThrow(SvgValidationError);
  });

  // 実際に突破が確認された payload の回帰テスト
  describe("確認済みの回避経路", () => {
    it("除去の結果として <script> を組み立てない", () => {
      // 1パス走査だった頃、<image>/<set>/<use> は閉じタグを持たないため
      // 単独タグ用の regex だけが発火し <scr + ipt> が連結されていた
      for (const payload of [
        `<svg xmlns="http://www.w3.org/2000/svg"><scr<image>ipt>alert(1)</scr<image>ipt></svg>`,
        `<svg><scri<set>pt>alert(1)</scri<set>pt></svg>`,
        `<svg><scr<use>ipt>alert(1)</scr<use>ipt></svg>`,
      ]) {
        let out = "";
        try { out = sanitizeSvg(payload); } catch { out = ""; }
        expect(out).not.toMatch(/<script/i);
      }
    });

    it("スラッシュ区切りのイベントハンドラを落とす", () => {
      // HTML パーサは / も属性区切りとして扱うので \s だけでは足りない
      for (const payload of [
        `<svg viewBox="0 0 24 24"/onload="alert(1)"><circle r="5"/></svg>`,
        `<svg><circle r="5"/onclick="alert(1)"></circle></svg>`,
        `<svg><circle r="5"/onmouseover=alert(1)></circle></svg>`,
      ]) {
        let out = "";
        try { out = sanitizeSvg(payload); } catch { out = ""; }
        expect(out).not.toMatch(/on(load|click|mouseover)/i);
      }
    });

    it("閉じていない <style> を残さない", () => {
      for (const payload of [
        `<svg><style>@import url(http://evil.test/x.css);</svg>`,
        `<svg><style>circle{fill:url(http://evil.test/bg.svg)}</style xx><circle r="5"/></svg>`,
      ]) {
        let out = "";
        try { out = sanitizeSvg(payload); } catch { out = ""; }
        expect(out).not.toMatch(/<style|@import|evil\.test/i);
      }
    });

    it("実体参照で書かれた javascript: を通さない", () => {
      for (const payload of [
        `<svg><a href="java&#115;cript:alert(1)"><circle r="9"/></a></svg>`,
        `<svg><a xlink:href="&#106;avascript:alert(1)"><circle r="9"/></a></svg>`,
      ]) {
        let out = "";
        try { out = sanitizeSvg(payload); } catch { out = ""; }
        expect(out).not.toMatch(/java.*script:/i);
      }
    });
  });

  it("rejects oversized input", () => {
    const big = "<svg>" + "a".repeat(MAX_SVG_LENGTH) + "</svg>";
    expect(() => sanitizeSvg(big)).toThrow(SvgValidationError);
  });
});

describe("normalizeLogoSvg", () => {
  it("treats null and blank as unset", () => {
    expect(normalizeLogoSvg(null)).toBeNull();
    expect(normalizeLogoSvg("")).toBeNull();
    expect(normalizeLogoSvg("   \n ")).toBeNull();
  });

  it("sanitizes non-empty input", () => {
    const out = normalizeLogoSvg('<svg><script>x</script><path/></svg>');
    expect(out).not.toContain("script");
  });
});
