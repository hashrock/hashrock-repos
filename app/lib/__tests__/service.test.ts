import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateRepoTagsWithSync,
  updateRepoDescriptionWithSync,
  archiveRepoWithSync,
  bulkAddTagsWithSync,
  syncReposFromGitHub,
} from "../service";
import type { GitHubRepo } from "../github";
import { githubRepo } from "./github-fixtures";

vi.mock("../db", () => ({
  syncRepos: vi.fn(),
  getRepoById: vi.fn(),
  updateRepoTags: vi.fn(),
  addTagsToRepo: vi.fn(),
  setRepoArchived: vi.fn(),
  setRepoDescription: vi.fn(),
}));

vi.mock("../github", () => ({
  fetchUserRepos: vi.fn(),
  updateRepoTopics: vi.fn(),
  updateRepoDescription: vi.fn(),
  archiveRepo: vi.fn(),
}));

import {
  syncRepos,
  getRepoById,
  updateRepoTags,
  addTagsToRepo,
  setRepoArchived,
  setRepoDescription,
} from "../db";
import {
  fetchUserRepos,
  updateRepoTopics,
  updateRepoDescription,
  archiveRepo,
} from "../github";

const mockD1 = {} as D1Database;

/** repositories の 1 行。列が増えてもここだけ直せば済むようにする */
function repoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    githubId: 1001,
    name: "repo",
    fullName: "user/repo",
    url: "https://github.com/user/repo",
    description: null,
    updatedAt: "2024-01-01",
    language: null,
    starCount: 0,
    archived: false,
    isPrivate: false,
    createdAt: "2024-01-01",
    notes: null,
    star: false,
    hide: false,
    coverImageKey: null,
    homepage: null,
    logoSvg: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncReposFromGitHub", () => {
  it("fetches repos from GitHub and syncs to DB", async () => {
    const mockRepos: GitHubRepo[] = [githubRepo()];
    vi.mocked(fetchUserRepos).mockResolvedValue(mockRepos);
    vi.mocked(syncRepos).mockResolvedValue({ synced: 1, deleted: 0 });

    const result = await syncReposFromGitHub(mockD1, "token", "user");

    expect(fetchUserRepos).toHaveBeenCalledWith("token", "user");
    expect(syncRepos).toHaveBeenCalledWith(mockD1, mockRepos);
    expect(result).toEqual({ data: { synced: 1, deleted: 0 } });
  });
});

describe("updateRepoTagsWithSync", () => {
  it("updates tags and syncs to GitHub", async () => {
    vi.mocked(updateRepoTags).mockResolvedValue({ repoId: 1, tags: ["tag1"] });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoTopics).mockResolvedValue(undefined);

    const result = await updateRepoTagsWithSync(mockD1, "token", 1, ["tag1"]);

    expect(updateRepoTags).toHaveBeenCalledWith(mockD1, 1, ["tag1"]);
    expect(updateRepoTopics).toHaveBeenCalledWith("token", "user/repo", ["tag1"]);
    expect(result).toEqual({
      data: { repoId: 1, tags: ["tag1"] },
    });
  });

  it("normalises tags before writing to the DB and GitHub", async () => {
    // 表記ゆれのまま入れると「Ops」と「ops」が別タグとして増える。
    // DB と GitHub に同じ形が渡ることまで見る
    // db は受け取った形をそのまま返す
    vi.mocked(updateRepoTags).mockImplementation(async (_d1, repoId, tags) => ({
      repoId,
      tags,
    }));
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoTopics).mockResolvedValue(undefined);

    await updateRepoTagsWithSync(mockD1, "token", 1, [" Ops ", "OPS", "", "web"]);

    expect(updateRepoTags).toHaveBeenCalledWith(mockD1, 1, ["ops", "web"]);
    expect(updateRepoTopics).toHaveBeenCalledWith("token", "user/repo", [
      "ops",
      "web",
    ]);
  });

  it("skips GitHub sync when token is undefined", async () => {
    vi.mocked(updateRepoTags).mockResolvedValue({ repoId: 1, tags: ["tag1"] });

    const result = await updateRepoTagsWithSync(mockD1, undefined, 1, ["tag1"]);

    expect(updateRepoTopics).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: { repoId: 1, tags: ["tag1"] },
    });
  });

  it("returns githubSyncErrors when GitHub sync fails", async () => {
    vi.mocked(updateRepoTags).mockResolvedValue({ repoId: 1, tags: ["tag1"] });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoTopics).mockRejectedValue(new Error("API error"));

    const result = await updateRepoTagsWithSync(mockD1, "token", 1, ["tag1"]);

    expect(result.githubSyncErrors).toEqual(["Error: API error"]);
  });
});

describe("archiveRepoWithSync", () => {
  it("archives repo and syncs to GitHub", async () => {
    vi.mocked(setRepoArchived).mockResolvedValue({ repoId: 1, archived: true });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(archiveRepo).mockResolvedValue(undefined);

    const result = await archiveRepoWithSync(mockD1, "token", 1);

    expect(setRepoArchived).toHaveBeenCalledWith(mockD1, 1, true);
    expect(archiveRepo).toHaveBeenCalledWith("token", "user/repo");
    expect(result).toEqual({
      data: { repoId: 1, archived: true },
    });
  });

  it("skips GitHub sync when token is undefined", async () => {
    vi.mocked(setRepoArchived).mockResolvedValue({ repoId: 1, archived: true });

    const result = await archiveRepoWithSync(mockD1, undefined, 1);

    expect(archiveRepo).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: { repoId: 1, archived: true },
    });
  });

  it("returns githubSyncErrors when GitHub sync fails", async () => {
    vi.mocked(setRepoArchived).mockResolvedValue({ repoId: 1, archived: true });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(archiveRepo).mockRejectedValue(new Error("API error"));

    const result = await archiveRepoWithSync(mockD1, "token", 1);

    expect(result.githubSyncErrors).toEqual(["Error: API error"]);
  });
});

describe("bulkAddTagsWithSync", () => {
  it("adds tags to multiple repos and syncs to GitHub", async () => {
    vi.mocked(addTagsToRepo)
      .mockResolvedValueOnce(["existing", "new"])
      .mockResolvedValueOnce(["new"]);
    vi.mocked(getRepoById)
      .mockResolvedValueOnce(repoRow({ name: "repo1", fullName: "user/repo1", url: "https://github.com/user/repo1" }))
      .mockResolvedValueOnce(repoRow({ id: 2, name: "repo2", fullName: "user/repo2", url: "https://github.com/user/repo2" }));
    vi.mocked(updateRepoTopics).mockResolvedValue(undefined);

    const result = await bulkAddTagsWithSync(mockD1, "token", [1, 2], ["new"]);

    expect(addTagsToRepo).toHaveBeenCalledTimes(2);
    expect(updateRepoTopics).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      data: [
        { repoId: 1, tags: ["existing", "new"] },
        { repoId: 2, tags: ["new"] },
      ],
    });
  });

  it("normalises tags once, before touching any repo", async () => {
    vi.mocked(addTagsToRepo).mockResolvedValue(["ops"]);
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoTopics).mockResolvedValue(undefined);

    await bulkAddTagsWithSync(mockD1, "token", [1], ["  OPS ", "ops", " "]);

    expect(addTagsToRepo).toHaveBeenCalledWith(mockD1, 1, ["ops"]);
  });

  it("collects GitHub sync errors without stopping", async () => {
    vi.mocked(addTagsToRepo).mockResolvedValue(["new"]);
    vi.mocked(getRepoById).mockResolvedValue(repoRow({ name: "repo1", fullName: "user/repo1", url: "https://github.com/user/repo1" }));
    vi.mocked(updateRepoTopics).mockRejectedValue(new Error("API error"));

    const result = await bulkAddTagsWithSync(mockD1, "token", [1], ["new"]);

    expect(result.githubSyncErrors).toHaveLength(1);
  });
});

describe("updateRepoDescriptionWithSync", () => {
  it("writes the description to the DB and back to GitHub", async () => {
    vi.mocked(setRepoDescription).mockResolvedValue({
      repoId: 1,
      description: "new desc",
    });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoDescription).mockResolvedValue(undefined);

    const result = await updateRepoDescriptionWithSync(
      mockD1,
      "token",
      1,
      "new desc"
    );

    expect(setRepoDescription).toHaveBeenCalledWith(mockD1, 1, "new desc");
    expect(updateRepoDescription).toHaveBeenCalledWith(
      "token",
      "user/repo",
      "new desc"
    );
    expect(result).toEqual({ data: { repoId: 1, description: "new desc" } });
  });

  it("passes null through so GitHub clears the description", async () => {
    vi.mocked(setRepoDescription).mockResolvedValue({
      repoId: 1,
      description: null,
    });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoDescription).mockResolvedValue(undefined);

    await updateRepoDescriptionWithSync(mockD1, "token", 1, null);

    expect(updateRepoDescription).toHaveBeenCalledWith("token", "user/repo", null);
  });

  it("skips GitHub sync when token is undefined", async () => {
    vi.mocked(setRepoDescription).mockResolvedValue({
      repoId: 1,
      description: "x",
    });

    await updateRepoDescriptionWithSync(mockD1, undefined, 1, "x");

    expect(updateRepoDescription).not.toHaveBeenCalled();
  });

  it("reports githubSyncErrors when GitHub rejects the write", async () => {
    vi.mocked(setRepoDescription).mockResolvedValue({
      repoId: 1,
      description: "x",
    });
    vi.mocked(getRepoById).mockResolvedValue(repoRow());
    vi.mocked(updateRepoDescription).mockRejectedValue(new Error("API error"));

    const result = await updateRepoDescriptionWithSync(mockD1, "token", 1, "x");

    expect(result.githubSyncErrors).toEqual(["Error: API error"]);
  });
});
