# サインアップ数モニタリング (/admin/stats)

各サービスが持つ `GET /api/stats` (Bearer 認証) を並列に叩き、サインアップ数を 1 か所で見る。
他サービスの D1 は bind しない。

| 項目 | 場所 |
|---|---|
| 取得先 | `wrangler.jsonc` の `vars.STATS_SOURCES` (JSON 文字列 `[{"name":"grid24","url":"https://grid.hashrock.info"}, …]`)。`url: null` は未記入で、取得せず「URL 未設定」と出す |
| トークン | secret の `STATS_TOKEN` (`wrangler secret put STATS_TOKEN`)。ローカルは `.dev.vars` |
| 収集 | `app/lib/signupStats.ts`。各 5 秒でタイムアウト、失敗はエラー文字列付きで残す |
| 記録 | `signup_snapshots` (date, service が主キー)。毎日 UTC 0 時の Cron と `POST /admin/api/stats/refresh` が upsert する。取得に失敗したサービスは書かない (同じ日の成功した値を残す) |
| 画面 | `/admin/stats`。上の表は開くたびに取り直した値 (記録しない)、下の折れ線は直近 30 日の記録 |

ローカルで Cron を試すとき: `npm run build && npx wrangler dev --test-scheduled` のあと
`curl "http://localhost:8787/__scheduled?cron=0+0+*+*+*"`。
