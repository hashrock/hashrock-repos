import type { Env } from 'hono'
import { showRoutes } from 'hono/dev'
import { createApp } from 'honox/server'
import { takeSignupSnapshot } from './lib/signupStats'

const app = createApp()

showRoutes(app)

/** Cron (wrangler.jsonc の triggers.crons) から毎日 UTC 0 時に呼ばれる */
async function scheduled(
  _controller: ScheduledController,
  env: Env['Bindings'],
  ctx: ExecutionContext
) {
  ctx.waitUntil(
    takeSignupSnapshot(env).then(({ date, saved, results }) => {
      const failed = results.filter((r) => r.error !== null)
      console.log(
        `signup snapshot ${date}: saved ${saved}, failed ${failed.length}`,
        failed.map((r) => `${r.service}: ${r.error}`)
      )
    })
  )
}

// @hono/vite-build は default export の fetch 以外のキー (scheduled) を Worker の export にそのまま載せる
export default { fetch: app.fetch, scheduled }
