import { createRoute } from "honox/factory";
import { getRepoWithTags, updateRepoMeta } from "../../../../../lib/db";
import { SvgValidationError, normalizeLogoSvg } from "../../../../../lib/svg";

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
    logoSvg?: string | null;
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

  // 公開ページにインライン展開するので、保存前に必ずサニタイズを通す
  let logoSvg: string | null | undefined;
  if (body.logoSvg !== undefined) {
    if (body.logoSvg !== null && typeof body.logoSvg !== "string") {
      return c.json({ error: "logoSvg must be a string or null" }, 400);
    }
    try {
      logoSvg = normalizeLogoSvg(body.logoSvg);
    } catch (e) {
      if (e instanceof SvgValidationError) {
        return c.json({ error: e.message }, 400);
      }
      throw e;
    }
  }

  const repo = await updateRepoMeta(c.env.DB, id, { ...body, logoSvg });
  if (!repo) {
    return c.json({ error: "Repo not found" }, 404);
  }

  return c.json(repo);
});
