import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createInitialState,
  repoListReducer,
  selectBulkTagTarget,
  selectVisibleRepos,
  sortRepos,
  type FilterKey,
  type RepoListAction,
  type RepoListState,
  type SortKey,
} from "../repo-list-state";
import type { AdminRepo } from "../repo";

/**
 * 管理画面の一覧が持つ状態遷移の property-based test。
 *
 * この島は「楽観更新してから失敗したら戻す」「絞り込みを変えても選択は残す」
 * のように、単発の例示テストでは踏み切れない組み合わせで壊れる。狙いは
 * 個々のアクションの正しさではなく、**任意のアクション列を流した後でも
 * 成り立っていてほしい不変条件** を自動で殴ることにある。
 *
 * 生成器はランダムな文字列や id ではなく、UI から実際に出るアクションだけを
 * 作る。存在しない repo id を混ぜても「そんな dispatch はしない」という
 * 反例しか出ず、探索が無駄になるため。
 */

const SORT_KEYS: SortKey[] = ["updated", "stars", "name", "created"];
const FILTER_KEYS: FilterKey[] = ["noTags", "archived", "hidden"];
const TAG_NAMES = ["ongoing", "done", "backlog"];
const FULL_NAMES = ["u/alpha", "u/beta", "u/gamma"];
const TIMESTAMPS = ["2024-01-01", "2024-06-15", "2025-02-02"];

const tagsArb = fc.uniqueArray(fc.constantFrom(...TAG_NAMES), { maxLength: 3 });

/** 並べ替えと絞り込みが見る列だけを振る。id は後段で 1 から振り直す */
const repoBodyArb = fc.record({
  fullName: fc.constantFrom(...FULL_NAMES),
  updatedAt: fc.constantFrom(...TIMESTAMPS),
  createdAt: fc.option(fc.constantFrom(...TIMESTAMPS), { nil: null }),
  starCount: fc.option(fc.integer({ min: 0, max: 500 }), { nil: null }),
  // archived と hide は DB 上 nullable。null と false を区別しない実装なので両方出す
  archived: fc.option(fc.boolean(), { nil: null }),
  hide: fc.option(fc.boolean(), { nil: null }),
  tags: tagsArb,
});

const reposArb: fc.Arbitrary<AdminRepo[]> = fc
  .array(repoBodyArb, { minLength: 1, maxLength: 5 })
  .map((bodies) =>
    bodies.map((body, i) => ({
      id: i + 1,
      name: `repo${i + 1}`,
      url: `https://github.test/${body.fullName}`,
      description: null,
      language: null,
      isPrivate: false,
      star: false,
      ...body,
    }))
  );

function actionArb(ids: number[]): fc.Arbitrary<RepoListAction> {
  const idArb = fc.constantFrom(...ids);
  const idAction = (type: RepoListAction["type"]) =>
    idArb.map((repoId) => ({ type, repoId }) as RepoListAction);

  return fc.oneof(
    idAction("toggleSelect"),
    fc.constant<RepoListAction>({ type: "toggleAll" }),
    fc
      .tuple(fc.constantFrom(...FILTER_KEYS), fc.boolean())
      .map(([filter, value]): RepoListAction => ({
        type: "setFilter",
        filter,
        value,
      })),
    fc
      .constantFrom(...SORT_KEYS)
      .map((sortKey): RepoListAction => ({ type: "setSortKey", sortKey })),
    // 空・前後空白・空要素混じりと、一括入力で実際に来る形を混ぜる
    fc
      .constantFrom("", "  ", "ops", " Ops , Web ", "a,,b")
      .map((value): RepoListAction => ({ type: "setBulkTagInput", value })),
    fc.constant<RepoListAction>({ type: "bulkTagsStarted" }),
    fc
      .option(
        fc.uniqueArray(fc.record({ repoId: idArb, tags: tagsArb }), {
          selector: (c) => c.repoId,
          maxLength: 3,
        }),
        { nil: undefined }
      )
      .map((changes): RepoListAction => ({ type: "bulkTagsFinished", changes })),
    fc
      .tuple(idArb, tagsArb)
      .map(([repoId, tags]): RepoListAction => ({
        type: "tagsChanged",
        repoId,
        tags,
      })),
    idAction("archiveStarted"),
    fc
      .tuple(idArb, fc.boolean())
      .map(([repoId, ok]): RepoListAction => ({
        type: "archiveFinished",
        repoId,
        ok,
      })),
    fc
      .tuple(idArb, fc.boolean())
      .map(([repoId, hide]): RepoListAction => ({
        type: "hideStarted",
        repoId,
        hide,
      })),
    fc
      .tuple(idArb, fc.boolean())
      .map(([repoId, ok]): RepoListAction => ({
        type: "hideFinished",
        repoId,
        ok,
      }))
  );
}

interface Scenario {
  repos: AdminRepo[];
  actions: RepoListAction[];
}

const scenarioArb: fc.Arbitrary<Scenario> = reposArb.chain((repos) =>
  fc.record({
    repos: fc.constant(repos),
    actions: fc.array(actionArb(repos.map((r) => r.id)), { maxLength: 24 }),
  })
);

/** アクション列を畳んだ「到達可能な状態」 */
function run(scenario: Scenario): RepoListState {
  return scenario.actions.reduce(
    repoListReducer,
    createInitialState(scenario.repos)
  );
}

function ids(repos: AdminRepo[]): number[] {
  return repos.map((r) => r.id);
}

/** repos は必ず 1 件以上あるので、任意の整数から 1 行選べる */
function pickRepo(state: RepoListState, i: number): AdminRepo {
  return state.repos[i % state.repos.length];
}

/**
 * repo は最大 5 件・アクション列は最大 24 なので、状態機械としての
 * 組み合わせはこの回数で十分に踏める。
 */
const RUNS = 500;

describe("repoListReducer の不変条件", () => {
  it("到達可能な状態は常に妥当 (行が増減せず、id 集合は実在するものだけ)", () => {
    // 行の追加も削除も並べ替えもしないのがこの reducer の前提 (表示順は
    // selectVisibleRepos の担当)。選択や処理中に消えた id が残ると、
    // 一括タグ追加や disabled 判定が存在しない行に向かってしまう
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const state = run(scenario);
        expect(ids(state.repos)).toEqual(ids(scenario.repos));
        const known = new Set(ids(state.repos));
        for (const id of [
          ...state.selected,
          ...state.archiving,
          ...state.hiding.keys(),
        ]) {
          expect(known.has(id)).toBe(true);
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("toggleSelect と toggleAll 以外のアクションは冪等", () => {
    // 二重送信や再レンダリングで同じアクションが 2 回流れても状態が動かないこと。
    // 選択のトグルだけは定義上 2 回で戻るので対象外
    fc.assert(
      fc.property(scenarioArb, fc.nat(), (scenario, i) => {
        const before = run(scenario);
        const candidates = scenario.actions.filter(
          (a) => a.type !== "toggleSelect" && a.type !== "toggleAll"
        );
        if (candidates.length === 0) return;
        const action = candidates[i % candidates.length];
        const once = repoListReducer(before, action);
        expect(repoListReducer(once, action)).toEqual(once);
      }),
      { numRuns: RUNS }
    );
  });

  it("同じ repo を 2 回 toggleSelect すると選択は元に戻る", () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), (scenario, i) => {
        const before = run(scenario);
        const action: RepoListAction = {
          type: "toggleSelect",
          repoId: pickRepo(before, i).id,
        };
        const after = repoListReducer(repoListReducer(before, action), action);
        expect(after.selected).toEqual(before.selected);
      }),
      { numRuns: RUNS }
    );
  });

  it("異なる repo の toggleSelect は順序に依らない", () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), fc.nat(), (scenario, i, j) => {
        const before = run(scenario);
        const a = pickRepo(before, i).id;
        const b = pickRepo(before, j).id;
        if (a === b) return;
        const first: RepoListAction = { type: "toggleSelect", repoId: a };
        const second: RepoListAction = { type: "toggleSelect", repoId: b };
        expect(
          repoListReducer(repoListReducer(before, first), second).selected
        ).toEqual(
          repoListReducer(repoListReducer(before, second), first).selected
        );
      }),
      { numRuns: RUNS }
    );
  });

  it("toggleAll の後、選択は空か表示中の全 id のどちらか", () => {
    // 「表示していない行が選択に紛れ込む」「一部だけ選ばれる」を禁じる。
    // 絞り込みで表示から外れた選択が残っている状態でも成り立つこと
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const after = repoListReducer(run(scenario), { type: "toggleAll" });
        const displayed = new Set(ids(selectVisibleRepos(after)));
        expect(
          after.selected.size === 0 ||
            (after.selected.size === displayed.size &&
              [...after.selected].every((id) => displayed.has(id)))
        ).toBe(true);
      }),
      { numRuns: RUNS }
    );
  });

  it("hide の楽観更新は、失敗すると元の値ちょうどに戻る", () => {
    // null と false は表示上どちらも「隠していない」だが、戻し方を間違えると
    // 列の値が勝手に書き換わる。?? false で潰さずそのまま比べる
    fc.assert(
      fc.property(scenarioArb, fc.nat(), (scenario, i) => {
        const before = run(scenario);
        const { id: repoId, hide: original } = pickRepo(before, i);
        // 送信中はボタンが disabled なので、二重に送られている状態は見ない
        // (その場合に控えを上書きしないことは冪等のプロパティが押さえている)
        if (before.hiding.has(repoId)) return;
        // UI は必ず現在値の反転を送る
        const hide = !original;
        const started = repoListReducer(before, {
          type: "hideStarted",
          repoId,
          hide,
        });
        expect(started.repos.find((r) => r.id === repoId)?.hide).toBe(hide);
        const rolledBack = repoListReducer(started, {
          type: "hideFinished",
          repoId,
          ok: false,
        });
        expect(rolledBack.repos).toEqual(before.repos);
      }),
      { numRuns: RUNS }
    );
  });

  it("hide の楽観更新は、成功すると送った値のまま残る", () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), fc.boolean(), (scenario, i, hide) => {
        const before = run(scenario);
        const repoId = pickRepo(before, i).id;
        const after = repoListReducer(
          repoListReducer(before, { type: "hideStarted", repoId, hide }),
          { type: "hideFinished", repoId, ok: true }
        );
        expect(after.repos.find((r) => r.id === repoId)?.hide).toBe(hide);
      }),
      { numRuns: RUNS }
    );
  });

  it("finished を流せば必ず処理中から外れる", () => {
    // finally で必ず finished を投げるので、どんな順に飛んでもボタンが
    // disabled のまま固まらないこと
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const drained = ids(scenario.repos).reduce(
          (state, repoId) =>
            repoListReducer(
              repoListReducer(state, {
                type: "archiveFinished",
                repoId,
                ok: false,
              }),
              { type: "hideFinished", repoId, ok: true }
            ),
          run(scenario)
        );
        expect(drained.archiving.size).toBe(0);
        expect(drained.hiding.size).toBe(0);
      }),
      { numRuns: RUNS }
    );
  });

  it("1 行を指すアクションは、その行の狙った列だけを書き換える", () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat(), (scenario, i) => {
        const before = run(scenario);
        const repoId = pickRepo(before, i).id;
        const cases: { action: RepoListAction; patch: Partial<AdminRepo> }[] =
          [
            {
              action: { type: "tagsChanged", repoId, tags: ["ops"] },
              patch: { tags: ["ops"] },
            },
            {
              action: { type: "archiveFinished", repoId, ok: true },
              patch: { archived: true },
            },
            {
              action: { type: "hideStarted", repoId, hide: true },
              patch: { hide: true },
            },
            {
              action: { type: "hideFinished", repoId, ok: true },
              patch: {},
            },
          ];
        for (const { action, patch } of cases) {
          repoListReducer(before, action).repos.forEach((repo, index) => {
            const original = before.repos[index];
            expect(repo).toEqual(
              repo.id === repoId ? { ...original, ...patch } : original
            );
          });
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("一括タグを反映したら選択が外れ、そのままではもう一度送れない", () => {
    // 入力を空にし損ねると次の Enter で同じタグをもう一度投げ、選択を
    // 外し損ねると一括バーが出たままになる
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const after = repoListReducer(run(scenario), {
          type: "bulkTagsFinished",
          changes: [],
        });
        expect(after.selected.size).toBe(0);
        expect(selectBulkTagTarget(after)).toBeNull();
      }),
      { numRuns: RUNS }
    );
  });
});

describe("selectVisibleRepos の不変条件", () => {
  it("表示は repos の部分集合で、重複しない", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const state = run(scenario);
        const displayed = selectVisibleRepos(state);
        const known = new Set(ids(state.repos));
        expect(new Set(ids(displayed)).size).toBe(displayed.length);
        for (const repo of displayed) {
          expect(known.has(repo.id)).toBe(true);
        }
      }),
      { numRuns: RUNS }
    );
  });

  it("Archived/Hidden 表示は増やす方向、タグなしのみは減らす方向にしか効かない", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const state = run(scenario);
        const shown = (filter: FilterKey, value: boolean) =>
          new Set(
            ids(
              selectVisibleRepos({
                ...state,
                filters: { ...state.filters, [filter]: value },
              })
            )
          );

        for (const filter of ["archived", "hidden"] as const) {
          const off = shown(filter, false);
          expect([...off].every((id) => shown(filter, true).has(id))).toBe(true);
        }
        const strict = shown("noTags", true);
        expect([...strict].every((id) => shown("noTags", false).has(id))).toBe(
          true
        );
      }),
      { numRuns: RUNS }
    );
  });
});

describe("sortRepos の不変条件", () => {
  it("中身を保存し、冪等で、キーの順に並ぶ", () => {
    // 昇降の向きは実装から独立に書く。実装の比較関数を借りると検算にならない
    const ordered: Record<
      SortKey,
      (a: AdminRepo, b: AdminRepo) => boolean
    > = {
      updated: (a, b) => a.updatedAt >= b.updatedAt,
      created: (a, b) => (a.createdAt ?? "") >= (b.createdAt ?? ""),
      stars: (a, b) => (a.starCount ?? 0) >= (b.starCount ?? 0),
      name: (a, b) => a.fullName.localeCompare(b.fullName) <= 0,
    };

    fc.assert(
      fc.property(reposArb, fc.constantFrom(...SORT_KEYS), (repos, key) => {
        const sorted = sortRepos(repos, key);
        expect(ids(sorted).sort()).toEqual(ids(repos).sort());
        expect(sortRepos(sorted, key)).toEqual(sorted);
        for (let i = 0; i + 1 < sorted.length; i++) {
          expect(ordered[key](sorted[i], sorted[i + 1])).toBe(true);
        }
      }),
      { numRuns: RUNS }
    );
  });
});

describe("selectBulkTagTarget の不変条件", () => {
  it("送るのは選択があり、かつ実質的なタグがあるときだけ", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const state = run(scenario);
        const hasTag = state.bulkTagInput
          .split(",")
          .some((t) => t.trim() !== "");
        expect(selectBulkTagTarget(state) !== null).toBe(
          state.selected.size > 0 && hasTag
        );
      }),
      { numRuns: RUNS }
    );
  });

  it("送る中身は選択中の id と正規化済みのタグ", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const state = run(scenario);
        const target = selectBulkTagTarget(state);
        if (target === null) return;
        expect(new Set(target.repoIds)).toEqual(state.selected);
        for (const tag of target.tags) {
          expect(tag).toBe(tag.trim().toLowerCase());
          expect(tag).not.toBe("");
        }
      }),
      { numRuns: RUNS }
    );
  });
});
