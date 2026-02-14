import { createRoute } from "honox/factory";
import { getRepoById, addTagsToRepo } from "../../../lib/db";
import { updateRepoTopics } from "../../../lib/github";

// POST /api/repos/bulk-tags - 複数リポジトリにタグを一括追加
export const POST = createRoute(async (c) => {
  const { repoIds, tags } = await c.req.json<{
    repoIds: number[];
    tags: string[];
  }>();

  if (!Array.isArray(repoIds) || !Array.isArray(tags)) {
    return c.json({ error: "repoIds and tags must be arrays" }, 400);
  }

  const results = [];
  const token = c.env.GITHUB_TOKEN;

  for (const repoId of repoIds) {
    const updatedTags = await addTagsToRepo(c.env.DB, repoId, tags);

    if (token) {
      const repo = await getRepoById(c.env.DB, repoId);
      if (repo) {
        try {
          await updateRepoTopics(token, repo.fullName, updatedTags);
        } catch (_) {
          // continue even if GitHub sync fails
        }
      }
    }

    results.push({ repoId, tags: updatedTags });
  }

  return c.json({ updated: results });
});
