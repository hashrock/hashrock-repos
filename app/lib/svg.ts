export const MAX_SVG_LENGTH = 64 * 1024;

export class SvgValidationError extends Error {}

/**
 * 貼り付けられた SVG をそのまま公開ページにインライン展開するため、
 * スクリプトを実行しうる要素・属性を落としてから保存する。
 * 編集できるのは CF Access を通ったオーナーだけだが、よそから拾ってきた
 * SVG を貼る操作が事故になりうるのでサーバ側で必ず通す。
 */
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

  let svg = trimmed;

  // スクリプトを持ち込める要素ごと落とす
  svg = svg.replace(
    /<(script|foreignObject|iframe|use|image|animate|set)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  svg = svg.replace(
    /<(script|foreignObject|iframe|use|image|animate|set)\b[^>]*\/?>/gi,
    ""
  );

  // インラインイベントハンドラ
  svg = svg.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // javascript: / data: を指す参照
  svg = svg.replace(
    /\s(?:xlink:)?href\s*=\s*(["'])\s*(?:javascript|data):[^"']*\1/gi,
    ""
  );

  // <style> は CSS の url() 経由で外部を引けるので落とす
  svg = svg.replace(/<style\b[\s\S]*?<\/style\s*>/gi, "");

  const result = svg.trim();
  if (!/^<svg[\s>]/i.test(result) || !/<\/svg>$/i.test(result)) {
    throw new SvgValidationError("Nothing left after sanitizing");
  }

  return result;
}

/** 空文字・空白のみは「未設定」として null にする */
export function normalizeLogoSvg(input: string | null): string | null {
  if (input === null || input.trim() === "") {
    return null;
  }
  return sanitizeSvg(input);
}
