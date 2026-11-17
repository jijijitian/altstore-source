import type { AppConfig } from './config.ts'
import { listReleases, type Release } from './github.ts'
import type { IpaMetadata } from './ipa.ts'

export interface Version {
  version: string
  buildVersion: string
  date: string
  localizedDescription: string
  downloadURL: string
  size: number
  minOSVersion: string
  sha256?: string
}

export interface App {
  name: string
  bundleIdentifier: string
  developerName: string
  subtitle: string
  localizedDescription: string
  iconURL: string
  tintColor: string
  category: string
  screenshots: { iphone: unknown[]; ipad: unknown[] }
  versions: Version[]
  appPermissions: { entitlements: string[]; privacy: Record<string, string> }
}

const RELEASE_LINK =
  /\n{0,2}\[*Full Changelog\**\]?\(?\s*(https:\/\/github\.com\/[^\s)]+)\s*\)?/gi
const NOISE = [
  /^\[?\/\/\]?: # \(.*\)$/gm,
  /^\[github-[a-z0-9-]+\]:.*$/gm,
  /^\[[a-z0-9-]+\]: https?:\/\/\S+$/gm,
]

export function cleanBody(body: string | null): string {
  if (!body) return ''
  let text = body
  const separator = text.indexOf('[//]: # (ANI-SERVER-MAGIC-SEPARATOR)')
  if (separator >= 0) text = text.slice(0, separator)
  for (const pattern of NOISE) text = text.replace(pattern, '')
  text = text.replace(RELEASE_LINK, '\n\n完整更新日志：$1')
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export interface ResolvedVersion extends Version {
  tag: string
  metadata: IpaMetadata
}

export async function resolveVersion(
  app: AppConfig,
  release: Release,
  probe: (url: string) => Promise<IpaMetadata>
): Promise<ResolvedVersion | null> {
  const asset = release.assets.find((item) => item.name.toLowerCase().endsWith('.ipa'))
  if (!asset) return null
  const metadata = await probe(asset.browser_download_url)
  if (metadata.bundleIdentifier !== app.bundleIdentifier) {
    throw new Error(
      `${app.name} ${release.tag_name} 的 Bundle ID 不符：期望 ${app.bundleIdentifier}，实际 ${metadata.bundleIdentifier}`
    )
  }
  const sha256 = asset.digest?.startsWith('sha256:')
    ? asset.digest.slice('sha256:'.length)
    : undefined
  return {
    tag: release.tag_name,
    version: metadata.version,
    buildVersion: metadata.buildVersion,
    date: release.published_at,
    localizedDescription: cleanBody(release.body),
    downloadURL: asset.browser_download_url,
    size: asset.size,
    minOSVersion: metadata.minOSVersion,
    ...(sha256 ? { sha256 } : {}),
    metadata,
  }
}

export async function collectVersions(
  app: AppConfig,
  options: {
    limit: number
    probe: (url: string) => Promise<IpaMetadata>
    log: (message: string) => void
  }
): Promise<ResolvedVersion[]> {
  const releases = (await listReleases(app.repo))
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => release.assets.some((asset) => asset.name.toLowerCase().endsWith('.ipa')))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))

  // 多取几份作为候补，某个版本探测失败时还能补上足量的历史版本。
  const candidates = releases.slice(0, options.limit * 2)
  const settled = await Promise.all(
    candidates.map(async (release) => {
      try {
        const version = await resolveVersion(app, release, options.probe)
        if (version) options.log(`  ${app.name} ${release.tag_name} → ${version.version} (${version.buildVersion})`)
        return version
      } catch (error) {
        options.log(`  ${app.name} ${release.tag_name} 解析失败：${(error as Error).message}`)
        return null
      }
    })
  )

  const resolved: ResolvedVersion[] = []
  const seen = new Set<string>()
  for (const version of settled) {
    if (!version) continue
    if (resolved.length >= options.limit) break
    const key = `${version.version}|${version.buildVersion}`
    if (seen.has(key)) continue
    seen.add(key)
    resolved.push(version)
  }

  if (resolved.length === 0) throw new Error(`${app.name} 没有可用的发布版本`)
  return resolved.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}
