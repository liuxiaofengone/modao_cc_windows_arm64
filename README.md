# 墨刀 Windows ARM64 原生桌面客户端构建工具

这是一个能将官方发布的 Windows x86 (ia32) 版本的 [墨刀 (Modao)](https://modao.cc) 桌面客户端，一键重构成原生 **Windows ARM64** 程序的一键构建工具。

适用于骁龙 X Elite / X Plus 以及各类 Windows 11 on ARM 设备的本地原生体验，彻底摆脱系统仿真的电量消耗与卡顿，带来流畅的绘图及编辑体验。

> **为什么不采用之前的“网页多标签套壳”方案？**  
> 之前的方案通过 Electron 网页套壳访问 `modao.cc` Web 端。这导致墨刀桌面端独有的离线本地组件（如**离线快捷键、原生取色器子程序**等）缺失。本方案通过**直接解耦并套壳官方核心 `app.asar` 文件**，百分之百还原了官方客户端的全部本地原生功能与逻辑。

---

## 🛠️ 改造原理解析

### 1. 架构解耦
Electron 架构的应用极其适合在 ARM 平台上作跨架构重构，它分为：
* **Electron 壳程序（Runtime）**：包含 Chromium 渲染引擎、Node.js 运行时等 C++ 机器码，需编译为原生 ARM64 二进制文件。
* **业务逻辑代码（`app.asar`）**：存放于 `resources/` 目录下，包含全部 JS/HTML/CSS，属于纯跨平台的前端资产。

### 2. 兼容性核验
* **无原生 Native C++ 模块**：解压墨刀的核心 `app.asar` 代码库并进行全局检索后，确认内部没有引入任何特定架构的 Native `.node` 文件，这意味着它可在任意架构的 Electron 运行时下无缝加载。
* **墨刀的 Electron 版本**：为较新的 **`32.1.0`**，具有极其稳定的原生 Windows ARM64 支持。
* **取色器兼容**：其唯一的辅助程序 `mockingbot-color-picker-ia32.exe` 为屏幕取色工具。在 Windows 11 on ARM 设备上，当主程序原生 ARM64 运行并调用该取色器时，系统内置的 Prism 仿真器会自动无缝接管并仿真运行它，取色功能不受影响。

---

## 🚀 快速开始

### 1. 准备工作
确保你的设备上已安装了 Node.js（v18+）。

1. 克隆本项目：
   ```bash
   git clone https://cnb.cool/liuxiaofengone/modao_cc_windows_arm64.git
   cd modao_cc_windows_arm64
   ```
2. 确保在本地能访问到原版 Windows x86 墨刀客户端的 `resources/app.asar` 文件。
   > 本构建脚本在运行时，会默认自动检测同级目录下的 `../modao-win32/modao-win32-ia32-1.5.4/resources/app.asar` 路径。如果你已放置在此处，无需任何操作。

### 2. 一键构建

1. 安装本地打包和资源修改依赖：
   ```bash
   npm install
   ```
2. 运行构建脚本：
   ```bash
   npm run build
   ```

### 3. 构建结果
构建完成后，脚本会自动从 `npmmirror`（淘宝镜像）高速下载 Electron v32.1.0 ARM64 的原生 Windows 运行时，把 `app.asar` 合并进入，并使用 `rcedit` 动态修改可执行文件。

最终，会在当前目录下生成：
`./dist/modao-win32-arm64/`

在该目录下，你可以找到完美的 **`Mockitt.exe`** 原生 ARM64 绿色程序，它已经具备：
* **官方精美橙色 ICO 图标**（由原本的 PNG 图标高保真转码而成）
* **与官方一模一样的版本信息属性**（如公司名称、版权、文件版本等）

双击即可直接原生极速启动！

---

## 📂 项目结构说明

* `build.js` — 原生 ARM64 一键全自动下载、合并、图标注入与重命名打包脚本。
* `icon.ico` — 由墨刀官方高清 PNG 标志转码制成的多分辨率（从 16x16 直至 256x256 的全规格）Windows 原生图标文件。
* `package.json` — 声明构建所需的依赖（`adm-zip`、`rcedit` 等）。

---

## 📝 许可证

本项目构建配置基于 [MIT](LICENSE) 协议开源。墨刀官方客户端所有前端资产（如 `app.asar` 内的文件）版权归 MockingBot 所有，本开源项目不提供任何官方的业务逻辑代码，仅供学术探讨与个人学习使用。
