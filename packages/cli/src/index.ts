#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as coreParse, resolve as coreResolve, rewrite as coreRewrite } from "@cclink8/core";
import {
  RuntimeError,
  UsageError,
  buildOpenCommand,
  classifyInput,
  clipboardCommands,
  detectTerminal,
  formatTarget,
  parseArgs,
  usage,
  type Format,
} from "./lib.js";

function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function launchDetached(file: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(file, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", rejectPromise);
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
  });
}

async function openTarget(raw: string): Promise<void> {
  const target = classifyInput(raw);
  if (target.kind === "file" && !target.exists) {
    throw new RuntimeError(`file not found: ${target.value}`);
  }
  const command = buildOpenCommand(target);
  try {
    // explorer.exe/rundll32 often return a non-zero exit code after a successful
    // launch. detached spawn + the spawn event is the reliable signal.
    await launchDetached(command.file, command.args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RuntimeError(`failed to open ${target.value}: ${message}`);
  }
  process.stdout.write(`opened ${target.kind}: ${target.value}\n`);
}

async function copyTarget(raw: string): Promise<void> {
  const target = classifyInput(raw);
  if (target.kind === "file" && !target.exists) {
    throw new RuntimeError(`file not found: ${target.value}`);
  }
  const text = target.value;
  const errors: string[] = [];
  for (const command of clipboardCommands()) {
    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const child = spawn(command.file, command.args, {
          stdio: ["pipe", "ignore", "pipe"],
          windowsHide: true,
        });
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("error", rejectPromise);
        child.on("close", (code) => {
          if (code === 0) resolvePromise();
          else rejectPromise(new Error(stderr.trim() || `${command.file} exited with ${code}`));
        });
        child.stdin.end(text, "utf8");
      });
      process.stdout.write(`copied to clipboard: ${text}\n`);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new RuntimeError(
    `no clipboard command succeeded. Tried ${clipboardCommands().map((c) => c.file).join(", ")}. ${errors.join("; ")}`,
  );
}

const SEGMENT_SPLIT = /(\s+(?=(?:https?:\/\/|[A-Za-z]:[\\/]|\\\\|\.{1,2}\/)))/;

function rewriteText(text: string, format: Format): string {
  const cwd = process.cwd();
  // Parse each path/URL segment separately. This avoids core's broad path
  // candidate swallowing "and https://..." and lets us use real existence
  // checks, so prose is never linked as one giant path.
  return text
    .split(SEGMENT_SPLIT)
    .map((part) => {
      if (!part || part.trim() === "" || part.trim() === "/") return part;
      const parsed = coreParse(part, { cwd, checkExists: true });
      const targets = parsed.spans.map((span) =>
        coreResolve(span, cwd, { checkExists: true }),
      );
      return coreRewrite(part, targets, format);
    })
    .join("");
}

async function printTarget(raw: string | undefined, text: string | undefined, format: Format): Promise<void> {
  if (text !== undefined) {
    if (raw !== undefined) throw new UsageError("print takes either a target or --text, not both");
    process.stdout.write(`${rewriteText(text, format)}\n`);
    return;
  }
  if (!raw) throw new UsageError("print requires a path, URL, or --text");
  const target = classifyInput(raw);
  if (target.kind === "file" && !target.exists) {
    throw new RuntimeError(`file not found: ${target.value}`);
  }
  process.stdout.write(`${formatTarget(target, format)}\n`);
}

async function printDoctor(): Promise<void> {
  const profile = detectTerminal();
  const version = getVersion();
  const force = process.env.FORCE_HYPERLINK;
  const forceEnabled = Boolean(force && !["0", "false", "no", "off"].includes(force.toLowerCase()));
  process.stdout.write(`cclink8 ${version}\n`);
  process.stdout.write(`node ${process.version} (${process.platform}/${process.arch})\n`);
  process.stdout.write(`terminal: ${profile.name} (level ${profile.level})\n`);
  for (const note of profile.notes) process.stdout.write(`  - ${note}\n`);
  process.stdout.write(`FORCE_HYPERLINK=${force || "(unset)"}\n`);
  if (!forceEnabled) {
    process.stdout.write("FORCE_HYPERLINK is not set. Set it BEFORE starting Claude Code:\n");
    process.stdout.write("  PowerShell: $env:FORCE_HYPERLINK=1\n");
    process.stdout.write("  cmd:        set FORCE_HYPERLINK=1\n");
    process.stdout.write("Restart the terminal/Claude Code after setting it.\n");
  }
  process.stdout.write("core: bundled (print/open/copy available)\n");
}

function printDemo(): void {
  const samples = [
    process.execPath,
    homedir(),
    "\\\\server\\share\\example.txt",
    "https://example.com/",
    "C:\\path with space\\中文文件.txt",
  ];
  process.stdout.write("cclink8 demo — five link forms\n\n");
  for (const raw of samples) {
    try {
      const target = classifyInput(raw);
      process.stdout.write(`${formatTarget(target, "markdown")}\n`);
    } catch (error) {
      process.stdout.write(`(${raw}) ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  process.stdout.write("\nPaste one into Claude Code, or run `cclink8 print --text ...`.\n");
}

function printInit(): void {
  process.stdout.write([
    "Install the Claude Code plugin:",
    "",
    "  claude plugin marketplace add Cyber-Marty/cclink8",
    "  claude plugin install cclink8@cclink8",
    "",
    "Then run:",
    "",
    "  cclink8 doctor",
    "",
    "The plugin is self-contained; no npm install is required for the plugin.",
    "If Ctrl+Click does nothing: set FORCE_HYPERLINK=1 before starting claude (cclink8 doctor shows commands).",
    "npm registry is pending. Install the CLI from a GitHub tarball or from source:",
    `  npm pack -w cclink8 && npm i -g ./cclink8-${getVersion()}.tgz`,
  ].join("\n") + "\n");
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    if (args.version) {
      process.stdout.write(`${getVersion()}\n`);
      return 0;
    }
    if (args.help || !args.command) {
      process.stdout.write(`${usage()}\n`);
      return args.help ? 0 : 2;
    }

    switch (args.command) {
      case "open":
        if (!args.target) throw new UsageError("open requires a path or URL");
        await openTarget(args.target);
        return 0;
      case "copy":
        if (!args.target) throw new UsageError("copy requires a path or URL");
        await copyTarget(args.target);
        return 0;
      case "print":
        await printTarget(args.target, args.text, args.format);
        return 0;
      case "doctor":
        await printDoctor();
        return 0;
      case "demo":
        printDemo();
        return 0;
      case "init":
        printInit();
        return 0;
      default:
        throw new UsageError(`unknown command: ${args.command}`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`cclink8: ${error.message}\n\n${usage()}\n`);
      return error.exitCode;
    }
    if (error instanceof RuntimeError) {
      process.stderr.write(`cclink8: ${error.message}\n`);
      return error.exitCode;
    }
    process.stderr.write(`cclink8: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
