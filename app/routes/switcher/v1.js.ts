import { createRoute } from "honox/factory";
import source from "../../switcher/v1.js?raw";

/**
 * 各サイトに配るサービス切り替え (<hashrock-switcher>)。
 *
 * app/switcher/v1.js を加工せずにそのまま返す。静的ファイルにしなかったのは、
 * ヘッダをここで持てば dev でも本番でも同じになり、テストもできるため。
 *
 * 別オリジンの <script type="module"> は CORS で取得されるので
 * access-control-allow-origin が無いと読み込めない。中身は v1 のまま差し替わる
 * (immutable にしない) ので、キャッシュは短めにしておく。
 */
export const SWITCHER_HEADERS = {
  "content-type": "text/javascript; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=300",
  "x-content-type-options": "nosniff",
} as const;

export const GET = createRoute((c) => c.body(source, 200, SWITCHER_HEADERS));
