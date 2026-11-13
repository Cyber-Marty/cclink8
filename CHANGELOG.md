# Changelog

## 0.1.0-rc.1 — 2026-11-13

First release candidate.

- Claude Code `ui.render` mod (`AssistantMessage`) rewrites file paths and URLs to `file://` / `https://` Markdown links.
- Conservative grammar: only drive-letter, UNC, POSIX absolute paths, `file://`, and `http(s)://`; no relative paths or bare `/`.
- No `fs` access in the render path; the CLI validates existence before opening.
- `cclink8` CLI: `open`, `print`, `copy`, `doctor`, `demo`, `init`.
- Self-contained plugin bundle (no `node_modules`, no external imports).
- No local HTTP server, no file tracking, no previews, no telemetry, no automatic opening.
- Tests: 76 unit tests + 14 plugin tests; typecheck and `claude plugin validate` pass.
- Manual TUI Ctrl+Click acceptance is still required before `v0.1.0` final.

## Unreleased

- v0.2: `Markdown` + `onLinkPress` line/column jump.
- v0.2: npm registry publish (pending `NPM_TOKEN`).
- v0.2: cclinks picker adapter and tmux/SSH guidance.
