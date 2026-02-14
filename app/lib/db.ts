import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { repositories, tags, repositoryTags } from "../db/schema";
import type { GitHubRepo } from "./github";

export function getDb(d1: D1Database) {
  return drizzle(d1);
}

export async function syncRepos(d1: D1Database, repos: GitHubRepo[]) {
  const db = getDb(d1);

  for (const repo of repos) {
    // Upsert repository
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

    // Sync tags (topics)
    if (repo.topics && repo.topics.length > 0) {
      // Remove existing tags for this repo
      await db
        .delete(repositoryTags)
        .where(eq(repositoryTags.repositoryId, repoId));

      for (const topicName of repo.topics) {
        // Upsert tag
        let tag = await db
          .select()
          .from(tags)
          .where(eq(tags.name, topicName))
          .get();

        if (!tag) {
          tag = await db
            .insert(tags)
            .values({ name: topicName })
            .returning()
            .get();
        }

        await db
          .insert(repositoryTags)
          .values({ repositoryId: repoId, tagId: tag.id })
          .onConflictDoNothing();
      }
    }
  }

  return { synced: repos.length };
}

export async function listRepos(d1: D1Database) {
  const db = getDb(d1);

  const allRepos = await db.select().from(repositories).all();

  // Fetch tags for each repo
  const result = await Promise.all(
    allRepos.map(async (repo) => {
      const repoTags = await db
        .select({ name: tags.name })
        .from(repositoryTags)
        .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
        .where(eq(repositoryTags.repositoryId, repo.id))
        .all();

      return {
        ...repo,
        tags: repoTags.map((t) => t.name),
      };
    })
  );

  return result;
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

  // Remove all existing tags for this repo
  await db
    .delete(repositoryTags)
    .where(eq(repositoryTags.repositoryId, repoId));

  // Add new tags
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

    await db
      .insert(repositoryTags)
      .values({ repositoryId: repoId, tagId: tag.id })
      .onConflictDoNothing();
  }

  return { repoId, tags: tagNames };
}

// 既存タグを保持しつつ新しいタグを追加（一括追加用）
export async function addTagsToRepo(
  d1: D1Database,
  repoId: number,
  newTagNames: string[]
): Promise<string[]> {
  const db = getDb(d1);

  // 既存タグを取得
  const existingTags = await db
    .select({ name: tags.name })
    .from(repositoryTags)
    .innerJoin(tags, eq(repositoryTags.tagId, tags.id))
    .where(eq(repositoryTags.repositoryId, repoId))
    .all();

  const existingNames = existingTags.map((t) => t.name);
  const toAdd = newTagNames.filter((n) => !existingNames.includes(n));

  for (const name of toAdd) {
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

    await db
      .insert(repositoryTags)
      .values({ repositoryId: repoId, tagId: tag.id })
      .onConflictDoNothing();
  }

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
