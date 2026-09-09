import type { Scenario } from "./types";

/** まっさら。初回利用者が見るトップページ (カードなし、列は全部空) */
export const empty: Scenario = {
  name: "empty",
  description: "リポジトリが 1 件も無い状態のトップページ。カード欄は出ず、5 列とも No items",
  requiresAdmin: false,
  seeds: () => [],
  target: ({ scope }) => `/?scenario=${scope}`,
};
