import type {} from 'hono'

declare module 'hono' {
  interface Env {
    Variables: {}
    Bindings: {
      DB: D1Database
      IMAGES: R2Bucket
      GITHUB_TOKEN: string
      /** サインアップ数を取りに行くサービス。JSON 文字列 [{"name":"grid24","url":"https://..."}] */
      STATS_SOURCES?: string
      /** 各サービスの GET /api/stats に付ける Bearer トークン (secret) */
      STATS_TOKEN?: string
      /** "1" のとき UI テスト用シナリオの DB 種まき (/__scenarios の admin-*) を許可する */
      SCENARIOS_ENABLED?: string
    }
  }
}
