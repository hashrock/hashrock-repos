export interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
  created_at: string;
  topics: string[];
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

export async function fetchUserRepos(
  token: string,
  username: string
): Promise<GitHubRepo[]> {
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
