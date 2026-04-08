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
