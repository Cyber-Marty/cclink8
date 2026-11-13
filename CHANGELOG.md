# Changelog

## 0.1.2 — 2026-11-13

- `cclink8 doctor` and `cclink8 init` now print the exact `FORCE_HYPERLINK=1` commands for PowerShell and cmd.
- README troubleshooting: if Ctrl+Click does nothing, set `FORCE_HYPERLINK=1` before starting Claude Code; use Windows Terminal / VS Code; VS Code terminal has a known file-link scheme issue.
- `init` derives the tarball name from the package version instead of hardcoding 0.1.0.

## 0.1.1 — 2026-11-13

- Fix install documentation: npm registry is still pending; the CLI installs from a packed tarball or source.
- `cclink8 init` no longer suggests an unpublished `npm i -g cclink8`.
- Clarify that the plugin guarantees syntactic links only; `cclink8 open`/`copy` validate file existence.

## 0.1.0-rc.1 — 2026-11-13

First release candidate.

- Claude Code `ui.render` mod (`AssistantMessage`) rewrites file paths and URLs to `file://` / `https://` Markdown links.
- Conservative grammar: only drive-letter, UNC, POSIX absolute paths, `file://`, and `http(s)://`; no relative paths or bare `/`.
- No `fs` access in the render path; the CLI validates existence before opening.
- `cclink8` CLI: `open`, `print`, `copy`, `doctor`, `demo`, `init`.
- Self-contained plugin bundle (no `node_modules`, no external imports).
- No local HTTP server, no file tracking, no previews, no telemetry, no automatic opening.
- Tests: 77 unit tests + 14 plugin tests; typecheck and `claude plugin validate` pass.
- Manual TUI Ctrl+Click acceptance is still required before `v0.1.0` final.

## Unreleased

- v0.2: `Markdown` + `onLinkPress` line/column jump.
- v0.2: npm registry publish (pending `NPM_TOKEN`).
- v0.2: cclinks picker adapter and tmux/SSH guidance.
