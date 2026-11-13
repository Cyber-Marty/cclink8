import { basename, isAbsolute, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { statSync } from "node:fs";

export type Format = "markdown" | "osc8" | "plain";
export type TargetKind = "file" | "url";

export interface Target {
  kind: TargetKind;
  value: string;
  label: string;
  exists: boolean;
  line?: number;
  column?: number;
}

export interface ParsedPath {
  path: string;
  line?: number;
  column?: number;
}

export class UsageError extends Error {
  readonly exitCode = 2;
}

export class RuntimeError extends Error {
  readonly exitCode = 1;
}

const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/;
const UNC_RE = /^\\\\/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export function splitTrailingLine(raw: string): ParsedPath {
  const match = /^(.*?)(?::(\d{1,7})(?::(\d{1,5}))?)$/.exec(raw);
  if (!match) return { path: raw };
  const [, path, line, column] = match;
  if (!path) return { path: raw };
  return {
    path,
    line: Number(line),
    ...(column ? { column: Number(column) } : {}),
  };
}

function assertSafe(raw: string, max: number): string {
  if (!raw || CONTROL_RE.test(raw)) {
    throw new UsageError("path or URL is empty or contains control characters");
  }
  if (raw.length > max) {
    throw new UsageError(`path or URL is longer than ${max} characters`);
  }
  return raw;
}

function lineSuffix(line?: number, column?: number): string {
  if (!line) return "";
  return `:${line}${column ? `:${column}` : ""}`;
}

function isWindowsPath(value: string): boolean {
  return WINDOWS_DRIVE_RE.test(value) || UNC_RE.test(value);
}

function fileTarget(path: string, label?: string, line?: number, column?: number): Target {
  const windowsPath = isWindowsPath(path);
  const absolute = windowsPath || isAbsolute(path) ? path : resolve(process.cwd(), path);
  // statSync on a UNC path can block on an unreachable SMB server. Leave UNC
  // verification to the launcher / user action instead of hanging the CLI.
  const isUnc = path.startsWith("\\\\");
  let exists = isUnc;
  if (!isUnc) {
    try {
      const stat = statSync(absolute);
      exists = stat.isFile() || stat.isDirectory();
    } catch {
      exists = false;
    }
  }
  const name = label || (windowsPath ? win32.basename(path) : basename(absolute)) || absolute;
  return {
    kind: "file",
    value: absolute,
    label: name + lineSuffix(line, column),
    exists,
    ...(line ? { line } : {}),
    ...(column ? { column } : {}),
  };
}

export function classifyInput(raw: string, cwd = process.cwd()): Target {
  const input = assertSafe(raw.trim(), 4096);

  // Windows drive and UNC paths contain a colon but are not schemes.
  if (WINDOWS_DRIVE_RE.test(input) || UNC_RE.test(input) || input.startsWith("/")) {
    const split = splitTrailingLine(input);
    return fileTarget(split.path, undefined, split.line, split.column);
  }

  if (/^file:/i.test(input)) {
    let url: URL;
    let path: string;
    try {
      url = new URL(input);
      if (url.protocol !== "file:") throw new Error("not file");
      if (url.username || url.password) throw new Error("credentials");
      if (/%2f|%5c/i.test(url.pathname)) {
        throw new UsageError("encoded path separators are not allowed in file:// URLs");
      }
      path = decodeURIComponent(url.pathname);
    } catch {
      throw new UsageError("invalid file:// URL");
    }
    if (CONTROL_RE.test(path)) {
      throw new UsageError("file:// URL decodes to control characters");
    }
    if (url.hostname) {
      path = `\\\\${url.hostname}${path.replace(/\//g, "\\")}`;
    } else if (/^\/[A-Za-z]:/.test(path)) {
      path = path.slice(1);
    }
    const split = splitTrailingLine(path);
    return fileTarget(split.path, undefined, split.line, split.column);
  }

  if (SCHEME_RE.test(input)) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new UsageError("invalid URL");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new UsageError(`unsupported URL scheme: ${url.protocol}`);
    }
    if (input.length > 2048) {
      throw new UsageError("URL is longer than 2048 characters");
    }
    return { kind: "url", value: url.href, label: url.href, exists: true };
  }

  const split = splitTrailingLine(input);
  return fileTarget(split.path, undefined, split.line, split.column);
}

function fileHref(value: string): string {
  if (!isWindowsPath(value)) return pathToFileURL(value).href;
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("//")) {
    const parts = normalized.slice(2).split("/");
    const host = parts.shift() || "";
    return `file://${encodeURIComponent(host)}/${parts.map(encodeURIComponent).join("/")}`;
  }
  const drive = normalized.slice(0, 2);
  const rest = normalized.slice(2).replace(/^\/+/, "").split("/");
  return `file:///${drive}/${rest.map(encodeURIComponent).join("/")}`;
}

export function formatTarget(target: Target, format: Format): string {
  const href = target.kind === "file" ? fileHref(target.value) : target.value;
  if (format === "plain") return target.value;
  if (format === "osc8") {
    return `\u001b]8;;${href}\u001b\\${target.label}\u001b]8;;\u001b\\`;
  }
  const label = target.label
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
  return `[${label}](${href})`;
}

export function buildOpenCommand(
  target: Target,
  platform: NodeJS.Platform = process.platform,
): { file: string; args: string[] } {
  if (platform === "win32") {
    if (target.kind === "url") {
      return { file: "rundll32.exe", args: ["url.dll,FileProtocolHandler", target.value] };
    }
    return { file: "explorer.exe", args: [target.value] };
  }
  if (platform === "darwin") {
    return { file: "open", args: [target.value] };
  }
  return { file: "xdg-open", args: [target.value] };
}

export function clipboardCommands(): Array<{ file: string; args: string[] }> {
  if (process.platform === "win32") return [{ file: "clip.exe", args: [] }];
  if (process.platform === "darwin") return [{ file: "pbcopy", args: [] }];
  return [
    { file: "wl-copy", args: [] },
    { file: "xclip", args: ["-selection", "clipboard"] },
    { file: "xsel", args: ["--clipboard", "--input"] },
  ];
}

export interface TerminalProfile {
  level: "A" | "B" | "C" | "D";
  name: string;
  notes: string[];
}

export function detectTerminal(env: NodeJS.ProcessEnv = process.env, platform = process.platform): TerminalProfile {
  const notes: string[] = [];
  const termProgram = (env.TERM_PROGRAM || "").toLowerCase();
  const term = (env.TERM || "").toLowerCase();

  if (env.WT_SESSION) {
    return { level: "A", name: "Windows Terminal", notes: ["OSC 8 fallback supported; single-click plugin links in Claude Code."] };
  }
  if (termProgram === "vscode") {
    return { level: "A", name: "VS Code terminal", notes: ["OSC 8 fallback supported; single-click plugin links in Claude Code."] };
  }
  if (termProgram === "iterm.app") return { level: "A", name: "iTerm2", notes: ["OSC 8 supported."] };
  if (termProgram === "wezterm") return { level: "A", name: "WezTerm", notes: ["OSC 8 supported."] };
  if (termProgram === "ghostty" || env.GHOSTTY_RESOURCES_DIR) {
    return { level: "A", name: "Ghostty", notes: ["OSC 8 supported."] };
  }
  if (env.KITTY_WINDOW_ID || term.includes("kitty")) {
    return { level: "A", name: "kitty", notes: ["OSC 8 supported."] };
  }
  if (env.TMUX) {
    notes.push("tmux 3.4+ needs `-T hyperlinks` for OSC 8; otherwise use cclink8 open.");
    return { level: "D", name: "tmux", notes };
  }
  if (termProgram === "apple_terminal") {
    notes.push("Apple Terminal does not support OSC 8; use cclink8 open.");
    return { level: "C", name: "Apple Terminal", notes };
  }
  if (platform === "win32") {
    notes.push("Plain PowerShell/cmd may not support OSC 8; use Windows Terminal or cclink8 open.");
    return { level: "C", name: "Windows console", notes };
  }
  notes.push("Terminal capability not recognized; use cclink8 open as fallback.");
  return { level: "C", name: "unknown terminal", notes };
}

export interface CliArgs {
  command: string;
  target?: string;
  format: Format;
  text?: string;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { command: "", format: "markdown", help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "-v" || arg === "--version") {
      args.version = true;
      continue;
    }
    if (arg === "-f" || arg === "--format") {
      const value = argv[++i];
      if (value !== "markdown" && value !== "osc8" && value !== "plain") {
        throw new UsageError("--format must be markdown, osc8, or plain");
      }
      args.format = value;
      continue;
    }
    if (arg === "-t" || arg === "--text") {
      args.text = argv[++i];
      if (args.text === undefined) throw new UsageError("--text requires a value");
      continue;
    }
    if (arg.startsWith("-")) throw new UsageError(`unknown option: ${arg}`);
    if (!args.command) args.command = arg;
    else if (!args.target) args.target = arg;
    else throw new UsageError(`unexpected argument: ${arg}`);
  }
  return args;
}

export function usage(): string {
  return [
    "cclink8 — clickable paths and URLs for Claude Code",
    "",
    "Usage:",
    "  cclink8 open <path-or-url>       open a file or URL",
    "  cclink8 print <path-or-url>      print markdown/osc8/plain link",
    "  cclink8 print --text <text>      linkify a block of text via @cclink8/core",
    "  cclink8 copy <path-or-url>       copy a link to the clipboard",
    "  cclink8 doctor                   show terminal capability and setup",
    "  cclink8 demo                     print five example links",
    "  cclink8 init                     print plugin install instructions",
    "",
    "Options:",
    "  -f, --format <markdown|osc8|plain>  output format for print (default: markdown)",
    "  -t, --text <text>                   text to linkify (print only)",
    "  -h, --help                          show this help",
    "  -v, --version                       show version",
  ].join("\n");
}
