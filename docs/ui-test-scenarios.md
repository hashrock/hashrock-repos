# UI テスト用シナリオ route

Chrome MCP などのブラウザ自動操作で UI を確認するとき、URL を 1 つ開くだけで
所定の初期状態の画面へ移動する。

| URL | 動き |
|---|---|
| `GET /__scenarios` | シナリオ一覧 (名前・説明・リンク) |
| `GET /__scenarios/:name` | 状態を用意して対象画面へ 303 リダイレクト |
| `GET /__scenarios/:name?format=json` (または `Accept: application/json`) | リダイレクトせず、URL・props (または作った ID)・ログイン状態を JSON で返す |
| `GET /__scenarios/:name/page` | props 直描画のページ (303 の行き先) |
| `DELETE /__scenarios/scopes/:scope` | DB に撒いた行の片付け |

## シナリオ一覧

| name | 種類 | 行き先 | 内容 |
|---|---|---|---|
| `empty` | props 直描画 | `/__scenarios/empty/page` | リポジトリ 0 件。カード欄なし、5 列とも「まだありません」 |
| `typical` | props 直描画 | `/__scenarios/typical/page` | 8 件。カード 2 枚 (メモ・ロゴ付き)、各列 1〜2 件、private 1 件 |
| `large` | props 直描画 | `/__scenarios/large/page` | 60 件。カード 12 枚、各列 12 件。長い名前・長文の説明とメモ・10 個のタグ・5 桁の star 数 |
| `visibility` | props 直描画 | `/__scenarios/visibility/page` | 公開トップに出る/出ないの境界 9 件。`shown-*` の 5 件だけ出て `hidden-*` の 4 件は出ない |
| `admin-list` | DB に撒く | `/__scenarios/admin-list/page?scope=…` | 管理一覧 (RepoList) 8 件。archived・hidden・タグ無し・private を含み、撒いた分だけを見せる |
| `admin-edit` | DB に撒く | `/admin/repos/:id` | 全項目が埋まった 1 件の編集ページ |

### 2 種類のシナリオ

- **props 直描画** (`empty` / `typical` / `large` / `visibility`): DB を触らない。
  公開トップページのコンポーネント `TopPage` に、種から作った props を渡して描く。
  本番でも安全なので常に有効。JSON の `props` に描画に使った props がそのまま入る。
- **DB に撒く** (`admin-*`): 一覧の島 (RepoList) や編集の島は行の id で API を叩くので、
  本物の行が要る。架空の owner `scenario-<name>-<6 文字乱数>` (scope) 配下に行を足して
  から移動する。認証なしの GET で DB に書く口なので、**`SCENARIOS_ENABLED=1`
  (wrangler の vars か `.dev.vars`) か vite の dev サーバのときだけ有効**。本番では
  403 を返し、一覧ページにも「無効」と出る。

`admin-*` は `/admin` 配下 (か管理画面の島) へ移動するので、本番で有効にした場合は
Cloudflare Access のログインが要る (このアプリには認証バイパスの仕組みが無い)。
ローカル開発では保護が無いのでそのまま開ける。

## Chrome MCP からの使い方

1. `GET /__scenarios/typical?format=json` を叩く。

   ```json
   {
     "name": "typical",
     "kind": "props",
     "url": "/__scenarios/typical/page",
     "absoluteUrl": "http://localhost:5173/__scenarios/typical/page",
     "props": { "starred": [ … ], "columns": [ … ], "signedIn": false },
     "auth": { "mechanism": "cloudflare-access", "bypass": false, "signedIn": false }
   }
   ```

   DB に撒くシナリオはこうなる:

   ```json
   {
     "name": "admin-list",
     "kind": "db",
     "scope": "scenario-admin-list-k3j9x2",
     "prefix": "scenario-admin-list-k3j9x2/",
     "url": "/__scenarios/admin-list/page?scope=scenario-admin-list-k3j9x2",
     "repos": [{ "id": 12, "name": "alpha", "fullName": "scenario-admin-list-k3j9x2/alpha", "adminUrl": "/admin/repos/12" }],
     "cleanupUrl": "/__scenarios/scopes/scenario-admin-list-k3j9x2",
     "auth": { … }
   }
   ```

2. `absoluteUrl` をブラウザで開く。個別ページを見たいときは `repos[].adminUrl`。
3. 単に画面を開くだけなら `format=json` を付けずに `/__scenarios/typical` を開けばよい
   (303 で行き先へ移動する)。
4. DB に撒いた行は `curl -X DELETE <cleanupUrl>` で消す。

`curl` での確認例:

```sh
curl -i http://localhost:5173/__scenarios/typical                 # 303 + Location
curl -s http://localhost:5173/__scenarios/typical?format=json | jq .props.columns[].name
curl -s http://localhost:5173/__scenarios/admin-list?format=json | jq .cleanupUrl
curl -X DELETE http://localhost:5173/__scenarios/scopes/scenario-admin-list-k3j9x2
```

## 安全性

- props 直描画のシナリオは何も書かない。
- DB に撒くシナリオは `scenario-<name>-<rand>/` 配下に **足すだけ**。既存の行は消さないし
  書き換えない。本番では `SCENARIOS_ENABLED` を立てない限り閉じている。
- 片付けは scope を指定した削除。scope の形 (`scenario-<name>-<6 文字>`) をしたものしか
  受け付けないので、他の行に届かない。消し忘れても `github_id` が負なので実在リポジトリと
  突き合わされず、次の GitHub 同期が「GitHub に無い行」として消す。
- 本番の route (`/`, `/admin/repos`) とドメイン層 (`listRepos`) はシナリオを知らない。
  撒いた分だけを見せる一覧は `/__scenarios/admin-list/page` 側で絞る。
- ロゴ SVG は本番の保存経路と同じ `normalizeLogoSvg` を通す。
- 認証は迂回しない。ログイン状態は JSON の `auth.signedIn` (Cloudflare Access の
  セッション Cookie の有無) で分かる。

## 制限

- `admin-edit` などで保存すると、GitHub への書き戻しは架空の owner のため失敗し
  `githubSyncErrors` として返る。DB への保存自体は成功する。
- props 直描画のページでは id が仮なので、`/logos/:id` は引けない (ロゴは出ない)。
  ロゴの描画を見るときは `admin-edit` を使う。
- カバー画像 (R2) は撒かない。

## 実装

- `app/lib/top-page.ts`: `buildTopPageProps(repos, signedIn)` (純粋)。
  `app/components/top-page.tsx`: `TopPage(props)`。本番 route `app/routes/index.tsx` は
  この 2 つを呼ぶだけ。管理一覧も同様に `app/components/admin-repos-page.tsx` に分離。
- `app/scenarios/`: `index.ts` がレジストリ・DB 種まき (`runDbScenario`)・片付け・ゲート、
  `render.ts` が種 → props、`app.tsx` が Hono の sub app、各 `<name>.ts` が種。
- `app/routes/__scenarios/index.tsx` は sub app を mount するだけ。
- テストは `app/scenarios/__tests__/scenarios.test.ts` と `app/lib/__tests__/top-page.test.ts`。
