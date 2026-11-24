export type Category =
  | 'developer'
  | 'entertainment'
  | 'games'
  | 'lifestyle'
  | 'other'
  | 'photo-video'
  | 'social'
  | 'utilities'

export interface SizedImage {
  imageURL: string
  width: number
  height: number
}

export interface Screenshots {
  iphone: SizedImage[]
  ipad: SizedImage[]
}

export interface AppConfig {
  key: string
  repo: string
  name: string
  bundleIdentifier: string
  developerName: string
  subtitle: string
  description: string
  iconFile: string
  tintColor: string
  category: Category
  screenshots: Screenshots
  entitlements: string[]
  privacy: Record<string, string>
  maxVersions: number
}

const raw = (repo: string, branch: string, path: string) =>
  `https://raw.githubusercontent.com/${repo}/${branch}/${path}`

export const APPS: AppConfig[] = [
  {
    key: 'animeko',
    repo: 'open-ani/animeko',
    name: 'Animeko',
    bundleIdentifier: 'org.animeko.animeko',
    developerName: 'openani',
    subtitle: '一站式弹幕追番平台',
    description:
      '集找番、追番、看番的一站式弹幕追番平台。支持 Bangumi 云收藏同步、离线缓存、BitTorrent 下载与弹幕云过滤，基于 Kotlin Multiplatform 构建，覆盖 iOS、Android 与桌面端。\n\n配套仓库：https://github.com/open-ani/animeko\n官方网站：https://animeko.org',
    iconFile: 'animeko.png',
    tintColor: '#1F6FC4',
    category: 'entertainment',
    screenshots: {
      iphone: [
        'home',
        'anime-schedule',
        'subject-collection',
        'search-by-tag',
        'subject-details',
      ].map((name) => ({
        imageURL: raw('open-ani/animeko', 'main', `.readme/images/features/${name}.png`),
        width: 575,
        height: 1280,
      })),
      ipad: [],
    },
    entitlements: [],
    privacy: {
      NSCameraUsageDescription: '用于扫描电视端登录时显示的二维码。',
    },
    maxVersions: 10,
  },
  {
    key: 'kazumi',
    repo: 'Predidit/Kazumi',
    name: 'Kazumi',
    bundleIdentifier: 'com.example.kazumi',
    developerName: 'Predidit',
    subtitle: '自定义规则的番剧采集播放器',
    description:
      '使用 Flutter 开发的番剧采集与在线观看 App。用基于 XPath 语法的自定义规则抓取站点，支持规则导入与分享、弹幕、批量下载缓存，以及基于 Anime4K 的实时超分辨率。\n\n配套仓库：https://github.com/Predidit/Kazumi\n官方网站：https://kazumi.app',
    iconFile: 'kazumi.png',
    tintColor: '#7FA82E',
    category: 'entertainment',
    screenshots: {
      iphone: [1, 2, 3, 4, 5, 6].map((i) => ({
        imageURL: raw('Predidit/Kazumi', 'main', `static/screenshot/img_${i}.png`),
        width: 1228,
        height: 2700,
      })),
      ipad: [],
    },
    entitlements: [],
    privacy: {
      NSPhotoLibraryAddUsageDescription: '用于把截图和缓存的图片保存到相册。',
    },
    maxVersions: 10,
  },
  {
    key: 'aidoku',
    repo: 'Aidoku/Aidoku',
    name: 'Aidoku',
    bundleIdentifier: 'app.aidoku.Aidoku',
    developerName: 'Aidoku',
    subtitle: '开源漫画阅读器',
    description:
      '面向 iOS、iPadOS 与 macOS 的开源漫画阅读器。通过书源扩展在线获取内容，也可以连接局域网内的 Komga、Kavita 服务器，支持书架管理、下载离线与阅读进度同步。\n\n配套仓库：https://github.com/Aidoku/Aidoku\n官方网站：https://aidoku.app',
    iconFile: 'aidoku.png',
    tintColor: '#D91F3C',
    category: 'lifestyle',
    screenshots: {
      iphone: ['library-noframe', 'source-noframe', 'reader-noframe'].map((name) => ({
        imageURL: raw('Aidoku/Website', 'main', `static/images/${name}.png`),
        width: 1206,
        height: 2622,
      })),
      ipad: [],
    },
    entitlements: [
      'aps-environment',
      'com.apple.developer.icloud-container-environment',
      'com.apple.developer.icloud-container-identifiers',
      'com.apple.developer.icloud-services',
      'com.apple.developer.ubiquity-container-identifiers',
      'com.apple.developer.ubiquity-kvstore-identifier',
      'com.apple.developer.user-fonts',
      'get-task-allow',
    ],
    privacy: {
      NSFaceIDUsageDescription: '用于锁定应用内需要保护的设置项。',
      NSLocalNetworkUsageDescription: '用于连接局域网内的 Komga 与 Kavita 服务器。',
      NSPhotoLibraryUsageDescription: '用于把漫画页面保存到相册。',
    },
    maxVersions: 10,
  },
  {
    key: 'lightnovelshelf',
    repo: 'LightNovelShelf/Flutter',
    name: '轻书架',
    bundleIdentifier: 'app.lightnovel.shelf',
    developerName: 'LightNovelShelf',
    subtitle: '轻书架官方客户端',
    description:
      '轻书架（LightNovelShelf）官方 Flutter 客户端，面向 iOS 与 iPadOS。支持书架同步、在线阅读与离线缓存，可将图片保存到专属相册；平板端提供侧边导航与左右分栏布局。\n\n配套仓库：https://github.com/LightNovelShelf/Flutter',
    iconFile: 'lightnovelshelf.png',
    tintColor: '#4756C8',
    category: 'lifestyle',
    screenshots: { iphone: [], ipad: [] },
    entitlements: [],
    privacy: {
      NSPhotoLibraryAddUsageDescription: '保存预览中的图片到相册。',
      NSPhotoLibraryUsageDescription: '开启「图片保存到专属目录」后，把图片存进「轻书架」相册。',
    },
    maxVersions: 10,
  },
  {
    key: 'wild',
    repo: 'niuhuan/wild',
    name: 'Wild',
    bundleIdentifier: 'opensource.wild',
    developerName: 'niuhuan',
    subtitle: '轻小说文库第三方客户端',
    description:
      '轻小说文库（wenku8）第三方客户端，支持 iOS、Android 与桌面平台。提供书架分卷、在线阅读与下载缓存，支持多语言界面，使用 Material Design 3 风格。\n\n配套仓库：https://github.com/niuhuan/wild',
    iconFile: 'wild.png',
    tintColor: '#9E1B34',
    category: 'lifestyle',
    screenshots: {
      iphone: [1, 2, 3, 4].map((i) => ({
        imageURL: raw('niuhuan/wild', 'main', `images/IMG_0${i}.PNG`),
        width: 1179,
        height: 2556,
      })),
      ipad: [],
    },
    entitlements: [],
    privacy: {
      NSPhotoLibraryUsageDescription: '用于把书内插图保存到相册。',
    },
    maxVersions: 10,
  },
  {
    key: 'yomiru',
    repo: 'hesitation-snow/Yomiru',
    name: 'Yomiru',
    bundleIdentifier: 'moe.yutro.yomiru',
    developerName: 'hesitation-snow',
    subtitle: '轻之国度第三方客户端',
    description:
      '使用 Flutter 开发的轻之国度第三方客户端，集小说阅读、书架管理与社区交流于一体。支持滚动与翻页阅读、正文缓存、简繁体切换，适配深色模式、平板与大屏设备。\n\n配套仓库：https://github.com/hesitation-snow/Yomiru',
    iconFile: 'yomiru.png',
    tintColor: '#7A5FC0',
    category: 'lifestyle',
    screenshots: {
      iphone: [1, 2, 3].map((i) => ({
        imageURL: raw('hesitation-snow/Yomiru', 'main', `assets/screenshot${i}.jpg`),
        width: 1170,
        height: 2532,
      })),
      ipad: [],
    },
    entitlements: [],
    privacy: {
      NSPhotoLibraryAddUsageDescription: '用于将动态和评论图片保存到相册。',
      NSPhotoLibraryUsageDescription: '用于选择并上传动态和评论图片。',
    },
    maxVersions: 10,
  },
  {
    key: 'lightnovelreader',
    repo: 'komorebiiluvu/LightNovelReader-For-IOS',
    name: 'LightNovelReader',
    bundleIdentifier: 'com.komorebiiluv.LightNovelReader',
    developerName: 'komorebiiluvu',
    subtitle: 'iOS 轻小说阅读器',
    description:
      '基于 SwiftUI 与 Kotlin Multiplatform 的 iOS 轻小说阅读器，支持 iPhone 与 iPad。提供真实书源、卷曲翻页与滚动阅读、多书架管理、整本离线缓存、EPUB / TXT 导出与阅读统计。\n\n配套仓库：https://github.com/komorebiiluvu/LightNovelReader-For-IOS',
    iconFile: 'lightnovelreader.png',
    tintColor: '#6E5BB0',
    category: 'lifestyle',
    screenshots: {
      iphone: [],
      ipad: [1, 2, 3, 4, 5, 6, 7].map((i) => ({
        imageURL: raw(
          'komorebiiluvu/LightNovelReader-For-IOS',
          'main',
          `assets/screenshots/${String(i).padStart(2, '0')}.png`,
        ),
        width: 1536,
        height: 2048,
      })),
    },
    entitlements: [],
    privacy: {},
    maxVersions: 10,
  },
  {
    key: 'wenku8',
    repo: 'jijijitian/light-novel-library_Wenku8_iOS',
    name: '轻小说文库',
    bundleIdentifier: 'org.jijijitian.wenku8.ios',
    developerName: 'jijijitian',
    subtitle: '轻小说文库 iOS 客户端',
    description:
      '轻小说文库（wenku8.net）的第三方 iOS 客户端，使用 SwiftUI 编写，界面采用 iOS 26 起的液态玻璃风格。提供云端书架同步、整本与分卷离线下载、四种配色的阅读器，以及封面取色、iPad 横屏适配等细节。\n\n配套仓库：https://github.com/jijijitian/light-novel-library_Wenku8_iOS',
    iconFile: 'wenku8.png',
    tintColor: '#4A66E0',
    category: 'lifestyle',
    screenshots: {
      iphone: ['home', 'explore', 'detail', 'reader', 'reviews'].map((name) => ({
        imageURL: raw(
          'jijijitian/light-novel-library_Wenku8_iOS',
          'master',
          `.readme/images/${name}.jpg`
        ),
        width: 603,
        height: 1311,
      })),
      ipad: [],
    },
    entitlements: [],
    privacy: {},
    maxVersions: 10,
  },
]

export const SOURCE = {
  name: 'Altstore Source',
  identifier: 'io.github.jijijitian.altstore-source',
  subtitle: '自用 AltStore / SideStore 软件源',
  description:
    '个人自用的 AltStore / SideStore 软件源，收录以下开源项目的 iOS 版本：Animeko、Kazumi、Aidoku、轻书架、Wild、Yomiru、LightNovelReader、轻小说文库。所有安装包均来自各项目 GitHub Releases 的未签名 IPA，由客户端使用本地证书签名后安装。\n\n配套仓库：\nhttps://github.com/open-ani/animeko\nhttps://github.com/Predidit/Kazumi\nhttps://github.com/LightNovelShelf/Flutter\nhttps://github.com/niuhuan/wild\nhttps://github.com/hesitation-snow/Yomiru\nhttps://github.com/Aidoku/Aidoku\nhttps://github.com/komorebiiluvu/LightNovelReader-For-IOS\nhttps://github.com/jijijitian/light-novel-library_Wenku8_iOS',
  repo: 'jijijitian/altstore-source',
  branch: 'main',
  file: 'generated/apps.json',
  tintColor: '#1F6FC4',
} as const
