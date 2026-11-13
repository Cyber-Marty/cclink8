# Manual TUI acceptance (release gate)

R3 requires one real **single-click** in each of Windows Terminal and VS Code, plus a path with spaces/Chinese, and `/plugin` must show `cclink8` mod active. Ctrl/Cmd+Click is handled by the surface and does not trigger the plugin's `onLinkPress` (Windows may only run `explorer /select`).

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

Single-click each path. Expected: the default app opens the file. Do not use Ctrl+Click: it is handled by the terminal/IDE and may only select the file.

Also ask for a fenced code block containing one of the paths. Expected: the path inside the code block is plain text, not a link.

## Terminals

1. Windows Terminal.
2. VS Code integrated terminal.

## Failure handling

1. Confirm `/plugin` shows `cclink8` 0.1.4+ and retry with a single click.
2. If it still fails, run `cclink8 open "<path>"`; the CLI is the guaranteed fallback.
3. Record terminal name, version, and result. If a terminal fails, report it; do not claim final sign-off.

## Result template

```text
Windows Terminal: PASS / FAIL (version, notes)
VS Code terminal: PASS / FAIL (version, notes)
/plugin shows cclink8 mod active: PASS / FAIL
C:\Program Files\nodejs\node.exe: PASS / FAIL
中文/空格路径: PASS / FAIL
Code block unaffected: PASS / FAIL
Single-click used: yes / no
```
