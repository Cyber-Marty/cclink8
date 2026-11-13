# Contributing to cclink8

Thanks for helping make Claude Code links safer and more portable.

## Developer Certificate of Origin (DCO)

This project uses the DCO, not a CLA. Every commit must be signed off:

```sh
git commit -s -m "fix: ..."
```

The sign-off certifies that you wrote the change or have the right to submit it under Apache-2.0. See <https://developercertificate.org/>.

## Setup

```sh
npm install
npm run build
npm test
```

Requirements: Node 20+, npm 10+.

## What to work on

- `packages/core`: parser, resolver, rewriter, fixtures. Parser changes need positive **and** negative fixtures.
- `packages/cli`: `open`, `print`, `copy`, `doctor`, `demo`, `init`.
- `packages/claude-plugin`: `ui.render` hooks module and manifest.
- Docs, terminal matrix, translations, and reproducible bug reports are valuable.

## Pull request checklist

- [ ] `npm run build` passes.
- [ ] `npm test` passes.
- [ ] New parser behavior has a fixture or test.
- [ ] No `shell: true`, no arbitrary command execution.
- [ ] No telemetry, local HTTP server, or file tracking.
- [ ] Only `file:`, `http:`, `https:` schemes are accepted.
- [ ] Plugin output stays self-contained (no imports outside the package root).
- [ ] Commit is DCO signed off (`git commit -s`).

Parser and opener PRs need two maintainer approvals; docs and fixtures need one.

## Reporting bugs

Include:

- OS, terminal, Claude Code version, cclink8 version (`cclink8 doctor`).
- The exact input (redact secrets).
- Expected vs actual behavior.
- Whether `cclink8 open` works as a fallback.

Open a normal issue for non-security bugs. For security, follow [SECURITY.md](SECURITY.md).

## Scope

cclink8 is a link renderer and opener, not a file manager. File previews, tracking databases, cloud sync, and local HTTP servers are out of scope.
