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
  createdAt: text("created_at"),
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
