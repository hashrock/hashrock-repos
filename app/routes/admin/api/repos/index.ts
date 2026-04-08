import { createRoute } from "honox/factory";
import { listRepos } from "../../../../lib/db";
import { syncReposFromGitHub } from "../../../../lib/service";

export const GET = createRoute(async (c) => {
  const repos = await listRepos(c.env.DB);
  return c.json(repos);
});

export const POST = createRoute(async (c) => {
  const token = c.env.GITHUB_TOKEN;
  if (!token) {
    return c.json({ error: "GITHUB_TOKEN is not configured" }, 500);
  }

  const { username } = await c.req.json<{ username: string }>();
  if (!username) {
    return c.json({ error: "username is required" }, 400);
  }

  const result = await syncReposFromGitHub(c.env.DB, token, username);
  return c.json(result.data);
});
