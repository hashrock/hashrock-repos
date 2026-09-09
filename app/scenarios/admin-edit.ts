import type { DbScenario, RepoSeed } from "./types";
import { LOGO_SVG, daysAgo } from "./fixtures";

/** 個別編集ページ。全部の欄が埋まった 1 件を開く */
const seeds: RepoSeed[] = [
  {
    name: "fully-filled",
    description: "説明・メモ・タグ・ロゴ・homepage が全部入っている private リポジトリ",
    language: "TypeScript",
    starCount: 12,
    isPrivate: true,
    homepage: "https://example.com/fully-filled",
    tags: ["ongoing", "web", "design"],
    star: true,
    notes: "編集ページの初期値を確認するためのメモ。\n2 行目もある。",
    logoSvg: LOGO_SVG,
    updatedAt: daysAgo(1),
    createdAt: daysAgo(100),
  },
];

export const adminEdit: DbScenario = {
  kind: "db",
  name: "admin-edit",
  description: "個別編集ページ (/admin/repos/:id)。全項目が埋まった 1 件を開く。保存すると GitHub 同期は失敗する (架空の owner のため) が DB には入る",
  seeds: () => seeds,
  target: ({ repos }) => `/admin/repos/${repos[0].id}`,
};
