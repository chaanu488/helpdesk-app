const BITBUCKET_API = 'https://api.bitbucket.org/2.0';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

type BitbucketIssue = {
  id: number;
  state: string;
  assignee?: { display_name: string } | null;
  links?: { html?: { href: string } };
};

export async function createIssue(
  token: string,
  workspace: string,
  repoSlug: string,
  title: string,
  body: string
): Promise<BitbucketIssue> {
  const res = await fetch(
    `${BITBUCKET_API}/repositories/${workspace}/${repoSlug}/issues`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        title,
        content: { raw: body },
        kind: 'task',
        priority: 'major',
      }),
    }
  );
  if (!res.ok) throw new Error(`Bitbucket API error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<BitbucketIssue>;
}

export async function getIssue(
  token: string,
  workspace: string,
  repoSlug: string,
  issueId: number
): Promise<BitbucketIssue> {
  const res = await fetch(
    `${BITBUCKET_API}/repositories/${workspace}/${repoSlug}/issues/${issueId}`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Bitbucket API error: ${res.status}`);
  return res.json() as Promise<BitbucketIssue>;
}

export async function listRepos(token: string, workspace: string) {
  const res = await fetch(
    `${BITBUCKET_API}/repositories/${workspace}?pagelen=100&sort=-updated_on`,
    { headers: headers(token) }
  );
  if (!res.ok) throw new Error(`Bitbucket API error: ${res.status}`);
  const data = await res.json() as { values: unknown[] };
  return data.values;
}
