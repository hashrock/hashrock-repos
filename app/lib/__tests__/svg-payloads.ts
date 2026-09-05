/**
 * 実際に sanitizeSvg の突破が確認された payload。
 *
 * 例示テスト (svg.test.ts) は「その回帰が直っているか」を、プロパティテスト
 * (svg.property.test.ts) は「この形から始めても不変条件が破れないか」を、
 * それぞれ同じ入力に対して見る。片方に足した反例がもう片方から漏れないよう、
 * 一覧はここに 1 つだけ置く。
 */
export const KNOWN_BYPASS_PAYLOADS = {
  /** 1 パス走査だった頃、閉じタグを持たない要素の除去で <scr + ipt> が連結された */
  assembledScript: [
    `<svg xmlns="http://www.w3.org/2000/svg"><scr<image>ipt>alert(1)</scr<image>ipt></svg>`,
    `<svg><scri<set>pt>alert(1)</scri<set>pt></svg>`,
    `<svg><scr<use>ipt>alert(1)</scr<use>ipt></svg>`,
  ],
  /** HTML パーサは / も属性区切りとして扱うので \s だけでは足りない */
  slashSeparatedHandler: [
    `<svg viewBox="0 0 24 24"/onload="alert(1)"><circle r="5"/></svg>`,
    `<svg><circle r="5"/onclick="alert(1)"></circle></svg>`,
    `<svg><circle r="5"/onmouseover=alert(1)></circle></svg>`,
  ],
  /** 閉じていない <style> が末尾まで残る経路 */
  unclosedStyle: [
    `<svg><style>@import url(http://evil.test/x.css);</svg>`,
    `<svg><style>circle{fill:url(http://evil.test/bg.svg)}</style xx><circle r="5"/></svg>`,
  ],
  /** 実体参照で隠した javascript: */
  encodedScheme: [
    `<svg><a href="java&#115;cript:alert(1)"><circle r="9"/></a></svg>`,
    `<svg><a xlink:href="&#106;avascript:alert(1)"><circle r="9"/></a></svg>`,
  ],
  /** 値が空のイベントハンドラ。除去の結果として現れる */
  emptyValueHandler: [
    `<svg>/onload=<script></svg>`,
    `<svg>/onload=<animateMotion></svg>`,
  ],
} as const;

export const ALL_KNOWN_BYPASS_PAYLOADS: string[] = Object.values(
  KNOWN_BYPASS_PAYLOADS
).flat();
