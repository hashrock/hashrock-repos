import { parseTagList } from "./tags";

/** 管理画面の一覧が扱う 1 行。listRepos の戻りに tags を足したもの */
export interface RepoListItem {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  updatedAt: string;
  language: string | null;
  starCount: number | null;
  archived: boolean | null;
  isPrivate: boolean | null;
  createdAt: string | null;
  star: boolean | null;
  hide: boolean | null;
  tags: string[];
}

export type SortKey = "updated" | "stars" | "name" | "created";

export type FilterKey = "noTags" | "archived" | "hidden";

export interface RepoListFilters {
  /** タグが付いていない repo だけに絞る */
  noTags: boolean;
  /** archived な repo も表示する */
  archived: boolean;
  /** hide した repo も表示する */
  hidden: boolean;
}

export interface RepoListState {
  repos: RepoListItem[];
  /**
   * チェックを入れた repo の id。絞り込みを変えて表示から外れても保持する
   * (チェックしてから一覧を絞っただけで選択が消えると使いづらいため)。
   */
  selected: Set<number>;
  bulkTagInput: string;
  bulkSaving: boolean;
  filters: RepoListFilters;
  sortKey: SortKey;
  /** archive リクエストが飛んでいる repo の id */
  archiving: Set<number>;
  /** hide/unhide リクエストが飛んでいる repo の id */
  hiding: Set<number>;
}

export type RepoListAction =
  | { type: "toggleSelect"; repoId: number }
  | { type: "toggleAll" }
  | { type: "setFilter"; filter: FilterKey; value: boolean }
  | { type: "setSortKey"; sortKey: SortKey }
  | { type: "setBulkTagInput"; value: string }
  | { type: "bulkTagsStarted" }
  | { type: "bulkTagsApplied"; changes: { repoId: number; tags: string[] }[] }
  | { type: "bulkTagsSettled" }
  | { type: "tagsChanged"; repoId: number; tags: string[] }
  | { type: "archiveStarted"; repoId: number }
  | { type: "archived"; repoId: number }
  | { type: "archiveSettled"; repoId: number }
  /** 楽観更新。サーバの返事を待たずに hide を書き換える */
  | { type: "hideStarted"; repoId: number; hide: boolean }
  /** 楽観更新の取り消し。hide には戻したい値を入れる */
  | { type: "hideRolledBack"; repoId: number; hide: boolean }
  | { type: "hideSettled"; repoId: number };

export function createInitialState(repos: RepoListItem[]): RepoListState {
  return {
    repos,
    selected: new Set(),
    bulkTagInput: "",
    bulkSaving: false,
    filters: { noTags: false, archived: false, hidden: false },
    sortKey: "updated",
    archiving: new Set(),
    hiding: new Set(),
  };
}

/** 対象の repo だけ差し替える。他の行はオブジェクトごと使い回す */
function updateRepo(
  repos: RepoListItem[],
  repoId: number,
  patch: Partial<RepoListItem>
): RepoListItem[] {
  return repos.map((r) => (r.id === repoId ? { ...r, ...patch } : r));
}

function withId(set: Set<number>, id: number): Set<number> {
  return new Set(set).add(id);
}

function withoutId(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  next.delete(id);
  return next;
}

export function repoListReducer(
  state: RepoListState,
  action: RepoListAction
): RepoListState {
  switch (action.type) {
    case "toggleSelect": {
      const selected = state.selected.has(action.repoId)
        ? withoutId(state.selected, action.repoId)
        : withId(state.selected, action.repoId);
      return { ...state, selected };
    }
    case "toggleAll": {
      const displayed = selectVisibleRepos(state);
      const selected =
        state.selected.size === displayed.length
          ? new Set<number>()
          : new Set(displayed.map((r) => r.id));
      return { ...state, selected };
    }
    case "setFilter":
      return {
        ...state,
        filters: { ...state.filters, [action.filter]: action.value },
      };
    case "setSortKey":
      return { ...state, sortKey: action.sortKey };
    case "setBulkTagInput":
      return { ...state, bulkTagInput: action.value };
    case "bulkTagsStarted":
      return { ...state, bulkSaving: true };
    case "bulkTagsApplied": {
      const changed = new Map(action.changes.map((c) => [c.repoId, c.tags]));
      const repos = state.repos.map((r) => {
        const tags = changed.get(r.id);
        return tags ? { ...r, tags } : r;
      });
      return { ...state, repos, bulkTagInput: "", selected: new Set() };
    }
    case "bulkTagsSettled":
      return { ...state, bulkSaving: false };
    case "tagsChanged":
      return {
        ...state,
        repos: updateRepo(state.repos, action.repoId, { tags: action.tags }),
      };
    case "archiveStarted":
      return { ...state, archiving: withId(state.archiving, action.repoId) };
    case "archived":
      return {
        ...state,
        repos: updateRepo(state.repos, action.repoId, { archived: true }),
      };
    case "archiveSettled":
      return { ...state, archiving: withoutId(state.archiving, action.repoId) };
    case "hideStarted":
      return {
        ...state,
        repos: updateRepo(state.repos, action.repoId, { hide: action.hide }),
        hiding: withId(state.hiding, action.repoId),
      };
    case "hideRolledBack":
      return {
        ...state,
        repos: updateRepo(state.repos, action.repoId, { hide: action.hide }),
      };
    case "hideSettled":
      return { ...state, hiding: withoutId(state.hiding, action.repoId) };
  }
}

export function sortRepos(
  list: RepoListItem[],
  key: SortKey
): RepoListItem[] {
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

/** 絞り込みと並べ替えを適用した、実際に画面に出る行 */
export function selectVisibleRepos(state: RepoListState): RepoListItem[] {
  const filtered = state.repos.filter(
    (r) =>
      (!state.filters.noTags || r.tags.length === 0) &&
      (state.filters.archived || !r.archived) &&
      (state.filters.hidden || !r.hide)
  );
  return sortRepos(filtered, state.sortKey);
}

/**
 * 一括タグ追加の対象。入力が空、または 1 件も選択されていなければ null。
 */
export function selectBulkTagTarget(
  state: RepoListState
): { repoIds: number[]; tags: string[] } | null {
  const tags = parseTagList(state.bulkTagInput);
  if (tags.length === 0 || state.selected.size === 0) {
    return null;
  }
  return { repoIds: Array.from(state.selected), tags };
}
