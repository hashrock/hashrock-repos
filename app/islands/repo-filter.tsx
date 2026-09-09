import { useState } from "hono/jsx";
import { matchesQuery } from "../lib/top-page";

interface Props {
  /** トップに出ているリポジトリの数 (カードと列の重複を除いた数) */
  total: number;
}

/**
 * 公開トップページの絞り込み (所見 #2 の最小版)。
 * 描画はサーバ側 (TopPage) のまま、`data-search` を持つカードの hidden を
 * 切り替えるだけ。同じリポジトリがカードと列の両方に出ることがあるので
 * 件数は data-repo-id で数える。
 */
export default function RepoFilter({ total }: Props) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(total);

  const apply = (next: string) => {
    setQuery(next);
    const ids = new Set<string>();
    document.querySelectorAll<HTMLElement>("[data-search]").forEach((el) => {
      const ok = matchesQuery(el.dataset.search ?? "", next);
      el.hidden = !ok;
      if (ok && el.dataset.repoId) ids.add(el.dataset.repoId);
    });
    // 列の中身が全部隠れたら「一致なし」を出す
    document.querySelectorAll<HTMLElement>("[data-column]").forEach((col) => {
      const anyVisible = Array.from(col.querySelectorAll<HTMLElement>("[data-search]")).some((el) => !el.hidden);
      const empty = col.querySelector<HTMLElement>("[data-column-no-match]");
      if (empty) empty.hidden = anyVisible || next.trim() === "";
    });
    setShown(ids.size);
  };

  return (
    <div class="flex items-center gap-2">
      <input
        type="search"
        value={query}
        onInput={(e) => apply((e.target as HTMLInputElement).value)}
        placeholder="名前・説明・タグで絞り込み"
        aria-label="リポジトリを絞り込み"
        class="w-56 max-w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white outline-none focus:border-blue-400"
      />
      <span class="text-xs text-gray-500 whitespace-nowrap">
        {query.trim() ? `${shown} / ${total} 件` : `${total} 件`}
      </span>
    </div>
  );
}
