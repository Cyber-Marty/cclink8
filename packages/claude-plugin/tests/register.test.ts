import { expect, test } from "claude-code/testing";

const SITE = {
  plugin: "cclink8",
  component: "AssistantMessage",
  requestId: "m1",
  props: {
    text: "",
    isFirstOfReply: true,
  },
  surface: "terminal",
} as const;

function stubEnv(on: any, value: string | undefined = "1") {
  on("env.get", ($: any, e: any) => ({
    value: e.name === "OS" ? "Windows_NT" : value,
  }));
  on("env.set", () => ({ value: undefined }));
}

function stubProcess(on: any): { argv?: string[]; calls: string[][] } {
  const captured: { argv?: string[]; calls: string[][] } = { calls: [] };
  on("process.run", ($: any, e: any) => {
    captured.argv = e.argv;
    captured.calls.push(e.argv);
    return { value: { exitCode: 0, stdout: "", stderr: "" } };
  });
  return captured;
}

async function render(
  $: any,
  on: any,
  text: string,
  options: { surface?: string; isFirstOfReply?: boolean } = {},
): Promise<string> {
  let captured = text;
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    captured = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({
    ...SITE,
    surface: options.surface ?? "terminal",
    props: {
      ...SITE.props,
      isFirstOfReply: options.isFirstOfReply ?? true,
      text,
    },
  });
  const md = await ui.find({ type: "Markdown" });
  if (md) captured = String((md.props as any).text ?? captured);
  await ui.unmount();
  return captured;
}

test("rewrites a Windows file path to a file:// markdown link", async ($, on) => {
  const out = await render($, on, "see C:\\work\\file.py");
  expect(out).toContain("(file:///C:/work/file.py)");
});

test("rewrites a POSIX file path to a file:// markdown link", async ($, on) => {
  const out = await render($, on, "see /home/user/file.py");
  expect(out).toContain("(file:///home/user/file.py)");
});

test("keeps an http URL clickable", async ($, on) => {
  const out = await render($, on, "see https://example.com/page");
  expect(out).toContain("https://example.com/page");
});

test("rewrites spaces, Chinese and brackets in a valid path", async ($, on) => {
  const out = await render($, on, "see C:\\工作 目录\\文件(1).py");
  expect(out).toContain("file:///C:/");
  expect(out).toContain("%E5%B7%A5");
});

test("links a syntactically valid path even when it does not exist", async ($, on) => {
  const out = await render($, on, "see C:\\definitely\\missing\\cclink8.txt");
  expect(out).toContain("(file:///C:/definitely/missing/cclink8.txt)");
});

test("does not rewrite inside inline code", async ($, on) => {
  const input = "`C:\\work\\file.py`";
  expect(await render($, on, input)).toBe(input);
});

test("does not rewrite inside a fenced code block", async ($, on) => {
  const input = "```\nC:\\work\\file.py\n```";
  const out = await render($, on, input);
  expect(out).toBe(input);
  expect(out).not.toContain("file:///");
});

test("does not rewrite inside an existing markdown link", async ($, on) => {
  const input = "[C:\\work\\file.py](file:///C:/work/file.py)";
  expect(await render($, on, input)).toBe(input);
});

test("is idempotent", async ($, on) => {
  const texts: string[] = [];
  let fallbackText = "";
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    fallbackText = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });

  const first = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "C:\\work\\file.py", isFirstOfReply: false },
  });
  const firstMd = await first.find({ type: "Markdown" });
  texts.push(String((firstMd?.props as any)?.text ?? ""));
  await first.unmount();

  const second = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: texts[0], isFirstOfReply: false },
  });
  const secondMd = await second.find({ type: "Markdown" });
  texts.push(secondMd ? String((secondMd.props as any)?.text ?? "") : fallbackText);
  await second.unmount();

  expect(texts[1]).toBe(texts[0]);
});

test("caches session.cwd across assistant blocks", async ($, on) => {
  let calls = 0;
  stubEnv(on);
  on("session.cwd", () => {
    calls += 1;
    return { value: "C:/work" };
  });
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));

  const first = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\a.py" } });
  await first.unmount();
  const second = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\b.py" } });
  await second.unmount();

  expect(calls).toBe(1);
});

test("leaves text without paths unchanged", async ($, on) => {
  const input = "no paths here, just prose";
  expect(await render($, on, input)).toBe(input);
});

test("does not break when session.cwd() throws", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => {
    throw new Error("no cwd");
  });
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "see C:\\work\\file.py\nrelative/file.py" },
  });
  const md = await ui.find({ type: "Markdown" });
  const text = String((md?.props as any)?.text ?? "");
  await ui.unmount();

  expect(text).toContain("(file:///C:/work/file.py)");
  expect(text).not.toContain("file:///relative");
});

test("preserves other AssistantMessage props on fallback A", async ($, on) => {
  let capturedProps: any;
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    capturedProps = e.props;
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({
    ...SITE,
    surface: "desktop",
    props: { ...SITE.props, text: "C:\\work\\file.py", custom: "keep-me" },
  });
  await ui.unmount();

  expect(capturedProps.custom).toBe("keep-me");
  expect(capturedProps.isFirstOfReply).toBe(true);
});

test("adds the reply bullet on the first block", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));
  const ui = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\file.py" } });
  const md = await ui.find({ type: "Markdown" });
  expect(String((md?.props as any)?.text ?? "").startsWith("● ")).toBe(true);
  await ui.unmount();
});

test("does not add the bullet on later blocks", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "C:\\work\\file.py", isFirstOfReply: false },
  });
  const md = await ui.find({ type: "Markdown" });
  expect(String((md?.props as any)?.text ?? "").startsWith("● ")).toBe(false);
  await ui.unmount();
});

test("press on .xlsx runs explorer with the decoded path", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  const captured = stubProcess(on);
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "C:\\work\\book.xlsx", isFirstOfReply: false },
  });
  await ui.press({ key: "cclink8-links", link: { href: "file:///C:/work/book.xlsx" } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await ui.unmount();
  expect(captured.argv).toEqual(["explorer.exe", "C:\\work\\book.xlsx"]);
});

test("press on .txt runs explorer with the decoded path", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  const captured = stubProcess(on);
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "C:\\work\\notes.txt", isFirstOfReply: false },
  });
  await ui.press({ key: "cclink8-links", link: { href: "file:///C:/work/notes.txt" } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await ui.unmount();
  expect(captured.argv).toEqual(["explorer.exe", "C:\\work\\notes.txt"]);
});

test("press on a spaces/Chinese path decodes correctly", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  const captured = stubProcess(on);
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "C:\\工作 目录\\文件.xlsx", isFirstOfReply: false },
  });
  await ui.press({
    key: "cclink8-links",
    link: { href: "file:///C:/%E5%B7%A5%E4%BD%9C%20%E7%9B%AE%E5%BD%95/%E6%96%87%E4%BB%B6.xlsx" },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await ui.unmount();
  expect(captured.argv).toEqual(["explorer.exe", "C:\\工作 目录\\文件.xlsx"]);
});

test("press works for every file extension matrix", async ($, on) => {
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  const captured = stubProcess(on);
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));

  const simple = [
    "file.md", "file.txt", "file.csv", "file.json", "file.py", "file.xlsx", "file.xls",
    "file.docx", "file.doc", "file.pptx", "file.ppt", "file.pdf", "file.zip", "file.7z",
    "file.png", "file.jpg", "file.mp4", "file.bin", "README",
  ];
  const cases = simple.map((name) => ({
    text: `C:\\work\\${name}`,
    href: `file:///C:/work/${name}`,
    path: `C:\\work\\${name}`,
  }));
  cases.push({
    text: "C:\\工作 目录\\文件.docx",
    href: "file:///C:/%E5%B7%A5%E4%BD%9C%20%E7%9B%AE%E5%BD%95/%E6%96%87%E4%BB%B6.docx",
    path: "C:\\工作 目录\\文件.docx",
  });

  for (const item of cases) {
    const ui = await $.ui.mount({
      ...SITE,
      props: { ...SITE.props, text: item.text, isFirstOfReply: false },
    });
    expect(await ui.find({ type: "Markdown" })).toBeDefined();
    await ui.press({ key: "cclink8-links", link: { href: item.href } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await ui.unmount();
    expect(captured.calls.at(-1)).toEqual(["explorer.exe", item.path]);
  }
});

test("long text falls back to native AssistantMessage rewriting", async ($, on) => {
  const text = "x".repeat(10_001) + " C:\\work\\file.py";
  let captured = "";
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    captured = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({ ...SITE, props: { ...SITE.props, text } });
  expect(await ui.find({ type: "Markdown" })).toBeUndefined();
  await ui.unmount();
  expect(captured).toContain("(file:///C:/work/file.py)");
});

test("non-CLI surface falls back to native AssistantMessage rewriting", async ($, on) => {
  const text = "see C:\\work\\file.py";
  let captured = "";
  stubEnv(on);
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    captured = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({ ...SITE, surface: "desktop", props: { ...SITE.props, text } });
  expect(await ui.find({ type: "Markdown" })).toBeUndefined();
  await ui.unmount();
  expect(captured).toContain("(file:///C:/work/file.py)");
});

test("sets FORCE_HYPERLINK when unset", async ($, on) => {
  let getCalls = 0;
  let setValue: string | undefined;
  on("env.get", ($: any, e: any) => {
    getCalls += 1;
    return { value: e.name === "OS" ? "Windows_NT" : undefined };
  });
  on("env.set", ($: any, e: any) => {
    setValue = e.value;
    return { value: undefined };
  });
  on("session.start", () => ({ cwd: "/work" }));

  await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" });

  expect(getCalls).toBe(1);
  expect(setValue).toBe("1");
});

test("sets once and falls back to the first ui.render when session.start did not run", async ($, on) => {
  let getCalls = 0;
  let setCalls = 0;
  on("env.get", ($: any, e: any) => {
    getCalls += 1;
    return { value: e.name === "OS" ? "Windows_NT" : undefined };
  });
  on("env.set", () => {
    setCalls += 1;
    return { value: undefined };
  });
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", () => ({ type: "Text", props: {}, children: ["drawn by Claude Code"] }));

  const first = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\a.py" } });
  await first.unmount();
  const second = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\b.py" } });
  await second.unmount();

  expect(getCalls).toBe(1);
  expect(setCalls).toBe(1);
});

test("does not override an explicit FORCE_HYPERLINK value", async ($, on) => {
  let setCalled = false;
  on("env.get", ($: any, e: any) => ({ value: e.name === "OS" ? "Windows_NT" : "0" }));
  on("env.set", () => {
    setCalled = true;
    return { value: undefined };
  });
  on("session.start", () => ({ cwd: "/work" }));

  await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" });

  expect(setCalled).toBe(false);
});

test("env failure does not block rendering", async ($, on) => {
  let captured = "";
  on("env.get", () => {
    throw new Error("env unavailable");
  });
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    captured = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });

  const ui = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\file.py" } });
  const md = await ui.find({ type: "Markdown" });
  const text = String((md?.props as any)?.text ?? captured);
  await ui.unmount();

  expect(text).toContain("(file:///C:/work/file.py)");
});

test("does not break drawing when the text is not a string", async ($, on) => {
  let captured: unknown = "unset";
  stubEnv(on);
  on("ui.render", ($: any, e: any) => {
    captured = e.props.text;
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: undefined } });
  await ui.unmount();
  expect(captured).toBeUndefined();
});
