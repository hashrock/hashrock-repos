import type {} from 'hono'

declare module 'hono' {
  interface Env {
    Variables: {}
    Bindings: {
      DB: D1Database
      IMAGES: R2Bucket
      GITHUB_TOKEN: string
    }
  }
}
