import { createRoute } from "honox/factory";
import { getRepoById, setRepoArchived } from "../../../../lib/db";
import { archiveRepo } from "../../../../lib/github";

// POST /api/repos/:id/archive
export const POST = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  // Update local DB
  const result = await setRepoArchived(c.env.DB, id, true);

  // Archive on GitHub if token is available
  const token = c.env.GITHUB_TOKEN;
  if (token) {
    const repo = await getRepoById(c.env.DB, id);
    if (repo) {
      try {
        await archiveRepo(token, repo.fullName);
      } catch (e) {
        return c.json({ ...result, githubSync: false, error: String(e) });
      }
    }
  }

  return c.json({ ...result, githubSync: true });
});
