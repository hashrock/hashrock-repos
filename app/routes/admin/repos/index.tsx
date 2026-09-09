import { createRoute } from "honox/factory";
import { listRepos } from "../../../lib/db";
import AdminReposPage from "../../../components/admin-repos-page";

export default createRoute(async (c) => {
  const repos = await listRepos(c.env.DB, {
    includePrivate: true,
    includeHidden: true,
    includeArchived: true,
  });

  return c.render(<AdminReposPage repos={repos} />);
});
