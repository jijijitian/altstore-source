# Altstore Source

自用的 AltStore / SideStore 软件源，收录以下开源项目的 iOS 版本：

| 应用 | 上游仓库 | 说明 |
| --- | --- | --- |
| Animeko | [open-ani/animeko](https://github.com/open-ani/animeko) | 一站式弹幕追番平台 |
| Kazumi | [Predidit/Kazumi](https://github.com/Predidit/Kazumi) | 自定义规则的番剧采集播放器 |
| Aidoku | [Aidoku/Aidoku](https://github.com/Aidoku/Aidoku) | 开源漫画阅读器 |
| 轻书架 | [LightNovelShelf/Flutter](https://github.com/LightNovelShelf/Flutter) | 轻书架官方客户端 |
| Wild | [niuhuan/wild](https://github.com/niuhuan/wild) | 轻小说文库第三方客户端 |
| Yomiru | [hesitation-snow/Yomiru](https://github.com/hesitation-snow/Yomiru) | 轻之国度第三方客户端 |
| LightNovelReader | [komorebiiluvu/LightNovelReader-For-IOS](https://github.com/komorebiiluvu/LightNovelReader-For-IOS) | iOS 轻小说阅读器 |
| 轻小说文库 | [jijijitian/light-novel-library_Wenku8_iOS](https://github.com/jijijitian/light-novel-library_Wenku8_iOS) | 轻小说文库 iOS 客户端 |

## 添加源

在 AltStore / SideStore 中通过 URL 添加：

```text
https://raw.githubusercontent.com/jijijitian/altstore-source/main/generated/apps.json
```

GitHub 直链无法访问时可用 jsDelivr 镜像（分支地址通常缓存 12 小时，更新可能滞后）：

```text
https://cdn.jsdelivr.net/gh/jijijitian/altstore-source@main/generated/apps.json
```

在线预览：[altsource-viewer](https://therealfoxster.github.io/altsource-viewer/view/?source=https://raw.githubusercontent.com/jijijitian/altstore-source/main/generated/apps.json)

## 说明

- 所有 IPA 都是上游 GitHub Releases 提供的**未签名**安装包，安装时由客户端用自己的证书重签，仅收录正式版，不含 Alpha / Beta / RC。
- 每个应用保留最近 10 个版本，方便回退。
- 版本号、build 号、最低系统版本、隐私权限说明都直接读取自 IPA 内的 `Info.plist`，与安装包真实内容一致；`sha256` 取自 GitHub 为发布文件提供的摘要。
- 应用图标与截图指向上游仓库的原始文件，不复制到本仓库。
- 本仓库只做索引，不托管任何安装包，版权与许可归各上游项目所有。

## 维护

源文件由脚本从 GitHub Releases 自动生成，无需手动编辑。

```bash
# 需要 Node.js 22.18+（直接运行 TypeScript）
export GITHUB_TOKEN=...   # 建议设置，否则受 GitHub API 速率限制

npm run generate        # 使用 .cache 里的 IPA 元数据缓存增量生成
npm run generate:fresh  # 忽略缓存，重新探测全部 IPA
npm run verify          # 校验 generated/apps.json
```

日常更新由 [`.github/workflows/update.yml`](.github/workflows/update.yml) 每 12 小时执行一次，检测到变化后自动提交。

## 目录结构

```text
assets/icons/       应用图标（512×512）
src/config.ts       应用元数据（描述、配色、截图、权限）
src/                生成脚本
generated/apps.json 生成的软件源
```

## License

[MIT](LICENSE)
