import { Hono, type Context, type Env } from "hono";
import { hasAccessSession } from "../lib/access";
import { listRepos } from "../lib/db";
import TopPage from "../components/top-page";
import { SCENARIOS, cleanupScope, findScenario, isDbSeedingEnabled, runDbScenario } from "./index";
import { seedsToTopPageProps } from "./render";
import { isScope, scopePrefix } from "./scope";

/**
 * UI テスト用シナリオ route。/__scenarios に mount する。
 *
 *   - props 直描画 (empty / typical / large / visibility): DB を触らず、公開トップ
 *     ページのコンポーネントに種から作った props を渡して描く。本番でも安全
 *   - DB 種まき (admin-*): 架空の owner `scenario-<name>-<rand>` 配下に行を足して
 *     管理画面へ飛ぶ。認証なしの GET で書く口なので SCENARIOS_ENABLED か vite dev
 *     のときだけ有効。片付けは DELETE /__scenarios/scopes/:scope
 *
 * 認証は迂回しない。/admin へ飛ぶ先は Cloudflare Access がそのままログインを求める
 * (このアプリには認証バイパスの仕組みが無い)。
 */
// global.d.ts で拡張した Env (DB などの Bindings) をここでも使う
const app = new Hono<Env>();

function wantsJson(c: Context): boolean {
  return (
    c.req.query("format") === "json" ||
    (c.req.header("accept") ?? "").includes("application/json")
  );
}

function authInfo(c: Context) {
  return {
    mechanism: "cloudflare-access",
    bypass: false,
    signedIn: hasAccessSession(c.req.header("cookie")),
  };
}

app.get("/", (c) => {
  const seeding = isDbSeedingEnabled(c.env);
  return c.render(
    <div class="py-8 px-6 max-w-3xl mx-auto">
      <title>UI test scenarios</title>
      <h1 class="text-2xl font-bold mb-2">UI test scenarios</h1>
      <p class="text-sm text-gray-600 mb-6">
        リンクを開くとその状態の画面へ移動します。末尾に <code>?format=json</code> を付けると
        移動せずに URL や props を JSON で返します。
      </p>
      <ul class="space-y-3">
        {SCENARIOS.map((s) => {
          const disabled = s.kind === "db" && !seeding;
          return (
            <li key={s.name} class={`p-4 border rounded ${disabled ? "opacity-60" : ""}`}>
              <div class="flex items-center gap-2 flex-wrap">
                <a href={`/__scenarios/${s.name}`} class="font-semibold text-blue-600 hover:underline">
                  {s.name}
                </a>
                <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {s.kind === "props" ? "props 直描画" : "DB に撒く"}
                </span>
                {s.kind === "db" && (
                  <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">admin</span>
                )}
                <a href={`/__scenarios/${s.name}?format=json`} class="text-xs text-gray-400 hover:underline">
                  json
                </a>
              </div>
              <p class="text-sm text-gray-600 mt-1">{s.description}</p>
              {disabled && (
                <p class="text-xs text-red-600 mt-1">
                  無効: DB に書くため SCENARIOS_ENABLED=1 (または vite dev) が要ります
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p class="text-xs text-gray-500 mt-6">
        admin 付きのシナリオは /admin 配下へ移動するため Cloudflare Access のログインが要ります
        (ローカル開発では保護が無いのでそのまま開けます)。撒いた行は
        <code> DELETE /__scenarios/scopes/:scope </code>で消せます。
      </p>
      <p class="mt-6">
        <a href="/" class="text-xs text-gray-400 hover:text-gray-600">← Projects</a>
      </p>
    </div>
  );
});

app.get("/:name", async (c) => {
  const scenario = findScenario(c.req.param("name"));
  if (!scenario) {
    return c.notFound();
  }

  if (scenario.kind === "props") {
    const url = `/__scenarios/${scenario.name}/page`;
    if (wantsJson(c)) {
      return c.json({
        name: scenario.name,
        kind: scenario.kind,
        description: scenario.description,
        url,
        absoluteUrl: new URL(url, c.req.url).toString(),
        props: seedsToTopPageProps(scenario.seeds(), hasAccessSession(c.req.header("cookie"))),
        auth: authInfo(c),
      });
    }
    return c.redirect(url, 303);
  }

  if (!isDbSeedingEnabled(c.env)) {
    const reason = "DB seeding is disabled. Set SCENARIOS_ENABLED=1 (or run under vite dev).";
    return wantsJson(c)
      ? c.json({ name: scenario.name, kind: scenario.kind, error: reason }, 403)
      : c.text(reason, 403);
  }

  const run = await runDbScenario(c.env.DB, scenario);
  if (wantsJson(c)) {
    return c.json({
      name: scenario.name,
      kind: scenario.kind,
      description: scenario.description,
      ...run,
      absoluteUrl: new URL(run.url, c.req.url).toString(),
      cleanupUrl: `/__scenarios/scopes/${run.scope}`,
      auth: authInfo(c),
    });
  }
  return c.redirect(run.url, 303);
});

/** props 直描画のページ。DB 種まきのシナリオでは撒いた scope の分だけを描く */
app.get("/:name/page", async (c) => {
  const scenario = findScenario(c.req.param("name"));
  if (!scenario) {
    return c.notFound();
  }

  if (scenario.kind === "props") {
    const signedIn = hasAccessSession(c.req.header("cookie"));
    return c.render(<TopPage {...seedsToTopPageProps(scenario.seeds(), signedIn)} />);
  }

  const scope = c.req.query("scope");
  if (!scenario.page || !isScope(scope)) {
    return c.notFound();
  }
  const prefix = scopePrefix(scope);
  const repos = (
    await listRepos(c.env.DB, { includePrivate: true, includeHidden: true, includeArchived: true })
  ).filter((r) => r.fullName.startsWith(prefix));
  return c.render(scenario.page(repos) as Parameters<typeof c.render>[0]);
});

/** 撒いた行の片付け。scope の形をしたものしか受け付けないので他の行は消えない */
app.delete("/scopes/:scope", async (c) => {
  if (!isDbSeedingEnabled(c.env)) {
    return c.json({ error: "DB seeding is disabled" }, 403);
  }
  const scope = c.req.param("scope");
  if (!isScope(scope)) {
    return c.json({ error: "not a scenario scope" }, 400);
  }
  const result = await cleanupScope(c.env.DB, scope);
  return c.json({ scope, ...result });
});

export default app;
