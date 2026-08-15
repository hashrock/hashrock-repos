import { createRoute } from "honox/factory";
import { getRepoWithTags } from "../../../lib/db";
import RepoEditor from "../../../islands/repo-editor";

export default createRoute(async (c) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.notFound();
  }

  const repo = await getRepoWithTags(c.env.DB, id);
  if (!repo) {
    return c.notFound();
  }

  return c.render(
    <div class="py-8 px-6 max-w-3xl mx-auto">
      <title>{repo.fullName}</title>
      <a
        href="/admin/repos"
        class="text-sm text-gray-500 hover:text-gray-800 hover:underline"
      >
        ← Repositories
      </a>
      <RepoEditor repo={repo} />
    </div>
  );
});
