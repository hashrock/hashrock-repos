import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { repositories, tags, repositoryTags } from "../db/schema";
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

export async function syncRepos(d1: D1Database, repos: GitHubRepo[]) {
  const db = getDb(d1);

  for (const repo of repos) {
    const existing = await db
      .select()
      .from(repositories)
      .where(eq(repositories.fullName, repo.full_name))
      .get();

    let repoId: number;

    if (existing) {
      await db
        .update(repositories)
        .set({
          name: repo.name,
          url: repo.html_url,
          description: repo.description,
          updatedAt: repo.updated_at,
          language: repo.language,
          starCount: repo.stargazers_count,
          archived: repo.archived,
          isPrivate: repo.private,
          createdAt: repo.created_at,
        })
        .where(eq(repositories.fullName, repo.full_name));
      repoId = existing.id;
    } else {
      const inserted = await db
        .insert(repositories)
        .values({
          name: repo.name,
          fullName: repo.full_name,
          url: repo.html_url,
          description: repo.description,
          updatedAt: repo.updated_at,
          language: repo.language,
          starCount: repo.stargazers_count,
          archived: repo.archived,
          isPrivate: repo.private,
          createdAt: repo.created_at,
        })
        .returning()
        .get();
      repoId = inserted.id;
    }

    if (repo.topics && repo.topics.length > 0) {
      await db
        .delete(repositoryTags)
        .where(eq(repositoryTags.repositoryId, repoId));

      const tagIds = await ensureTagIds(db, repo.topics);
      await linkRepoTags(db, repoId, tagIds);
    }
  }

  return { synced: repos.length };
}

export interface ListReposOptions {
  /**
   * private リポジトリを含めるか。トップページは未認証で見られるため、
   * 明示的に指定されない限り含めない。
   */
  includePrivate?: boolean;
  /** hide が立っているリポジトリを含めるか。管理画面でのみ true にする */
  includeHidden?: boolean;
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

  // 全リポジトリ分のタグをまとめて取得する。repositoryId で絞ると D1 の
  // バインドパラメータ上限 (100) を超えてクエリが失敗するため WHERE は付けない。
  const allRepoTags = await db
    .select({
      repositoryId: repositoryTags.repositoryId,
      tagName: tags.name,
    })
    .from(repositoryTags)
    .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
    .all();

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

  if (Object.keys(values).length > 0) {
    await db
      .update(repositories)
      .set(values)
      .where(eq(repositories.id, repoId));
  }

  return getRepoById(d1, repoId);
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
