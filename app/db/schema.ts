import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  fullName: text("full_name").notNull().unique(),
  url: text("url").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull(),
  language: text("language"),
  starCount: integer("star_count").default(0),
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
