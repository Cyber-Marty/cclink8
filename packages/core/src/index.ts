import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pure from './pure.js';
import { fileUrlForPath } from './pure.js';
import type {
  LineInfo,
  ParseResult,
  RawSpan,
  ResolveOptions,
  ResolvedTarget,
} from './pure.js';

const MAX_LINE_CHECK_BYTES = 8 * 1024 * 1024;

function nodeLineFits(filePath: string, line?: number, column?: number): LineInfo {
  if (line === undefined) return {};
  try {
    const absolute = resolvePath(filePath);
    const stat = statSync(absolute);
    if (!stat.isFile() || stat.size > MAX_LINE_CHECK_BYTES) return { line, column };
    const lines = readFileSync(absolute, 'utf8').split(/\r?\n/);
    if (line > lines.length) return {};
    if (column !== undefined && column > lines[line - 1].length + 1) return { line };
    return { line, column };
  } catch {
    return { line, column };
  }
}

function nodeFileUrl(filePath: string): string {
  // pathToFileURL on macOS/Linux treats a Windows drive or UNC string as a
  // relative POSIX path. Detect Windows shapes independently of the host and
  // use the pure encoder, which always yields file:///C:/... or file://server/...
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')) {
    return fileUrlForPath(filePath);
  }
  if (filePath.startsWith('/')) return new URL(`file://${encodeURI(filePath)}`).href;
  return pathToFileURL(filePath).href;
}

function withNode(opts: ResolveOptions = {}): ResolveOptions {
  return {
    ...opts,
    cwd: opts.cwd ?? process.cwd(),
    checkExists: opts.checkExists ?? true,
    allowRelative: opts.allowRelative ?? true,
    exists: opts.exists ?? ((value) => existsSync(value)),
    lineFits: opts.lineFits ?? nodeLineFits,
    toFileUrl: opts.toFileUrl ?? nodeFileUrl,
  };
}

export function parse(text: string, opts: ResolveOptions = {}): ParseResult {
  return pure.parse(text, withNode(opts));
}

export function resolve(
  span: RawSpan,
  cwd: string = process.cwd(),
  opts: ResolveOptions = {},
): ResolvedTarget {
  return pure.resolve(span, cwd, withNode({ ...opts, cwd }));
}

export function rewriteMarkdown(text: string, opts: ResolveOptions = {}): string {
  return pure.rewriteMarkdown(text, withNode(opts));
}

export { rewrite } from './pure.js';
export type {
  LineInfo,
  ParseResult,
  RawSpan,
  ResolveOptions,
  ResolvedTarget,
  RewriteMode,
  SpanKind,
} from './pure.js';
