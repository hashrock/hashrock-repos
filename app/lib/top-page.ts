import { KANBAN_COLUMNS, type KanbanColumn } from "./constants";
import type { AdminRepoDetail } from "./repo";

/** 公開トップページが 1 枚のカード / 列の 1 項目として読む列 */
export type TopPageRepo = Pick<
  AdminRepoDetail,
  | "id"
  | "name"
  | "url"
  | "description"
  | "notes"
  | "language"
  | "starCount"
  | "isPrivate"
  | "homepage"
  | "coverImageKey"
  | "logoSvg"
  | "tags"
> & { star: boolean | null };

export interface TopPageColumn {
  name: KanbanColumn;
  repos: TopPageRepo[];
}

export interface TopPageProps {
  /** star 付き。カードとして大きく出す */
  starred: TopPageRepo[];
  columns: TopPageColumn[];
  /** 管理者本人らしいか。編集リンクを出すかどうかだけに使う */
  signedIn: boolean;
}

/**
 * カードのリンク先。private リポジトリへのリンクは訪問者には 404 にしかならず、
 * 存在を晒すだけなので出さない。private は homepage があるときだけ開ける。
 */
export function cardHref(repo: {
  isPrivate: boolean | null
  homepage: string | null
  url: string
}): string | null {
  if (repo.isPrivate) {
    return repo.homepage || null
  }
  return repo.homepage || repo.url
}


/**
 * 公開トップページの描画に必要なものを組み立てる。DB は触らない。
 *
 * repos は「トップに出てよい候補」(hide でなく archived でもないもの。private は
 * 含む) を渡す。星付きはその中から取るので、別に問い合わせる必要はない。
 * 列に並ぶのは列名のタグが付いたものだけなので、タグも star も無い行は
 * どこにも出ない。
 */
export function buildTopPageProps(
  repos: TopPageRepo[],
  signedIn: boolean
): TopPageProps {
  return {
    starred: repos.filter((r) => r.star),
    columns: KANBAN_COLUMNS.map((name) => ({
      name,
      repos: repos.filter((r) => r.tags.includes(name)),
    })),
    signedIn,
  };
}

/** カンバン列名を除いた、カードに並べるタグ */
export function extraTags(tags: string[]): string[] {
  return tags.filter((t) => !(KANBAN_COLUMNS as readonly string[]).includes(t));
}

/**
 * 列名の日本語の添え書き。列名 (= タグ名) は英語のまま残し、意味だけ補う。
 * 開発者でない訪問者には Backlog / Research が何か分からない (所見 #6)。
 */
export const COLUMN_LABELS: Record<KanbanColumn, string> = {
  backlog: "構想中",
  ongoing: "進行中",
  unfinished: "中断中",
  done: "完成",
  research: "調査・実験",
};

/**
 * カードを押すとどこへ行くかの表示文言。カード全体がリンクなのに見た目で
 * 分からず、homepage 行きと GitHub 行きの区別も無かった (所見 #4, #5)。
 * リンクが無い (homepage の無い private) なら null。
 */
export function cardLinkLabel(repo: {
  isPrivate: boolean | null;
  homepage: string | null;
  url: string;
}): "GitHub で見る" | "サイトを開く" | null {
  const href = cardHref(repo);
  if (!href) return null;
  return href === repo.homepage ? "サイトを開く" : "GitHub で見る";
}

/** 絞り込みの照合対象。名前・説明・(列名を除いた) タグを小文字で結合する */
export function searchText(repo: Pick<TopPageRepo, "name" | "description" | "tags">): string {
  return [repo.name, repo.description ?? "", ...extraTags(repo.tags)]
    .join(" ")
    .toLowerCase();
}

/**
 * 絞り込み。空白区切りの語をすべて含むものだけ残す (AND)。大文字小文字は
 * 区別しない。query が空 (空白のみ) なら全部一致。
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack.toLowerCase();
  return terms.every((t) => text.includes(t));
}

/** トップに出る (カードか列に並ぶ) リポジトリの数。同じ行は 1 回だけ数える */
export function countVisibleRepos(props: Pick<TopPageProps, "starred" | "columns">): number {
  const ids = new Set<number>();
  for (const r of props.starred) ids.add(r.id);
  for (const c of props.columns) for (const r of c.repos) ids.add(r.id);
  return ids.size;
}
