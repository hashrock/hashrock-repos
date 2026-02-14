import { createRoute } from "honox/factory";
import { listRepos, syncRepos } from "../../../lib/db";
import { fetchUserRepos } from "../../../lib/github";

// GET /api/repos - リポジトリ一覧
export const GET = createRoute(async (c) => {
  const repos = await listRepos(c.env.DB);
  return c.json(repos);
});

// POST /api/repos/sync - GitHubから同期
export const POST = createRoute(async (c) => {
  const token = c.env.GITHUB_TOKEN;
  if (!token) {
    return c.json({ error: "GITHUB_TOKEN is not configured" }, 500);
  }

  const { username } = await c.req.json<{ username: string }>();
  if (!username) {
    return c.json({ error: "username is required" }, 400);
  }

  const repos = await fetchUserRepos(token, username);
  const result = await syncRepos(c.env.DB, repos);
  return c.json(result);
});
