# cclink8 决策日志

**规则：每个决定都必须经过三位研究员共同商讨。** 流程：

1. **提案**：围绕一个问题，三位研究员各自独立给出方案（不互相参考）。
2. **交叉质询**：协调者把三份方案互相转发；每人指出同意/反对/让步/绝不让步。
3. **表决**：2/3 多数通过；若无人过半数，进入第二轮，只允许在已有方案中选。
4. **记录**：协调者把问题、方案、票型、理由、影响写入本文件。
5. **实现**：指定 owner 实现；另外两人 review；两人都 approve 才合并。
6. **发布**：v0.1.0 前必须三人共同签核。

角色：

- **R1 — Parser / Correctness**：路径/URL 语法、Windows/UNC/POSIX、行号列号、fixtures、安全边界。
- **R2 — Mod / Rendering**：Claude Code `ui.render`、OSC 8、Markdown/Link 元素、终端检测、降级。
- **R3 — CLI / QA / Release**：CLI、打包、测试、CI、文档、GitHub release。

---

## D001：文件链接的渲染路径（待裁决）

**背景**：官方 `Link` 元素的 `href` 只允许 `https:` 或 `http://localhost`，不允许 `file://`。因此不能直接用 `Link` 画本地文件链接。

候选：

- **A. 重写 `AssistantMessage.props.text`**：把路径改写成 `[label](file:///...)` markdown，依赖 Claude Code 原生 markdown 渲染器。
- **B. 用 `Markdown` 元素 + `onLinkPress`**：替换 assistant 消息为 `Markdown` 树，链接按下时由 mod 自己打开文件。
- **C. 本地 HTTP 重定向**：`Link` 使用 `http://localhost:<port>/...`，服务端打开文件。
- **D. 只做 URL 可点击 + `cclink8 open` 兜底**：文件路径保持纯文本。

**待决**：A/B/C/D 哪个作为 v0.1 核心？是否需要技术 spike 验证 A/B 在真实 TUI 中可点击？

**票型**：待三位研究员提交。

---

## D002：Parser 合同（待裁决）

- 支持哪些路径形式、行号/列号、URL scheme、相对路径、UNC、中文/空格。
- 哪些负样本必须不 linkify（代码块、版本号、日期、裸标识符、IP）。
- 是否需要文件存在性校验；校验失败时降级为纯文本还是保留链接。

---

## D003：包结构与 CLI（待裁决）

- Monorepo vs 单包；`packages/core` / `plugin` / `cli`。
- TypeScript/Node；零运行时依赖；`tsup`/`vitest`。
- CLI 命令：`open` / `print` / `copy` / `list` / `doctor` / `demo` / `init`。
- npm 包名、bin 名、Node 版本。

---

## D004：发布与仓库（待裁决）

- GitHub owner：`Cyber-Marty`（本机 `gh` 已登录）。
- 仓库名：`cclink8`；可见性：public。
- 许可证：Apache-2.0 + DCO。
- 发布：GitHub tag + release；是否同时 npm publish。
- 首发渠道与 README/对比表。

---

## 决策记录

| ID | 问题 | 方案 | 票型 | 决定 | Owner | Reviewers | 状态 |
|---|---|---|---|---|---|---|---|
| D001 | 文件链接渲染路径 | A/B/C/D | **3/3 A** | A：重写 `AssistantMessage.props.text` 为 `file://` markdown；B 留 v0.2 行号；C 否决；D 兜底 | R2 | R1/R3 | 已批准；发布前需真实 TUI 点击验收 |
| D002 | Parser 合同 | R1/R2/R3 合并 | 一致 | mask-first；span/maskedText；纯函数 parse/resolve/rewrite；20+ fixtures | R1 | R2/R3 | 已批准 |
| D003 | 包结构与 CLI | monorepo vs 单包 | **2/3 + 折中一致** | monorepo + npm workspaces；plugin 构建时 bundle core，自包含 | R3 | R1/R2 | 已批准 |
| D004 | 发布与仓库 | GitHub/npm | 一致 | GitHub 先发；npm 暂缓；Apache-2.0 + DCO；marketplace.json | R3 | R1/R2 | 已批准 |
| D005 | core 运行时拆分 | pure/node | **3/3 yes** | `@cclink8/core/pure` 零 `node:*`；Node 入口给 CLI；插件用 pure + 可选同步 exists | R1 | R2/R3 | 已批准 |
| D006 | 插件存在性策略 | A/B | **2/3 A** | A：渲染不碰 fs；保守 grammar；CLI open 时校验 | R1/R2 | R3 | 已批准 |
| D007 | 零配置 OSC 8 | 插件自设 env | **3/3 yes** | 仅未设置/空值时 `$.env.set('FORCE_HYPERLINK','1')`，不覆盖显式 0/false，失败不阻塞 | R2 | R1/R3 | 已批准 |
| D008 | 点击由插件处理 | A/B | **3/3 yes** | CLI surface 用 `Markdown`+`onLinkPress` 打开 file/http(s)；非 CLI/超长/无 process.run 回退 A | R2 | R1/R3 | 已批准 |

## 第一轮裁决详情（2026-11-13）

### D001：A（3/3）

- 依据：`AssistantMessage.props.text` 是 markdown；`Markdown` 允许 `file:` scheme；`Link` 只允许 `https:`/`http://localhost`。
- v0.1：重写 markdown 为 `[label](file:///...)`，由原生 renderer 绘制。
- v0.2：`Markdown` + `onLinkPress` + `$.process.run` 实现行号/列号精确跳转。
- 否决 C：本地 HTTP 服务违背“默认无服务器”的产品边界。
- 兜底 D：A/B 都失败时，只保证 URL 可点 + `cclink8 open`。
- **发布硬门槛**：Windows Terminal + VS Code 各完成一次真实人工 Ctrl+Click 文件打开；不过则不发 v0.1.0。

### D002：Parser 合同

- **先 mask 后替换**：跳过 fenced code、inline code、已有 markdown 链接、HTML 标签；只在未 masked 的纯文本 span 上改写。
- `parse(text, opts) -> { spans, maskedText }`；span 字段：`start/end/kind/target/line/column/exists/confidence`。
- `resolve(span, cwd) -> Target | null`：存在性校验、行/列截断、scheme 白名单。
- `rewrite(text, targets, mode) -> string`：markdown / osc8 / plain；幂等，重复处理不得二次链接。
- 路径：Windows 盘符、UNC、POSIX、`file://`、`vscode://`、`path:line:col`、空格/中文/括号。
- 负样本：代码块、版本号、日期、时间、IP、`javascript:`/`data:`/`smb:`、不存在文件、越界行号。
- 行号/列号：正整数，行 ≤ 1,000,000，列 ≤ 10,000；越界只链文件。
- 相对路径：只在 cwd 下真实存在时 linkify。
- 编码：`pathToFileURL`；控制字符/ANSI/OSC 注入拒绝；路径 ≤ 4096；URL ≤ 2048。

### D003：monorepo + workspaces，plugin 自包含

```text
packages/core            # parser/resolver/rewriter
packages/cli             # cclink8 open/print/copy/doctor/demo
packages/claude-plugin   # hooks/register + manifest + marketplace
```

- Node >= 20；TypeScript 5.x；tsup 构建；vitest 测试；运行时零依赖。
- `packages/claude-plugin` 构建时把 core bundle 进单文件 hooks 模块；marketplace 安装不依赖 `node_modules`/`npm install`。
- CI 增加“解压到无 node_modules 的临时目录，`claude --plugin-dir` + `claude plugin validate/test`”离线加载测试。
- v0.1 CLI：`open` / `print` / `copy` / `doctor` / `demo`；`list` 延到 v0.2；`init` 只打印安装指令，不修改全局配置。

### D004：发布

- GitHub：`Cyber-Marty/cclink8`，public；`gh` 已登录，repo/workflow scope。
- npm：`cclink8` 包名可用，但 `npm whoami` = ENEEDAUTH；v0.1 只发 GitHub，npm 发布放 GitHub Actions + `NPM_TOKEN`。
- 许可证：Apache-2.0 + DCO。
- 仓库内 `.claude-plugin/marketplace.json`，支持 `claude plugin marketplace add Cyber-Marty/cclink8` 后安装。
- v0.1.0 tag + GitHub release；README 首屏放 cclinks/link/glass/FlowLink 对比表与终端矩阵。

### 实现约束（三人共同）

- 不在代码块/行内代码/已有链接上改写；rewrite 幂等。
- plugin 包内不得越过包根目录相对 import；发布物自包含、可离线加载。
- 禁止 `shell:true`；只允许 `file:`/`http:`/`https:`；不自动打开；无 telemetry。
- 任何新决策必须按本文件流程重新提案/表决，不得由单个 owner 自行改变。
