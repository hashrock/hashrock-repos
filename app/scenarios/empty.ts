import type { PropsScenario } from "./types";

/** まっさら。初回利用者が見るトップページ (カードなし、列は全部空) */
export const empty: PropsScenario = {
  kind: "props",
  name: "empty",
  description: "リポジトリが 1 件も無い状態のトップページ。カード欄は出ず、5 列とも No items",
  seeds: () => [],
};
