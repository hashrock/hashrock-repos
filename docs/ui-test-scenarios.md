# UI テスト用シナリオ route

Chrome MCP などのブラウザ自動操作で UI を確認するとき、URL を 1 つ開くだけで
所定の初期状態が用意され、その画面へ移動する。

| URL | 動き |
|---|---|
| `GET /__scenarios` | シナリオ一覧 (名前・説明・リンク) |
| `GET /__scenarios/:name` | 初期状態を **新規に** 作り、対象画面へ 303 リダイレクト |
| `GET /__scenarios/:name?format=json` (または `Accept: application/json`) | リダイレクトせず、作った ID・URL・ログイン状態を JSON で返す |

## シナリオ一覧

| name | 行き先 | 内容 |
|---|---|---|
| `empty` | `/?scenario=…` | リポジトリ 0 件。カード欄なし、5 列とも No items |
| `typical` | `/?scenario=…` | 8 件。カード 2 枚 (メモ・ロゴ付き)、各列 1〜2 件、private 1 件 |
| `large` | `/?scenario=…` | 60 件。カード 12 枚、各列 12 件。長い名前・長文の説明とメモ・10 個のタグ・5 桁の star 数 |
| `visibility` | `/?scenario=…` | 公開トップに出る/出ないの境界 9 件。`shown-*` の 5 件だけ出て `hidden-*` の 4 件は出ない |
| `admin-list` | `/admin/repos?scenario=…` | 管理一覧 8 件。archived・hidden・タグ無し・private を含み、絞り込みと並び替えを試す |
| `admin-edit` | `/admin/repos/:id` | 全項目が埋まった 1 件の編集ページ |

`admin-*` は `/admin` 配下へ移動するので、本番では Cloudflare Access のログインが要る
(このアプリには認証バイパスの仕組みが無い)。ローカル開発では保護が無いのでそのまま開ける。

## Chrome MCP からの使い方

1. `GET /__scenarios/typical?format=json` を叩いて JSON を受け取る。

   ```json
   {
     "name": "typical",
     "scope": "scenario-typical-k3j9x2",
     "prefix": "scenario-typical-k3j9x2/",
     "requiresAdmin": false,
     "url": "/?scenario=scenario-typical-k3j9x2",
     "absoluteUrl": "http://localhost:5173/?scenario=scenario-typical-k3j9x2",
     "repos": [{ "id": 12, "name": "notes-app", "fullName": "scenario-typical-k3j9x2/notes-app", "adminUrl": "/admin/repos/12" }],
     "auth": { "mechanism": "cloudflare-access", "bypass": false, "signedIn": false }
   }
   ```

2. `absoluteUrl` をブラウザで開く。個別ページを見たいときは `repos[].adminUrl` を使う。
3. 単に画面を開くだけなら `format=json` を付けずに `/__scenarios/typical` を開けばよい
   (303 で行き先へ移動する)。

`curl` での確認例:

```sh
curl -i http://localhost:5173/__scenarios/typical            # 303 + Location
curl -s http://localhost:5173/__scenarios/typical?format=json | jq .
```

## 仕組みと安全性

- 毎回 `scenario-<name>-<6 文字の乱数>` という架空の owner を作り、その配下
  (`<owner>/<repo>`) に行を **追加するだけ**。既存の行は消さないし書き換えない。
- 一覧ページ (`/` と `/admin/repos`) は `?scenario=<owner>` を受けると、その配下の
  行だけを表示する。絞り込みは狭める方向にしか働かない。
- `?scenario=` を付けない通常の一覧 (`/`、`/admin/repos`、`/api/starred`、`/admin/api/repos`)
  からはシナリオの行を除外する (`listRepos` の規則)。本番でシナリオを叩いても
  公開ページや外部 CMS が読む JSON は汚れない。
- `github_id` は負の乱数。実在の GitHub リポジトリと突き合わされることはなく、
  次の GitHub 同期 (管理画面の Sync) で「GitHub に無い行」として消える。
  つまり片付けは同期が兼ねる。
- 使うタグは固定の集合なので、何度叩いても `tags` テーブルは増え続けない。
- 認証は迂回しない。ログイン状態は JSON の `auth.signedIn` (Cloudflare Access の
  セッション Cookie の有無) で分かる。

## 制限

- `admin-edit` などで保存すると、GitHub への書き戻しは架空の owner のため失敗し
  `githubSyncErrors` として返る。DB への保存自体は成功する。
- カバー画像 (R2) は撒かない。画像付きカードの確認は手でアップロードする。

## 実装

- `app/scenarios/` にまとめてある。`index.ts` がレジストリと実行 (`runScenario`)、
  `app.tsx` が Hono の sub app、各 `<name>.ts` が種。
- `app/routes/__scenarios/index.tsx` は sub app を mount するだけ。
- scope の命名と判定は `app/lib/scenario-scope.ts`。ドメイン層 (`listRepos`) も参照する。
- テストは `app/scenarios/__tests__/scenarios.test.ts`。
