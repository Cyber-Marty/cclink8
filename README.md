# cclink8

**Clickable file paths and URLs in Claude Code, with a safe terminal fallback.**

`cclink8` is a Claude Code plugin (an official `ui.render` mod) plus a small CLI. It rewrites assistant markdown so paths like `C:\repo\file.py:42` and URLs become real OSC 8 links. When the terminal cannot render links, it says so and gives you `cclink8 open` instead of pretending.

- No local HTTP server
- No file tracking or previews
- No telemetry
- No automatic opening
- No shell execution

Requires Claude Code **2.1.287+** for mods. The CLI requires Node **20+**.

## Install

**Claude Code plugin** (self-contained; no npm install for the plugin):

```sh
claude plugin marketplace add Cyber-Marty/cclink8
claude plugin install cclink8@cclink8
```

In a session, run `/plugin` and look for `cclink8`; after installing, start a new session or `/reload-plugins`.

**CLI** 鈥?npm registry is **pending** (not published yet). Install from the GitHub repo, a packed tarball, or source:

```sh
git clone https://github.com/Cyber-Marty/cclink8.git
cd cclink8
npm install
npm run build -w cclink8

# then either link the workspace or install the packed tarball
npm pack -w cclink8
npm i -g ./cclink8-0.1.2.tgz
cclink8 doctor
```

The CLI bundles `@cclink8/core` into `dist/index.js`; the tarball has no runtime dependency on an unpublished package.

## Five MVP scenarios

1. `C:\repo\file.py:42` 鈫?Ctrl+Click in Windows Terminal / VS Code.
2. `\\server\share\file` 鈫?open Explorer or the default app.
3. `https://example.com/...` 鈫?open the browser.
4. Paths with spaces, Chinese, brackets, `#`, `%` encode correctly.
5. A terminal without OSC 8 鈫?full path shown plus `cclink8 open <path>`.

## CLI

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

`open` uses `execFile`-style argv and never `shell: true`:
Windows files/directories use `explorer.exe`; URLs use `rundll32.exe url.dll,FileProtocolHandler`. macOS uses `open`; Linux uses `xdg-open`. Windows launchers often return non-zero after a successful launch, so the CLI treats the `spawn` event as success and detaches.

## Terminal matrix

| Level | Terminal | Behavior |
|---|---|---|
| A | Windows Terminal, VS Code, iTerm2, WezTerm, Ghostty, kitty | OSC 8 link; Ctrl+Click |
| B | Markdown-capable TUI | `[label](url)` |
| C | cmd/PowerShell, Apple Terminal | full path/URL + `cclink8 open` |
| D | tmux 3.4+/SSH | `-T hyperlinks`; otherwise copy or CLI |

`cclink8 doctor` prints the detected level and a concrete fix. If nothing renders, use the CLI; it is the guaranteed path.

## Troubleshooting

**Ctrl+Click does nothing for a `.txt` or any file.** Set `FORCE_HYPERLINK=1` **before** starting Claude Code, then restart the terminal and Claude Code:

```powershell
# PowerShell
$env:FORCE_HYPERLINK=1
```

```bat
REM cmd.exe
set FORCE_HYPERLINK=1
```

**Use Windows Terminal or VS Code.** The VS Code terminal has a known file-link scheme issue (#78833); if links still do not open, use `cclink8 open <path>`.

**If you see `path (file:///...)`**, the terminal is not enabling OSC 8. Click the URL text or set `FORCE_HYPERLINK=1`; `cclink8 open <path>` always works as a fallback.

## Why not the alternatives?

| Project | What it does | cclink8 |
|---|---|---|
| Claude Code native OSC 8 | Emits links in assistant output | Stands on it; only fills detection/format gaps |
| [cclinks](https://pypi.org/project/cclinks/) | Picks links from session transcripts with fzf | Complements it; cclinks is the picker, cclink8 is the renderer |
| [link plugin](https://claudemods.dev/en/builds/link-5ff37b) | `ui.render` path rewriting | Same idea; cclink8 is Windows-first, safe-fallback, no local server |
| [glass plugin](https://claudemods.dev/en/builds/glass-428358) | Redraws assistant replies, https as OSC 8 | Different scope; cclink8 covers files + URLs + fallback |
| [FlowLink MCP](https://cdn.jsdelivr.net/npm/flowlink-mcp@1.3.0/README.md) | Local HTTP file links, tracking, previews | Deliberately not: no server, no tracking, no previews |

## Security

- Only `file:`, `http:`, and `https:` are accepted by the CLI; `javascript:`, `data:`, `vbscript:`, `smb:` are rejected.
- The plugin only guarantees **syntax**; it does not verify that a file exists.
- `cclink8 open`/`copy` verify local files before opening/copying; `print`/`print --text` also only link existing local paths.
- Paths are canonicalized; controlled characters and ANSI/OSC injection are rejected.
- The plugin only changes what is drawn; it never opens a file or URL by itself.
- No telemetry. `doctor` is local-only; sharing its output is opt-in.

See [SECURITY.md](SECURITY.md) for reporting and the threat model.

## Development

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

## License

Apache-2.0. Contributions use DCO sign-off; see [CONTRIBUTING.md](CONTRIBUTING.md). Governance is in [GOVERNANCE.md](GOVERNANCE.md).

