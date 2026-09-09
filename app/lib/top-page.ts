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
