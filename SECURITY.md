# Security Policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability), or open a private Security Advisory.

We aim to:

- acknowledge within **72 hours**;
- provide a remediation plan or clear status within **7 days**;
- coordinate disclosure within **90 days** of the report.

## Scope

In scope:

- parser/resolver: path traversal, scheme bypass, control-character/ANSI/OSC injection;
- CLI opener: command injection, argument injection, shell invocation;
- plugin: rendering a malicious path/URL, unintended file access, escaping the plugin sandbox;
- release artifacts and CI.

Out of scope: vulnerabilities in Claude Code itself, the terminal emulator, or third-party websites opened by the user.

## Threat model

- A malicious file name or URL may appear in model output. The plugin must treat it as untrusted text.
- A path may contain `..`, symlinks, UNC credentials, control characters, or a non-allowlisted scheme.
- A URL may use `javascript:`, `data:`, `vbscript:`, `smb:`, or a credential-bearing host.
- A malicious model/mod may try to make cclink8 open something without a user action.

## Hard rules

- Only `file:`, `http:`, and `https:` are accepted by the CLI.
- `open` uses `execFile`/argv; never `shell: true`. Windows files use `explorer.exe`; URLs use `rundll32.exe url.dll,FileProtocolHandler`.
- Paths are canonicalized; files must exist before `open`/`copy`.
- Control characters, ANSI, and OSC sequences are rejected or escaped.
- The plugin only changes what is drawn; it never opens a file or URL by itself.
- No telemetry, no local HTTP server, no file tracking, no previews.

## Supported versions

Security fixes land on the latest `0.1.x` release. Pre-release tags are not supported.

## No telemetry

cclink8 does not collect analytics. `cclink8 doctor` runs locally and prints its result; sharing it is an explicit user action.
