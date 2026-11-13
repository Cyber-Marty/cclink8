import { rewriteMarkdown } from "@cclink8/core/pure";

type ModsApi = {
  session: {
    cwd: () => Promise<string>;
  };
};

type AssistantMessageEvent = {
  props: {
    text?: unknown;
    isFirstOfReply?: boolean;
    [key: string]: unknown;
  };
};

type Next = (event: AssistantMessageEvent) => unknown;

type On = (
  event: "ui.render",
  filter: { component: "AssistantMessage" },
  handler: (api: ModsApi, event: AssistantMessageEvent, next: Next) => Promise<unknown>,
) => void;

// One Claude Code session loads this module once. Cache the session cwd so a
// transcript with many assistant blocks does not call $.session.cwd() each time.
let cwdPromise: Promise<string | undefined> | undefined;

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
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
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
