import type { PropsScenario, RepoSeed } from "./types";
import { LOGO_SVG, daysAgo } from "./fixtures";

const seeds: RepoSeed[] = [
  {
    name: "notes-app",
    description: "Markdown のメモ帳。オフラインでも動く",
    language: "TypeScript",
    starCount: 42,
    homepage: "https://example.com/notes",
    tags: ["done", "web"],
    star: true,
    notes: "自分用に毎日使っている。\n次は共有リンクを付けたい",
    logoSvg: LOGO_SVG,
    updatedAt: daysAgo(1),
    createdAt: daysAgo(400),
  },
  {
    name: "gantt-cli",
    description: "ターミナルでガントチャートを描く CLI",
    language: "Rust",
    starCount: 7,
    tags: ["ongoing", "cli"],
    star: true,
    updatedAt: daysAgo(3),
    createdAt: daysAgo(120),
  },
  {
    name: "icon-editor",
    description: "ピクセルアイコンのエディタ",
    language: "TypeScript",
    starCount: 3,
    tags: ["ongoing"],
    updatedAt: daysAgo(5),
    createdAt: daysAgo(200),
  },
  {
    name: "secret-diary",
    description: "private なリポジトリ。homepage があるのでカードから開ける",
    language: "Go",
    isPrivate: true,
    homepage: "https://example.com/diary",
    tags: ["backlog"],
    updatedAt: daysAgo(8),
    createdAt: daysAgo(90),
  },
  {
    name: "blog",
    description: "静的サイトのブログ",
    language: "Astro",
    starCount: 1,
    tags: ["backlog"],
    updatedAt: daysAgo(13),
    createdAt: daysAgo(700),
  },
  {
    name: "old-chat-bot",
    description: null,
    language: "Python",
    tags: ["unfinished"],
    updatedAt: daysAgo(300),
    createdAt: daysAgo(900),
  },
  {
    name: "wasm-experiments",
    description: "WebAssembly を触ってみるためのリポジトリ",
    language: "Rust",
    tags: ["research", "wasm"],
    updatedAt: daysAgo(21),
    createdAt: daysAgo(60),
  },
  {
    name: "hono-template",
    description: "テンプレート",
    language: "TypeScript",
    tags: ["done"],
    updatedAt: daysAgo(40),
    createdAt: daysAgo(150),
  },
];

/** ふつうの利用状態。starred カードが 2 枚、各列に 1〜2 件 */
export const typical: PropsScenario = {
  kind: "props",
  name: "typical",
  description: "数件のリポジトリがある通常のトップページ。カード 2 枚 (メモ・ロゴ付き) と各列 1〜2 件、private が 1 件",
  seeds: () => seeds,
};
