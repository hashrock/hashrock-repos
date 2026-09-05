/**
 * タグ文字列の正規化。DB にもトピックにも小文字で入る前提なので、
 * 入力を受ける場所ごとに trim/toLowerCase を書かずここに寄せる。
 */
export function normalizeTag(input: string): string {
  return input.trim().toLowerCase();
}

/** 一括入力用。カンマ区切りを正規化済みのタグ列にする。空要素は落とす */
export function parseTagList(input: string): string[] {
  return input.split(",").map(normalizeTag).filter(Boolean);
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
