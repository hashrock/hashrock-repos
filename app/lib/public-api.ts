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
  logoSvg: string | null;
  updatedAt: string;
}

interface RepoRow {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  updatedAt: string;
  language: string | null;
  starCount: number | null;
  isPrivate: boolean | null;
  notes: string | null;
  coverImageKey: string | null;
  homepage: string | null;
  logoSvg: string | null;
  tags: string[];
}

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
    logoSvg: repo.logoSvg,
    updatedAt: repo.updatedAt,
  };
}

/** 更新が新しい順。CMS 側で並べ替えなくても使えるようにしておく */
export function sortByUpdatedDesc(repos: PublicRepo[]): PublicRepo[] {
  return [...repos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
