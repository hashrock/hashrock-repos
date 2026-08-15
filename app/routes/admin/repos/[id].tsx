import { createRoute } from "honox/factory";
import { getRepoWithTags } from "../../../lib/db";
import RepoEditor from "../../../islands/repo-editor";
import AdminNav from "../../../components/admin-nav";

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
      <AdminNav
        crumbs={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/repos", label: "Repositories" },
        ]}
      />
      <RepoEditor repo={repo} />
    </div>
  );
});
