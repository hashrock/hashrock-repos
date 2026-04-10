import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";
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

  // 今回の sync で触れた内部 id を記録。最後にここに含まれない行を削除する。
  const touchedIds = new Set<number>();

  for (const repo of repos) {
    // 不変の github_id で照合するのが正。これが一致すればリネーム/オーナー変更でも同一レコード。
    let existing = await db
      .select()
      .from(repositories)
      .where(eq(repositories.githubId, repo.id))
      .get();

    // 移行期フォールバック: github_id 未登録 (nullable) の既存行は full_name で拾って埋め戻す。
    // 既に別の github_id が入っている行を横取りしないため githubId === null の時だけ採用する。
    if (!existing) {
      const byName = await db
        .select()
        .from(repositories)
        .where(eq(repositories.fullName, repo.full_name))
        .get();
      if (byName && byName.githubId === null) {
        existing = byName;
      }
    }

    let repoId: number;

    if (existing) {
      await db
        .update(repositories)
        .set({
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          url: repo.html_url,
          description: repo.description,
          updatedAt: repo.updated_at,
          language: repo.language,
          starCount: repo.stargazers_count,
          archived: repo.archived,
          createdAt: repo.created_at,
        })
        .where(eq(repositories.id, existing.id));
      repoId = existing.id;
    } else {
      const inserted = await db
        .insert(repositories)
        .values({
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          url: repo.html_url,
          description: repo.description,
          updatedAt: repo.updated_at,
          language: repo.language,
          starCount: repo.stargazers_count,
          archived: repo.archived,
          createdAt: repo.created_at,
        })
        .returning()
        .get();
      repoId = inserted.id;
    }

    touchedIds.add(repoId);

    if (repo.topics && repo.topics.length > 0) {
      await db
        .delete(repositoryTags)
        .where(eq(repositoryTags.repositoryId, repoId));

      const tagIds = await ensureTagIds(db, repo.topics);
      await linkRepoTags(db, repoId, tagIds);
    }
  }

  // GitHub から消えた (削除 / 非公開化など) リポジトリを DB からも削除する。
  // リネームやオーナー変更は github_id で追従済みなので、ここに残るのは本当に消えた行だけ。
  const allDbRepos = await db
    .select({ id: repositories.id })
    .from(repositories)
    .all();
  const idsToDelete = allDbRepos
    .map((r) => r.id)
    .filter((id) => !touchedIds.has(id));

  if (idsToDelete.length > 0) {
    // D1 の 100 パラメータ制限に合わせてチャンク削除。FK に cascade がないので先に repositoryTags を消す
    const CHUNK_SIZE = 80;
    for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
      const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
      await db
        .delete(repositoryTags)
        .where(inArray(repositoryTags.repositoryId, chunk));
      await db
        .delete(repositories)
        .where(inArray(repositories.id, chunk));
    }
  }

  return { synced: repos.length, deleted: idsToDelete.length };
}

export async function listRepos(d1: D1Database) {
  const db = getDb(d1);

  const allRepos = await db.select().from(repositories).all();

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
