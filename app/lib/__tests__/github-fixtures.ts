import type { GitHubRepo } from "../github";

/**
 * GitHub API が返すリポジトリ 1 件。
 * GitHubRepo に列が増えてもここだけ直せば済むよう、テスト間で共有する。
 */
export function githubRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
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
    private: false,
    homepage: null,
    ...overrides,
  };
}
