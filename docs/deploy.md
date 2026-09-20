# デプロイ

main に push すると Cloudflare 側の Git 連携 (Workers Builds) が自動でデプロイする。
設定は Cloudflare ダッシュボードにあり、このリポジトリには入っていない
(Workers & Pages → hashrock-repos → Settings → Build)。

GitHub Actions (`.github/workflows/test.yml`) は `npm test` を回すだけで、デプロイはしない。

| やりたいこと | すること |
|---|---|
| 本番へ出す | main に push する。20〜30 秒ほどで新しいバージョンが出る |
| 出たか確かめる | `npx wrangler deployments list` の一番下が push の直後の時刻になっている |
| 手で出す | `npm run deploy` (`vite build` してから `wrangler deploy`)。連携が止まっているときの逃げ道 |
| secret を足す | `npx wrangler secret put <NAME>`。ダッシュボード側に入るので、連携デプロイでも手動デプロイでも同じものを見る |

公開先は `wrangler.jsonc` の `routes` (`repos.hashrock.info/*`)。DNS レコードと証明書は
ダッシュボードで作る (wrangler は触らない)。
