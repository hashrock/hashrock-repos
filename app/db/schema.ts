import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // GitHub API が返す不変の数値 ID。リネーム/オーナー変更でも変わらないので同期のキーにする。
  // 既存レコードに埋め戻すため初回は nullable。次回 sync 後は全行で埋まる想定。
  githubId: integer("github_id").unique(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull().unique(),
  url: text("url").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull(),
  language: text("language"),
  starCount: integer("star_count").default(0),
  archived: integer("archived", { mode: "boolean" }).default(false),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  createdAt: text("created_at"),
  // 手書きのメモ。star したリポジトリは公開カードにも表示される
  notes: text("notes"),
  // star = 「公開トップに大きく出してよい」の意思表示。private でも出る
  star: integer("star", { mode: "boolean" }).default(false),
  // hide = 公開トップから完全に外す。star より強い
  hide: integer("hide", { mode: "boolean" }).default(false),
  // R2 のオブジェクトキー。/images/{key} で配信する
  coverImageKey: text("cover_image_key"),
  // GitHub の homepage。カードのリンク先はここを優先し、無ければ url に落とす
  homepage: text("homepage"),
  // 手で貼り付けた SVG マークアップ。カードにインラインで描画する
  logoSvg: text("logo_svg"),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const repositoryTags = sqliteTable(
  "repository_tags",
  {
    repositoryId: integer("repository_id")
      .notNull()
      .references(() => repositories.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.tagId] })]
);
