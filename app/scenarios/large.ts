import { KANBAN_COLUMNS } from "../lib/constants";
import type { RepoSeed, Scenario } from "./types";
import { LOGO_SVG, daysAgo } from "./fixtures";

const LONG_DESCRIPTION =
  "とても長い説明文。カンバンのカードでは 2 行で切れるはずで、starred カードでは全文が出る。" +
  "画面幅が狭いときに折り返しが崩れないか、日本語と English mixed text and a very-long-unbroken-token-" +
  "abcdefghijklmnopqrstuvwxyz0123456789 が混ざったときにどう見えるかを確認するための文章。";

const LONG_NOTES = [
  "# メモ (長文)",
  "",
  "- 1 行目: whitespace-pre-wrap で改行が保たれること",
  "- 2 行目: 空行を挟んでも詰まらないこと",
  "",
  "https://example.com/a/very/long/url/that/should/not/break/the/card/layout/because/it/has/no/spaces/at/all",
  "",
  "最後の行。ここまで全部出るはず。".repeat(6),
].join("\n");

/** 固定のタグ集合。実行のたびに tags テーブルが増えないように種類は増やさない */
const EXTRA_TAGS = [
  "web", "cli", "rust", "wasm", "ai", "design", "tooling", "infra",
  "experimental", "very-long-tag-name-to-test-wrapping",
] as const;

const LANGUAGES = ["TypeScript", "Rust", "Go", "Python", "Jupyter Notebook", null] as const;

function build(): RepoSeed[] {
  const seeds: RepoSeed[] = [];
  const count = 60;
  for (let i = 0; i < count; i++) {
    const column = KANBAN_COLUMNS[i % KANBAN_COLUMNS.length];
    const starred = i % 5 === 0; // 12 枚のカード
    const longName = i % 7 === 0;
    seeds.push({
      name: longName
        ? `extremely-long-repository-name-number-${i}-that-keeps-going-and-going`
        : `repo-${String(i).padStart(2, "0")}`,
      description: i % 3 === 0 ? LONG_DESCRIPTION : `${i} 番目のリポジトリ`,
      language: LANGUAGES[i % LANGUAGES.length],
      starCount: i % 4 === 0 ? 12345 : i,
      isPrivate: i % 11 === 0,
      homepage: i % 6 === 0 ? `https://example.com/${i}` : null,
      tags: [column, ...EXTRA_TAGS.slice(0, i % (EXTRA_TAGS.length + 1))],
      star: starred,
      notes: starred && i % 10 === 0 ? LONG_NOTES : null,
      logoSvg: i % 8 === 0 ? LOGO_SVG : null,
      updatedAt: daysAgo(i),
      createdAt: daysAgo(i + 100),
    });
  }
  return seeds;
}

/** 件数が多く、長文・長い名前・大量のタグが混ざる状態 */
export const large: Scenario = {
  name: "large",
  description: "60 件 (カード 12 枚、各列 12 件)。長い名前・長文の説明とメモ・10 個のタグ・5 桁の star 数でレイアウト崩れを見る",
  requiresAdmin: false,
  seeds: build,
  target: ({ scope }) => `/?scenario=${scope}`,
};
