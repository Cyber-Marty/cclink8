# Manual TUI acceptance (release gate)

R3 requires one real Ctrl+Click in each of Windows Terminal and VS Code, plus a path with spaces/Chinese, and `/plugin` must show `cclink8` mod active.

## Setup

```powershell
claude --plugin-dir C:\Users\SunnyCC\Projects\cclink8\packages\claude-plugin
```

In the session, run `/plugin` and confirm the dim line says `mod active` and includes `cclink8`.

## Test paths

Ask Claude to output each path on its own line:

```text
C:\Program Files\nodejs\node.exe
C:\Users\SunnyCC\Projects\cclink8-acceptance\中文 空格目录\验收 文件.txt
C:\Users\SunnyCC\Projects\cclink8\README.md
```

Ctrl+Click each path. Expected: the default app opens the file.

Also ask for a fenced code block containing one of the paths. Expected: the path inside the code block is plain text, not a link.

## Terminals

1. Windows Terminal.
2. VS Code integrated terminal.

## Failure handling

1. Set `FORCE_HYPERLINK=1` and retry.
2. If it still fails, run `cclink8 open "<path>"`; the CLI is the guaranteed fallback.
3. Record terminal name, version, and result. If a terminal fails, report it; do not claim v0.1.1 final sign-off.

## Result template

```text
Windows Terminal: PASS / FAIL (version, notes)
VS Code terminal: PASS / FAIL (version, notes)
/plugin shows cclink8 mod active: PASS / FAIL
C:\Program Files\nodejs\node.exe: PASS / FAIL
中文/空格路径: PASS / FAIL
Code block unaffected: PASS / FAIL
FORCE_HYPERLINK used: yes / no
```
