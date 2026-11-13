# cclink8 产品规格：Claude Code 可点击链接层

- 日期：2026-11-13
- 项目代号：**cclink8**（Claude Code + OSC 8）
- 形态：Claude Code 插件 + `cclink8` CLI + 薄 skill
- 许可证：Apache-2.0 + DCO
- 评审方式：三位独立产品经理备忘录 → 汇总裁决

---

## 0. 一句话结论

**做一个 Windows-first、确定性解析、默认安全的 Claude Code 链接渲染层：终端支持就发 OSC 8 真链接，不支持就显式降级并给一条 `cclink8 open` 兜底命令。**

不是 skill，不是 MCP，不是本地 HTTP 文件服务器；核心是 `ui.render` 插件。

---

## 1. 三位产品经理的立场与裁决

| 议题 | PM-A 平台/生态 | PM-B 终端 UX | PM-C 开源治理 | 最终裁决 |
|---|---|---|---|---|
| 核心形态 | `ui.render` 插件 + `cclink` CLI | `ui.render` 插件 + `cclink` CLI | `ui.render` 插件 + `cclink8` CLI | **插件为核心，CLI 为兜底，skill 只做输出约定** |
| 名称 | `cclink` | `cclink` | `cclink8` | **`cclink8`**（避免与 cclinks/CCLink 混淆，8=OSC 8） |
| 技术栈 | TS/Node | 避免额外重运行时 | TS/Node + `ui.render` | **TS/Node，零运行时依赖；不引入 Python/fzf** |
| 许可证 | 未指定 | 倾向 MIT | Apache-2.0 + DCO | **Apache-2.0 + DCO**（专利授权、企业采用友好） |
| Picker | 不重写 cclinks，合作 | MVP 需要 `cclink list` | v0.2 历史链接选择 | **MVP 只做当前会话 `list`；历史 picker v0.2，优先集成 cclinks** |
| 终端覆盖 | 先赢 Windows + VS Code | A/B/C/D 四级降级 | v0.1 不承诺全终端 | **v0.1 支持 Windows Terminal / VS Code / cmd-PowerShell 降级；其余进测试矩阵** |
| 本地 HTTP/文件跟踪 | 明确否决 | 明确否决 | 明确否决 | **否决** |
| Telemetry | 明确否决 | 明确否决 | 明确否决 | **否决；只做 opt-in `doctor --share`** |
| 自动打开 | 未提 | 明确否决 | 明确否决 | **否决；渲染不自动打开，点击才打开** |

---

## 2. 定位与目标用户

### 2.1 一句话定位

**cclink8 是 Claude Code 的链接层：把文件路径、行号和 URL 变成真正可点击的 OSC 8 链接，并在不支持的终端安全降级。**

### 2.2 目标用户

1. **CLI 重度用户**：看到 `C:\repo\file.py:42`，想 Ctrl+Click 直接跳到编辑器第 42 行。
2. **Windows 开发者**：受盘符、UNC、空格、中文、括号路径困扰；现有插件大多 macOS 倾向。
3. **远程/SSH/tmux 用户**：链接要跨会话存活，终端不支持 OSC 8 时要有明确 fallback。
4. **插件作者**：需要一个稳定、跨平台的“路径/URL → 可点击链接”原语，而不是各自重写。

### 2.3 JTBD

- “我不用复制粘贴路径，点一下就打开。”
- “我要跳到具体行号，不是只打开文件。”
- “我的终端不支持点击时，别假装可点，告诉我怎么打开。”
- “我不想为了点链接启动一个本地服务器或上传遥测。”

---

## 3. 产品形态

### 3.1 核心：`ui.render` 插件

- 只重绘 assistant 消息，不改模型上下文、不改 transcript。
- 识别路径/URL，重写为 OSC 8 超链接；支持 `file://` 与 `vscode://file/...:line:col`。
- 尊重 Claude Code 原生 OSC 8 与 `FORCE_HYPERLINK`，只在原生识别失败时补位。
- 不自动打开、不预览、不跟踪、不联网。

### 3.2 兜底：`cclink8` CLI

```text
cclink8 open <path-or-url>     # 显式打开
cclink8 print <path-or-url>    # 打印 markdown / osc8 / plain
cclink8 copy <path-or-url>     # 复制到剪贴板
cclink8 list                   # 当前会话最近链接
cclink8 doctor                 # 终端能力检测与修复建议
cclink8 demo                   # 5 个示例，2 分钟看到效果
```

- `open` 使用 `execFile`/argv，禁止 `shell:true`。
- 文件必须存在；URL 只允许 `http:`/`https:`。
- 不启动本地 HTTP 服务。

### 3.3 薄 skill：只做输出约定

- 告诉 Claude：文件用 `[name](file:///...)`，URL 用 `[title](https://...)`。
- 不承担渲染；没有 skill 也能工作。
- 可选，默认随插件安装。

### 3.4 明确不做

- 不做 MCP（渲染是 TUI 层的事，MCP 是工具层）。
- 不做本地 HTTP 文件链接服务器（FlowLink 式）。
- 不做文件跟踪数据库、预览、云同步。
- 不做任意命令执行、自动打开、AI 判断“是不是链接”。
- 不重写 cclinks 的历史链接选择器。

---

## 4. MVP 范围与非目标

### 4.1 MVP 五个必支持场景

1. `C:\path\file.py:42` → Windows Terminal / VS Code 中 Ctrl+Click 跳到第 42 行。
2. `\\server\share\file` → 打开资源管理器/默认应用。
3. `https://...` → 打开浏览器。
4. 空格、中文、括号、`#`、`%` 路径正确编码。
5. 终端不支持 OSC 8 → 显示完整路径/URL + 提示 `cclink8 open`。

### 4.2 MVP 支持范围

- 路径：Windows 盘符、UNC、POSIX 绝对路径、`file://`、`vscode://file/...`、`path:line:col`。
- URL：`http://`、`https://`。
- 终端：Windows Terminal、VS Code、cmd/PowerShell 降级；iTerm2/WezTerm/Ghostty/tmux 进测试矩阵，不阻塞 v0.1。
- 输出：OSC 8 / Markdown / 纯文本三态。

### 4.3 非目标

- 全终端承诺、GUI、文件预览、文件跟踪、云同步、链接分享页、自动打开、遥测、AI 语义判断。
- 不支持 `javascript:`、`data:`、`vbscript:`、`smb:` 等 scheme。
- 不支持相对路径的“猜测”；只有文件真实存在时才按项目 cwd 解析。

---

## 5. 架构与仓库

### 5.1 技术选择

- TypeScript/Node：Claude Code 插件/mod 生态就是 TS/Node，`ui.render` 接入成本最低。
- 运行时零依赖；开发用 `vitest` + `tsup`。
- 打开文件/URL 用 Node `child_process.execFile`，绝不拼 shell。
- 跨平台 CI：Windows / macOS / Linux。

### 5.2 仓库结构

```text
cclink8/
  packages/
    core/            # 路径/URL 解析、终端检测、编码、存在性校验
    claude-plugin/   # ui.render hook + plugin manifest + skill
    cli/             # cclink8 open/print/copy/list/doctor/demo
  tests/
    fixtures/        # Windows/UNC/中文/空格/行号/URL/负样本
    e2e/             # 终端矩阵快照与手工验收清单
  docs/
    terminal-matrix.md
    threat-model.md
    troubleshooting.md
  .github/
    ISSUE_TEMPLATE/  # bug / terminal / feature / security
    workflows/       # CI, release-please, provenance
  PRODUCT_SPEC.md
  README.md
  LICENSE
  SECURITY.md
  GOVERNANCE.md
```

### 5.3 核心模块边界

- `parser`：确定性正则/状态机；输入文本，输出 spans（start/end/kind/target）。
- `resolver`：路径归一化、存在性校验、行号/列号截断、URL scheme 白名单。
- `renderer`：OSC 8 / Markdown / plain 三态；控制字符转义。
- `terminal`：环境变量检测（`WT_SESSION`、`TERM_PROGRAM`、`TERM`、`TMUX`、`KITTY_WINDOW_ID`、`GHOSTTY_RESOURCES_DIR`）。
- `opener`：`execFile` 打开，白名单，不自动执行。
- `plugin`：`ui.render` 只调用 core/renderer，不直接打开。

---

## 6. 终端矩阵与降级

| 级别 | 终端 | 行为 |
|---|---|---|
| A | Windows Terminal、VS Code、iTerm2、WezTerm、Ghostty、kitty | OSC 8 真链接 |
| B | 支持 Markdown 的 Claude Code TUI | `[label](url)` |
| C | cmd/PowerShell、Apple Terminal | 完整路径/URL + `cclink8 open` 提示 |
| D | tmux 3.4+ / SSH | tmux 需 `-T hyperlinks`；否则复制到剪贴板或 `cclink8 open` |

自动选择：

- 读环境变量 + `FORCE_HYPERLINK=1`；检测不到就降级，绝不假装可点。
- `cclink8 doctor` 打印检测结果、支持级别、修复建议。
- 不支持时错误信息必须具体，例如：“此终端不支持 OSC 8；请用 `cclink8 open` 或切换到 Windows Terminal/VS Code。”

---

## 7. 路径与 URL 解析规则

### 7.1 必须支持

- `C:\path\file.py`
- `C:\path with space\中文文件.py:42:3`
- `\\server\share\file`
- `/home/user/file.py:42`
- `file:///C:/path/file.py`
- `vscode://file/C:/path/file.py:42:3`
- `https://example.com/path?q=1`

### 7.2 必须避免

- 代码块、行内代码、版本号、日期、裸标识符、IP 地址被误识别。
- 相对路径“猜测”；只有文件真实存在才解析。
- 行号/列号越界时截断，不虚构。
- URL 尾部标点 `.,;:)` 去掉。
- 控制字符、ANSI/OSC 注入转义。
- 非白名单 scheme 拒绝。

### 7.3 确定性原则

- 解析器是确定性规则，不让 AI 判断“这是不是链接”。
- 插件只改显示；打开动作必须由用户点击或显式 CLI 触发。

---

## 8. 分发与安装

- npm：`npm i -g cclink8` 或 `npx cclink8 init`。
- Claude Code marketplace：插件一键安装。
- GitHub Releases：独立 CLI 包（Node 单文件/npx 兜底）。
- Homebrew/PyPI：有明确需求再做，MVP 不铺。
- 安装后 `cclink8 doctor` + `cclink8 demo`，2 分钟内完成第一次点击。
- 版本兼容：plugin manifest 固定 API 版本；semver；release-please + Changesets；npm provenance/Sigstore。

---

## 9. 差异化与合作

| 项目 | 它做什么 | cclink8 的关系 |
|---|---|---|
| Claude Code 原生 OSC 8 | 已发链接 | 站在它上面，不重复造；只在识别失败时补位 |
| `cclinks` | 从 transcript 选链接 | **合作**：它做选择器，cclink8 做渲染器；v0.2 提供 adapter |
| `link` / `glass` 插件 | `ui.render` 重绘 | 借鉴；如 MIT 优先 upstream 或联合维护，避免重复 |
| FlowLink MCP | 本地 HTTP 文件链接 | 不同产品；它做文件预览/服务，cclink8 做轻量渲染 |

README 首屏放对比表，避免“又一个 cclinks”的误解。

---

## 10. 成功指标（无 telemetry）

- **北极星**：首次点击成功率（fixtures + 用户报告 + opt-in `doctor --share`）。
- 采用：npm 周下载、marketplace 安装量、独立下游仓库。
- 质量：“链接点不开”类 issue <5%；回归修复时长；A/B 级终端占比 ≥90%。
- 贡献：外部 PR 数、二次贡献率、首次 review 时长、48h 首响率。
- 终端矩阵：≥6 个终端、≥90% 通过。
- Stars 只做参考，不做目标。

---

## 11. 治理、许可证与安全

### 11.1 许可证

- **Apache-2.0 + DCO**。
- 理由：专利授权、企业采用友好、贡献门槛低；不做 CLA。
- 商标政策：禁止冒充 Anthropic 官方；项目名 `cclink8` 不含 Anthropic 商标。

### 11.2 治理

- 初期 BDFL；出现 3 名外部维护者后转 3 人委员会，写入 `GOVERNANCE.md`。
- 每周 triage 轮值；48h 首响；30 天 stale。
- 资金：GitHub Sponsors/Open Collective；核心永久免费；不引入 VC。

### 11.3 安全

- `SECURITY.md`：私密报告、72h 确认、90 天披露。
- 威胁模型：恶意文件名/URL、OSC 8 注入、路径穿越、symlink、UNC 凭据泄露、命令注入、telemetry。
- 硬规则：
  - 不启 shell；`execFile`/argv。
  - 只允许 `file:`/`http:`/`https:`；拒绝 `javascript:`/`data:`/`vbscript:`/`smb:`。
  - 路径 canonicalize；渲染不自动打开；点击才打开。
  - 默认不预览、不跟踪、无本地 HTTP、无 telemetry。
  - 转义控制字符；依赖最小化 + Dependabot + fuzz。

---

## 12. 4 周 MVP 计划

| 周 | 交付 | 验收 |
|---|---|---|
| W1 | spec、威胁模型、parser、终端矩阵 harness | Windows/UNC/中文/空格/行号 fixtures 通过 |
| W2 | `ui.render` 插件 + `cclink8 open/print/copy/doctor/demo` | Windows Terminal / VS Code 实测 |
| W3 | 安全评审、fuzz、fallback、20 人 beta | 无 shell 注入；无 OSC 8 终端可用 |
| W4 | v0.1.0 公开发布、npm provenance、文档/demo/outreach | 5 个 MVP 场景全过；issue 模板可用 |

v0.2：历史链接选择（集成 cclinks）、tmux、配置、翻译、更多终端适配。

---

## 13. 风险与明确否决

### 13.1 风险

- Claude Code 原生 OSC 8 改进后，插件价值下降 → 定位为“补位 + 降级 + 跨平台”，不与其竞争。
- `ui.render` API 变化 → 固定 manifest 版本，CI 快照测试，快速跟进。
- Windows 路径边界复杂 → fixtures 优先，宁可少 linkify，不可误识别。
- 终端矩阵碎片化 → 显式降级，不承诺全终端。
- 维护者 burnout → 范围冻结、月度发布、triage 轮值。

### 13.2 三人共同否决

- 只做 skill 的项目。
- 把 MCP/本地 HTTP 服务当核心。
- 文件跟踪、预览、云同步。
- 任何 telemetry。
- `shell:true` 或任意命令执行。
- 渲染时自动打开文件/URL。
- 重写 cclinks 的 transcript picker。
- v0.1 承诺全终端支持。
- macOS-only 设计。
- 把裸词都变成链接。
- 让 AI 判断“是不是链接”——必须确定性解析。
- 把 stars 当成功指标。
- 范围膨胀成“AI 文件管理器”。

---

## 14. 待确认的产品决策

1. 项目名 `cclink8` 是否可用（npm/GitHub 查重）。
2. Apache-2.0 vs 双 MIT/Apache-2.0（若社区强烈偏好 MIT，可改）。
3. v0.1 是否包含 `cclink8 list`（当前会话），还是留到 v0.2。
4. 是否把 `link`/`glass` 作为 upstream 合作对象，而不是独立实现。
5. 首发渠道优先级：GitHub / Claude Code Discord / HN / V2EX / 知乎。

---

## 15. 一句话给决策者

**先发一个 Windows-first 的 `ui.render` 渲染器 + `cclink8 open` 兜底，4 周内让 5 个场景真正可点；不要先做 skill，不要做服务器，不要做文件管理器。**
