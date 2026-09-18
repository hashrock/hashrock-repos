import build from '@hono/vite-build/cloudflare-workers'
import adapter from '@hono/vite-dev-server/cloudflare'
import tailwindcss from '@tailwindcss/vite'
import honox, { devServerDefaultOptions } from 'honox/vite'
import { defineConfig } from 'vite'

// dev サーバは既定で *.js を Vite に回すが、/switcher/v1.js は Hono のルートで
// 配っている (app/routes/switcher/v1.js.ts)。それだけ Hono に通す
const devServerExclude = devServerDefaultOptions.exclude.map((pattern) =>
  pattern instanceof RegExp && pattern.source === '.*\\.js$' ? /^(?!\/switcher\/).*\.js$/ : pattern
)

export default defineConfig({
  plugins: [
    honox({
      devServer: { adapter, exclude: devServerExclude },
      client: { input: ['/app/client.ts', '/app/style.css'] }
    }),
    tailwindcss(),
    build()
  ]
})
