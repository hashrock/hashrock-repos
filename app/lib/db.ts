import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq, inArray } from "drizzle-orm";
import { repositories, tags, repositoryTags } from "../db/schema";
import { KANBAN_COLUMNS } from "./constants";
import { normalizeTagList } from "./tags";
import { planRepoSync } from "./repo-sync-plan";
import type { GitHubRepo } from "./github";

function getDb(d1: D1Database) {
  return drizzle(d1);
}

async function ensureTagIds(
  db: DrizzleD1Database,
  tagNames: string[]
): Promise<number[]> {
  const tagIds: number[] = [];

  for (const name of tagNames) {
    let tag = await db
      .select()
      .from(tags)
      .where(eq(tags.name, name))
      .get();

    if (!tag) {
      tag = await db
        .insert(tags)
        .values({ name })
        .returning()
        .get();
    }

    tagIds.push(tag.id);
  }

  return tagIds;
}

async function linkRepoTags(
  db: DrizzleD1Database,
  repoId: number,
  tagIds: number[]
): Promise<void> {
  for (const tagId of tagIds) {
    await db
      .insert(repositoryTags)
      .values({ repositoryId: repoId, tagId })
      .onConflictDoNothing();
  }
}

/** GitHub の topics を DB のタグに反映する。topics が空のときは触らない */
async function syncTopics(
  db: DrizzleD1Database,
  repoId: number,
  repo: GitHubRepo
): Promise<void> {
  if (!repo.topics || repo.topics.length === 0) {
    return;
  }
  await db.delete(repositoryTags).where(eq(repositoryTags.repositoryId, repoId));
  const tagIds = await ensureTagIds(db, normalizeTagList(repo.topics));
  await linkRepoTags(db, repoId, tagIds);
}

/** GitHub 由来の列。sync のたびに上書きする。手で編集する列は触らない */
function githubColumns(repo: GitHubRepo) {
  return {
    githubId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    updatedAt: repo.updated_at,
    language: repo.language,
    starCount: repo.stargazers_count,
    archived: repo.archived,
    isPrivate: repo.private,
    homepage: repo.homepage,
    createdAt: repo.created_at,
  };
}

export async function syncRepos(d1: D1Database, repos: GitHubRepo[]) {
  const db = getDb(d1);

  // 突き合わせは 1 回の select で取った棚卸しに対して純粋に行う。
  // 行を消す判断が絡むので、規則と不変条件は repo-sync-plan.ts 側に置く
  const existing = await db
    .select({
      id: repositories.id,
      githubId: repositories.githubId,
      fullName: repositories.fullName,
    })
    .from(repositories)
    .all();
  const plan = planRepoSync(existing, repos);

  // full_name の UNIQUE 制約があるので、名前を手放す側から順に片付ける
  if (plan.deleteIds.length > 0) {
    // D1 の 100 パラメータ制限に合わせてチャンク削除。FK に cascade がないので先に repositoryTags を消す
    const CHUNK_SIZE = 80;
    for (let i = 0; i < plan.deleteIds.length; i += CHUNK_SIZE) {
      const chunk = plan.deleteIds.slice(i, i + CHUNK_SIZE);
      await db
        .delete(repositoryTags)
        .where(inArray(repositoryTags.repositoryId, chunk));
      await db
        .delete(repositories)
        .where(inArray(repositories.id, chunk));
    }
  }

  for (const { rowId, repo } of plan.updates) {
    await db
      .update(repositories)
      .set(githubColumns(repo))
      .where(eq(repositories.id, rowId));
    await syncTopics(db, rowId, repo);
  }

  for (const repo of plan.inserts) {
    const inserted = await db
      .insert(repositories)
      .values(githubColumns(repo))
      .returning()
      .get();
    await syncTopics(db, inserted.id, repo);
  }

  return { synced: repos.length, deleted: plan.deleteIds.length };
}

export interface ListReposOptions {
  /**
   * private リポジトリを含めるか。トップページは未認証で見られるため、
   * 明示的に指定されない限り含めない。
   */
  includePrivate?: boolean;
  /** hide が立っているリポジトリを含めるか。管理画面でのみ true にする */
  includeHidden?: boolean;
  /** archived なリポジトリを含めるか。トップページには出さないので既定は false */
  includeArchived?: boolean;
  /** star が立っているリポジトリだけに絞るか */
  starredOnly?: boolean;
}

export async function listRepos(
  d1: D1Database,
  options: ListReposOptions = {}
) {
  const db = getDb(d1);

  const conditions = [];
  if (!options.includePrivate) {
    conditions.push(eq(repositories.isPrivate, false));
  }
  if (!options.includeHidden) {
    conditions.push(eq(repositories.hide, false));
  }
  if (!options.includeArchived) {
    conditions.push(eq(repositories.archived, false));
  }
  if (options.starredOnly) {
    conditions.push(eq(repositories.star, true));
  }

  const query = db.select().from(repositories);
  const allRepos = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query
  ).all();

  if (allRepos.length === 0) {
    return [];
  }

  const repoIds = allRepos.map((r) => r.id);

  // D1 has a 100 binding parameter limit, so chunk the query
  const CHUNK_SIZE = 80;
  const allRepoTags: { repositoryId: number; tagName: string }[] = [];
  for (let i = 0; i < repoIds.length; i += CHUNK_SIZE) {
    const chunk = repoIds.slice(i, i + CHUNK_SIZE);
    const rows = await db
      .select({
        repositoryId: repositoryTags.repositoryId,
        tagName: tags.name,
      })
      .from(repositoryTags)
      .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
      .where(inArray(repositoryTags.repositoryId, chunk))
      .all();
    allRepoTags.push(...rows);
  }

  const tagsByRepoId = new Map<number, string[]>();
  for (const row of allRepoTags) {
    const existing = tagsByRepoId.get(row.repositoryId);
    if (existing) {
      existing.push(row.tagName);
    } else {
      tagsByRepoId.set(row.repositoryId, [row.tagName]);
    }
  }

  return allRepos.map((repo) => ({
    ...repo,
    tags: tagsByRepoId.get(repo.id) ?? [],
  }));
}

export async function getRepoById(d1: D1Database, repoId: number) {
  const db = getDb(d1);
  return db.select().from(repositories).where(eq(repositories.id, repoId)).get();
}

/**
 * そのリポジトリが公開トップページに出ている状態か。
 *
 * ロゴとカバー画像の配信可否をこれで判定する。判定を持たずに R2 や DB を
 * そのまま引くと、hide や star 解除をしても URL を知っている相手には
 * 取り続けられてしまう (公開の取り消しが効かない)。
 *
 * 条件はトップページの描画条件と同じ:
 *   hide でなく archived でもなく、star が付いているか kanban タグがある
 */
async function findVisibleRepo(
  d1: D1Database,
  where: ReturnType<typeof eq>
) {
  const db = getDb(d1);

  const repo = await db
    .select()
    .from(repositories)
    .where(
      and(
        where,
        eq(repositories.hide, false),
        eq(repositories.archived, false)
      )
    )
    .get();

  if (!repo) {
    return undefined;
  }

  if (repo.star) {
    return repo;
  }

  // star が無い場合は kanban タグが付いていれば公開されている
  const tagged = await db
    .select({ tagName: tags.name })
    .from(repositoryTags)
    .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
    .where(eq(repositoryTags.repositoryId, repo.id))
    .all();

  const isOnBoard = tagged.some((t) =>
    (KANBAN_COLUMNS as readonly string[]).includes(t.tagName)
  );

  return isOnBoard ? repo : undefined;
}

/** 公開配信してよいリポジトリを id で引く。出ていなければ undefined */
export async function getPubliclyVisibleRepoById(
  d1: D1Database,
  repoId: number
) {
  return findVisibleRepo(d1, eq(repositories.id, repoId));
}

/** 公開配信してよいリポジトリをカバー画像のキーで引く */
export async function getPubliclyVisibleRepoByCoverImageKey(
  d1: D1Database,
  key: string
) {
  return findVisibleRepo(d1, eq(repositories.coverImageKey, key));
}

/** 個別編集ページ用。タグ付きで 1 件返す */
export async function getRepoWithTags(d1: D1Database, repoId: number) {
  const db = getDb(d1);

  const repo = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, repoId))
    .get();

  if (!repo) {
    return undefined;
  }

  const rows = await db
    .select({ tagName: tags.name })
    .from(repositoryTags)
    .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
    .where(eq(repositoryTags.repositoryId, repoId))
    .all();

  return { ...repo, tags: rows.map((r) => r.tagName) };
}

export interface RepoMetaPatch {
  notes?: string | null;
  star?: boolean;
  hide?: boolean;
  logoSvg?: string | null;
}

/**
 * 手で編集する項目だけを更新する。GitHub 由来の項目は sync が上書きするので
 * ここでは触らない。
 */
export async function updateRepoMeta(
  d1: D1Database,
  repoId: number,
  patch: RepoMetaPatch
) {
  const db = getDb(d1);

  const values: RepoMetaPatch = {};
  if (patch.notes !== undefined) values.notes = patch.notes;
  if (patch.star !== undefined) values.star = patch.star;
  if (patch.hide !== undefined) values.hide = patch.hide;
  if (patch.logoSvg !== undefined) values.logoSvg = patch.logoSvg;

  if (Object.keys(values).length > 0) {
    await db
      .update(repositories)
      .set(values)
      .where(eq(repositories.id, repoId));
  }

  return getRepoById(d1, repoId);
}

/**
 * description は GitHub 由来なので、DB だけ書き換えても次の sync で戻る。
 * 呼ぶのは GitHub にも書き戻すサービス層からだけにすること。
 */
export async function setRepoDescription(
  d1: D1Database,
  repoId: number,
  description: string | null
) {
  const db = getDb(d1);
  await db
    .update(repositories)
    .set({ description })
    .where(eq(repositories.id, repoId));
  return { repoId, description };
}

export async function setRepoCoverImageKey(
  d1: D1Database,
  repoId: number,
  key: string | null
) {
  const db = getDb(d1);
  await db
    .update(repositories)
    .set({ coverImageKey: key })
    .where(eq(repositories.id, repoId));
  return { repoId, coverImageKey: key };
}

/**
 * タグを丸ごと入れ替える。tagNames は正規化済みであること
 * (service 層の normalizeTagList を通す。呼び出し元はそこだけ)
 */
export async function updateRepoTags(
  d1: D1Database,
  repoId: number,
  tagNames: string[]
) {
  const db = getDb(d1);

  await db
    .delete(repositoryTags)
    .where(eq(repositoryTags.repositoryId, repoId));

  const tagIds = await ensureTagIds(db, tagNames);
  await linkRepoTags(db, repoId, tagIds);

  return { repoId, tags: tagNames };
}

/** 既に付いているタグはそのままに足す。newTagNames は正規化済みであること */
export async function addTagsToRepo(
  d1: D1Database,
  repoId: number,
  newTagNames: string[]
): Promise<string[]> {
  const db = getDb(d1);

  const existingTags = await db
    .select({ name: tags.name })
    .from(repositoryTags)
    .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
    .where(eq(repositoryTags.repositoryId, repoId))
    .all();

  const existingNames = existingTags.map((t) => t.name);
  const toAdd = newTagNames.filter((n) => !existingNames.includes(n));

  const tagIds = await ensureTagIds(db, toAdd);
  await linkRepoTags(db, repoId, tagIds);

  return [...existingNames, ...toAdd];
}

export async function setRepoArchived(
  d1: D1Database,
  repoId: number,
  archived: boolean
) {
  const db = getDb(d1);
  await db
    .update(repositories)
    .set({ archived })
    .where(eq(repositories.id, repoId));
  return { repoId, archived };
}
