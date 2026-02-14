import { createRoute } from "honox/factory";
import { getRepoById, updateRepoTags } from "../../../../lib/db";
import { updateRepoTopics } from "../../../../lib/github";

// PUT /api/repos/:id/tags
export const PUT = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const { tags } = await c.req.json<{ tags: string[] }>();
  if (!Array.isArray(tags)) {
    return c.json({ error: "tags must be an array of strings" }, 400);
  }

  // Update local DB
  const result = await updateRepoTags(c.env.DB, id, tags);

  // Push to GitHub if token is available
  const token = c.env.GITHUB_TOKEN;
  if (token) {
    const repo = await getRepoById(c.env.DB, id);
    if (repo) {
      try {
        await updateRepoTopics(token, repo.fullName, tags);
      } catch (e) {
        return c.json({ ...result, githubSync: false, error: String(e) });
      }
    }
  }

  return c.json({ ...result, githubSync: true });
});
