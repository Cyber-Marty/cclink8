# cclink8

[![CI](https://github.com/Cyber-Marty/cclink8/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Cyber-Marty/cclink8/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Cyber-Marty/cclink8)](https://github.com/Cyber-Marty/cclink8/releases/latest)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Clickable file paths and URLs in Claude Code, with a safe terminal fallback.**  
**让 Claude Code 里的文件路径和网址可点击跳转，终端不支持时安全降级。**

[English](#english) | [中文](#中文)

---

## English

`cclink8` is a Claude Code plugin (an official `ui.render` mod) plus a small CLI. It rewrites assistant markdown so paths like `C:\repo\file.py:42` and URLs become real OSC 8 links. When the terminal cannot render links, it says so and gives you `cclink8 open` instead of pretending.

- No local HTTP server
- No file tracking or previews
- No telemetry
- No automatic opening
- No shell execution
- Zero configuration: the plugin sets `FORCE_HYPERLINK=1` in-session unless you explicitly set it

Requires Claude Code **2.1.287+** for mods. The CLI requires Node **20+**.

### Install

**Claude Code plugin** (self-contained; no npm install for the plugin):

```sh
claude plugin marketplace add Cyber-Marty/cclink8
claude plugin install cclink8@cclink8
```

Start a new session or run `/reload-plugins`. In a session, `/plugin` should show `cclink8` as active. No environment setup is required. If you explicitly set `FORCE_HYPERLINK=0`/`false`, cclink8 respects it and links may not be clickable.

**CLI** — npm registry is **pending**. Install from the GitHub repo, a packed tarball, or source:

```sh
git clone https://github.com/Cyber-Marty/cclink8.git
cd cclink8
npm install
npm run build -w cclink8

npm pack -w cclink8
npm i -g ./cclink8-0.1.3.tgz
cclink8 doctor
```

The CLI bundles `@cclink8/core` into `dist/index.js`; the tarball has no runtime dependency on an unpublished package.

### Five MVP scenarios

1. `C:\repo\file.py:42` → Ctrl+Click in Windows Terminal / VS Code.
2. `\\server\share\file` → open Explorer or the default app.
3. `https://example.com/...` → open the browser.
4. Paths with spaces, Chinese, brackets, `#`, `%` encode correctly.
5. A terminal without OSC 8 → full path shown plus `cclink8 open <path>`.

### CLI

```text
cclink8 open <path-or-url>       # explicit open (user action)
cclink8 print <path-or-url>      # markdown / osc8 / plain
cclink8 print --text "<text>"    # linkify a block via @cclink8/core
cclink8 copy <path-or-url>       # copy path/URL to clipboard
cclink8 doctor                   # terminal detection and setup hints
cclink8 demo                     # five example links
cclink8 init                     # print plugin install instructions
```

**Semantics**

- `print` and `open`/`copy` check local files and fail with exit code 1 if the file is missing. `print --text` only links paths that exist, so prose cannot become one giant path.
- UNC paths are not pre-verified with `statSync` (an unreachable SMB server can hang the CLI); the launcher handles them.
- The plugin only guarantees **syntax**: a rendered path may not exist on your machine. `cclink8 print`/`open`/`copy` are the existence-checked paths.
- `:42` / `:42:3` stays in the clickable label, but v0.1 opens the file; jumping to the line is v0.2.

`open` uses `execFile`-style argv and never `shell: true`: Windows files/directories use `explorer.exe`; URLs use `rundll32.exe url.dll,FileProtocolHandler`. macOS uses `open`; Linux uses `xdg-open`. Windows launchers often return non-zero after a successful launch, so the CLI treats the `spawn` event as success and detaches.

### Terminal matrix

| Level | Terminal | Behavior |
|---|---|---|
| A | Windows Terminal, VS Code, iTerm2, WezTerm, Ghostty, kitty | OSC 8 link; Ctrl+Click |
| B | Markdown-capable TUI | `[label](url)` |
| C | cmd/PowerShell, Apple Terminal | full path/URL + `cclink8 open` |
| D | tmux 3.4+/SSH | `-T hyperlinks`; otherwise copy or CLI |

`cclink8 doctor` prints the detected level and a concrete fix. If nothing renders, use the CLI; it is the guaranteed path.

### Troubleshooting

**Ctrl+Click does nothing for a `.txt` or any file.** The plugin sets `FORCE_HYPERLINK=1` automatically in-session; no manual setup is needed. If you explicitly set `FORCE_HYPERLINK=0`/`false`, the plugin respects it and links may not be clickable — unset it or use `cclink8 open <path>`.

**Use Windows Terminal or VS Code.** The VS Code terminal has a known file-link scheme issue (#78833); if links still do not open, use `cclink8 open <path>`.

**If you see `path (file:///...)`**, the terminal is not enabling OSC 8. Click the URL text or use `cclink8 open <path>`.

### Why not the alternatives?

| Project | What it does | cclink8 |
|---|---|---|
| Claude Code native OSC 8 | Emits links in assistant output | Stands on it; only fills detection/format gaps |
| [cclinks](https://pypi.org/project/cclinks/) | Picks links from session transcripts with fzf | Complements it; cclinks is the picker, cclink8 is the renderer |
| [link plugin](https://claudemods.dev/en/builds/link-5ff37b) | `ui.render` path rewriting | Same idea; cclink8 is Windows-first, safe-fallback, no local server |
| [glass plugin](https://claudemods.dev/en/builds/glass-428358) | Redraws assistant replies, https as OSC 8 | Different scope; cclink8 covers files + URLs + fallback |
| [FlowLink MCP](https://cdn.jsdelivr.net/npm/flowlink-mcp@1.3.0/README.md) | Local HTTP file links, tracking, previews | Deliberately not: no server, no tracking, no previews |

### Security

- Only `file:`, `http:`, and `https:` are accepted by the CLI; `javascript:`, `data:`, `vbscript:`, `smb:` are rejected.
- The plugin only guarantees **syntax**; it does not verify that a file exists.
- `cclink8 open`/`copy` verify local files before opening/copying; `print`/`print --text` also only link existing local paths.
- Paths are canonicalized; controlled characters and ANSI/OSC injection are rejected.
- The plugin only changes what is drawn; it never opens a file or URL by itself.
- No telemetry. `doctor` is local-only; sharing its output is opt-in.

See [SECURITY.md](SECURITY.md) for reporting and the threat model.

### Development

```sh
npm install
npm run build
npm test
npm run plugin:validate   # if Claude Code is installed
```

Repo layout:

```text
packages/core            parser / resolver / rewriter
packages/cli             cclink8 open / print / copy / doctor / demo
packages/claude-plugin   ui.render hooks module + manifest
```

The plugin build bundles `@cclink8/core` into one self-contained hooks module; marketplace installs do not need `node_modules` or `npm install`.

### Status

- v0.1.3 (zero-config OSC 8, no manual environment setup)
- 78 unit tests + 18 plugin tests
- CI green on Windows / macOS / Ubuntu × Node 20/22
- npm CLI registry publish pending

### License

Apache-2.0. Contributions use DCO sign-off; see [CONTRIBUTING.md](CONTRIBUTING.md). Governance is in [GOVERNANCE.md](GOVERNANCE.md).

---

## 中文

`cclink8` 是一个 Claude Code 插件（官方 `ui.render` mod）加一个小型 CLI。它重写 assistant 的 Markdown，把 `C:\repo\file.py:42` 这类路径和网址变成真正的 OSC 8 链接。终端不支持链接时，它明确降级并给出 `cclink8 open`，而不是假装可点。

- 不启动本地 HTTP 服务
- 不跟踪文件、不做预览
- 无 telemetry
- 不自动打开
- 不执行 shell
- 零配置：插件会在 session 内自动设置 `FORCE_HYPERLINK=1`（除非你显式设置）

需要 Claude Code **2.1.287+**（mods）；CLI 需要 Node **20+**。

### 安装

**Claude Code 插件**（自包含，不需要 npm install）：

```sh
claude plugin marketplace add Cyber-Marty/cclink8
claude plugin install cclink8@cclink8
```

启动新会话，或运行 `/reload-plugins`。在会话里运行 `/plugin`，应看到 `cclink8` 处于 active。不需要任何环境变量设置。如果你显式设置了 `FORCE_HYPERLINK=0`/`false`，插件会尊重它，此时链接可能不可点。

**CLI** —— npm registry 仍 **pending**。可从 GitHub 仓库、打包的 tarball 或源码安装：

```sh
git clone https://github.com/Cyber-Marty/cclink8.git
cd cclink8
npm install
npm run build -w cclink8

npm pack -w cclink8
npm i -g ./cclink8-0.1.3.tgz
cclink8 doctor
```

CLI 会把 `@cclink8/core` 打包进 `dist/index.js`；tarball 不依赖未发布的 npm 包。

### 五个 MVP 场景

1. `C:\repo\file.py:42` → 在 Windows Terminal / VS Code 里 Ctrl+Click。
2. `\\server\share\file` → 打开资源管理器或默认应用。
3. `https://example.com/...` → 打开浏览器。
4. 含空格、中文、括号、`#`、`%` 的路径正确编码。
5. 终端不支持 OSC 8 → 显示完整路径，并提示 `cclink8 open <path>`。

### CLI

```text
cclink8 open <path-or-url>       # 显式打开（用户动作）
cclink8 print <path-or-url>      # markdown / osc8 / plain
cclink8 print --text "<text>"    # 用 @cclink8/core 链接化一段文本
cclink8 copy <path-or-url>       # 复制路径/URL 到剪贴板
cclink8 doctor                   # 终端检测与修复建议
cclink8 demo                     # 五个示例链接
cclink8 init                     # 打印插件安装说明
```

**语义**

- `print`、`open`、`copy` 会校验本地文件；文件不存在时退出码为 1。`print --text` 只链接存在的路径，避免把整段文字误判成一个路径。
- UNC 路径不用 `statSync` 预检（不可达的 SMB 服务器可能挂起 CLI），由启动器处理。
- 插件只保证**语法**可点；渲染出的路径不一定存在。`cclink8 print`/`open`/`copy` 才是带存在性校验的路径。
- `:42` / `:42:3` 保留在可点击 label 中，但 v0.1 只打开文件；跳转到行是 v0.2。

`open` 使用 `execFile` 风格 argv，绝不使用 `shell: true`：Windows 文件/目录用 `explorer.exe`，URL 用 `rundll32.exe url.dll,FileProtocolHandler`；macOS 用 `open`；Linux 用 `xdg-open`。Windows 启动器常在成功打开后返回非 0，所以 CLI 以 `spawn` 事件作为成功信号并 detach。

### 终端矩阵

| 级别 | 终端 | 行为 |
|---|---|---|
| A | Windows Terminal、VS Code、iTerm2、WezTerm、Ghostty、kitty | OSC 8 链接；Ctrl+Click |
| B | 支持 Markdown 的 TUI | `[label](url)` |
| C | cmd/PowerShell、Apple Terminal | 完整路径/URL + `cclink8 open` |
| D | tmux 3.4+/SSH | `-T hyperlinks`；否则复制或 CLI |

`cclink8 doctor` 会打印检测到的级别和具体修复建议。如果什么都不显示，直接用 CLI，它是最可靠的兜底。

### 排障

**`.txt` 或任意文件 Ctrl+Click 没反应。** 插件会在 session 内自动设置 `FORCE_HYPERLINK=1`，无需手动配置。如果你显式设置了 `FORCE_HYPERLINK=0`/`false`，插件会尊重它，此时链接可能不可点——取消该设置，或用 `cclink8 open <path>`。

**请使用 Windows Terminal 或 VS Code。** VS Code 终端有已知的 file-link scheme 问题（#78833）；如果仍打不开，用 `cclink8 open <path>`。

**如果显示 `路径 (file:///...)`**，说明终端没有启用 OSC 8。点击括号里的 URL，或用 `cclink8 open <path>`。

### 为什么不用替代方案？

| 项目 | 功能 | cclink8 |
|---|---|---|
| Claude Code 原生 OSC 8 | 在 assistant 输出里发链接 | 站在它上面；只补检测/格式缺口 |
| [cclinks](https://pypi.org/project/cclinks/) | 用 fzf 从会话记录里选链接 | 互补：cclinks 是选择器，cclink8 是渲染器 |
| [link 插件](https://claudemods.dev/en/builds/link-5ff37b) | `ui.render` 重写路径 | 同思路；cclink8 更偏 Windows、安全降级、无本地服务 |
| [glass 插件](https://claudemods.dev/en/builds/glass-428358) | 重绘 assistant 回复，把 https 变 OSC 8 | 范围不同；cclink8 覆盖文件 + URL + 降级 |
| [FlowLink MCP](https://cdn.jsdelivr.net/npm/flowlink-mcp@1.3.0/README.md) | 本地 HTTP 文件链接、跟踪、预览 | 刻意不做：无服务器、无跟踪、无预览 |

### 安全

- CLI 只接受 `file:`、`http:`、`https:`；拒绝 `javascript:`、`data:`、`vbscript:`、`smb:`。
- 插件只保证**语法**可点，不校验文件是否存在。
- `cclink8 open`/`copy` 打开/复制前校验本地文件；`print`/`print --text` 也只链接存在的本地路径。
- 路径会 canonicalize；拒绝控制字符和 ANSI/OSC 注入。
- 插件只改绘制内容，绝不自己打开文件或 URL。
- 无 telemetry。`doctor` 只在本地运行；分享输出需你主动选择。

安全报告和威胁模型见 [SECURITY.md](SECURITY.md)。

### 开发

```sh
npm install
npm run build
npm test
npm run plugin:validate   # 如果本机安装了 Claude Code
```

仓库结构：

```text
packages/core            parser / resolver / rewriter
packages/cli             cclink8 open / print / copy / doctor / demo
packages/claude-plugin   ui.render hooks module + manifest
```

插件构建会把 `@cclink8/core` 打包成一个自包含的 hooks 模块；marketplace 安装不需要 `node_modules` 或 `npm install`。

### 状态

- v0.1.3（零配置 OSC 8，无需手动设置环境变量）
- 78 个单测 + 18 个 plugin 测试
- CI 在 Windows / macOS / Ubuntu × Node 20/22 全绿
- npm CLI registry 发布仍 pending

### 许可证

Apache-2.0。贡献使用 DCO sign-off；见 [CONTRIBUTING.md](CONTRIBUTING.md)。治理见 [GOVERNANCE.md](GOVERNANCE.md)。
