import { inflateRawSync } from 'node:zlib'
import { parsePlist } from './plist.ts'

const INFO_PLIST = /^Payload\/[^/]+\.app\/Info\.plist$/
const TAIL_SIZE = 65_557
const MAX_PLIST_SIZE = 2 * 1024 * 1024

export interface IpaMetadata {
  bundleIdentifier: string
  version: string
  buildVersion: string
  minOSVersion: string
  size: number
  privacy: Record<string, string>
}

const HEADERS = { 'User-Agent': 'altstore-source', 'Accept-Encoding': 'identity' }

class RangeUnsupported extends Error {}

// 跨洋链路上偶发连接超时与 5xx，单纯重试即可恢复。
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, init)
    } catch (error) {
      last = error
      if (attempt === attempts) break
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

interface DirectoryEntry {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

async function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  const response = await fetchWithRetry(url, {
    headers: { ...HEADERS, Range: `bytes=${start}-${end}` },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  })
  if (response.status !== 206) {
    await response.body?.cancel()
    throw new RangeUnsupported(`HTTP ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

// GitHub 的 release 资产链接会 302 到带签名的 CDN 地址；这里复用首个 Range
// 请求的最终地址，省掉后续每次请求的跳转往返（跳转本身可能耗时数秒）。
const resolvedUrls = new Map<string, string>()

function findEocd(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (
      buffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      return offset
    }
  }
  return -1
}

function findInfoPlist(directory: Buffer, label: string): DirectoryEntry {
  const matches: DirectoryEntry[] = []
  let cursor = 0
  while (cursor + 46 <= directory.length && directory.readUInt32LE(cursor) === 0x02014b50) {
    const method = directory.readUInt16LE(cursor + 10)
    const flags = directory.readUInt16LE(cursor + 8)
    const compressedSize = directory.readUInt32LE(cursor + 20)
    const nameLength = directory.readUInt16LE(cursor + 28)
    const extraLength = directory.readUInt16LE(cursor + 30)
    const commentLength = directory.readUInt16LE(cursor + 32)
    const localOffset = directory.readUInt32LE(cursor + 42)
    const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    if (INFO_PLIST.test(name) && !(flags & 1)) {
      matches.push({ name, method, compressedSize, localOffset })
    }
    cursor += 46 + nameLength + extraLength + commentLength
  }
  if (matches.length === 0) throw new Error(`${label} 内找不到主应用 Info.plist`)
  return matches[0]
}

function readEntry(buffer: Buffer, entry: DirectoryEntry): Buffer {
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26)
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28)
  const start = entry.localOffset + 30 + nameLength + extraLength
  const raw = buffer.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return raw
  if (entry.method === 8) return inflateRawSync(raw, { maxOutputLength: MAX_PLIST_SIZE })
  throw new Error(`不支持的 ZIP 压缩方式 ${entry.method}`)
}

async function probeByRange(url: string): Promise<{ info: Buffer; size: number }> {
  const known = resolvedUrls.get(url)
  const probe = await fetchWithRetry(known ?? url, {
    headers: { ...HEADERS, Range: 'bytes=0-0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  })
  const contentRange = probe.headers.get('content-range')
  const status = probe.status
  const target = probe.url || known || url
  await probe.body?.cancel()
  if (status !== 206 || !contentRange) throw new RangeUnsupported('服务器不支持 Range 请求')
  if (!known) resolvedUrls.set(url, target)
  const size = Number(contentRange.split('/')[1])
  if (!Number.isSafeInteger(size) || size <= 0) throw new RangeUnsupported('文件大小无效')

  const tailStart = Math.max(0, size - TAIL_SIZE)
  const tail = await fetchRange(target, tailStart, size - 1)
  const eocd = findEocd(tail)
  if (eocd < 0) throw new RangeUnsupported('未找到中央目录尾记录')

  const directorySize = tail.readUInt32LE(eocd + 12)
  const directoryOffset = tail.readUInt32LE(eocd + 16)
  if (
    tail.readUInt16LE(eocd + 10) === 0xffff ||
    directoryOffset === 0xffffffff ||
    directorySize === 0 ||
    directorySize > 8 * 1024 * 1024 ||
    directoryOffset + directorySize > tailStart + eocd
  ) {
    throw new RangeUnsupported('需要完整下载解析 ZIP 目录')
  }

  const directory =
    directoryOffset >= tailStart
      ? tail.subarray(directoryOffset - tailStart, directoryOffset - tailStart + directorySize)
      : await fetchRange(target, directoryOffset, directoryOffset + directorySize - 1)

  const entry = findInfoPlist(directory, url)
  const localHeader = await fetchRange(target, entry.localOffset, entry.localOffset + 29)
  if (localHeader.readUInt32LE(0) !== 0x04034b50) throw new RangeUnsupported('ZIP 本地头无效')
  const nameLength = localHeader.readUInt16LE(26)
  const extraLength = localHeader.readUInt16LE(28)
  const dataStart = entry.localOffset + 30 + nameLength + extraLength
  const payload = await fetchRange(target, dataStart, dataStart + entry.compressedSize - 1)

  const info =
    entry.method === 0
      ? payload
      : entry.method === 8
        ? inflateRawSync(payload, { maxOutputLength: MAX_PLIST_SIZE })
        : null
  if (!info) throw new RangeUnsupported(`不支持的 ZIP 压缩方式 ${entry.method}`)
  return { info, size }
}

async function probeByDownload(url: string): Promise<{ info: Buffer; size: number }> {
  const response = await fetchWithRetry(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(600_000),
  })
  if (!response.ok) throw new Error(`下载 IPA 失败: HTTP ${response.status}`)
  const archive = Buffer.from(await response.arrayBuffer())
  const tailStart = Math.max(0, archive.length - TAIL_SIZE)
  const eocd = findEocd(archive.subarray(tailStart))
  if (eocd < 0) throw new Error('IPA 不是有效的 ZIP 文件')
  const directorySize = archive.readUInt32LE(tailStart + eocd + 12)
  const directoryOffset = archive.readUInt32LE(tailStart + eocd + 16)
  const directory = archive.subarray(directoryOffset, directoryOffset + directorySize)
  const entry = findInfoPlist(directory, url)
  return { info: readEntry(archive, entry), size: archive.length }
}

const PRIVACY_KEY = /^NS[A-Za-z0-9]+UsageDescription/

function toMetadata(info: Buffer, size: number): IpaMetadata {
  const plist = parsePlist(info)
  const privacy: Record<string, string> = {}
  for (const [key, value] of Object.entries(plist)) {
    if (PRIVACY_KEY.test(key)) privacy[key] = typeof value === 'string' ? value : ''
  }
  const metadata: IpaMetadata = {
    bundleIdentifier: String(plist.CFBundleIdentifier ?? ''),
    version: String(plist.CFBundleShortVersionString ?? ''),
    buildVersion: String(plist.CFBundleVersion ?? ''),
    minOSVersion: String(plist.MinimumOSVersion ?? ''),
    size,
    privacy,
  }
  for (const field of ['bundleIdentifier', 'version', 'minOSVersion'] as const) {
    if (!metadata[field]) throw new Error(`Info.plist 缺少 ${field}`)
  }
  return metadata
}

export async function probeIpa(url: string): Promise<IpaMetadata> {
  try {
    const { info, size } = await probeByRange(url)
    return toMetadata(info, size)
  } catch (error) {
    if (!(error instanceof RangeUnsupported)) throw error
    const { info, size } = await probeByDownload(url)
    return toMetadata(info, size)
  }
}
