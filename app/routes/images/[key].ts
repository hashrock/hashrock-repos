import { createRoute } from "honox/factory";
import { getPubliclyVisibleRepoByCoverImageKey } from "../../lib/db";

/**
 * R2 のカバー画像の公開配信。star したカードは公開トップに出るため
 * CF Access の外に置いている。
 *
 * R2 を直接引くだけにすると、hide を立てても star を外しても URL を知って
 * いる相手には取り続けられてしまう (公開の取り消しが効かない)。配信前に
 * DB を引き、いま公開されているリポジトリの画像だけを返す。
 */
export const GET = createRoute(async (c) => {
  const key = c.req.param("key");
  if (!key) {
    return c.notFound();
  }

  const repo = await getPubliclyVisibleRepoByCoverImageKey(c.env.DB, key);
  if (!repo) {
    return c.notFound();
  }

  const object = await c.env.IMAGES.get(key);
  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // 公開を取り消せる必要があるので immutable にはしない
  headers.set("cache-control", "public, max-age=300");
  // アップロード物がこのオリジンでスクリプトとして動かないようにする
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
});
