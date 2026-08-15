import { createRoute } from "honox/factory";
import {
  ImageValidationError,
  deleteCoverImage,
  putCoverImage,
} from "../../../../lib/images";

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
