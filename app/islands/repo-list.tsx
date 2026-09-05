import { useReducer } from "hono/jsx";
import TagEditor from "./tag-editor";
import { apiFetch } from "../lib/api-fetch";
import {
  createInitialState,
  repoListReducer,
  selectBulkTagTarget,
  selectVisibleRepos,
  type FilterKey,
  type SortKey,
} from "../lib/repo-list-state";
import type { AdminRepo } from "../lib/repo";

interface Props {
  repos: AdminRepo[];
}

export default function RepoList({ repos: initialRepos }: Props) {
  const [state, dispatch] = useReducer(
    repoListReducer,
    createInitialState(initialRepos)
  );
  const { repos, selected, bulkTagInput, bulkSaving } = state;
  const { filters, sortKey, archiving, hiding } = state;

  const displayed = selectVisibleRepos(state);

  const toggleFilter = (filter: FilterKey) =>
    dispatch({ type: "setFilter", filter, value: !filters[filter] });

  const bulkAddTags = async () => {
    const target = selectBulkTagTarget(state);
    if (!target) return;

    dispatch({ type: "bulkTagsStarted" });
    let changes: { repoId: number; tags: string[] }[] | undefined;
    try {
      const res = await apiFetch("/admin/api/repos/bulk-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ repoIds: target.repoIds, tags: target.tags }),
      });
      const data = (await res.json()) as {
        updated: { repoId: number; tags: string[] }[];
      };
      changes = data.updated;
    } finally {
      dispatch({ type: "bulkTagsFinished", changes });
    }
  };

  const handleBulkKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      bulkAddTags();
    }
  };

  const handleArchive = async (repoId: number) => {
    dispatch({ type: "archiveStarted", repoId });
    let ok = false;
    try {
      const res = await apiFetch(`/admin/api/repos/${repoId}/archive`, {
        method: "POST",
        credentials: "same-origin",
      });
      ok = res.ok;
    } finally {
      dispatch({ type: "archiveFinished", repoId, ok });
    }
  };

  const toggleHide = async (repoId: number, hide: boolean) => {
    // 先に反映して戻りを待たせない。失敗したら reducer が元の値に戻す
    dispatch({ type: "hideStarted", repoId, hide });
    let ok = false;
    try {
      const res = await apiFetch(`/admin/api/repos/${repoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ hide }),
      });
      ok = res.ok;
    } finally {
      dispatch({ type: "hideFinished", repoId, ok });
    }
  };

  // TagEditorでタグ変更された時にローカルstateも更新
  const onTagsChange = (repoId: number, tags: string[]) => {
    dispatch({ type: "tagsChanged", repoId, tags });
  };

  return (
    <div>
      {/* ツールバー */}
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <label class="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.noTags}
            onChange={() => toggleFilter("noTags")}
          />
          タグなしのみ
        </label>

        <label class="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.archived}
            onChange={() => toggleFilter("archived")}
          />
          Archived表示
        </label>

        <label class="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hidden}
            onChange={() => toggleFilter("hidden")}
          />
          Hidden表示
        </label>

        <select
          value={sortKey}
          onChange={(e) =>
            dispatch({
              type: "setSortKey",
              sortKey: (e.target as HTMLSelectElement).value as SortKey,
            })
          }
          class="text-sm px-2 py-1 border rounded bg-white"
        >
          <option value="updated">Updated (new)</option>
          <option value="created">Created (new)</option>
          <option value="stars">Stars</option>
          <option value="name">Name (A-Z)</option>
        </select>

        <span class="text-sm text-gray-500">
          {displayed.length} / {repos.length} repos
        </span>
      </div>

      {/* 一括タグ追加バー */}
      {selected.size > 0 && (
        <div class="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded">
          <span class="text-sm font-medium">
            {selected.size} selected
          </span>
          <input
            type="text"
            value={bulkTagInput}
            onInput={(e) =>
              dispatch({
                type: "setBulkTagInput",
                value: (e.target as HTMLInputElement).value,
              })
            }
            onKeyDown={handleBulkKeyDown}
            placeholder="tag1, tag2, ..."
            class="text-sm px-2 py-1 border rounded flex-1 outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={bulkAddTags}
            disabled={bulkSaving}
            class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
          >
            {bulkSaving ? "Adding..." : "Add Tags"}
          </button>
        </div>
      )}

      {/* リポジトリ一覧 */}
      <div class="grid gap-4">
        {displayed.length > 0 && (
          <label class="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === displayed.length && displayed.length > 0}
              onChange={() => dispatch({ type: "toggleAll" })}
            />
            Select all
          </label>
        )}

        {displayed.map((repo) => (
          <div class="p-4 border rounded" key={repo.id}>
            <div class="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(repo.id)}
                onChange={() =>
                  dispatch({ type: "toggleSelect", repoId: repo.id })
                }
                class="mt-1.5 cursor-pointer"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between">
                  <div>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-lg font-semibold text-blue-600 hover:underline"
                    >
                      {repo.fullName}
                    </a>
                    {repo.isPrivate && (
                      <span class="ml-2 align-middle text-xs px-2 py-0.5 border border-amber-300 bg-amber-50 text-amber-700 rounded-full">
                        Private
                      </span>
                    )}
                    {repo.star && (
                      <span class="ml-2 align-middle text-xs px-2 py-0.5 border border-yellow-400 bg-yellow-50 text-yellow-700 rounded-full">
                        ★ Star
                      </span>
                    )}
                    {repo.hide && (
                      <span class="ml-2 align-middle text-xs px-2 py-0.5 border border-gray-300 bg-gray-100 text-gray-500 rounded-full">
                        Hidden
                      </span>
                    )}
                    {repo.description && (
                      <p class="text-gray-600 mt-1">{repo.description}</p>
                    )}
                  </div>
                  <div class="flex items-center gap-2 text-sm text-gray-500 shrink-0">
                    {repo.language && (
                      <span class="px-2 py-0.5 bg-gray-100 rounded">
                        {repo.language}
                      </span>
                    )}
                    {(repo.starCount ?? 0) > 0 && (
                      <span>★ {repo.starCount}</span>
                    )}
                  </div>
                </div>
                <TagEditor
                  repoId={repo.id}
                  initialTags={repo.tags}
                  onTagsChange={onTagsChange}
                />
                <div class="flex items-center justify-between mt-2">
                  <div class="flex items-center gap-3">
                    <div class="text-xs text-gray-400">
                      Updated: {new Date(repo.updatedAt).toLocaleDateString()}
                    </div>
                    <a
                      href={`/admin/repos/${repo.id}`}
                      class="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </a>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleHide(repo.id, !repo.hide)}
                      disabled={hiding.has(repo.id)}
                      title={
                        repo.hide
                          ? "トップページに戻す"
                          : "トップページから外す"
                      }
                      class={`text-xs px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 ${
                        repo.hide
                          ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          : "text-gray-400 hover:text-gray-800 hover:bg-gray-100"
                      }`}
                    >
                      {repo.hide ? "Unhide" : "Hide"}
                    </button>

                    {repo.archived ? (
                      <span class="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded">
                        Archived
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleArchive(repo.id)}
                        disabled={archiving.has(repo.id)}
                        class="text-xs px-2 py-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer disabled:opacity-50"
                      >
                        {archiving.has(repo.id) ? "Archiving..." : "Archive"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {displayed.length === 0 && (
          <div class="text-center py-12 text-gray-400">
            {filters.noTags
              ? <p>All repositories have tags.</p>
              : <p>No repositories yet. Click "Sync from GitHub" to fetch.</p>
            }
          </div>
        )}
      </div>
    </div>
  );
}
