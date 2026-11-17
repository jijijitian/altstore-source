import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HEADER = 'bplist00'
const TRAILER_SIZE = 32

function readUInt(buffer: Buffer, offset: number, size: number): number {
  let value = 0
  for (let i = 0; i < size; i++) value = value * 256 + buffer[offset + i]
  return value
}

function readInt(buffer: Buffer, offset: number, size: number): number {
  if (size < 8) return readUInt(buffer, offset, size)
  const high = readUInt(buffer, offset, 4)
  const low = readUInt(buffer, offset + 4, 4)
  return high * 0x100000000 + low
}

class BinaryPlistReader {
  private readonly buffer: Buffer
  private readonly offsets: number[]
  private readonly refSize: number
  private readonly topObject: number

  constructor(buffer: Buffer) {
    this.buffer = buffer
    if (buffer.subarray(0, 8).toString('latin1') !== HEADER) {
      throw new Error('不是 bplist00 格式')
    }
    const trailer = buffer.length - TRAILER_SIZE
    const offsetSize = buffer[trailer + 6]
    this.refSize = buffer[trailer + 7]
    const objectCount = readInt(buffer, trailer + 8, 8)
    this.topObject = readInt(buffer, trailer + 16, 8)
    const tableOffset = readInt(buffer, trailer + 24, 8)
    if (!objectCount || tableOffset <= 0 || tableOffset + objectCount * offsetSize > trailer) {
      throw new Error('bplist 偏移表越界')
    }
    this.offsets = []
    for (let i = 0; i < objectCount; i++) {
      this.offsets.push(readUInt(buffer, tableOffset + i * offsetSize, offsetSize))
    }
  }

  parse(): unknown {
    return this.object(this.topObject)
  }

  private length(offset: number, info: number): { count: number; start: number } {
    if (info !== 0xf) return { count: info, start: offset + 1 }
    const marker = this.buffer[offset + 1]
    if (marker >> 4 !== 0x1) throw new Error('bplist 长度标记无效')
    const size = 1 << (marker & 0xf)
    return { count: readInt(this.buffer, offset + 2, size), start: offset + 2 + size }
  }

  private object(index: number): unknown {
    const offset = this.offsets[index]
    if (offset === undefined) throw new Error(`bplist 对象 ${index} 不存在`)
    const marker = this.buffer[offset]
    const type = marker >> 4

    switch (type) {
      case 0x0:
        if (marker === 0x08) return false
        if (marker === 0x09) return true
        return null
      case 0x1: {
        const size = 1 << (marker & 0xf)
        return readInt(this.buffer, offset + 1, size)
      }
      case 0x2: {
        const size = 1 << (marker & 0xf)
        return size === 4
          ? this.buffer.readFloatBE(offset + 1)
          : this.buffer.readDoubleBE(offset + 1)
      }
      case 0x3:
        return new Date(Date.UTC(2001, 0, 1) + this.buffer.readDoubleBE(offset + 1) * 1000)
      case 0x4: {
        const { count, start } = this.length(offset, marker & 0xf)
        return this.buffer.subarray(start, start + count)
      }
      case 0x5: {
        const { count, start } = this.length(offset, marker & 0xf)
        return this.buffer.subarray(start, start + count).toString('latin1')
      }
      case 0x6: {
        const { count, start } = this.length(offset, marker & 0xf)
        const raw = this.buffer.subarray(start, start + count * 2)
        return raw.swap16().toString('utf16le')
      }
      case 0xa: {
        const { count, start } = this.length(offset, marker & 0xf)
        const items: unknown[] = []
        for (let i = 0; i < count; i++) {
          items.push(this.object(readUInt(this.buffer, start + i * this.refSize, this.refSize)))
        }
        return items
      }
      case 0xd: {
        const { count, start } = this.length(offset, marker & 0xf)
        const result: Record<string, unknown> = {}
        for (let i = 0; i < count; i++) {
          const key = this.object(
            readUInt(this.buffer, start + i * this.refSize, this.refSize)
          )
          const value = this.object(
            readUInt(this.buffer, start + (count + i) * this.refSize, this.refSize)
          )
          result[String(key)] = value
        }
        return result
      }
      default:
        throw new Error(`bplist 不支持的对象类型 0x${type.toString(16)}`)
    }
  }
}

export function parseBinaryPlist(buffer: Buffer): Record<string, unknown> {
  const value = new BinaryPlistReader(buffer).parse()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Info.plist 根节点不是字典')
  }
  return value as Record<string, unknown>
}

const ENTITY: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

function decodeXml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITY[m] ?? m)
}

function parseXmlPlist(text: string): Record<string, unknown> {
  const root = /<dict>([\s\S]*)<\/dict>/.exec(text)
  if (!root) throw new Error('XML plist 缺少根字典')
  const result: Record<string, unknown> = {}
  const pattern =
    /<key>([\s\S]*?)<\/key>\s*(?:<string>([\s\S]*?)<\/string>|<integer>([\s\S]*?)<\/integer>|<true\/>|<false\/>|<dict>[\s\S]*?<\/dict>|<array>[\s\S]*?<\/array>)?/g
  for (const match of root[1].matchAll(pattern)) {
    const key = decodeXml(match[1])
    if (match[2] !== undefined) result[key] = decodeXml(match[2])
    else if (match[3] !== undefined) result[key] = Number(match[3])
    else if (match[0].includes('<true/>')) result[key] = true
    else if (match[0].includes('<false/>')) result[key] = false
  }
  return result
}

export function parsePlist(buffer: Buffer): Record<string, unknown> {
  if (buffer.subarray(0, 8).toString('latin1') === HEADER) return parseBinaryPlist(buffer)
  const text = buffer.toString('utf8')
  if (!text.includes('<plist')) throw new Error('无法识别的 plist 格式')
  return parseXmlPlist(text)
}

export function readLocalPlist(path: string): Record<string, unknown> {
  return parsePlist(readFileSync(join(process.cwd(), path)))
}
