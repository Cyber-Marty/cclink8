import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import {
  UsageError,
  buildOpenCommand,
  classifyInput,
  detectTerminal,
  formatTarget,
  parseArgs,
  splitTrailingLine,
  usage,
} from "../src/lib.js";

describe("splitTrailingLine", () => {
  it("splits Windows paths with line and column", () => {
    expect(splitTrailingLine("C:\\repo\\file.py:42:3")).toEqual({
      path: "C:\\repo\\file.py",
      line: 42,
      column: 3,
    });
  });

  it("leaves a plain path alone", () => {
    expect(splitTrailingLine("C:\\repo\\file.py")).toEqual({ path: "C:\\repo\\file.py" });
  });
});

describe("classifyInput", () => {
  it("accepts http and https URLs", () => {
    expect(classifyInput("https://example.com/a").kind).toBe("url");
    expect(classifyInput("http://localhost:8080/x").kind).toBe("url");
  });

  it("rejects dangerous schemes", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "smb://host/share"]) {
      expect(() => classifyInput(value)).toThrow(UsageError);
    }
  });

  it("round-trips a file URL", () => {
    const url = pathToFileURL(process.execPath).href;
    const target = classifyInput(url);
    expect(target.kind).toBe("file");
    expect(target.exists).toBe(true);
  });

  it("marks missing files as not existing", () => {
    const target = classifyInput("C:\\definitely\\missing\\cclink8.txt");
    expect(target.kind).toBe("file");
    expect(target.exists).toBe(false);
  });

  it("keeps line and column in the label but strips them from the opened path", () => {
    const target = classifyInput("C:\\repo\\file.py:42:3");
    expect(target.value).toBe("C:\\repo\\file.py");
    expect(target.label).toBe("file.py:42:3");
    expect(target.line).toBe(42);
    expect(target.column).toBe(3);
  });

  it("keeps the UNC host from a file URL", () => {
    const target = classifyInput("file://server/share/a%20b.txt");
    expect(target.value).toBe("\\\\server\\share\\a b.txt");
    expect(target.label).toBe("a b.txt");
  });

  it("rejects percent-encoded control characters in file URLs", () => {
    expect(() => classifyInput("file:///C:/x%1By")).toThrow(UsageError);
  });

  it("rejects encoded path separators in file URLs", () => {
    expect(() => classifyInput("file:///C:/foo%2Fbar")).toThrow(UsageError);
  });
});

describe("formatTarget", () => {
  it("formats markdown, osc8 and plain", () => {
    const target = classifyInput("https://example.com/");
    expect(formatTarget(target, "markdown")).toBe("[https://example.com/](https://example.com/)");
    expect(formatTarget(target, "plain")).toBe("https://example.com/");
    expect(formatTarget(target, "osc8")).toContain("\u001b]8;;https://example.com/\u001b\\");
  });

  it("escapes brackets and backslashes in the markdown label", () => {
    const target = classifyInput("C:\\repo\\a[b].py");
    const out = formatTarget(target, "markdown");
    expect(out).toContain("a\\[b\\].py");
    expect(out).toContain("](file:///C:/repo/");
  });
});

describe("buildOpenCommand", () => {
  it("returns a command and argv array", () => {
    const command = buildOpenCommand(classifyInput("https://example.com/"));
    expect(command.file.length).toBeGreaterThan(0);
    expect(Array.isArray(command.args)).toBe(true);
  });
});

describe("detectTerminal", () => {
  it("detects Windows Terminal", () => {
    expect(detectTerminal({ WT_SESSION: "1" }, "win32").level).toBe("A");
  });

  it("detects VS Code", () => {
    expect(detectTerminal({ TERM_PROGRAM: "vscode" }, "win32").level).toBe("A");
  });

  it("falls back for unknown consoles", () => {
    expect(detectTerminal({}, "win32").level).toBe("C");
  });
});

describe("parseArgs", () => {
  it("parses print with text and format", () => {
    const args = parseArgs(["print", "--text", "a C:\\x\\y.py:1", "-f", "osc8"]);
    expect(args.command).toBe("print");
    expect(args.text).toBe("a C:\\x\\y.py:1");
    expect(args.format).toBe("osc8");
  });

  it("rejects unknown options", () => {
    expect(() => parseArgs(["open", "--bogus"])).toThrow(UsageError);
  });
});

describe("usage", () => {
  it("lists the v0.1 commands", () => {
    for (const command of ["open", "print", "copy", "doctor", "demo", "init"]) {
      expect(usage()).toContain(command);
    }
  });
});
