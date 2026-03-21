import { createRoute } from "honox/factory";
import { bulkAddTagsWithSync } from "../../../lib/service";

export const POST = createRoute(async (c) => {
  const { repoIds, tags } = await c.req.json<{
    repoIds: number[];
    tags: string[];
  }>();

  if (!Array.isArray(repoIds) || !Array.isArray(tags)) {
    return c.json({ error: "repoIds and tags must be arrays" }, 400);
  }

  const result = await bulkAddTagsWithSync(c.env.DB, c.env.GITHUB_TOKEN, repoIds, tags);
  return c.json({ updated: result.data });
});
