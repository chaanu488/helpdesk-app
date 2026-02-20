const GITHUB_API = 'https://api.github.com';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

type GitHubIssue = {
  number: number;
  html_url: string;
  state: string;
  assignee?: { login: string } | null;
};

export async function createIssue(
  token: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<GitHubIssue> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GitHubIssue>;
}

export async function getIssue(token: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/issues/${issueNumber}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json() as Promise<GitHubIssue>;
}

export async function listRepos(token: string, org: string) {
  const res = await fetch(`${GITHUB_API}/orgs/${org}/repos?per_page=100&sort=updated`, {
    headers: headers(token),
  });
  if (!res.ok) {
    // Fallback to user repos
    const userRes = await fetch(`${GITHUB_API}/users/${org}/repos?per_page=100&sort=updated`, {
      headers: headers(token),
    });
    if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);
    return userRes.json();
  }
  return res.json();
}
