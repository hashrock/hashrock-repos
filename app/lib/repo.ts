/**
 * 管理画面が扱う repositories の 1 行 (listRepos の戻りに tags を足したもの)。
 *
 * スキーマから導出せず手で並べるのは、島に「使っていない列」まで型として
 * 持ち込まないため。列を増やしたときにここを直す手間は、その代わり。
 */
export interface AdminRepo {
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

/** 個別編集ページは一覧の列に加えて、手で編集する列も扱う */
export interface AdminRepoDetail extends AdminRepo {
  notes: string | null;
  coverImageKey: string | null;
  homepage: string | null;
  logoSvg: string | null;
}
