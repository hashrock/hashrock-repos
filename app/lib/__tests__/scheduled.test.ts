import { afterEach, describe, expect, it, vi } from "vitest";
import { CRON_SYNC_USERNAME, runScheduledJobs, type ScheduledDeps } from "../scheduled";

const env = { DB: {} as D1Database, GITHUB_TOKEN: "t" } as Parameters<typeof runScheduledJobs>[0];

const okSnapshot = vi.fn(async () => ({ date: "2026-10-10", saved: 1, results: [] })) as unknown as ScheduledDeps["takeSignupSnapshot"];
const okSync = vi.fn(async () => ({ data: { synced: 3, deleted: 0 } })) as unknown as ScheduledDeps["syncReposFromGitHub"];

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("runScheduledJobs", () => {
  it("スナップショットと GitHub 同期の両方を呼ぶ。同期は手動ボタンと同じ username", async () => {
    await runScheduledJobs(env, { takeSignupSnapshot: okSnapshot, syncReposFromGitHub: okSync });
    expect(okSnapshot).toHaveBeenCalledWith(env);
    expect(okSync).toHaveBeenCalledWith(env.DB, "t", CRON_SYNC_USERNAME);
    expect(CRON_SYNC_USERNAME).toBe("hashrock");
  });

  it("同期が失敗してもスナップショットは走り、throw しない", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const failingSync = vi.fn(async () => {
      throw new Error("GitHub API error: 403");
    }) as unknown as ScheduledDeps["syncReposFromGitHub"];
    await expect(
      runScheduledJobs(env, { takeSignupSnapshot: okSnapshot, syncReposFromGitHub: failingSync })
    ).resolves.toBeUndefined();
    expect(okSnapshot).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
  });

  it("スナップショットが失敗しても同期は走る", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const failingSnapshot = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as ScheduledDeps["takeSignupSnapshot"];
    await runScheduledJobs(env, { takeSignupSnapshot: failingSnapshot, syncReposFromGitHub: okSync });
    expect(okSync).toHaveBeenCalledTimes(1);
  });

  it("GITHUB_TOKEN が無ければ同期は飛ばし、スナップショットだけ走る", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    await runScheduledJobs({ ...env, GITHUB_TOKEN: "" }, { takeSignupSnapshot: okSnapshot, syncReposFromGitHub: okSync });
    expect(okSync).not.toHaveBeenCalled();
    expect(okSnapshot).toHaveBeenCalledTimes(1);
  });
});
