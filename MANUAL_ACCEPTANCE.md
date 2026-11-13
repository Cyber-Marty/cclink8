# Manual TUI acceptance (release gate)

D001 requires one real Ctrl+Click in each of Windows Terminal and VS Code before `v0.1.0` final.

## Windows Terminal

```powershell
claude --plugin-dir C:\Users\SunnyCC\Projects\cclink8\packages\claude-plugin
```

Ask Claude to output a real path, for example:

```text
C:\Users\SunnyCC\Projects\cclink8\README.md
```

Ctrl+Click the path. Expected: the default app opens the file.

Also ask for a fenced code block containing the same path. Expected: the path inside the code block is plain text, not a link.

## VS Code integrated terminal

Repeat the same two checks.

## Failure handling

1. Set `FORCE_HYPERLINK=1` and retry.
2. If it still fails, run `cclink8 open "C:\...\README.md"`; the CLI is the guaranteed fallback.
3. Record terminal name, version, and result. Keep the release at `v0.1.0-rc.1`; do not tag `v0.1.0` until both terminals pass or the failure is documented and accepted.

## Result template

```text
Windows Terminal: PASS / FAIL (version, notes)
VS Code terminal: PASS / FAIL (version, notes)
Code block unaffected: PASS / FAIL
FORCE_HYPERLINK used: yes / no
```
