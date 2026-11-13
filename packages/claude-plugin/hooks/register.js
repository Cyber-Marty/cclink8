// ../core/src/pure.ts
var MAX_PATH = 4096;
var MAX_URL = 2048;
var MAX_LINE = 1e6;
var MAX_COLUMN = 1e4;
var CONTROL_RE = /[\x00-\x1F\x7F]/;
var TRAILING_PUNCT_RE = /[.,;:!?。，；：！？]+$/;
function maskRanges(text, ranges) {
  const flags = new Uint8Array(text.length);
  const chars = text.split("");
  for (const [start, end] of ranges) {
    const from = Math.max(0, Math.min(start, text.length));
    const to = Math.max(from, Math.min(end, text.length));
    for (let i = from; i < to; i += 1) {
      flags[i] = 1;
      if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
    }
  }
  return { maskedText: chars.join(""), flags };
}
function lineRanges(text) {
  const out = [];
  const re = /[^\n]*\n|[^\n]+$/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    out.push({ start: match.index, text: match[0] });
    if (match[0].length === 0) break;
  }
  return out;
}
function fencedCodeRanges(text) {
  const ranges = [];
  const lines = lineRanges(text);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].text.replace(/\r?\n$/, "");
    const open = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
    if (!open) {
      i += 1;
      continue;
    }
    const fence = open[1];
    const marker = fence[0] === "`" ? "`" : "~";
    const min = fence.length;
    const start = lines[i].start;
    let end = start + lines[i].text.length;
    let j = i + 1;
    let closed = false;
    while (j < lines.length) {
      const candidate = lines[j].text.replace(/\r?\n$/, "");
      end = lines[j].start + lines[j].text.length;
      const closeRe = new RegExp(`^[ \\t]{0,3}${marker === "`" ? "`" : "~"}{${min},}[ \\t]*$`);
      if (closeRe.test(candidate)) {
        closed = true;
        break;
      }
      j += 1;
    }
    ranges.push([start, closed ? end : text.length]);
    i = closed ? j + 1 : lines.length;
  }
  return ranges;
}
function insideRanges(ranges, index) {
  for (const [start, end] of ranges) {
    if (index >= start && index < end) return end;
  }
  return null;
}
function inlineCodeRanges(text, fenced) {
  const ranges = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "`") {
      i += 1;
      continue;
    }
    const fencedEnd = insideRanges(fenced, i);
    if (fencedEnd !== null) {
      i = fencedEnd;
      continue;
    }
    let run = 0;
    while (text[i + run] === "`") run += 1;
    const close = text.indexOf("`".repeat(run), i + run);
    if (close === -1) {
      i += run;
      continue;
    }
    ranges.push([i, close + run]);
    i = close + run;
  }
  return ranges;
}
function regexRanges(text, re) {
  const ranges = [];
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let match;
  while ((match = copy.exec(text)) !== null) {
    if (match[0].length === 0) {
      copy.lastIndex += 1;
      continue;
    }
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}
function markdownStructureRanges(text) {
  const ranges = [];
  ranges.push(...regexRanges(text, /!?\[[^\]\n]*\]\([^)\n]*\)|\[[^\]\n]*\]\[[^\]\n]*\]/g));
  ranges.push(...regexRanges(text, /^[ \t]*\[[^\]\n]+\]:[^\n]*/gm));
  ranges.push(...regexRanges(text, /<!--[\s\S]*?-->/g));
  ranges.push(...regexRanges(text, /<(pre|code|a)\b[^>]*>[\s\S]*?<\/\1>/gi));
  ranges.push(...regexRanges(text, /<[^>\n]+>/g));
  return ranges;
}
function buildMask(text) {
  const fenced = fencedCodeRanges(text);
  const inline = inlineCodeRanges(text, fenced);
  const structure = markdownStructureRanges(text);
  return maskRanges(text, [...fenced, ...inline, ...structure]);
}
function trimTrailing(raw) {
  let value = raw.trimEnd();
  while (value.length > 0) {
    const punct = TRAILING_PUNCT_RE.exec(value);
    if (punct) {
      value = value.slice(0, punct[0].length > 0 ? value.length - punct[0].length : value.length);
      continue;
    }
    const last = value[value.length - 1];
    if (last === ")" && count(value, "(") < count(value, ")")) {
      value = value.slice(0, -1);
      continue;
    }
    if (last === "]" && count(value, "[") < count(value, "]")) {
      value = value.slice(0, -1);
      continue;
    }
    if (last === "}" && count(value, "{") < count(value, "}")) {
      value = value.slice(0, -1);
      continue;
    }
    break;
  }
  return value;
}
function count(value, needle) {
  let total = 0;
  for (const char of value) if (char === needle) total += 1;
  return total;
}
function pathVariants(raw) {
  const out = [raw];
  let value = raw;
  while (/\s/.test(value)) {
    const match = /\s+\S*$/.exec(value);
    if (!match || match.index <= 0) break;
    value = value.slice(0, match.index).trimEnd();
    if (value.length === 0) break;
    out.push(value);
  }
  return out;
}
function splitLineSuffix(value) {
  let match = /^(.*):(\d{1,7}):(\d{1,5})$/.exec(value);
  if (match && !/^[A-Za-z]:$/.test(match[1])) {
    return { pathText: match[1], line: Number(match[2]), column: Number(match[3]) };
  }
  match = /^(.*):(\d{1,7})$/.exec(value);
  if (match && !/^[A-Za-z]:$/.test(match[1])) {
    return { pathText: match[1], line: Number(match[2]) };
  }
  return { pathText: value };
}
function isWindowsPath(value) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}
function isRelativePath(value) {
  return value.startsWith("./") || value.startsWith("../");
}
function normalizePosix(value) {
  const absolute = value.startsWith("/");
  const out = [];
  for (const part of value.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
      continue;
    }
    out.push(part);
  }
  const body = out.join("/");
  return absolute ? `/${body}` : body.length > 0 ? body : ".";
}
function normalizeWindows(value) {
  let raw = value.replace(/\//g, "\\");
  let prefix = "";
  if (raw.startsWith("\\\\")) {
    const match = /^\\\\[^\\]+\\[^\\]+/.exec(raw);
    if (match) {
      prefix = match[0];
      raw = raw.slice(prefix.length);
    } else {
      prefix = "\\\\";
      raw = raw.slice(2);
    }
  } else {
    const match = /^([A-Za-z]:)(\\|$)/.exec(raw);
    if (match) {
      prefix = `${match[1]}\\`;
      raw = raw.slice(match[0].length);
    }
  }
  const out = [];
  for (const part of raw.split("\\")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (prefix.length === 0) out.push("..");
      continue;
    }
    out.push(part);
  }
  const body = out.join("\\");
  if (prefix.length > 0) {
    if (!prefix.endsWith("\\")) prefix += "\\";
    return body.length > 0 ? prefix + body : prefix;
  }
  return body.length > 0 ? body : ".";
}
function joinPath(cwd, value) {
  if (cwd.length === 0) return value;
  if (isWindowsPath(cwd) || isWindowsPath(value)) {
    return `${cwd.replace(/[\\/]+$/, "")}\\${value.replace(/^[\\/]+/, "")}`;
  }
  return `${cwd.replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
}
function canonicalPath(value, cwd) {
  if (isRelativePath(value)) {
    const joined2 = joinPath(cwd, value);
    return isWindowsPath(joined2) || isWindowsPath(cwd) ? normalizeWindows(joined2) : normalizePosix(joined2);
  }
  if (isWindowsPath(value)) return normalizeWindows(value);
  if (value.startsWith("/")) return normalizePosix(value);
  const joined = joinPath(cwd, value);
  return isWindowsPath(joined) || isWindowsPath(cwd) ? normalizeWindows(joined) : normalizePosix(joined);
}
function encodeFileUrlPath(path) {
  return path.split("/").map((segment, index) => index === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)).join("/");
}
function pathToUrl(value, opts) {
  if (opts?.toFileUrl) return opts.toFileUrl(value);
  const normalized = isWindowsPath(value) ? normalizeWindows(value) : normalizePosix(value);
  if (normalized.startsWith("\\\\")) {
    const body = normalized.slice(2).replace(/\\/g, "/");
    const slash = body.indexOf("/");
    const host = slash === -1 ? body : body.slice(0, slash);
    const rest = slash === -1 ? "" : body.slice(slash + 1);
    return `file://${encodeURIComponent(host)}${rest.length > 0 ? `/${encodeFileUrlPath(rest)}` : "/"}`;
  }
  if (/^[A-Za-z]:\\/.test(normalized)) {
    const drive = normalized[0];
    const rest = normalized.slice(2).replace(/^[\\/]+/, "").replace(/\\/g, "/");
    return `file:///${drive}:/${encodeFileUrlPath(rest)}`;
  }
  if (normalized.startsWith("/")) return `file://${encodeFileUrlPath(normalized)}`;
  return `file:///${encodeFileUrlPath(normalized.replace(/\\/g, "/"))}`;
}
function fileUrlToPath(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "file:") return null;
  if (/%2f|%5c/i.test(parsed.pathname)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (parsed.hostname) return `\\\\${parsed.hostname}${pathname.replace(/\//g, "\\")}`;
  if (/^\/[A-Za-z]:\//.test(pathname)) return pathname.slice(1).replace(/\//g, "\\");
  return pathname;
}
function vscodeUrlToPath(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "vscode:") return null;
  if (/%2f|%5c/i.test(parsed.pathname)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  let path;
  if (parsed.hostname === "file") {
    path = pathname;
    if (/^\/+[A-Za-z]:[\\/]/.test(path)) path = path.replace(/^\/+/, "");
  } else if (pathname.startsWith("/file/")) {
    path = pathname.slice("/file/".length);
    if (/^\/+[A-Za-z]:[\\/]/.test(path)) path = path.replace(/^\/+/, "");
  } else {
    return null;
  }
  return path;
}
function fileExists(value, cwd, opts) {
  const absolute = canonicalPath(value, cwd);
  if (isRelativePath(value)) return opts.exists ? opts.exists(absolute) : false;
  if (opts.checkExists === false) return true;
  return opts.exists ? opts.exists(absolute) : false;
}
function lineInfo(path, line, column, opts) {
  if (line === void 0) return {};
  if (!numericLineIsValid(line, column)) return {};
  if (opts?.lineFits && opts.checkExists !== false) return opts.lineFits(path, line, column);
  return { line, column };
}
function pathIsValid(value) {
  if (value.length === 0 || value.length > MAX_PATH) return false;
  if (CONTROL_RE.test(value)) return false;
  if (value.includes("`") || value.includes('"') || value.includes("'")) return false;
  if (value.includes("<") || value.includes(">") || value.includes("|")) return false;
  return true;
}
function urlIsValid(raw) {
  if (raw.length === 0 || raw.length > MAX_URL) return null;
  if (CONTROL_RE.test(raw)) return null;
  if (/[^\x20-\x7E]/.test(raw)) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || !parsed.hostname) return null;
  if (parsed.href.length > MAX_URL) return null;
  return parsed.href;
}
function numericLineIsValid(line, column) {
  if (line === void 0) return true;
  if (!Number.isInteger(line) || line < 1 || line > MAX_LINE) return false;
  if (column === void 0) return true;
  return Number.isInteger(column) && column >= 1 && column <= MAX_COLUMN;
}
function makeResolved(span, target, url, line, column) {
  const display = span.raw;
  const escaped = escapeMarkdownLabel(display);
  const safeUrl = escapeMarkdownUrl(url);
  return {
    ...span,
    ok: true,
    display,
    target,
    url,
    line,
    column,
    markdown: `[${escaped}](${safeUrl})`,
    osc8: `\x1B]8;;${url}\x1B\\${display}\x1B]8;;\x1B\\`
  };
}
function failed(span, reason) {
  return {
    ...span,
    ok: false,
    reason,
    display: span.raw,
    target: "",
    url: "",
    markdown: span.raw,
    osc8: span.raw
  };
}
function escapeMarkdownLabel(value) {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}
function escapeMarkdownUrl(value) {
  return value.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22").replace(/ /g, "%20");
}
var CANDIDATES = [
  { kind: "file-url", re: /file:\/\/[^\s<>"'`|]+/gi, priority: 100 },
  { kind: "vscode-url", re: /vscode:\/\/file\/[^\s<>"'`|]+/gi, priority: 100 },
  { kind: "url", re: /https?:\/\/[^\s<>"'`|]+/gi, priority: 90 },
  { kind: "file-path", re: /\\\\[^\n\r\t<>"'`|]*/g, priority: 80 },
  { kind: "file-path", re: /[A-Za-z]:[\\/][^\n\r\t<>"'`|]*/g, priority: 70 },
  { kind: "file-path", re: /(?<![A-Za-z0-9./])\/(?!\/)[^\n\r\t<>"'`|]*/g, priority: 60 },
  { kind: "file-path", re: /(?:\.{1,2}\/)[^\n\r\t<>"'`|]*/g, priority: 50 }
];
function findCandidates(maskedText, flags, text, allowRelative) {
  const all = [];
  for (const spec of CANDIDATES) {
    const copy = new RegExp(spec.re.source, spec.re.flags);
    let match;
    while ((match = copy.exec(maskedText)) !== null) {
      if (match[0].length === 0) {
        copy.lastIndex += 1;
        continue;
      }
      const start = match.index;
      const end = start + match[0].length;
      if (!rangeIsClean(flags, start, end)) continue;
      const raw = trimTrailing(text.slice(start, end));
      if (raw.length === 0) continue;
      if (!allowRelative && spec.kind === "file-path" && isRelativePath(raw)) continue;
      all.push({ start, end: start + raw.length, raw, kind: spec.kind, priority: spec.priority });
    }
  }
  all.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.end - b.start - (a.end - a.start);
  });
  const selected = [];
  let lastEnd = -1;
  for (const candidate of all) {
    if (candidate.start < lastEnd) continue;
    selected.push(candidate);
    lastEnd = candidate.end;
  }
  return selected;
}
function rangeIsClean(flags, start, end) {
  for (let i = start; i < end; i += 1) if (flags[i] === 1) return false;
  return true;
}
function looksCompletePath(value) {
  const split = splitLineSuffix(value);
  if (split.line !== void 0) return true;
  const last = split.pathText.split(/[\\/]/).filter(Boolean).pop() ?? "";
  return /\.[A-Za-z0-9]{1,12}$/.test(last);
}
function parsePathCandidate(candidate, cwd, opts) {
  const variants = pathVariants(candidate.raw);
  for (let index = 0; index < variants.length; index += 1) {
    const trimmed = trimTrailing(variants[index]);
    if (trimmed.length === 0) continue;
    if (!pathIsValid(trimmed)) continue;
    const split = splitLineSuffix(trimmed);
    if (!pathIsValid(split.pathText)) continue;
    if (/^\/+$/.test(split.pathText)) continue;
    if (index > 0 && !looksCompletePath(trimmed)) continue;
    if (!fileExists(split.pathText, cwd, opts)) continue;
    const info = lineInfo(canonicalPath(split.pathText, cwd), split.line, split.column, opts);
    return {
      start: candidate.start,
      end: candidate.start + trimmed.length,
      raw: trimmed,
      kind: candidate.kind,
      pathText: split.pathText,
      line: info.line,
      column: info.column
    };
  }
  return null;
}
function parseFileUrl(candidate, cwd, opts) {
  const raw = trimTrailing(candidate.raw);
  if (raw.length > MAX_URL || CONTROL_RE.test(raw)) return null;
  const path = fileUrlToPath(raw);
  if (path === null) return null;
  const split = splitLineSuffix(path);
  if (!pathIsValid(split.pathText)) return null;
  if (/^\/+$/.test(split.pathText)) return null;
  if (!fileExists(split.pathText, cwd, opts)) return null;
  const info = lineInfo(canonicalPath(split.pathText, cwd), split.line, split.column, opts);
  return {
    start: candidate.start,
    end: candidate.start + raw.length,
    raw,
    kind: candidate.kind,
    pathText: split.pathText,
    line: info.line,
    column: info.column
  };
}
function parseVscodeUrl(candidate, cwd, opts) {
  const raw = trimTrailing(candidate.raw);
  if (raw.length > MAX_URL || CONTROL_RE.test(raw)) return null;
  const path = vscodeUrlToPath(raw);
  if (path === null) return null;
  const split = splitLineSuffix(path);
  if (!pathIsValid(split.pathText)) return null;
  if (/^\/+$/.test(split.pathText)) return null;
  if (!fileExists(split.pathText, cwd, opts)) return null;
  const info = lineInfo(canonicalPath(split.pathText, cwd), split.line, split.column, opts);
  return {
    start: candidate.start,
    end: candidate.start + raw.length,
    raw,
    kind: candidate.kind,
    pathText: split.pathText,
    line: info.line,
    column: info.column
  };
}
function parseUrl(candidate) {
  const raw = trimTrailing(candidate.raw);
  const href = urlIsValid(raw);
  if (!href) return null;
  return {
    start: candidate.start,
    end: candidate.start + raw.length,
    raw,
    kind: candidate.kind,
    pathText: href
  };
}
function parseOneCandidate(candidate, cwd, opts) {
  if (candidate.kind === "url") return parseUrl(candidate);
  if (candidate.kind === "file-url") return parseFileUrl(candidate, cwd, opts);
  if (candidate.kind === "vscode-url") return parseVscodeUrl(candidate, cwd, opts);
  return parsePathCandidate(candidate, cwd, opts);
}
function splitPathStarts(raw) {
  const starts = [];
  const re = /(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/)|\.{1,2}\/)/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    if (match.index === 0 || /\s/.test(raw[match.index - 1])) starts.push(match.index);
  }
  if (starts.length <= 1) return [{ text: raw, offset: 0 }];
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? raw.length;
    const text = raw.slice(start, next).replace(/\s+(?:and|or|与|和)\s*$/i, "").trimEnd();
    return { text, offset: start };
  });
}
function parseCandidates(text, mask, cwd, opts, offset, output) {
  const candidates = findCandidates(mask.maskedText, mask.flags, text, opts.allowRelative ?? false);
  let cursor = 0;
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue;
    const pieces = candidate.kind === "file-path" ? splitPathStarts(candidate.raw) : [{ text: candidate.raw, offset: 0 }];
    for (const piece of pieces) {
      const pieceCandidate = {
        ...candidate,
        start: candidate.start + piece.offset,
        end: candidate.start + piece.offset + piece.text.length,
        raw: piece.text
      };
      const span = parseOneCandidate(pieceCandidate, cwd, opts);
      if (!span) continue;
      output.push({
        ...span,
        start: span.start + offset,
        end: span.end + offset
      });
    }
    cursor = candidate.end;
  }
}
function parse(text, opts = {}) {
  const cwd = opts.cwd ?? "/";
  const effective = {
    ...opts,
    cwd,
    checkExists: opts.checkExists ?? false,
    allowRelative: opts.allowRelative ?? false
  };
  const mask = buildMask(text);
  const spans = [];
  parseCandidates(text, mask, cwd, effective, 0, spans);
  spans.sort((a, b) => a.start - b.start);
  return { spans, maskedText: mask.maskedText };
}
function resolve(span, cwd = "/", opts = {}) {
  const effective = {
    ...opts,
    cwd,
    checkExists: opts.checkExists ?? false,
    allowRelative: opts.allowRelative ?? false
  };
  if (span.kind === "url") {
    const href = urlIsValid(span.raw);
    if (!href) return failed(span, "invalid-url");
    return makeResolved({ ...span, pathText: href }, href, href);
  }
  if (span.pathText === void 0) return failed(span, "missing-path");
  if (span.kind === "file-url" || span.kind === "vscode-url") {
    const split = splitLineSuffix(span.pathText);
    if (!pathIsValid(split.pathText)) return failed(span, "invalid-path");
    if (/^\/+$/.test(split.pathText)) return failed(span, "invalid-path");
    if (!fileExists(split.pathText, cwd, effective)) return failed(span, "not-found");
    const absolute2 = canonicalPath(split.pathText, cwd);
    const info2 = lineInfo(absolute2, split.line ?? span.line, split.column ?? span.column, effective);
    const url2 = pathToUrl(absolute2, effective);
    return makeResolved(span, absolute2, url2, info2.line, info2.column);
  }
  if (!pathIsValid(span.pathText)) return failed(span, "invalid-path");
  if (!fileExists(span.pathText, cwd, effective)) return failed(span, "not-found");
  const absolute = canonicalPath(span.pathText, cwd);
  const info = lineInfo(absolute, span.line, span.column, effective);
  const url = pathToUrl(absolute, effective);
  return makeResolved(span, absolute, url, info.line, info.column);
}
function rewrite(text, targets, mode = "markdown") {
  const sorted = [...targets].filter((target) => target.ok).sort((a, b) => b.start - a.start);
  let output = text;
  for (const target of sorted) {
    const replacement = mode === "markdown" ? target.markdown : mode === "plain" ? target.display : target.osc8;
    output = output.slice(0, target.start) + replacement + output.slice(target.end);
  }
  return output;
}
function rewriteMarkdown(text, opts = {}) {
  const cwd = opts.cwd ?? "/";
  const effective = {
    ...opts,
    cwd,
    checkExists: opts.checkExists ?? false,
    allowRelative: opts.allowRelative ?? false
  };
  const { spans } = parse(text, effective);
  const targets = spans.map((span) => resolve(span, cwd, effective));
  return rewrite(text, targets, "markdown");
}

// src/register.ts
var cwdPromise;
function sessionCwd(api) {
  if (!cwdPromise) {
    cwdPromise = api.session.cwd().then(
      (cwd) => typeof cwd === "string" && cwd.length > 0 ? cwd : void 0,
      () => void 0
    );
  }
  return cwdPromise;
}
function register(on) {
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    try {
      const original = e?.props?.text;
      if (typeof original !== "string" || original.length === 0) return next(e);
      const cwd = await sessionCwd($);
      const rewritten = rewriteMarkdown(
        original,
        cwd ? { cwd, checkExists: false } : { checkExists: false }
      );
      if (typeof rewritten !== "string" || rewritten === original) return next(e);
      return next({ ...e, props: { ...e.props, text: rewritten } });
    } catch {
      return next(e);
    }
  });
}
export {
  register
};
