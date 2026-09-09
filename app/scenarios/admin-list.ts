import type { RepoSeed, Scenario } from "./types";
import { daysAgo } from "./fixtures";

/** 管理画面の一覧。絞り込み (タグ無し / archived / hidden) と並び替えの材料を揃える */
const seeds: RepoSeed[] = [
  { name: "alpha", description: "star 数が一番多い", starCount: 999, tags: ["done", "web"], updatedAt: daysAgo(10), createdAt: daysAgo(30) },
  { name: "bravo", description: "一番新しく更新", starCount: 2, tags: ["ongoing"], updatedAt: daysAgo(0), createdAt: daysAgo(500) },
  { name: "charlie", description: "タグ無し (noTags 絞り込みの対象)", starCount: 0, updatedAt: daysAgo(3), createdAt: daysAgo(1) },
  { name: "delta", description: "archived (既定では隠れる)", archived: true, tags: ["backlog"], updatedAt: daysAgo(200), createdAt: daysAgo(800) },
  { name: "echo", description: "hidden (既定では隠れる)", hide: true, tags: ["research"], updatedAt: daysAgo(4), createdAt: daysAgo(40) },
  { name: "foxtrot", description: "private", isPrivate: true, tags: ["unfinished"], updatedAt: daysAgo(7), createdAt: daysAgo(70) },
  { name: "golf", description: "archived かつタグ無し", archived: true, updatedAt: daysAgo(365), createdAt: daysAgo(900) },
  { name: "hotel", description: "star 付き", star: true, tags: ["done"], starCount: 15, updatedAt: daysAgo(2), createdAt: daysAgo(20) },
];

export const adminList: Scenario = {
  name: "admin-list",
  description: "管理画面の一覧 (/admin/repos)。archived・hidden・タグ無し・private を含む 8 件で絞り込みと並び替えを試す",
  requiresAdmin: true,
  seeds: () => seeds,
  target: ({ scope }) => `/admin/repos?scenario=${scope}`,
};
