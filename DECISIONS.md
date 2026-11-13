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
| D001 | 文件链接渲染路径 | A/B/C/D | 待定 | 待定 | R2 | R1/R3 | 待裁决 |
| D002 | Parser 合同 | — | 待定 | 待定 | R1 | R2/R3 | 待裁决 |
| D003 | 包结构与 CLI | — | 待定 | 待定 | R3 | R1/R2 | 待裁决 |
| D004 | 发布与仓库 | — | 待定 | 待定 | R3 | R1/R2 | 待裁决 |
