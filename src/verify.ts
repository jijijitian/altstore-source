import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SOURCE } from './config.ts'
import { validateSource } from './validate.ts'

for (const file of ['generated/apps.json', 'generated/apps-ghproxy.json']) {
  const path = join(process.cwd(), file)
  const source = JSON.parse(await readFile(path, 'utf8'))
  validateSource(source)

  // 中转源里除了描述文本中的仓库地址，所有媒体与安装包链接都必须是中转地址。
  const isMirror = file.includes('ghproxy')
  if (isMirror) {
    const inner = (url: string) => url.replace(/^https:\/\/gh-proxy\.org\//, '')
    const check = (url: string, label: string) => {
      if (!url.startsWith('https://gh-proxy.org/https://')) {
        throw new Error(`${file} ${label} 未使用中转地址：${url}`)
      }
      if (!inner(url).startsWith('https://')) throw new Error(`${file} ${label} 内层地址无效：${url}`)
    }
    check(source.iconURL, 'iconURL')
    check(source.headerURL, 'headerURL')
    check(source.sourceURL, 'sourceURL')
    for (const app of source.apps as any[]) {
      check(app.iconURL, `${app.name}.iconURL`)
      for (const shot of [...app.screenshots.iphone, ...app.screenshots.ipad]) {
        check(shot.imageURL, `${app.name}.screenshot`)
      }
      for (const version of app.versions) check(version.downloadURL, `${app.name}.downloadURL`)
    }
  }

  const apps = source.apps as { name: string; versions: unknown[] }[]
  const total = apps.reduce((sum, app) => sum + app.versions.length, 0)
  console.log(`校验通过：${file}，${apps.length} 个应用，${total} 个版本`)
}

void SOURCE
