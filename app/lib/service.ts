import {
  syncRepos,
  getRepoById,
  updateRepoTags,
  addTagsToRepo,
  setRepoArchived,
} from "./db";
import {
  fetchUserRepos,
  updateRepoTopics,
  archiveRepo,
} from "./github";

export interface ServiceResult<T> {
  data: T;
  githubSyncErrors?: string[];
}

export async function syncReposFromGitHub(
  d1: D1Database,
  token: string,
  username: string
): Promise<ServiceResult<{ synced: number }>> {
  const repos = await fetchUserRepos(token, username);
  const data = await syncRepos(d1, repos);
  return { data };
}

export async function updateRepoTagsWithSync(
  d1: D1Database,
  token: string | undefined,
  repoId: number,
  tagNames: string[]
): Promise<ServiceResult<{ repoId: number; tags: string[] }>> {
  const data = await updateRepoTags(d1, repoId, tagNames);

  if (!token) {
    return { data };
  }

  const repo = await getRepoById(d1, repoId);
  if (!repo) {
    return { data };
  }

  try {
    await updateRepoTopics(token, repo.fullName, tagNames);
  } catch (e) {
    return { data, githubSyncErrors: [String(e)] };
  }

  return { data };
}

export async function archiveRepoWithSync(
  d1: D1Database,
  token: string | undefined,
  repoId: number
): Promise<ServiceResult<{ repoId: number; archived: boolean }>> {
  const data = await setRepoArchived(d1, repoId, true);

  if (!token) {
    return { data };
  }

  const repo = await getRepoById(d1, repoId);
  if (!repo) {
    return { data };
  }

  try {
    await archiveRepo(token, repo.fullName);
  } catch (e) {
    return { data, githubSyncErrors: [String(e)] };
  }

  return { data };
}

export async function bulkAddTagsWithSync(
  d1: D1Database,
  token: string | undefined,
  repoIds: number[],
  tagNames: string[]
): Promise<ServiceResult<{ repoId: number; tags: string[] }[]>> {
  const results: { repoId: number; tags: string[] }[] = [];
  const githubSyncErrors: string[] = [];

  for (const repoId of repoIds) {
    const updatedTags = await addTagsToRepo(d1, repoId, tagNames);
    results.push({ repoId, tags: updatedTags });

    if (token) {
      const repo = await getRepoById(d1, repoId);
      if (repo) {
        try {
          await updateRepoTopics(token, repo.fullName, updatedTags);
        } catch (e) {
          githubSyncErrors.push(`repo ${repoId}: ${String(e)}`);
        }
      }
    }
  }

  const result: ServiceResult<{ repoId: number; tags: string[] }[]> = {
    data: results,
  };
  if (githubSyncErrors.length > 0) {
    result.githubSyncErrors = githubSyncErrors;
  }
  return result;
}
