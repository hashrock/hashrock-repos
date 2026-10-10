import type { Env } from 'hono'
import { showRoutes } from 'hono/dev'
import { createApp } from 'honox/server'
import { runScheduledJobs } from './lib/scheduled'

const app = createApp()

showRoutes(app)

/**
 * Cron (wrangler.jsonc の triggers.crons) から毎日 UTC 0 時に呼ばれる。
 * サインアップ数のスナップショットと GitHub リポジトリ同期を独立に走らせる。
 * ⚠ 同期は GitHub で消えたリポジトリを D1 からも消す (手で付けた star / hide / notes /
 * カバー画像 / logo ごと)。詳細は lib/scheduled.ts のコメント。
 */
async function scheduled(
  _controller: ScheduledController,
  env: Env['Bindings'],
  ctx: ExecutionContext
) {
  ctx.waitUntil(runScheduledJobs(env))
}

// @hono/vite-build は default export の fetch 以外のキー (scheduled) を Worker の export にそのまま載せる
export default { fetch: app.fetch, scheduled }
