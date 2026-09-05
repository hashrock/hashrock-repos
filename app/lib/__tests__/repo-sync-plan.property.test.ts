import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  planRepoSync,
  type ExistingRepoRow,
  type RepoSyncPlan,
} from "../repo-sync-plan";
import type { GitHubRepo } from "../github";
import { githubRepo as githubRepoFixture } from "./github-fixtures";

/**
 * sync の突き合わせの property-based test。
 *
 * ここは唯一「DB の行を消す」判断をする場所で、間違えるとメモ・star・
 * 画像といった GitHub に無い情報ごと消える。例示テストで踏めるのは
 * 「新規」「更新」「削除」の代表例だけなので、リネーム・名前の使い回し・
 * github_id 未登録の移行期の行が混ざった状態を自動で組ませる。
 *
 * 生成器の要は **名前と github_id を独立に振る** こと。両者を連動させると
 * 「名前は当たるが github_id は別のリポジトリのもの」という、フォールバックが
 * 行を横取りしうる唯一の状況を作れず、条件を外す変異を検出できない。
 * ただし DB の一意制約 (id / github_id / full_name) は必ず守る。制約を破った
 * 入力で反例を出しても、実在しない状況の話になってしまうため。
 */

const SLOTS = 4;
const githubIdOf = (slot: number) => 1000 + slot;
const fullNameOf = (slot: number) => `u/repo${slot}`;
/** GitHub 側にはもう無い名前と id。既存行にだけ現れる */
const staleNameOf = (slot: number) => `u/old${slot}`;
const staleIdOf = (slot: number) => 9000 + slot;

const NAMES = [
  ...Array.from({ length: SLOTS }, (_, i) => fullNameOf(i)),
  ...Array.from({ length: SLOTS }, (_, i) => staleNameOf(i)),
];
const GITHUB_IDS = [
  ...Array.from({ length: SLOTS }, (_, i) => githubIdOf(i)),
  ...Array.from({ length: SLOTS }, (_, i) => staleIdOf(i)),
];

function githubRepo(slot: number): GitHubRepo {
  return githubRepoFixture({
    id: githubIdOf(slot),
    name: `repo${slot}`,
    full_name: fullNameOf(slot),
    html_url: `https://github.com/${fullNameOf(slot)}`,
  });
}

/**
 * 既存行。full_name と github_id は独立に、どちらも重複しないように振る。
 * github_id は移行期の行を作るため一部を null に落とす。
 */
const existingArb: fc.Arbitrary<ExistingRepoRow[]> = fc
  .tuple(
    fc.shuffledSubarray(NAMES, { maxLength: SLOTS + 1 }),
    // 名前より必ず多く用意しておき、名前の数だけ先頭から使う
    fc.shuffledSubarray(GITHUB_IDS, { minLength: SLOTS + 1 }),
    fc.array(fc.boolean(), { minLength: SLOTS + 1, maxLength: SLOTS + 1 })
  )
  .map(([names, githubIds, unregistered]) =>
    names.map((fullName, i) => ({
      id: i + 1,
      githubId: unregistered[i] ? null : githubIds[i],
      fullName,
    }))
  );

const incomingArb: fc.Arbitrary<GitHubRepo[]> = fc
  .uniqueArray(fc.nat({ max: SLOTS - 1 }), { maxLength: SLOTS })
  .map((slots) => slots.map(githubRepo));

const scenarioArb = fc.record({
  existing: existingArb,
  incoming: incomingArb,
});

const RUNS = 1000;

function updatedRowIds(plan: RepoSyncPlan): number[] {
  return plan.updates.map((u) => u.rowId);
}

/**
 * プランを適用した後の DB を再現する。冪等性と挿入の安全性を見るために必要で、
 * db.ts と同じ「削除 → 更新 → 挿入」の順で組む。
 */
function applyPlan(
  existing: ExistingRepoRow[],
  plan: RepoSyncPlan
): ExistingRepoRow[] {
  const rows = new Map(existing.map((r) => [r.id, r]));
  for (const id of plan.deleteIds) {
    rows.delete(id);
  }
  for (const { rowId, repo } of plan.updates) {
    rows.set(rowId, { id: rowId, githubId: repo.id, fullName: repo.full_name });
  }
  let nextId = Math.max(0, ...existing.map((r) => r.id)) + 1;
  for (const repo of plan.inserts) {
    const id = nextId++;
    rows.set(id, { id, githubId: repo.id, fullName: repo.full_name });
  }
  return [...rows.values()];
}

/** 生き残る行が、削除を済ませた時点で押さえている名前 */
function initialHolders(
  existing: ExistingRepoRow[],
  plan: RepoSyncPlan
): Map<string, number> {
  const deleted = new Set(plan.deleteIds);
  const holder = new Map<string, number>();
  for (const row of existing) {
    if (!deleted.has(row.id)) {
      holder.set(row.fullName, row.id);
    }
  }
  return holder;
}

/** updates を返ってきた順に当てて、full_name の UNIQUE 制約に触れるか */
function collidesWhenApplied(
  existing: ExistingRepoRow[],
  plan: RepoSyncPlan
): boolean {
  const holder = initialHolders(existing, plan);
  const nameOf = new Map(existing.map((r) => [r.id, r.fullName]));
  for (const { rowId, repo } of plan.updates) {
    const held = holder.get(repo.full_name);
    if (held !== undefined && held !== rowId) {
      return true;
    }
    holder.delete(nameOf.get(rowId)!);
    holder.set(repo.full_name, rowId);
  }
  return false;
}

/**
 * 名前の取り合いが循環しているか。
 *
 * 「この更新は、目的の名前をいま押さえている行が動くまで待つ」という依存は
 * 行ごとに高々 1 本なので、各点から辿って自分に戻るかを見れば足りる。
 * 循環していなければ必ず当てられる順があり、していればどう並べても詰む。
 */
function hasNameCycle(
  existing: ExistingRepoRow[],
  plan: RepoSyncPlan
): boolean {
  const holder = initialHolders(existing, plan);
  const targetOf = new Map(plan.updates.map((u) => [u.rowId, u.repo.full_name]));
  const blocker = (rowId: number): number | undefined => {
    const held = holder.get(targetOf.get(rowId)!);
    return held === undefined || held === rowId ? undefined : held;
  };

  return plan.updates.some(({ rowId }) => {
    let cursor = blocker(rowId);
    for (let step = 0; cursor !== undefined && step <= plan.updates.length; step++) {
      if (cursor === rowId) return true;
      cursor = blocker(cursor);
    }
    return false;
  });
}

describe("planRepoSync の不変条件", () => {
  it("GitHub が返した 1 件は、更新か挿入のどちらかちょうど一方になる", () => {
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const plan = planRepoSync(existing, incoming);
        const handled = [
          ...plan.updates.map((u) => u.repo),
          ...plan.inserts,
        ].map((r) => r.id);
        expect(handled.sort()).toEqual(incoming.map((r) => r.id).sort());
      }),
      { numRuns: RUNS }
    );
  });

  it("既存行は「更新される」か「消される」のどちらかちょうど一方", () => {
    // id は一意なので、この 1 本で 3 つを同時に押さえている:
    // 更新した行を消さない (更新したばかりの行が同じ sync で消え、メモや
    // star が道連れになる)、2 件の repo が同じ行を取り合わない (単射)、
    // どの行も分類から漏れない
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const plan = planRepoSync(existing, incoming);
        const classified = [...updatedRowIds(plan), ...plan.deleteIds].sort();
        expect(classified).toEqual(existing.map((r) => r.id).sort());
      }),
      { numRuns: RUNS }
    );
  });

  it("github_id が一致する行は、名前が変わっていても同じ行を指す", () => {
    // リネームやオーナー変更で行を作り直すと、手で書いた列が消える
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const byGithubId = new Map(
          existing.filter((r) => r.githubId !== null).map((r) => [r.githubId, r])
        );
        const plan = planRepoSync(existing, incoming);
        for (const { rowId, repo } of plan.updates) {
          const match = byGithubId.get(repo.id);
          if (match) {
            expect(rowId).toBe(match.id);
          }
        }
        for (const repo of plan.inserts) {
          expect(byGithubId.has(repo.id)).toBe(false);
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("github_id が入っている行は full_name では横取りされない", () => {
    // 名前を使い回した別のリポジトリが、既存行を乗っ取らないこと。
    // 乗っ取ると、無関係なリポジトリのメモや画像が引き継がれてしまう
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const byId = new Map(existing.map((r) => [r.id, r]));
        for (const { rowId, repo } of planRepoSync(existing, incoming).updates) {
          const row = byId.get(rowId)!;
          expect(row.githubId === repo.id || row.githubId === null).toBe(true);
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("削除と更新を先に済ませれば、挿入は必ず名前で衝突しない", () => {
    // db.ts が「削除 → 更新 → 挿入」の順で書く根拠。名前を手放す側を
    // 先に片付ければ、UNIQUE 制約に当たらない
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const plan = planRepoSync(existing, incoming);
        const taken = new Set(
          applyPlan(existing, { ...plan, inserts: [] }).map((r) => r.fullName)
        );
        for (const repo of plan.inserts) {
          expect(taken.has(repo.full_name)).toBe(false);
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("更新の並びは、名前が循環しているときしか衝突しない", () => {
    // 名前を手放す更新を先に出す並べ替えが効いているか。「循環なら詰む」は
    // 実装を追わずに判定できるので、独立した物差しとして使える
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const plan = planRepoSync(existing, incoming);
        expect(collidesWhenApplied(existing, plan)).toBe(
          hasNameCycle(existing, plan)
        );
      }),
      { numRuns: RUNS }
    );
  });

  it("GitHub 側が空なら、既存行は全部消える", () => {
    // 現行仕様の明示。token 事故などで空が返ると全消しになるのは既知の挙動
    fc.assert(
      fc.property(existingArb, (existing) => {
        const plan = planRepoSync(existing, []);
        expect(plan.updates).toEqual([]);
        expect(plan.inserts).toEqual([]);
        expect(plan.deleteIds.sort()).toEqual(existing.map((r) => r.id).sort());
      }),
      { numRuns: RUNS }
    );
  });

  it("同じ応答でもう一度 sync しても、増えも減りもしない (冪等)", () => {
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const applied = applyPlan(existing, planRepoSync(existing, incoming));
        const second = planRepoSync(applied, incoming);
        expect(second.deleteIds).toEqual([]);
        expect(second.inserts).toEqual([]);
        expect(second.updates.length).toBe(incoming.length);
      }),
      { numRuns: RUNS }
    );
  });

  it("GitHub が返す順を入れ替えても、行の割り当ては変わらない", () => {
    fc.assert(
      fc.property(scenarioArb, ({ existing, incoming }) => {
        const assign = (repos: GitHubRepo[]) => {
          const plan = planRepoSync(existing, repos);
          return {
            updates: new Map(plan.updates.map((u) => [u.repo.id, u.rowId])),
            inserts: plan.inserts.map((r) => r.id).sort(),
            deleteIds: [...plan.deleteIds].sort(),
          };
        };
        expect(assign([...incoming].reverse())).toEqual(assign(incoming));
      }),
      { numRuns: RUNS }
    );
  });
});
