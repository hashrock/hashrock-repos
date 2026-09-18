// テスト用の D1 代替 (sqlite-d1.ts) が使う分だけの node:sqlite の型。
// @types/node を入れると Workers の型と衝突するので、必要な分だけ宣言する。
declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export interface StatementSync {
    all(...params: SQLInputValue[]): unknown[];
    run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
