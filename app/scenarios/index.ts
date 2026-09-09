import { insertRepo, updateRepoMeta } from "../lib/db";
import type { GitHubRepo } from "../lib/github";
import { makeScope, randomSuffix, scopePrefix } from "../lib/scenario-scope";
import type { RepoSeed, Scenario, SeededRepo } from "./types";
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
 * 種を GitHub 由来の行の形にする。
 *
 * githubId は負の乱数にする。GitHub の ID は正なので実在のリポジトリと
 * 突き合わされることがなく、次の sync で「GitHub に無い行」として消える。
 * シナリオのデータは使い捨てなので、それが片付けを兼ねる。
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
  name: string;
  description: string;
  scope: string;
  /** 一覧ページに渡す full_name の前方一致 */
  prefix: string;
  requiresAdmin: boolean;
  /** リダイレクト先 (相対パス) */
  url: string;
  repos: (SeededRepo & { adminUrl: string })[];
}

/** シナリオの初期状態を新規に作る。既存の行には触れない */
export async function runScenario(
  d1: D1Database,
  scenario: Scenario,
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
      ...(seed.logoSvg !== undefined && { logoSvg: seed.logoSvg }),
    };
    if (Object.keys(meta).length > 0) {
      await updateRepoMeta(d1, row.id, meta);
    }
    repos.push({ id: row.id, name: row.name, fullName: row.fullName });
  }

  return {
    name: scenario.name,
    description: scenario.description,
    scope,
    prefix: scopePrefix(scope),
    requiresAdmin: scenario.requiresAdmin,
    url: scenario.target({ scope, repos }),
    repos: repos.map((r) => ({ ...r, adminUrl: `/admin/repos/${r.id}` })),
  };
}
