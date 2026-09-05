export const MAX_SVG_LENGTH = 64 * 1024;

export class SvgValidationError extends Error {}

/**
 * 貼り付けられた SVG の検証と、念のためのクリーニング。
 *
 * 重要: **安全性の境界はここではない。** ロゴは公開ページにインライン展開
 * せず、/logos/:id が独立したドキュメントとして返し、ページ側は <img> で
 * 参照する。<img> 経由の SVG はスクリプトも外部参照も実行されないため、
 * 中身が何であってもページのオリジンでは何も起きない。
 *
 * ここでの除去はあくまで多層防御。文字列処理でマークアップを安全にする
 * ことはできない (以前この関数は 1 パス走査だったため、`<scr<image>ipt>`
 * のように禁止タグを挟むと除去の結果として <script> が組み上がっていた)。
 * 同じ轍を踏まないよう、除去は変化しなくなるまで繰り返す。
 */

/** 落とす要素。プロパティテストからも参照するので配列で持つ */
export const FORBIDDEN_ELEMENTS = [
  "script",
  "foreignObject",
  "iframe",
  "use",
  "image",
  "animate",
  "animateTransform",
  "animateMotion",
  "set",
  "style",
  "handler",
] as const;

const ELEMENTS = FORBIDDEN_ELEMENTS.join("|");

/**
 * イベントハンドラ属性の「区切り + 名前 + =」。
 *
 * 除去側と最後のガードで **同じもの** を見るために一箇所にまとめる。
 * 以前ここが食い違っており、除去側は `/` も区切りとして扱うのにガードは
 * `\s` しか見ていなかったため、値が空の `/onload=` が最後の網を素通り
 * していた。組み立てを共有していれば構造的に食い違わない。
 */
const ON_ATTR = String.raw`[\s/]on[a-z]+\s*=`;

/** 閉じタグまで一組で落とす */
const PAIRED_ELEMENT = new RegExp(`<(${ELEMENTS})\\b[\\s\\S]*?</\\1\\s*>`, "gi");
/** 閉じタグが無いものは以降を末尾まで捨てる */
const UNCLOSED_ELEMENT = new RegExp(`<(${ELEMENTS})\\b[^>]*>[\\s\\S]*$`, "gi");
/** 単独タグ */
const VOID_ELEMENT = new RegExp(`<(${ELEMENTS})\\b[^>]*/?>`, "gi");

const ON_ATTR_DQUOTED = new RegExp(`${ON_ATTR}\\s*"[^"]*"`, "gi");
const ON_ATTR_SQUOTED = new RegExp(`${ON_ATTR}\\s*'[^']*'`, "gi");
// 値は空でもよい。`[^\s>]+` だと `<circle/onload=>` や、上の切り詰めで
// 末尾ごと消えた `/onload=` が残る。`<` を値に含めないのは、閉じタグを
// 属性値として飲み込んで別のマークアップを組み立てないため
const ON_ATTR_BARE = new RegExp(`${ON_ATTR}\\s*[^\\s<>]*`, "gi");

/** 最後の網。除去しきれていなければ受け取らない */
const UNSAFE_RESIDUE = new RegExp(`<script\\b|${ON_ATTR}|javascript:`, "i");

/** &#106; や &#x6a; を実際の文字に戻す。javascript: の判定を素通りさせないため */
function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripOnce(svg: string): string {
  // 危険な要素は閉じタグの有無にかかわらず落とす。
  // 閉じていない <style> が残ると @import で外部を引けてしまうため、
  // 閉じタグが無い場合は以降を末尾まで捨てる。
  let out = svg;
  out = out.replace(PAIRED_ELEMENT, "");
  out = out.replace(UNCLOSED_ELEMENT, "");
  out = out.replace(VOID_ELEMENT, "");

  // イベントハンドラ。HTML パーサは `/` も属性区切りとして扱うので
  // 区切りを [\s/] にする。空白しか見ていないと `<circle/onload=...>` が通る。
  out = out.replace(ON_ATTR_DQUOTED, " ");
  out = out.replace(ON_ATTR_SQUOTED, " ");
  out = out.replace(ON_ATTR_BARE, " ");

  return out;
}

/** 属性値の実体参照を解いた上で危険なスキームを判定する */
function stripDangerousRefs(svg: string): string {
  return svg.replace(
    /(\s(?:xlink:)?href\s*=\s*)(["'])([^"']*)\2/gi,
    (whole, prefix, quote, value) => {
      const decoded = decodeEntities(value).trim().toLowerCase();
      // 相対参照・フラグメント・http(s) だけ通す
      if (/^(?:https?:|#|\/|[\w.-]+(?:[/?#]|$))/.test(decoded)) {
        return whole;
      }
      return `${prefix}${quote}#${quote}`;
    }
  );
}

export function sanitizeSvg(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length > MAX_SVG_LENGTH) {
    throw new SvgValidationError(
      `SVG too large: ${trimmed.length} chars (max ${MAX_SVG_LENGTH})`
    );
  }
  if (!/^<svg[\s>]/i.test(trimmed)) {
    throw new SvgValidationError("Must start with an <svg> element");
  }
  if (!/<\/svg>$/i.test(trimmed)) {
    throw new SvgValidationError("Must end with </svg>");
  }

  // 除去の結果として新たな危険タグが現れないよう、変化しなくなるまで回す
  let svg = trimmed;
  for (let i = 0; i < 20; i++) {
    const next = stripDangerousRefs(stripOnce(svg));
    if (next === svg) break;
    svg = next;
  }

  // 途中で切り落とした場合に閉じタグが失われるので付け直す
  let result = svg.trim();
  if (!/<\/svg>$/i.test(result)) {
    result = `${result}</svg>`;
  }

  if (!/^<svg[\s>]/i.test(result)) {
    throw new SvgValidationError("Nothing left after sanitizing");
  }
  if (UNSAFE_RESIDUE.test(decodeEntities(result))) {
    throw new SvgValidationError("Unsafe markup could not be removed");
  }

  return result;
}

/**
 * <img> で読める独立したドキュメントにする。
 *
 * インライン展開なら名前空間は HTML パーサが補うが、単体のドキュメントと
 * して読ませる場合 xmlns が無いと XML として不正になり描画されない。
 * 貼り付けられる SVG には付いていないことがあるので補う。
 */
export function toStandaloneSvg(svg: string): string {
  if (/^<svg[^>]*\sxmlns\s*=/i.test(svg)) {
    return svg;
  }
  return svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** 空文字・空白のみは「未設定」として null にする */
export function normalizeLogoSvg(input: string | null): string | null {
  if (input === null || input.trim() === "") {
    return null;
  }
  return sanitizeSvg(input);
}
