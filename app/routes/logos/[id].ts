import { createRoute } from "honox/factory";
import { getPubliclyVisibleRepoById } from "../../lib/db";
import { toStandaloneSvg } from "../../lib/svg";

/**
 * ロゴ SVG の配信。
 *
 * 以前は貼り付けられた SVG を正規表現で消毒してページに直接インライン展開
 * していたが、文字列処理でマークアップを安全にするのは無理だった (置換の
 * 結果として <script> が組み上がる経路まであった)。
 *
 * ここでは独立したドキュメントとして返し、ページ側は <img> で参照する。
 * <img> 経由の SVG はスクリプトも外部参照も実行されないため、中身が何で
 * あろうとページのオリジンでは何も起きない。CSP と nosniff はその上での
 * 保険。安全性は文字列フィルタではなくこの境界で担保している。
 */
export const GET = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.notFound();
  }

  // カバー画像と同じく、いま公開されているリポジトリの分だけ返す
  const repo = await getPubliclyVisibleRepoById(c.env.DB, id);
  if (!repo?.logoSvg) {
    return c.notFound();
  }

  return new Response(toStandaloneSvg(repo.logoSvg), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
});
