import type { Env } from "hono";
import { syncReposFromGitHub } from "./service";
import { takeSignupSnapshot } from "./signupStats";

/**
 * cron で同期する GitHub アカウント。/admin の同期ボタン (islands/sync-button.tsx)
 * が POST /admin/api/repos に送っている username と同じ値にしてある。
 */
export const CRON_SYNC_USERNAME = "hashrock";

type Bindings = Env["Bindings"];

export interface ScheduledDeps {
  takeSignupSnapshot: typeof takeSignupSnapshot;
  syncReposFromGitHub: typeof syncReposFromGitHub;
}

const defaultDeps: ScheduledDeps = { takeSignupSnapshot, syncReposFromGitHub };

/**
 * 毎日の cron (wrangler.jsonc の triggers.crons, UTC 0 時 = JST 9 時) でやること。
 *
 * サインアップ数のスナップショットと GitHub リポジトリ同期は互いに独立に走らせる。
 * 片方が throw してももう片方は最後まで進み、失敗はログに残すだけ。
 *
 * GitHub 同期について (POST /admin/api/repos と同じ syncReposFromGitHub を呼ぶ):
 *
 *   ⚠ GitHub 側で削除された (または取得結果に出てこなくなった) リポジトリは
 *     D1 からも行ごと削除される。その行に手で付けた star / hide / notes /
 *     カバー画像 (coverImageKey) / logoSvg / タグの紐付けも一緒に消え、復元できない。
 *     R2 上のカバー画像オブジェクト自体は消されず、どこからも参照されない孤児になる。
 *     これは手動の同期ボタンと同じ挙動で、cron で毎日自動で走るようになる点だけが違う。
 *
 *   - private リポジトリ: token の持ち主 (/user) が CRON_SYNC_USERNAME と一致すれば
 *     /user/repos?affiliation=owner&visibility=all で private も取り込む。一致しなければ
 *     public だけになり、それまで D1 にあった private の行は削除対象になるので注意。
 *   - レート制限: 特別な扱いはない。認証付きで 1 回の同期は /user + 100 件ごとに 1 リクエスト
 *     なので、1 日 1 回なら上限 (5000/h) には遠い。GitHub が 200 以外を返したら
 *     fetchUserRepos が throw し、D1 に触る前に同期全体が中止される
 *     (途中までのページで削除判定することはない)。
 */
export async function runScheduledJobs(
  env: Bindings,
  deps: ScheduledDeps = defaultDeps
): Promise<void> {
  await Promise.allSettled([runSignupSnapshot(env, deps), runRepoSync(env, deps)]);
}

async function runSignupSnapshot(env: Bindings, deps: ScheduledDeps) {
  try {
    const { date, saved, results } = await deps.takeSignupSnapshot(env);
    const failed = results.filter((r) => r.error !== null);
    console.log(
      `signup snapshot ${date}: saved ${saved}, failed ${failed.length}`,
      failed.map((r) => `${r.service}: ${r.error}`)
    );
  } catch (e) {
    console.error("signup snapshot failed:", e);
  }
}

async function runRepoSync(env: Bindings, deps: ScheduledDeps) {
  if (!env.GITHUB_TOKEN) {
    console.error("repo sync skipped: GITHUB_TOKEN is not configured");
    return;
  }
  try {
    const { data } = await deps.syncReposFromGitHub(env.DB, env.GITHUB_TOKEN, CRON_SYNC_USERNAME);
    console.log(`repo sync: synced ${data.synced}, deleted ${data.deleted}`);
  } catch (e) {
    console.error("repo sync failed:", e);
  }
}
