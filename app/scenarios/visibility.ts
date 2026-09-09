import type { PropsScenario, RepoSeed } from "./types";
import { daysAgo } from "./fixtures";

/**
 * 公開トップページに「出る / 出ない」の境界を一通り並べる。
 * 期待される見え方は各項目の description に書いてある。
 */
const seeds: RepoSeed[] = [
  {
    name: "shown-star-and-column",
    description: "出る: star 付きで done 列にもある → カードと done 列の両方",
    tags: ["done"],
    star: true,
    updatedAt: daysAgo(1),
  },
  {
    name: "shown-star-only",
    description: "出る: star だけでタグ無し → カードのみ、列には出ない",
    star: true,
    updatedAt: daysAgo(2),
  },
  {
    name: "shown-private-star-no-homepage",
    description: "出る: private + star、homepage 無し → カードは出るがクリック不可、鍵アイコン",
    isPrivate: true,
    star: true,
    updatedAt: daysAgo(3),
  },
  {
    name: "shown-private-with-homepage",
    description: "出る: private で homepage あり、backlog 列 → 鍵アイコン付きで homepage へ飛べる",
    isPrivate: true,
    homepage: "https://example.com/private",
    tags: ["backlog"],
    updatedAt: daysAgo(4),
  },
  {
    name: "shown-bare-minimum",
    description: null,
    tags: ["research"],
    updatedAt: daysAgo(5),
  },
  {
    name: "hidden-hide-flag",
    description: "出ない: hide が立っている (star があっても)",
    tags: ["ongoing"],
    star: true,
    hide: true,
    updatedAt: daysAgo(6),
  },
  {
    name: "hidden-archived",
    description: "出ない: archived (列タグがあっても)",
    tags: ["ongoing"],
    archived: true,
    updatedAt: daysAgo(7),
  },
  {
    name: "hidden-private-untagged",
    description: "出ない: private でタグも star も無い",
    isPrivate: true,
    updatedAt: daysAgo(8),
  },
  {
    name: "hidden-public-untagged",
    description: "出ない: public だが列タグも star も無い",
    tags: ["web"],
    updatedAt: daysAgo(9),
  },
];

export const visibility: PropsScenario = {
  kind: "props",
  name: "visibility",
  description: "公開トップに出る/出ないの境界。出るのは shown-* の 5 件だけ、hidden-* の 4 件は出ない",
  seeds: () => seeds,
};
