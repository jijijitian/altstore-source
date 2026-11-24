interface SourceDocument {
  name?: unknown
  subtitle?: unknown
  description?: unknown
  iconURL?: unknown
  headerURL?: unknown
  sourceURL?: unknown
  website?: unknown
  tintColor?: unknown
  featuredApps?: unknown
  apps?: unknown
  news?: unknown
}

const CATEGORIES = new Set([
  'developer',
  'entertainment',
  'games',
  'lifestyle',
  'other',
  'photo-video',
  'social',
  'utilities',
])

const errors: string[] = []
const fail = (message: string) => errors.push(message)

function httpUrl(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) fail(`${label} 必须是 HTTP(S) 链接`)
  // 中转源形如 https://gh-proxy.org/https://github.com/...，内层地址也必须是 HTTP(S)。
  const inner = value.replace(/^https?:\/\/[^/]+\//, '')
  if (/^https?:\/\//.test(inner) && !/^https?:\/\/[^\s]+$/.test(inner)) {
    fail(`${label} 的内层地址无效：${value}`)
  }
}

function nonEmpty(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} 不能为空`)
}

function expectHex(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail(`${label} 必须是 #RRGGBB`)
}

function expectDate(value: unknown, label: string) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(`${label} 不是有效日期`)
}

function checkScreenshots(screenshots: unknown, label: string) {
  if (!screenshots || typeof screenshots !== 'object' || Array.isArray(screenshots)) {
    fail(`${label} 必须是对象`)
    return
  }
  const { iphone, ipad } = screenshots as Record<string, unknown>
  for (const [device, list] of [
    ['iphone', iphone],
    ['ipad', ipad],
  ] as const) {
    if (!Array.isArray(list)) {
      fail(`${label}.${device} 必须是数组`)
      continue
    }
    for (const item of list) {
      if (!item || typeof item !== 'object') {
        fail(`${label}.${device} 的每一项必须是对象`)
        continue
      }
      const image = item as Record<string, unknown>
      httpUrl(image.imageURL, `${label}.${device}.imageURL`)
      if (device === 'ipad') {
        // AltStore 强制要求 iPad 截图显式给出尺寸。
        if (typeof image.width !== 'number' || typeof image.height !== 'number') {
          fail(`${label}.ipad 截图必须提供 width 与 height`)
        }
      } else if (image.width !== undefined && typeof image.width !== 'number') {
        fail(`${label}.${device}.width 必须是数字`)
      }
    }
  }
}

export function validateSource(source: SourceDocument): void {
  nonEmpty(source.name, 'name')
  nonEmpty(source.subtitle, 'subtitle')
  nonEmpty(source.description, 'description')
  httpUrl(source.iconURL, 'iconURL')
  httpUrl(source.headerURL, 'headerURL')
  httpUrl(source.sourceURL, 'sourceURL')
  httpUrl(source.website, 'website')
  expectHex(source.tintColor, 'tintColor')
  if (!Array.isArray(source.news)) fail('news 必须是数组')
  if (!Array.isArray(source.apps) || source.apps.length === 0) fail('apps 必须是非空数组')

  const bundleIDs = new Set<string>()
  for (const [index, rawApp] of (source.apps as unknown[]).entries()) {
    const label = `apps[${index}]`
    if (!rawApp || typeof rawApp !== 'object') {
      fail(`${label} 必须是对象`)
      continue
    }
    const app = rawApp as Record<string, unknown>
    nonEmpty(app.name, `${label}.name`)
    nonEmpty(app.bundleIdentifier, `${label}.bundleIdentifier`)
    nonEmpty(app.developerName, `${label}.developerName`)
    nonEmpty(app.subtitle, `${label}.subtitle`)
    nonEmpty(app.localizedDescription, `${label}.localizedDescription`)
    httpUrl(app.iconURL, `${label}.iconURL`)
    expectHex(app.tintColor, `${label}.tintColor`)
    if (!CATEGORIES.has(String(app.category))) fail(`${label}.category 不是合法分类`)

    const bundleID = String(app.bundleIdentifier)
    if (bundleIDs.has(bundleID)) fail(`${label}.bundleIdentifier 重复：${bundleID}`)
    bundleIDs.add(bundleID)

    checkScreenshots(app.screenshots, `${label}.screenshots`)

    const permissions = app.appPermissions as Record<string, unknown> | undefined
    if (!permissions || !Array.isArray(permissions.entitlements)) {
      fail(`${label}.appPermissions.entitlements 必须是数组`)
    }
    const privacy = permissions?.privacy
    if (!privacy || typeof privacy !== 'object' || Array.isArray(privacy)) {
      fail(`${label}.appPermissions.privacy 必须是对象`)
    } else {
      for (const [key, value] of Object.entries(privacy as Record<string, unknown>)) {
        if (!/^NS[A-Za-z0-9]+UsageDescription/.test(key)) fail(`${label}.privacy 键不合法：${key}`)
        // 空描述会被 AltStore 当作缺少说明，直接导致整份源加载失败。
        nonEmpty(value, `${label}.privacy.${key}`)
      }
    }

    if (!Array.isArray(app.versions) || app.versions.length === 0) {
      fail(`${label}.versions 必须是非空数组`)
      continue
    }
    const versions = new Set<string>()
    let previous = Number.POSITIVE_INFINITY
    for (const [vi, rawVersion] of (app.versions as unknown[]).entries()) {
      const vlabel = `${label}.versions[${vi}]`
      if (!rawVersion || typeof rawVersion !== 'object') {
        fail(`${vlabel} 必须是对象`)
        continue
      }
      const version = rawVersion as Record<string, unknown>
      nonEmpty(version.version, `${vlabel}.version`)
      nonEmpty(version.buildVersion, `${vlabel}.buildVersion`)
      nonEmpty(version.minOSVersion, `${vlabel}.minOSVersion`)
      if (!/^\d+(?:\.\d+){0,2}$/.test(String(version.minOSVersion))) {
        fail(`${vlabel}.minOSVersion 格式无效`)
      }
      expectDate(version.date, `${vlabel}.date`)
      httpUrl(version.downloadURL, `${vlabel}.downloadURL`)
      if (typeof version.size !== 'number' || version.size <= 0) fail(`${vlabel}.size 无效`)
      if (version.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(String(version.sha256))) {
        fail(`${vlabel}.sha256 不是合法的 SHA-256`)
      }

      // AltStore 依据 versionID = "version|buildVersion" 去重，重复会拒绝整份源。
      const id = `${version.version}|${version.buildVersion}`
      if (versions.has(id)) fail(`${label} 版本号重复：${id}`)
      versions.add(id)

      const time = Date.parse(String(version.date))
      if (time > previous) fail(`${label}.versions 未按时间倒序排列`)
      previous = time
    }
  }

  if (!Array.isArray(source.featuredApps)) {
    fail('featuredApps 必须是数组')
  } else {
    for (const id of source.featuredApps) {
      if (!bundleIDs.has(String(id))) fail(`featuredApps 含未知 bundleIdentifier：${id}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`源校验失败：\n- ${errors.join('\n- ')}`)
  }
}
