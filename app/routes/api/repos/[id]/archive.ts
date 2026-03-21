import { createRoute } from "honox/factory";
import { archiveRepoWithSync } from "../../../../lib/service";

export const POST = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const result = await archiveRepoWithSync(c.env.DB, c.env.GITHUB_TOKEN, id);
  return c.json({ ...result.data, githubSync: !result.githubSyncErrors?.length });
});
