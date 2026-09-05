/**
 * タグ文字列の正規化。DB にも GitHub の topics にも小文字で入る前提なので、
 * 入力を受ける場所ごとに trim/toLowerCase を書かずここに寄せる。
 */
export function normalizeTag(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * 正規化して、空文字と重複を落とす。初出の並びは保つ。
 * 外から来たタグ列は必ずこれを通してから DB と GitHub に渡すこと。
 */
export function normalizeTagList(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/** 一括入力用。カンマ区切りを正規化済みのタグ列にする */
export function parseTagList(input: string): string[] {
  return normalizeTagList(input.split(","));
}

/**
 * 追加した結果のタグ列。足すものが無い (空文字、または既に付いている) ときは
 * null。呼び出し側はこれを見て保存リクエストを送らずに済ませる。
 */
export function addTag(tags: string[], input: string): string[] | null {
  const tag = normalizeTag(input);
  if (!tag || tags.includes(tag)) {
    return null;
  }
  return [...tags, tag];
}

/** 取り除いた結果のタグ列。持っていないタグを渡しても副作用はない */
export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}
