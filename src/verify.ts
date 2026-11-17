import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SOURCE } from './config.ts'
import { validateSource } from './validate.ts'

const path = join(process.cwd(), SOURCE.file)
const source = JSON.parse(await readFile(path, 'utf8'))
validateSource(source)
const apps = source.apps as { name: string; versions: unknown[] }[]
const total = apps.reduce((sum, app) => sum + app.versions.length, 0)
console.log(`校验通过：${SOURCE.file}，${apps.length} 个应用，${total} 个版本`)
