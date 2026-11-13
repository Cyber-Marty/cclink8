import { rewriteMarkdown } from "@cclink8/core/pure";

type ModsApi = {
  session: {
    cwd: () => Promise<string>;
  };
  env: {
    get: (name: "FORCE_HYPERLINK") => Promise<string | undefined>;
    set: (name: "FORCE_HYPERLINK", value: string) => Promise<void>;
  };
};

type AssistantMessageEvent = {
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

// One Claude Code session loads this module once. Cache the session cwd so a
// transcript with many assistant blocks does not call $.session.cwd() each time.
let cwdPromise: Promise<string | undefined> | undefined;

// D007: enable OSC 8 hyperlinks without asking the user to set an env var.
// Run at most once per session; never override an explicit user value.
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
    // Fallback for surfaces where session.start did not run.
    try {
      await ensureHyperlink($);
    } catch {
      // Ignore: hyperlink setup must not break the transcript drawing.
    }

    try {
      const original = e?.props?.text;
      if (typeof original !== "string" || original.length === 0) return next(e);

      const cwd = await sessionCwd($);
      // D006-A: syntax-only rendering. Never touch the filesystem here.
      // Without a cwd, relative paths stay unlinked inside core/pure.
      const rewritten = rewriteMarkdown(
        original,
        cwd ? { cwd, checkExists: false } : { checkExists: false },
      );
      if (typeof rewritten !== "string" || rewritten === original) return next(e);

      return next({ ...e, props: { ...e.props, text: rewritten } });
    } catch {
      // A render hook must never break the transcript drawing.
      return next(e);
    }
  });
}
