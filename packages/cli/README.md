# cclink8 CLI

The fallback CLI for [cclink8](https://github.com/Cyber-Marty/cclink8): open or print clickable paths and URLs when your terminal does not render OSC 8 links.

**npm registry is pending.** Install from the repo or a packed tarball:

```sh
git clone https://github.com/Cyber-Marty/cclink8.git
cd cclink8
npm install
npm run build -w cclink8
npm pack -w cclink8
npm i -g ./cclink8-0.1.3.tgz
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
- The plugin sets `FORCE_HYPERLINK=1` automatically; no manual env setup (explicit `0`/`false` is respected).
- Only `file:`, `http:`, and `https:` are accepted.
- No telemetry, no local server, no automatic opening.
- `:42` stays in the label; v0.1 opens the file, jump-to-line is v0.2.

See the [main README](https://github.com/Cyber-Marty/cclink8#readme) for the plugin, terminal matrix, and security model.

