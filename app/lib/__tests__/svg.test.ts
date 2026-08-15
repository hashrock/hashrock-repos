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
