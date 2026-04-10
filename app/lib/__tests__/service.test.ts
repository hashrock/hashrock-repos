import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateRepoTagsWithSync,
  archiveRepoWithSync,
  bulkAddTagsWithSync,
  syncReposFromGitHub,
} from "../service";
import type { GitHubRepo } from "../github";

vi.mock("../db", () => ({
  syncRepos: vi.fn(),
  getRepoById: vi.fn(),
  updateRepoTags: vi.fn(),
  addTagsToRepo: vi.fn(),
  setRepoArchived: vi.fn(),
}));

vi.mock("../github", () => ({
  fetchUserRepos: vi.fn(),
  updateRepoTopics: vi.fn(),
  archiveRepo: vi.fn(),
}));

import {
  syncRepos,
  getRepoById,
  updateRepoTags,
  addTagsToRepo,
  setRepoArchived,
} from "../db";
import {
  fetchUserRepos,
  updateRepoTopics,
  archiveRepo,
} from "../github";

const mockD1 = {} as D1Database;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncReposFromGitHub", () => {
  it("fetches repos from GitHub and syncs to DB", async () => {
    const mockRepos: GitHubRepo[] = [{
      id: 12345,
      name: "repo1",
      full_name: "user/repo1",
      html_url: "https://github.com/user/repo1",
      description: null,
      updated_at: "2024-01-01",
      language: null,
      stargazers_count: 0,
      archived: false,
      created_at: "2024-01-01",
      topics: [],
    }];
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
    vi.mocked(getRepoById).mockResolvedValue({
      id: 1,
      githubId: 10001,
      fullName: "user/repo",
      name: "repo",
      url: "https://github.com/user/repo",
      description: null,
      updatedAt: "2024-01-01",
      language: null,
      starCount: 0,
      archived: false,
      createdAt: "2024-01-01",
    });
    vi.mocked(updateRepoTopics).mockResolvedValue(undefined);

    const result = await updateRepoTagsWithSync(mockD1, "token", 1, ["tag1"]);

    expect(updateRepoTags).toHaveBeenCalledWith(mockD1, 1, ["tag1"]);
    expect(updateRepoTopics).toHaveBeenCalledWith("token", "user/repo", ["tag1"]);
    expect(result).toEqual({
      data: { repoId: 1, tags: ["tag1"] },
    });
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
    vi.mocked(getRepoById).mockResolvedValue({
      id: 1,
      githubId: 10001,
      fullName: "user/repo",
      name: "repo",
      url: "https://github.com/user/repo",
      description: null,
      updatedAt: "2024-01-01",
      language: null,
      starCount: 0,
      archived: false,
      createdAt: "2024-01-01",
    });
    vi.mocked(updateRepoTopics).mockRejectedValue(new Error("API error"));

    const result = await updateRepoTagsWithSync(mockD1, "token", 1, ["tag1"]);

    expect(result.githubSyncErrors).toEqual(["Error: API error"]);
  });
});

describe("archiveRepoWithSync", () => {
  it("archives repo and syncs to GitHub", async () => {
    vi.mocked(setRepoArchived).mockResolvedValue({ repoId: 1, archived: true });
    vi.mocked(getRepoById).mockResolvedValue({
      id: 1,
      githubId: 10001,
      fullName: "user/repo",
      name: "repo",
      url: "https://github.com/user/repo",
      description: null,
      updatedAt: "2024-01-01",
      language: null,
      starCount: 0,
      archived: false,
      createdAt: "2024-01-01",
    });
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
    vi.mocked(getRepoById).mockResolvedValue({
      id: 1,
      githubId: 10001,
      fullName: "user/repo",
      name: "repo",
      url: "https://github.com/user/repo",
      description: null,
      updatedAt: "2024-01-01",
      language: null,
      starCount: 0,
      archived: false,
      createdAt: "2024-01-01",
    });
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
      .mockResolvedValueOnce({
        id: 1,
        githubId: 10001,
        fullName: "user/repo1",
        name: "repo1",
        url: "https://github.com/user/repo1",
        description: null,
        updatedAt: "2024-01-01",
        language: null,
        starCount: 0,
        archived: false,
        createdAt: "2024-01-01",
      })
      .mockResolvedValueOnce({
        id: 2,
        githubId: 10002,
        fullName: "user/repo2",
        name: "repo2",
        url: "https://github.com/user/repo2",
        description: null,
        updatedAt: "2024-01-01",
        language: null,
        starCount: 0,
        archived: false,
        createdAt: "2024-01-01",
      });
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

  it("collects GitHub sync errors without stopping", async () => {
    vi.mocked(addTagsToRepo).mockResolvedValue(["new"]);
    vi.mocked(getRepoById).mockResolvedValue({
      id: 1,
      githubId: 10001,
      fullName: "user/repo1",
      name: "repo1",
      url: "https://github.com/user/repo1",
      description: null,
      updatedAt: "2024-01-01",
      language: null,
      starCount: 0,
      archived: false,
      createdAt: "2024-01-01",
    });
    vi.mocked(updateRepoTopics).mockRejectedValue(new Error("API error"));

    const result = await bulkAddTagsWithSync(mockD1, "token", [1], ["new"]);

    expect(result.githubSyncErrors).toHaveLength(1);
  });
});
