import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/index.js";

let stdout = "";
let stderr = "";

beforeEach(() => {
  stdout = "";
  stderr = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runCli exit codes", () => {
  it("returns 0 for help and version", async () => {
    expect(await runCli(["--help"])).toBe(0);
    expect(await runCli(["--version"])).toBe(0);
  });

  it("returns 2 for no command or unknown command", async () => {
    expect(await runCli([])).toBe(2);
    expect(await runCli(["nope"])).toBe(2);
  });

  it("returns 1 when open, copy, or print target does not exist", async () => {
    expect(await runCli(["open", "C:\\definitely\\missing\\x.py"])).toBe(1);
    expect(await runCli(["copy", "C:\\definitely\\missing\\x.py"])).toBe(1);
    expect(await runCli(["print", "C:\\definitely\\missing\\x.py"])).toBe(1);
    expect(stderr).toContain("file not found");
  });

  it("leaves a missing path unchanged in print --text", async () => {
    expect(await runCli(["print", "--text", "see C:\\definitely\\missing\\x.py"])).toBe(0);
    expect(stdout).not.toContain("file:///");
  });

  it("does not merge a missing path with a following URL", async () => {
    expect(
      await runCli(["print", "--text", "see C:\\definitely\\missing\\x.py and https://example.com/"]),
    ).toBe(0);
    expect(stdout).toContain("[https://example.com/]");
    expect(stdout).not.toContain("x.py%20and");
  });

  it("keeps line/column in the print label", async () => {
    expect(await runCli(["print", `${process.execPath}:42`])).toBe(0);
    expect(stdout).toContain(":42](");
    expect(stdout).toContain("file:///");
  });

  it("keeps the UNC host from a file URL", async () => {
    expect(await runCli(["print", "file://server/share/a%20b.txt"])).toBe(0);
    expect(stdout).toContain("file://server/share/a%20b.txt");
  });

  it("doctor explains that the plugin sets FORCE_HYPERLINK automatically", async () => {
    const previous = process.env.FORCE_HYPERLINK;
    delete process.env.FORCE_HYPERLINK;
    try {
      expect(await runCli(["doctor"])).toBe(0);
      expect(stdout).toContain("core: bundled");
      expect(stdout).toContain("plugin sets it automatically");
      expect(stdout).toContain("CLI clicks are handled by the plugin");
      expect(stdout).toContain("single-click plugin links");
      expect(stdout).not.toContain("PowerShell:");
      expect(stdout).not.toContain("cmd:");
    } finally {
      if (previous === undefined) delete process.env.FORCE_HYPERLINK;
      else process.env.FORCE_HYPERLINK = previous;
    }
  });

  it("doctor warns when FORCE_HYPERLINK is explicitly disabled", async () => {
    const previous = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = "0";
    try {
      expect(await runCli(["doctor"])).toBe(0);
      expect(stdout).toContain("explicitly disabled");
      expect(stdout).toContain("OSC 8 fallback may not be clickable");
      expect(stdout).toContain("cclink8 open");
    } finally {
      if (previous === undefined) delete process.env.FORCE_HYPERLINK;
      else process.env.FORCE_HYPERLINK = previous;
    }
  });

  it("init mentions the pending npm registry and single-click behavior", async () => {
    expect(await runCli(["init"])).toBe(0);
    expect(stdout).toContain("npm registry is pending");
    expect(stdout).toContain("handles a single click in the CLI");
  });
});
