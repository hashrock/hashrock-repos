import { createRoute } from "honox/factory";
import { updateRepoTagsWithSync } from "../../../../../lib/service";

export const PUT = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const { tags } = await c.req.json<{ tags: string[] }>();
  if (!Array.isArray(tags)) {
    return c.json({ error: "tags must be an array of strings" }, 400);
  }

  const result = await updateRepoTagsWithSync(c.env.DB, c.env.GITHUB_TOKEN, id, tags);
  return c.json({ ...result.data, githubSync: !result.githubSyncErrors?.length });
});
