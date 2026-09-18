import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import signupSnapshotsSql from "../../../drizzle/migrations/0007_signup_snapshots.sql?raw";

/**
 * テスト用に node:sqlite の上へ D1Database の一部 (drizzle-orm/d1 が使う分) を載せる。
 * upsert のように SQL の意味そのものを確かめたいテストで、モックの代わりに使う。
 */
export function createSqliteD1(migrations: string[]): D1Database {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations) {
    for (const stmt of migration.split("--> statement-breakpoint")) {
      if (stmt.trim()) db.exec(stmt);
    }
  }

  const statement = (query: string, params: unknown[] = []) => {
    const args = params as SQLInputValue[];
    const all = () => db.prepare(query).all(...args) as Record<string, unknown>[];
    return {
      bind: (...values: unknown[]) => statement(query, values),
      all: async () => ({ results: all(), success: true, meta: {} }),
      raw: async () => all().map((row) => Object.values(row)),
      first: async (col?: string) => {
        const row = all()[0];
        return row === undefined ? null : col ? row[col] : row;
      },
      run: async () => {
        const info = db.prepare(query).run(...args);
        return { results: [], success: true, meta: { changes: Number(info.changes) } };
      },
    };
  };

  return {
    prepare: (query: string) => statement(query),
    batch: async (stmts: ReturnType<typeof statement>[]) => {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const s of stmts) results.push(await s.all());
        db.exec("COMMIT");
        return results;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    exec: async (query: string) => {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

/** signup_snapshots だけを持つ D1 */
export function createSignupSnapshotsD1(): D1Database {
  return createSqliteD1([signupSnapshotsSql]);
}
