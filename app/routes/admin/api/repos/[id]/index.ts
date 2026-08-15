import { createRoute } from "honox/factory";
import { getRepoWithTags, updateRepoMeta } from "../../../../../lib/db";

export const GET = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const repo = await getRepoWithTags(c.env.DB, id);
  if (!repo) {
    return c.json({ error: "Repo not found" }, 404);
  }

  return c.json(repo);
});

export const PATCH = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const body = await c.req.json<{
    notes?: string | null;
    star?: boolean;
    hide?: boolean;
  }>();

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
    return c.json({ error: "notes must be a string or null" }, 400);
  }
  if (body.star !== undefined && typeof body.star !== "boolean") {
    return c.json({ error: "star must be a boolean" }, 400);
  }
  if (body.hide !== undefined && typeof body.hide !== "boolean") {
    return c.json({ error: "hide must be a boolean" }, 400);
  }

  const repo = await updateRepoMeta(c.env.DB, id, body);
  if (!repo) {
    return c.json({ error: "Repo not found" }, 404);
  }

  return c.json(repo);
});
