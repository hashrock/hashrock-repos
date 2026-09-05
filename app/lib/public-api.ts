import type { AdminRepoDetail } from "./repo";

export interface PublicRepo {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;
  /** GitHub のリポジトリ URL。private のときは null */
  repositoryUrl: string | null;
  homepage: string | null;
  /** リンク先として使うべき URL。homepage 優先、private で homepage が無ければ null */
  url: string | null;
  language: string | null;
  starCount: number;
  tags: string[];
  isPrivate: boolean;
  /** カバー画像の絶対 URL */
  image: string | null;
  /** ロゴ SVG の絶対 URL。<img> で参照すること */
  logo: string | null;
  updatedAt: string;
}

/**
 * 公開 API が読む列。管理画面の行から、公開してよいものだけを取る
 * (archived / star / hide は出さない)。
 */
export type RepoRow = Pick<
  AdminRepoDetail,
  | "id"
  | "name"
  | "fullName"
  | "url"
  | "description"
  | "updatedAt"
  | "language"
  | "starCount"
  | "isPrivate"
  | "notes"
  | "coverImageKey"
  | "homepage"
  | "logoSvg"
  | "tags"
>;

/**
 * 公開 API 用に整形する。出す情報は公開トップページと揃える。
 *
 * private リポジトリは star が付いていれば名前や説明を出すが、GitHub の
 * リポジトリ URL と fullName は出さない。訪問者には 404 にしかならない上、
 * リポジトリのパスを晒すことになるため (トップページのカードと同じ扱い)。
 */
export function toPublicRepo(repo: RepoRow, origin: string): PublicRepo {
  const isPrivate = repo.isPrivate ?? false;
  const repositoryUrl = isPrivate ? null : repo.url;

  return {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    notes: repo.notes,
    repositoryUrl,
    homepage: repo.homepage,
    url: repo.homepage || repositoryUrl,
    language: repo.language,
    starCount: repo.starCount ?? 0,
    tags: repo.tags,
    isPrivate,
    image: repo.coverImageKey ? `${origin}/images/${repo.coverImageKey}` : null,
    // 生の SVG は返さない。受け取った CMS がそのままインライン展開すると
    // 貼り付けた内容がその CMS のオリジンで動いてしまうため、URL で渡す
    logo: repo.logoSvg ? `${origin}/logos/${repo.id}` : null,
    updatedAt: repo.updatedAt,
  };
}

/** 更新が新しい順。CMS 側で並べ替えなくても使えるようにしておく */
export function sortByUpdatedDesc(repos: PublicRepo[]): PublicRepo[] {
  return [...repos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
