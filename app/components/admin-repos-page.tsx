import SyncButton from "../islands/sync-button";
import RepoList from "../islands/repo-list";
import AdminNav from "./admin-nav";
import type { AdminRepo } from "../lib/repo";

/**
 * 管理画面の一覧。props だけで描けるので、本番の route と UI テスト用
 * シナリオ (撒いた分だけを見せるページ) の両方から使う。
 */
export default function AdminReposPage({ repos }: { repos: AdminRepo[] }) {
  return (
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
}
