# 墨刀桌面客户端 (Modao Desktop)

Windows ARM64 原生桌面客户端，为 [墨刀](https://modao.cc) 提供类似 Figma 桌面客户端的体验——支持多标签页浏览，登录态跨标签共享。

## 技术栈

| 类别 | 技术 |
|---|---|
| 桌面框架 | Electron 35 |
| 多标签页 | `WebContentsView` — 每标签独立 Chromium 进程 |
| 会话共享 | `session.fromPartition('persist:modao')` |
| 打包 | electron-builder → NSIS ARM64 安装程序 |
| 开发语言 | TypeScript |
| 图标转换 | sharp (SVG → ICO/PNG) |

## 项目结构

```
├── src/
│   ├── main/                    # 主进程
│   │   ├── index.ts             # 应用入口、窗口管理、系统托盘
│   │   ├── tab-manager.ts       # 标签页生命周期管理
│   │   ├── navigation-filter.ts # URL 白名单过滤
│   │   ├── session-manager.ts   # 共享 Session 配置
│   │   └── ipc-handlers.ts      # IPC 通信处理
│   ├── preload/
│   │   └── preload.ts           # contextBridge 安全 API
│   └── renderer/                # 渲染进程（标签栏 UI）
│       ├── index.html
│       ├── index.ts
│       └── styles.css
├── resources/                   # 应用图标
├── electron-builder.yml         # 打包配置
└── package.json
```

## 功能特性

- **多标签页** — 墨刀链接自动在新标签页打开，支持 `Ctrl+T/W/Tab` 快捷键
- **登录态共享** — 所有标签共享同一个持久化 Session，一处登录全局生效
- **URL 过滤** — 墨刀域名白名单，外部链接自动调起系统浏览器
- **系统托盘** — 关闭窗口最小化到托盘，后台运行不退出
- **多屏自适应** — 最大化时自动检测窗口所在屏幕的工作区尺寸
- **无边框窗口** — 自定义标题栏，暗色主题

## 开发

```bash
# 安装依赖
npm install

# 开发运行
npm start

# 打包（Windows ARM64 NSIS 安装程序）
npm run dist

# 仅打包目录（调试用）
npm run pack
```

> 打包时如遇网络问题，脚本已预设华为云 Electron 镜像及 npmmirror 构建工具镜像，无需额外配置。

## 许可

MIT
