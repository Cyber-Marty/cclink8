import { parse, resolve, rewrite, rewriteMarkdown } from "@cclink8/core/pure";
import type { ResolvedTarget } from "@cclink8/core/pure";

type ModsApi = {
  session: {
    cwd: () => Promise<string>;
  };
  env: {
    get: (name: string) => Promise<string | undefined>;
    set: (name: string, value: string) => Promise<void>;
  };
  process?: {
    run: (argv: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  ui: {
    resolve: (event: unknown) => {
      Markdown: (props: Record<string, unknown>) => unknown;
      Box: (props: Record<string, unknown>, ...children: unknown[]) => unknown;
      Text: (props: Record<string, unknown>, ...children: unknown[]) => unknown;
    };
    log: (text: string) => Promise<unknown>;
  };
};

type AssistantMessageEvent = {
  surface?: string;
  props: {
    text?: unknown;
    isFirstOfReply?: boolean;
    [key: string]: unknown;
  };
};

type Next = (event: any) => unknown;

type On = {
  (
    event: "ui.render",
    filter: { component: "AssistantMessage" },
    handler: (api: ModsApi, event: AssistantMessageEvent, next: Next) => Promise<unknown>,
  ): void;
  (
    event: "session.start",
    handler: (api: ModsApi, event: unknown, next: Next) => Promise<unknown>,
  ): void;
};

const MAX_MARKDOWN = 10_000;
const MAX_PRESSABLE = 256;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

let cwdPromise: Promise<string | undefined> | undefined;
let hyperlinkPromise: Promise<void> | undefined;

function ensureHyperlink(api: ModsApi): Promise<void> {
  if (!hyperlinkPromise) {
    hyperlinkPromise = (async () => {
      try {
        const current = await api.env.get("FORCE_HYPERLINK");
        if (current === undefined || current === "") {
          await api.env.set("FORCE_HYPERLINK", "1");
        }
      } catch {
        // Silent: a failed env read/write must never block drawing.
      }
    })();
  }
  return hyperlinkPromise;
}

function sessionCwd(api: ModsApi): Promise<string | undefined> {
  if (!cwdPromise) {
    cwdPromise = api.session.cwd().then(
      (cwd) => (typeof cwd === "string" && cwd.length > 0 ? cwd : undefined),
      () => undefined,
    );
  }
  return cwdPromise;
}

function fileUrlToPath(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "file:") return null;
    let path = decodeURIComponent(url.pathname);
    if (url.hostname) {
      return `\\\\${url.hostname}${path.replace(/\//g, "\\")}`;
    }
    if (/^\/[A-Za-z]:\//.test(path)) {
      return path.slice(1).replace(/\//g, "\\");
    }
    return path;
  } catch {
    return null;
  }
}

type Platform = "win32" | "darwin" | "linux";

async function detectPlatform(api: ModsApi): Promise<Platform> {
  let os = "";
  try {
    os = (await api.env.get("OS")) || "";
  } catch {
    // Fall back to the cwd shape.
  }
  if (/^win/i.test(os)) return "win32";
  if (/darwin|mac/i.test(os)) return "darwin";

  const cwd = await sessionCwd(api);
  if (cwd && (/^[A-Za-z]:[\\/]/.test(cwd) || cwd.startsWith("\\\\"))) return "win32";
  if (cwd && cwd.startsWith("/Users/")) return "darwin";
  return "linux";
}

async function log(api: ModsApi, text: string): Promise<void> {
  try {
    await api.ui.log(text);
  } catch {
    // Logging is best-effort and must not break the press chain.
  }
}

async function openLink(api: ModsApi, href: string): Promise<void> {
  try {
    if (!href || CONTROL_RE.test(href)) {
      await log(api, `cclink8: refused unsafe link: ${href}`);
      return;
    }

    const parsed = new URL(href);
    const protocol = parsed.protocol;
    if (protocol !== "file:" && protocol !== "http:" && protocol !== "https:") {
      await log(api, `cclink8: unsupported scheme: ${protocol}`);
      return;
    }
    const platform = await detectPlatform(api);
    let argv: string[];

    if (protocol === "file:") {
      const path = fileUrlToPath(href);
      if (!path || CONTROL_RE.test(path)) {
        await log(api, `cclink8: invalid file link: ${href}`);
        return;
      }
      argv = platform === "win32"
        ? ["explorer.exe", path]
        : platform === "darwin"
          ? ["open", path]
          : ["xdg-open", path];
    } else {
      argv = platform === "win32"
        ? ["rundll32.exe", "url.dll,FileProtocolHandler", parsed.href]
        : platform === "darwin"
          ? ["open", parsed.href]
          : ["xdg-open", parsed.href];
    }

    const result = await api.process!.run(argv);
    // explorer.exe and rundll32.exe often return 1 after successfully opening;
    // only log non-zero for the launchers whose exit code is meaningful.
    if (result.exitCode !== 0 && !(platform === "win32" && (argv[0] === "explorer.exe" || argv[0] === "rundll32.exe"))) {
      await log(api, `cclink8: ${argv[0]} exited with ${result.exitCode}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log(api, `cclink8: failed to open ${href}: ${message}`);
  }
}

function buildMarkdown(
  api: ModsApi,
  event: AssistantMessageEvent,
  text: string,
  targets: ResolvedTarget[],
): unknown | null {
  const links = targets
    .filter((target) => target.ok && (target.kind === "file-path" || target.kind === "file-url" || target.kind === "url"))
    .map((target) => target.url);
  if (links.length === 0 || links.length > MAX_PRESSABLE) return null;

  const { Markdown } = api.ui.resolve(event);
  // The engine does not reliably keep the opening bullet when a mod replaces
  // the AssistantMessage drawing, so keep it in the Markdown text itself.
  const display = event.props.isFirstOfReply ? `● ${text}` : text;
  if (display.length > MAX_MARKDOWN) return null;

  return Markdown({
    key: "cclink8-links",
    text: display,
    pressableLinks: links,
    onLinkPress: (link: { href: string }) => {
      void openLink(api, link.href);
    },
  });
}

export function register(on: On): void {
  on("session.start", async ($, e, next) => {
    try {
      await ensureHyperlink($);
    } catch {
      // Never block session start.
    }
    return next(e);
  });

  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    try {
      await ensureHyperlink($);
    } catch {
      // Ignore: hyperlink setup must not break the transcript drawing.
    }

    try {
      const original = e?.props?.text;
      if (typeof original !== "string" || original.length === 0) return next(e);

      const cwd = await sessionCwd($);
      const checkExists = false;
      const canPress = e.surface === "terminal";

      // D008: on the CLI surface, replace the drawing with a Markdown tree so
      // the mod itself handles clicks (terminal OSC 8 click forwarding is not
      // reliable for some extensions, e.g. .xlsx).
      if (canPress && original.length <= MAX_MARKDOWN) {
        try {
          const { spans } = parse(original, { cwd, checkExists });
          const targets = spans.map((span) => resolve(span, cwd ?? "/", { checkExists }));
          const text = rewrite(original, targets, "markdown");
          if (text !== original && text.length <= MAX_MARKDOWN) {
            const tree = buildMarkdown($, e, text, targets);
            if (tree) return tree;
          }
        } catch {
          // Fall through to the native-text fallback.
        }
      }

      // Fallback A: preserve the native AssistantMessage drawing. This also
      // covers non-CLI surfaces, long text, and no-process environments.
      const rewritten = rewriteMarkdown(
        original,
        cwd ? { cwd, checkExists } : { checkExists },
      );
      if (typeof rewritten !== "string" || rewritten === original) return next(e);
      return next({ ...e, props: { ...e.props, text: rewritten } });
    } catch {
      // A render hook must never break the transcript drawing.
      return next(e);
    }
  });
}
