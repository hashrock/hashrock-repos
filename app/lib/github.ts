export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
  archived: boolean;
  created_at: string;
  topics: string[];
  private: boolean;
  homepage: string | null;
}

async function fetchAllPages(
  url: string,
  token: string
): Promise<GitHubRepo[]> {
  const results: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "hashrock-repos",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data: GitHubRepo[] = await res.json();
    if (data.length === 0) break;

    results.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return results;
}

async function fetchAuthenticatedLogin(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "hashrock-repos",
    },
  });

  if (!res.ok) {
    return null;
  }

  const data: { login: string } = await res.json();
  return data.login;
}

export async function fetchUserRepos(
  token: string,
  username: string
): Promise<GitHubRepo[]> {
  // /users/{username}/repos は token があっても public リポジトリしか返さない。
  // token の持ち主自身を同期する場合だけ /user/repos を使い private も取得する。
  const login = await fetchAuthenticatedLogin(token);

  if (login === username) {
    return fetchAllPages(
      "https://api.github.com/user/repos?affiliation=owner&visibility=all",
      token
    );
  }

  return fetchAllPages(
    `https://api.github.com/users/${username}/repos?type=owner`,
    token
  );
}

export async function fetchOrgRepos(
  token: string,
  org: string
): Promise<GitHubRepo[]> {
  return fetchAllPages(
    `https://api.github.com/orgs/${org}/repos`,
    token
  );
}

export async function archiveRepo(
  token: string,
  fullName: string
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "hashrock-repos",
      },
      body: JSON.stringify({ archived: true }),
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
}

export async function updateRepoDescription(
  token: string,
  fullName: string,
  description: string | null
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "hashrock-repos",
      },
      // null を渡すと GitHub 側も未設定になる
      body: JSON.stringify({ description }),
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
}

export async function updateRepoTopics(
  token: string,
  fullName: string,
  topics: string[]
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}/topics`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "hashrock-repos",
      },
      body: JSON.stringify({ names: topics }),
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
}
