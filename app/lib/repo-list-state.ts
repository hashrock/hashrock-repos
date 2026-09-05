import { parseTagList } from "./tags";
import type { AdminRepo } from "./repo";

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
  repos: AdminRepo[];
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
  /**
   * hide/unhide リクエストが飛んでいる repo の id と、楽観更新する前の値。
   * 失敗したときは null も含めてこの値に戻す
   */
  hiding: Map<number, boolean | null>;
}

export type RepoListAction =
  | { type: "toggleSelect"; repoId: number }
  | { type: "toggleAll" }
  | { type: "setFilter"; filter: FilterKey; value: boolean }
  | { type: "setSortKey"; sortKey: SortKey }
  | { type: "setBulkTagInput"; value: string }
  | { type: "bulkTagsStarted" }
  /** 送信の後始末。changes が無ければ失敗したということ */
  | { type: "bulkTagsFinished"; changes?: { repoId: number; tags: string[] }[] }
  | { type: "tagsChanged"; repoId: number; tags: string[] }
  | { type: "archiveStarted"; repoId: number }
  | { type: "archiveFinished"; repoId: number; ok: boolean }
  /** 楽観更新。サーバの返事を待たずに hide を書き換える */
  | { type: "hideStarted"; repoId: number; hide: boolean }
  | { type: "hideFinished"; repoId: number; ok: boolean };

export function createInitialState(repos: AdminRepo[]): RepoListState {
  return {
    repos,
    selected: new Set(),
    bulkTagInput: "",
    bulkSaving: false,
    filters: { noTags: false, archived: false, hidden: false },
    sortKey: "updated",
    archiving: new Set(),
    hiding: new Map(),
  };
}

/** 対象の repo だけ差し替える。他の行はオブジェクトごと使い回す */
function updateRepo(
  repos: AdminRepo[],
  repoId: number,
  patch: Partial<AdminRepo>
): AdminRepo[] {
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
    case "bulkTagsFinished": {
      if (!action.changes) {
        return { ...state, bulkSaving: false };
      }
      const changed = new Map(action.changes.map((c) => [c.repoId, c.tags]));
      const repos = state.repos.map((r) => {
        const tags = changed.get(r.id);
        return tags ? { ...r, tags } : r;
      });
      return {
        ...state,
        repos,
        bulkTagInput: "",
        selected: new Set(),
        bulkSaving: false,
      };
    }
    case "tagsChanged":
      return {
        ...state,
        repos: updateRepo(state.repos, action.repoId, { tags: action.tags }),
      };
    case "archiveStarted":
      return { ...state, archiving: withId(state.archiving, action.repoId) };
    case "archiveFinished":
      return {
        ...state,
        repos: action.ok
          ? updateRepo(state.repos, action.repoId, { archived: true })
          : state.repos,
        archiving: withoutId(state.archiving, action.repoId),
      };
    case "hideStarted": {
      // 連打で 2 回目が飛んでも、控えるのは最初の値。上書きすると
      // 楽観更新した値を「元の値」として覚えてしまう
      const previous = state.hiding.has(action.repoId)
        ? state.hiding.get(action.repoId)!
        : (state.repos.find((r) => r.id === action.repoId)?.hide ?? null);
      const hiding = new Map(state.hiding).set(action.repoId, previous);
      return {
        ...state,
        repos: updateRepo(state.repos, action.repoId, { hide: action.hide }),
        hiding,
      };
    }
    case "hideFinished": {
      const hiding = new Map(state.hiding);
      const previous = hiding.get(action.repoId);
      hiding.delete(action.repoId);
      return {
        ...state,
        // 失敗したら、楽観更新する前の値をそのまま戻す
        repos:
          action.ok || previous === undefined
            ? state.repos
            : updateRepo(state.repos, action.repoId, { hide: previous }),
        hiding,
      };
    }
  }
}

export function sortRepos(
  list: AdminRepo[],
  key: SortKey
): AdminRepo[] {
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
export function selectVisibleRepos(state: RepoListState): AdminRepo[] {
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
