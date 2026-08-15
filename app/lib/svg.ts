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

const FORBIDDEN_ELEMENTS =
  "script|foreignObject|iframe|use|image|animate|animateTransform|animateMotion|set|style|handler";

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
  out = out.replace(
    new RegExp(`<(${FORBIDDEN_ELEMENTS})\\b[\\s\\S]*?</\\1\\s*>`, "gi"),
    ""
  );
  out = out.replace(
    new RegExp(`<(${FORBIDDEN_ELEMENTS})\\b[^>]*>[\\s\\S]*$`, "gi"),
    ""
  );
  out = out.replace(new RegExp(`<(${FORBIDDEN_ELEMENTS})\\b[^>]*/?>`, "gi"), "");

  // イベントハンドラ。HTML パーサは `/` も属性区切りとして扱うので
  // 区切りを [\s/] にする。空白しか見ていないと `<circle/onload=...>` が通る。
  out = out.replace(/[\s/]on[a-z]+\s*=\s*"[^"]*"/gi, " ");
  out = out.replace(/[\s/]on[a-z]+\s*=\s*'[^']*'/gi, " ");
  out = out.replace(/[\s/]on[a-z]+\s*=\s*[^\s>]+/gi, " ");

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
  if (/<script\b|\son[a-z]+\s*=|javascript:/i.test(decodeEntities(result))) {
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
