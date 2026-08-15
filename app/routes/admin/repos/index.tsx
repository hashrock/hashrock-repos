import { createRoute } from "honox/factory";
import { listRepos } from "../../../lib/db";
import SyncButton from "../../../islands/sync-button";
import RepoList from "../../../islands/repo-list";
import AdminNav from "../../../components/admin-nav";

export default createRoute(async (c) => {
  const repos = await listRepos(c.env.DB, {
    includePrivate: true,
    includeHidden: true,
    includeArchived: true,
  });

  return c.render(
    <div class="py-8 px-6 max-w-6xl mx-auto">
      <title>Repositories</title>
      <AdminNav crumbs={[{ href: "/admin", label: "Admin" }]} />
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Repositories</h1>
        <SyncButton />
      </div>
      <RepoList repos={repos} />
    </div>
  );
});
