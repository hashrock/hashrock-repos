import { createRoute } from "honox/factory";
import {
  ImageValidationError,
  deleteCoverImage,
  putCoverImage,
} from "../../../../../lib/images";
import { getRepoById } from "../../../../../lib/db";

/**
 * 管理画面のプレビュー用。公開側の /images/:key は hide や star 解除で
 * 404 になるため、オーナーが自分で確認できる経路を Access 配下に置く。
 */
export const GET = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const repo = await getRepoById(c.env.DB, id);
  if (!repo?.coverImageKey) {
    return c.notFound();
  }

  const object = await c.env.IMAGES.get(repo.coverImageKey);
  if (!object) {
    return c.notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=60");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
});

export const POST = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }

  try {
    const result = await putCoverImage(c.env.DB, c.env.IMAGES, id, file);
    return c.json(result);
  } catch (e) {
    if (e instanceof ImageValidationError) {
      return c.json({ error: e.message }, 400);
    }
    throw e;
  }
});

export const DELETE = createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid repo id" }, 400);
  }

  await deleteCoverImage(c.env.DB, c.env.IMAGES, id);
  return c.json({ repoId: id, coverImageKey: null });
});
