import { Hono, type Context, type Env } from "hono";
import { hasAccessSession } from "../lib/access";
import { SCENARIOS, findScenario, runScenario } from "./index";

/**
 * UI テスト用シナリオ route。/__scenarios に mount する。
 *
 * 公開されてよい前提で作ってある:
 *   - 既存の行は消さない・書き換えない。毎回 `scenario-<name>-<rand>` という
 *     架空の owner 配下に新しい行を足すだけ
 *   - 認証は迂回しない。/admin へ飛ぶシナリオは Cloudflare Access がそのまま
 *     ログインを求める (このアプリにはバイパス機構が無い)
 */
// global.d.ts で拡張した Env (DB などの Bindings) をここでも使う
const app = new Hono<Env>();

function wantsJson(c: Context): boolean {
  return (
    c.req.query("format") === "json" ||
    (c.req.header("accept") ?? "").includes("application/json")
  );
}

app.get("/", (c) => {
  const signedIn = hasAccessSession(c.req.header("cookie"));
  return c.render(
    <div class="py-8 px-6 max-w-3xl mx-auto">
      <title>UI test scenarios</title>
      <h1 class="text-2xl font-bold mb-2">UI test scenarios</h1>
      <p class="text-sm text-gray-600 mb-6">
        リンクを開くと初期状態を新規に作ってその画面へ移動します。既存のデータには触れません。
        末尾に <code>?format=json</code> を付けると移動せずに作った ID と URL を JSON で返します。
      </p>
      <ul class="space-y-3">
        {SCENARIOS.map((s) => (
          <li key={s.name} class="p-4 border rounded">
            <div class="flex items-center gap-2 flex-wrap">
              <a href={`/__scenarios/${s.name}`} class="font-semibold text-blue-600 hover:underline">
                {s.name}
              </a>
              {s.requiresAdmin && (
                <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  admin
                </span>
              )}
              <a href={`/__scenarios/${s.name}?format=json`} class="text-xs text-gray-400 hover:underline">
                json
              </a>
            </div>
            <p class="text-sm text-gray-600 mt-1">{s.description}</p>
          </li>
        ))}
      </ul>
      <p class="text-xs text-gray-500 mt-6">
        admin 付きのシナリオは /admin 配下へ移動するため Cloudflare Access のログインが要ります
        (ローカル開発では保護が無いのでそのまま開けます)。
        {signedIn ? " いまは Access のセッション Cookie があります。" : " いまは Access のセッション Cookie がありません。"}
        作ったデータは次の GitHub 同期で消えます。
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

  const run = await runScenario(c.env.DB, scenario);
  const absoluteUrl = new URL(run.url, c.req.url).toString();

  if (wantsJson(c)) {
    return c.json({
      ...run,
      absoluteUrl,
      auth: {
        mechanism: "cloudflare-access",
        bypass: false,
        signedIn: hasAccessSession(c.req.header("cookie")),
      },
    });
  }

  return c.redirect(run.url, 303);
});

export default app;
