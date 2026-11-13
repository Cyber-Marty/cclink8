# cclink8 CLI

The fallback CLI for [cclink8](https://github.com/Cyber-Marty/cclink8): open or print clickable paths and URLs when your terminal does not render OSC 8 links.

**npm registry is pending.** Install from the repo or a packed tarball:

```sh
git clone https://github.com/Cyber-Marty/cclink8.git
cd cclink8
npm install
npm run build -w cclink8
npm pack -w cclink8
npm i -g ./cclink8-0.1.4.tgz
```

```sh
cclink8 open C:\repo\file.py
cclink8 open https://example.com/
cclink8 print C:\repo\file.py -f markdown
cclink8 print --text "see C:\repo\file.py and https://example.com/" -f osc8
cclink8 copy C:\repo\file.py
cclink8 doctor
```

- `print`/`open`/`copy` check local files; `print --text` links only existing paths. The plugin only guarantees syntax.
- Any file format is opened through the OS default association; there is no extension filter (`.md`, `.txt`, `.xlsx`, `.docx`, `.pdf`, `.zip`, `.png`, extensionless, spaces/Chinese names, etc.).
- In the Claude Code CLI surface, the plugin handles a **single click** via `Markdown` + `onLinkPress`, not terminal OSC 8. Ctrl/Cmd+Click is handled by the surface (Windows may only run `explorer /select`) and does not trigger `onLinkPress`. `.xlsx`/Excel is fixed in 0.1.4. Non-CLI/long-text falls back to OSC 8; `cclink8 open` remains the fallback.
- The plugin sets `FORCE_HYPERLINK=1` automatically; no manual env setup (explicit `0`/`false` is respected for the OSC 8 fallback).
- Only `file:`, `http:`, and `https:` are accepted.
- No telemetry, no local server, no automatic opening.
- `:42` stays in the label; v0.1 opens the file, jump-to-line is v0.2.

See the [main README](https://github.com/Cyber-Marty/cclink8#readme) for the plugin, terminal matrix, and security model.

