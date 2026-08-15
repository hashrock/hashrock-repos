import { createRoute } from "honox/factory";

/**
 * R2 の画像配信。star したカードは公開トップに出るため、このパスは
 * CF Access の外側に置いている。キーは UUID なので推測はできない。
 */
export const GET = createRoute(async (c) => {
  const key = c.req.param("key");
  if (!key) {
    return c.notFound();
  }

  const object = await c.env.IMAGES.get(key);
  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // アップロード物がこのオリジンでスクリプトとして動かないようにする
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
});
