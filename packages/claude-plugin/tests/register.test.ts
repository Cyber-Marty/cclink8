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

async function render($: any, on: any, text: string): Promise<string> {
  let captured = text;
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    captured = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({ ...SITE, props: { ...SITE.props, text } });
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
  const out = await render($, on, input);
  expect(out).toBe(input);
});

test("does not rewrite inside a fenced code block", async ($, on) => {
  const input = "```\nC:\\work\\file.py\n```";
  const out = await render($, on, input);
  expect(out).toBe(input);
  expect(out).not.toContain("file:///");
});

test("does not rewrite inside an existing markdown link", async ($, on) => {
  const input = "[C:\\work\\file.py](file:///C:/work/file.py)";
  const out = await render($, on, input);
  expect(out).toBe(input);
});

test("is idempotent", async ($, on) => {
  const captured: string[] = [];
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    captured.push(String(e.props.text ?? ""));
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });

  const first = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: "C:\\work\\file.py" } });
  await first.unmount();
  const second = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: captured[0] } });
  await second.unmount();

  expect(captured[1]).toBe(captured[0]);
});

test("caches session.cwd across assistant blocks", async ($, on) => {
  let calls = 0;
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
  const out = await render($, on, input);
  expect(out).toBe(input);
});

test("does not break when session.cwd() throws", async ($, on) => {
  let captured = "";
  on("session.cwd", () => {
    throw new Error("no cwd");
  });
  on("ui.render", ($: any, e: any) => {
    captured = String(e.props.text ?? "");
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "see C:\\work\\file.py\nrelative/file.py" },
  });
  await ui.unmount();

  expect(captured).toContain("(file:///C:/work/file.py)");
  expect(captured).not.toContain("file:///relative");
});

test("preserves other AssistantMessage props", async ($, on) => {
  let capturedProps: any;
  on("session.cwd", () => ({ value: "C:/work" }));
  on("ui.render", ($: any, e: any) => {
    capturedProps = e.props;
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({
    ...SITE,
    props: { ...SITE.props, text: "C:\\work\\file.py", custom: "keep-me" },
  });
  await ui.unmount();

  expect(capturedProps.custom).toBe("keep-me");
  expect(capturedProps.isFirstOfReply).toBe(true);
});

test("does not break drawing when the text is not a string", async ($, on) => {
  let captured: unknown = "unset";
  on("ui.render", ($: any, e: any) => {
    captured = e.props.text;
    return { type: "Text", props: {}, children: ["drawn by Claude Code"] };
  });
  const ui = await $.ui.mount({ ...SITE, props: { ...SITE.props, text: undefined } });
  await ui.unmount();
  expect(captured).toBeUndefined();
});
