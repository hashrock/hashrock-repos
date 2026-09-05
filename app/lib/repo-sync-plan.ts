import type { GitHubRepo } from "./github";

/** 突き合わせに使う既存行。sync が見る列だけ */
export interface ExistingRepoRow {
  id: number;
  githubId: number | null;
  fullName: string;
}

export interface RepoSyncPlan {
  /** GitHub から消えた (削除 / 非公開化など) 行の id */
  deleteIds: number[];
  /** 既存行の更新。rowId は repositories.id */
  updates: { rowId: number; repo: GitHubRepo }[];
  /** 新規挿入 */
  inserts: GitHubRepo[];
}

/**
 * GitHub の応答と DB の既存行を突き合わせて、何を消し・何を更新し・何を足すかを決める。
 *
 * 行を消す判断が入るので、ここだけは DB を触らない純粋な関数にしてある。
 * 突き合わせ規則:
 *
 *   1. 不変の github_id が一致する行。リネームやオーナー変更でも同じ行を指す
 *   2. github_id が未登録 (nullable) の行だけ、full_name でも拾って埋め戻す。
 *      既に別の github_id が入っている行を横取りしないため条件を付けている
 *   3. どちらでも当たらなければ新規
 *
 * どのエントリからも指されなかった行が deleteIds になる。
 *
 * 適用は **deleteIds → updates → inserts の順** で行うこと。full_name には
 * UNIQUE 制約があり、名前を手放す側 (削除・リネーム) を先に片付けないと、
 * 名前を引き継ぐ側の書き込みが衝突する。updates 自体も、名前を手放す更新が
 * 先に来るように並べ替えて返す。どちらもプロパティで固定してある。
 *
 * 残る危険は名前の **循環** だけ (A を B の名前に、B を A の名前に、といった
 * 入れ替え)。これは一時的な名前を経由しない限りどう並べても衝突するので、
 * ここでは並べ替えず、そのまま返して衝突させる。
 */
export function planRepoSync(
  existing: ExistingRepoRow[],
  incoming: GitHubRepo[]
): RepoSyncPlan {
  const byGithubId = new Map<number, ExistingRepoRow>();
  const byFullName = new Map<string, ExistingRepoRow>();
  for (const row of existing) {
    if (row.githubId !== null) {
      byGithubId.set(row.githubId, row);
    }
    byFullName.set(row.fullName, row);
  }

  const touched = new Set<number>();
  const updates: { rowId: number; repo: GitHubRepo }[] = [];
  const inserts: GitHubRepo[] = [];

  for (const repo of incoming) {
    const byName = byFullName.get(repo.full_name);
    const row =
      byGithubId.get(repo.id) ??
      (byName?.githubId === null ? byName : undefined);

    if (row) {
      touched.add(row.id);
      updates.push({ rowId: row.id, repo });
    } else {
      inserts.push(repo);
    }
  }

  return {
    deleteIds: existing.filter((r) => !touched.has(r.id)).map((r) => r.id),
    updates: orderUpdates(updates, existing, touched),
    inserts,
  };
}

/**
 * 更新を「その時点で名前が空いているもの」から順に並べ替える。
 *
 * 削除される行の名前は最初から空いている扱いにしてよい (先に消すため)。
 * どれも空いていない = 名前が循環しているので、残りはそのまま後ろに付ける。
 */
function orderUpdates(
  updates: { rowId: number; repo: GitHubRepo }[],
  existing: ExistingRepoRow[],
  touched: Set<number>
): { rowId: number; repo: GitHubRepo }[] {
  // 削除されずに残る行が、いま押さえている名前
  const holder = new Map<string, number>();
  for (const row of existing) {
    if (touched.has(row.id)) {
      holder.set(row.fullName, row.id);
    }
  }

  const pending = [...updates];
  const ordered: { rowId: number; repo: GitHubRepo }[] = [];

  while (pending.length > 0) {
    const i = pending.findIndex(({ rowId, repo }) => {
      const held = holder.get(repo.full_name);
      return held === undefined || held === rowId;
    });
    if (i === -1) {
      // 循環。残りは順不同で返す
      return [...ordered, ...pending];
    }
    const [next] = pending.splice(i, 1);
    const previous = existing.find((r) => r.id === next.rowId);
    if (previous) {
      holder.delete(previous.fullName);
    }
    holder.set(next.repo.full_name, next.rowId);
    ordered.push(next);
  }

  return ordered;
}
