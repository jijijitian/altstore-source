const API = 'https://api.github.com'

export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
  digest?: string | null
}

export interface Release {
  tag_name: string
  draft: boolean
  prerelease: boolean
  published_at: string
  body: string | null
  assets: ReleaseAsset[]
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? ''

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'altstore-source',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    const hint = remaining === '0' ? '（API 速率限制已用尽，请设置 GITHUB_TOKEN）' : ''
    throw new Error(`GitHub API ${path} 失败: ${response.status} ${response.statusText}${hint}`)
  }
  return (await response.json()) as T
}

export async function listReleases(repo: string, pages = 3): Promise<Release[]> {
  const releases: Release[] = []
  for (let page = 1; page <= pages; page++) {
    const batch = await request<Release[]>(`/repos/${repo}/releases?per_page=100&page=${page}`)
    releases.push(...batch)
    if (batch.length < 100) break
  }
  return releases
}
