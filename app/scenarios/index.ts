import { deleteReposByFullNamePrefix, insertRepo, updateRepoMeta } from "../lib/db";
import type { GitHubRepo } from "../lib/github";
import { normalizeLogoSvg } from "../lib/svg";
import { makeScope, randomSuffix, scopePrefix } from "./scope";
import type { DbScenario, RepoSeed, Scenario, SeededRepo } from "./types";
import { empty } from "./empty";
import { typical } from "./typical";
import { large } from "./large";
import { visibility } from "./visibility";
import { adminList } from "./admin-list";
import { adminEdit } from "./admin-edit";

export const SCENARIOS: readonly Scenario[] = [
  empty,
  typical,
  large,
  visibility,
  adminList,
  adminEdit,
];

export function findScenario(name: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.name === name);
}

/**
 * DB に撒くシナリオを許すか。
 *
 * 認証なしの GET で DB に書く口なので、本番では閉じておく。wrangler の vars か
 * .dev.vars で SCENARIOS_ENABLED=1 を立てたときと、vite の dev サーバ
 * (import.meta.env.DEV) のときだけ開く。props 直描画のシナリオは何も書かないので
 * この判定の対象外。
 */
export function isDbSeedingEnabled(
  env: { SCENARIOS_ENABLED?: string },
  dev: boolean = import.meta.env.DEV
): boolean {
  return env.SCENARIOS_ENABLED === "1" || dev;
}

/**
 * 種を GitHub 由来の行の形にする。
 *
 * githubId は負の乱数。GitHub の ID は正なので実在のリポジトリと突き合わされる
 * ことがない。片付けは scope 指定の削除で明示的に行うが、消し忘れても次の
 * GitHub 同期が「GitHub に無い行」として消す。
 */
export function toGitHubRepo(scope: string, seed: RepoSeed): GitHubRepo {
  const fullName = `${scope}/${seed.name}`;
  return {
    id: -(Math.floor(Math.random() * 2 ** 48) + 1),
    name: seed.name,
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    description: seed.description ?? null,
    updated_at: seed.updatedAt ?? "2026-09-01T00:00:00.000Z",
    language: seed.language ?? null,
    stargazers_count: seed.starCount ?? 0,
    archived: seed.archived ?? false,
    created_at: seed.createdAt ?? "2026-01-01T00:00:00.000Z",
    topics: seed.tags ?? [],
    private: seed.isPrivate ?? false,
    homepage: seed.homepage ?? null,
  };
}

export interface ScenarioRun {
  scope: string;
  /** その scope の行を選ぶ full_name の前方一致 */
  prefix: string;
  /** リダイレクト先 (相対パス) */
  url: string;
  repos: (SeededRepo & { adminUrl: string })[];
}

/** DB に撒く。既存の行には触れない */
export async function runDbScenario(
  d1: D1Database,
  scenario: DbScenario,
  suffix: string = randomSuffix()
): Promise<ScenarioRun> {
  const scope = makeScope(scenario.name, suffix);
  const repos: SeededRepo[] = [];

  for (const seed of scenario.seeds()) {
    const row = await insertRepo(d1, toGitHubRepo(scope, seed));
    const meta = {
      ...(seed.notes !== undefined && { notes: seed.notes }),
      ...(seed.star !== undefined && { star: seed.star }),
      ...(seed.hide !== undefined && { hide: seed.hide }),
      // 本番の保存経路 (PATCH /admin/api/repos/:id) と同じ正規化を通す
      ...(seed.logoSvg !== undefined && { logoSvg: normalizeLogoSvg(seed.logoSvg) }),
    };
    if (Object.keys(meta).length > 0) {
      await updateRepoMeta(d1, row.id, meta);
    }
    repos.push({ id: row.id, name: row.name, fullName: row.fullName });
  }

  return {
    scope,
    prefix: scopePrefix(scope),
    url: scenario.target({ scope, repos }),
    repos: repos.map((r) => ({ ...r, adminUrl: `/admin/repos/${r.id}` })),
  };
}

/** その scope に撒いた行を全部消す。scope は呼び出し側で形を検証しておくこと */
export async function cleanupScope(d1: D1Database, scope: string) {
  return deleteReposByFullNamePrefix(d1, scopePrefix(scope));
}
