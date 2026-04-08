import { useState } from "hono/jsx";
import TagEditor from "./tag-editor";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  updatedAt: string;
  language: string | null;
  starCount: number | null;
  archived: boolean | null;
  createdAt: string | null;
  tags: string[];
}

interface Props {
  repos: Repo[];
}

type SortKey = "updated" | "stars" | "name" | "created";

function sortRepos(list: Repo[], key: SortKey): Repo[] {
  return [...list].sort((a, b) => {
    switch (key) {
      case "updated":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "created":
        return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      case "stars":
        return (b.starCount ?? 0) - (a.starCount ?? 0);
      case "name":
        return a.fullName.localeCompare(b.fullName);
    }
  });
}

export default function RepoList({ repos: initialRepos }: Props) {
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [filterNoTags, setFilterNoTags] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [archiving, setArchiving] = useState<Set<number>>(new Set());

  const filtered = repos
    .filter((r) => (filterNoTags ? r.tags.length === 0 : true))
    .filter((r) => (showArchived ? true : !r.archived));
  const displayed = sortRepos(filtered, sortKey);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((r) => r.id)));
    }
  };

  const bulkAddTags = async () => {
    const tagNames = bulkTagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tagNames.length === 0 || selected.size === 0) return;

    setBulkSaving(true);
    try {
      const res = await fetch("/admin/api/repos/bulk-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          repoIds: Array.from(selected),
          tags: tagNames,
        }),
      });
      const data = (await res.json()) as {
        updated: { repoId: number; tags: string[] }[];
      };

      // Update local state
      setRepos((prev) =>
        prev.map((r) => {
          const updated = data.updated.find((u) => u.repoId === r.id);
          return updated ? { ...r, tags: updated.tags } : r;
        })
      );
      setBulkTagInput("");
      setSelected(new Set());
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      bulkAddTags();
    }
  };

  const handleArchive = async (repoId: number) => {
    setArchiving((prev) => new Set(prev).add(repoId));
    try {
      const res = await fetch(`/admin/api/repos/${repoId}/archive`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok) {
        setRepos((prev) =>
          prev.map((r) => (r.id === repoId ? { ...r, archived: true } : r))
        );
      }
    } finally {
      setArchiving((prev) => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
    }
  };

  // TagEditorでタグ変更された時にローカルstateも更新
  const onTagsChange = (repoId: number, newTags: string[]) => {
    setRepos((prev) =>
      prev.map((r) => (r.id === repoId ? { ...r, tags: newTags } : r))
    );
  };

  return (
    <div>
      {/* ツールバー */}
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <label class="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filterNoTags}
            onChange={() => setFilterNoTags(!filterNoTags)}
          />
          タグなしのみ
        </label>

        <label class="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={() => setShowArchived(!showArchived)}
          />
          Archived表示
        </label>

        <select
          value={sortKey}
          onChange={(e) => setSortKey((e.target as HTMLSelectElement).value as SortKey)}
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
              setBulkTagInput((e.target as HTMLInputElement).value)
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
              onChange={toggleAll}
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
                onChange={() => toggleSelect(repo.id)}
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
                  <div class="text-xs text-gray-400">
                    Updated: {new Date(repo.updatedAt).toLocaleDateString()}
                  </div>
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
        ))}

        {displayed.length === 0 && (
          <div class="text-center py-12 text-gray-400">
            {filterNoTags
              ? <p>All repositories have tags.</p>
              : <p>No repositories yet. Click "Sync from GitHub" to fetch.</p>
            }
          </div>
        )}
      </div>
    </div>
  );
}
