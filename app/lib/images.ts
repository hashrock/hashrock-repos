import { getRepoById, setRepoCoverImageKey } from "./db";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * 拡張子は content-type から決める。ユーザー入力のファイル名は使わない。
 * SVG はスクリプトを埋め込めて同一オリジンで実行されるため許可しない。
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class ImageValidationError extends Error {}

export function extensionFor(contentType: string): string {
  const ext = EXTENSION_BY_TYPE[contentType];
  if (!ext) {
    throw new ImageValidationError(
      `Unsupported image type: ${contentType || "(none)"}`
    );
  }
  return ext;
}

export async function putCoverImage(
  d1: D1Database,
  bucket: R2Bucket,
  repoId: number,
  file: File
): Promise<{ coverImageKey: string }> {
  if (file.size === 0) {
    throw new ImageValidationError("Empty file");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `File too large: ${file.size} bytes (max ${MAX_IMAGE_BYTES})`
    );
  }

  const ext = extensionFor(file.type);

  const repo = await getRepoById(d1, repoId);
  if (!repo) {
    throw new ImageValidationError(`Repo not found: ${repoId}`);
  }

  // キーは推測できない値にする。/images/{key} は未認証でも配信されるため
  const key = `${crypto.randomUUID()}.${ext}`;

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await setRepoCoverImageKey(d1, repoId, key);

  // 古い画像は DB を更新できてから消す
  if (repo.coverImageKey) {
    await bucket.delete(repo.coverImageKey);
  }

  return { coverImageKey: key };
}

export async function deleteCoverImage(
  d1: D1Database,
  bucket: R2Bucket,
  repoId: number
): Promise<void> {
  const repo = await getRepoById(d1, repoId);
  if (!repo?.coverImageKey) {
    return;
  }

  await setRepoCoverImageKey(d1, repoId, null);
  await bucket.delete(repo.coverImageKey);
}
