import { createRoute } from "honox/factory";
import { listRepos } from "../../lib/db";
import { sortByUpdatedDesc, toPublicRepo } from "../../lib/public-api";

/**
 * star したリポジトリの公開 JSON API。外部の CMS から読む用なので
 * CF Access の外 (/admin 配下ではない) に置いている。
 *
 * listRepos の既定で hide と archived は除外される。star は「公開して
 * よい」の意思表示なので private も含めるが、出す項目は公開トップページ
 * と揃えてある (toPublicRepo を参照)。
 */
export const GET = createRoute(async (c) => {
  const repos = await listRepos(c.env.DB, {
    includePrivate: true,
    starredOnly: true,
  });

  // Cloudflare の内側では http で来ることがある。画像を絶対 URL で返す API
  // なので、CMS 側で mixed content にならないよう scheme を立て直す
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  const origin = `${proto}://${url.host}`;
  const items = sortByUpdatedDesc(repos.map((r) => toPublicRepo(r, origin)));

  return c.json(
    { count: items.length, repos: items },
    200,
    {
      // 誰でも読める前提の API なので、ブラウザから直接叩けるようにする
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=60",
    }
  );
});
