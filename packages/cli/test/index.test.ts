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

  it("doctor reports the bundled core", async () => {
    expect(await runCli(["doctor"])).toBe(0);
    expect(stdout).toContain("core: bundled");
  });

  it("init mentions the pending npm registry", async () => {
    expect(await runCli(["init"])).toBe(0);
    expect(stdout).toContain("npm registry is pending");
  });
});
