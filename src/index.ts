import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { APPS, MIRROR_PREFIX, SOURCE, type AppConfig } from './config.ts'
import { collectVersions, type ResolvedVersion } from './app.ts'
import { probeIpa, type IpaMetadata } from './ipa.ts'
import { validateSource } from './validate.ts'

const ROOT = process.cwd()
const CACHE = join(ROOT, '.cache/ipa-metadata.json')
const ASSETS = `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.branch}/assets`

const fresh = process.argv.includes('--fresh')
const metadataCache = new Map<string, IpaMetadata>()
const pending = new Map<string, Promise<IpaMetadata>>()

const log = (message: string) => console.log(message)

async function loadCache() {
  if (fresh) return
  try {
    const parsed = JSON.parse(await readFile(CACHE, 'utf8')) as {
      entries?: Record<string, IpaMetadata>
    }
    for (const [url, value] of Object.entries(parsed.entries ?? {})) metadataCache.set(url, value)
    log(`已载入 ${metadataCache.size} 条 IPA 元数据缓存`)
  } catch {
    log('没有可用的 IPA 元数据缓存，将全部重新探测')
  }
}

async function saveCache() {
  await mkdir(dirname(CACHE), { recursive: true })
  const entries = Object.fromEntries(
    [...metadataCache.entries()].sort(([a], [b]) => a.localeCompare(b))
  )
  await writeFile(CACHE, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`)
}

function probe(url: string): Promise<IpaMetadata> {
  const cached = metadataCache.get(url)
  if (cached) return Promise.resolve(cached)
  let job = pending.get(url)
  if (!job) {
    job = withSlot(() =>
      probeIpa(url).then((metadata) => {
        metadataCache.set(url, metadata)
        return metadata
      })
    ).finally(() => pending.delete(url))
    pending.set(url, job)
  }
  return job
}

// 探测一个 IPA 需要 3~4 次跨洋 Range 请求，并发过高反而会互相拖慢。
const MAX_PROBES = 8
let running = 0
const waiting: (() => void)[] = []

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PROBES) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await task()
  } finally {
    running--
    waiting.shift()?.()
  }
}

const FALLBACK_PRIVACY: Record<string, string> = {
  NSCameraUsageDescription: '应用需要使用相机。',
  NSMicrophoneUsageDescription: '应用需要使用麦克风。',
  NSPhotoLibraryUsageDescription: '应用需要访问相册。',
  NSPhotoLibraryAddUsageDescription: '应用需要向相册写入图片。',
  NSLocalNetworkUsageDescription: '应用需要访问本地网络。',
  NSFaceIDUsageDescription: '应用需要使用 Face ID。',
}

const GENERIC_PRIVACY = '应用需要使用该权限。'

// AltStore 会把空字符串的 usageDescription 当作未声明，因此空值必须补全；
// 同时把各历史版本新增的隐私权限补齐，否则安装校验会判定为「未声明的权限」。
function buildPermissions(app: AppConfig, versions: ResolvedVersion[]) {
  const privacy: Record<string, string> = { ...app.privacy }
  for (const version of versions) {
    for (const key of Object.keys(version.metadata.privacy)) {
      if (!privacy[key]) privacy[key] = FALLBACK_PRIVACY[key] ?? GENERIC_PRIVACY
    }
  }
  for (const key of Object.keys(privacy)) {
    if (!privacy[key].trim()) privacy[key] = FALLBACK_PRIVACY[key] ?? GENERIC_PRIVACY
  }
  return { entitlements: [...app.entitlements], privacy }
}

// 同一应用内 version+buildVersion 必须唯一，否则 AltStore 会拒绝整份源。
function dedupe(versions: ResolvedVersion[]): ResolvedVersion[] {
  const seen = new Set<string>()
  return versions.filter((version) => {
    const key = `${version.version}|${version.buildVersion}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface Variant {
  /** generated/ 下的文件名 */
  file: string
  /** 是否把图片与安装包链接改写成中转地址 */
  mirror: boolean
  identifierSuffix: string
  nameSuffix: string
}

const VARIANTS: Variant[] = [
  { file: 'apps.json', mirror: false, identifierSuffix: '', nameSuffix: '' },
  {
    file: 'apps-ghproxy.json',
    mirror: true,
    identifierSuffix: '.ghproxy',
    nameSuffix: ' · 中转',
  },
]

async function main() {
  await loadCache()
  log(`正在生成 ${SOURCE.name}：${APPS.length} 个应用`)

  const results = await Promise.all(
    APPS.map(async (app) => {
      log(`\n解析 ${app.name}（${app.repo}）`)
      const versions = await collectVersions(app, { limit: app.maxVersions, probe, log })
      return { app, versions }
    })
  )

  // 图片与安装包链接只在写盘时加前缀，探测始终访问原始地址。
  const proxied = (url: string, mirror: boolean) => (mirror ? MIRROR_PREFIX + url : url)

  for (const variant of VARIANTS) {
    const apps = results.map(({ app, versions }) => ({
      name: app.name,
      bundleIdentifier: app.bundleIdentifier,
      developerName: app.developerName,
      subtitle: app.subtitle,
      localizedDescription: app.description,
      iconURL: proxied(`${ASSETS}/icons/${app.iconFile}`, variant.mirror),
      tintColor: app.tintColor,
      category: app.category,
      screenshots: {
        iphone: app.screenshots.iphone.map((shot) => ({
          ...shot,
          imageURL: proxied(shot.imageURL, variant.mirror),
        })),
        ipad: app.screenshots.ipad.map((shot) => ({
          ...shot,
          imageURL: proxied(shot.imageURL, variant.mirror),
        })),
      },
      versions: dedupe(versions).map((version) => ({
        version: version.version,
        buildVersion: version.buildVersion,
        date: version.date,
        localizedDescription: version.localizedDescription,
        downloadURL: proxied(version.downloadURL, variant.mirror),
        size: version.size,
        minOSVersion: version.minOSVersion,
        ...(version.sha256 ? { sha256: version.sha256 } : {}),
      })),
      appPermissions: buildPermissions(app, versions),
    }))

    const sourceFile = `generated/${variant.file}`
    const sourceURL = proxied(
      `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.branch}/${sourceFile}`,
      variant.mirror
    )

    const source = {
      name: SOURCE.name + variant.nameSuffix,
      identifier: SOURCE.identifier + variant.identifierSuffix,
      subtitle: variant.mirror ? '自用 AltStore / SideStore 软件源 · gh-proxy 中转' : SOURCE.subtitle,
      description: variant.mirror
        ? `${SOURCE.description}\n\n本源的图片与安装包均通过 ${MIRROR_PREFIX} 中转下载，适用于 GitHub 直连不稳定的网络环境。`
        : SOURCE.description,
      iconURL: proxied(`${ASSETS}/icon.png`, variant.mirror),
      headerURL: proxied(`${ASSETS}/header.png`, variant.mirror),
      sourceURL,
      website: proxied(`https://github.com/${SOURCE.repo}`, variant.mirror),
      tintColor: SOURCE.tintColor,
      featuredApps: APPS.slice(0, 5).map((app) => app.bundleIdentifier),
      apps,
      news: [],
    }

    validateSource(source)
    const output = join(ROOT, sourceFile)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, `${JSON.stringify(source, null, 2)}\n`)

    const total = apps.reduce((sum, app) => sum + app.versions.length, 0)
    log(`\n已生成 ${output}：${apps.length} 个应用，共 ${total} 个版本`)
    for (const app of apps) {
      const latest = app.versions[0]
      log(
        `  ${app.name.padEnd(18)} ${latest.version} (${latest.buildVersion}) ${app.versions.length} 个版本`
      )
    }
  }

  await saveCache()
}

await main()
