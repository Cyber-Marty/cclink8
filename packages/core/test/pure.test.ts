import { describe, expect, it } from 'vitest';
import {
  parse,
  resolve,
  rewrite,
  rewriteMarkdown,
  type ResolveOptions,
} from '../src/pure.js';

const existing = new Set([
  'C:\\repo\\plain.py',
  'C:\\repo\\中文 文件.py',
  'C:\\repo\\file(1).py',
  'C:\\work\\rel.py',
  '\\\\server\\share\\file.txt',
  '/home/user/file.py',
]);

function options(extra: ResolveOptions = {}): ResolveOptions {
  return {
    cwd: 'C:\\work',
    checkExists: true,
    exists: (path) => existing.has(path),
    ...extra,
  };
}

describe('pure: no-node path handling', () => {
  it('links a Windows path and manually encodes the file URL', () => {
    const out = rewriteMarkdown('see C:\\repo\\中文 文件.py:2', options());
    expect(out).toContain('中文 文件.py:2');
    expect(out).toContain('](file:///C:/repo/');
    expect(out).toContain('%20');
    expect(out).toContain('%E4%B8%AD%E6%96%87');
  });

  it('encodes parentheses in the Markdown destination', () => {
    const out = rewriteMarkdown('C:\\repo\\file(1).py', options());
    expect(out).toContain('%28');
    expect(out).toContain('%29');
  });

  it('links a UNC path', () => {
    const out = rewriteMarkdown('\\\\server\\share\\file.txt:10', options());
    expect(out).toContain('](file://server/share/file.txt)');
  });

  it('links a POSIX path', () => {
    const out = rewriteMarkdown('/home/user/file.py:3:1', options());
    expect(out).toContain('](file:///home/user/file.py)');
  });

  it('links an absolute path without exists when checkExists is false', () => {
    const out = rewriteMarkdown('C:\\repo\\missing.py', {
      cwd: 'C:\\work',
      checkExists: false,
    });
    expect(out).toContain('](file:///C:/repo/missing.py)');
  });

  it('resolves a relative path only when allowRelative is enabled', () => {
    let seen = '';
    const out = rewriteMarkdown('./rel.py:1', {
      cwd: 'C:\\work',
      checkExists: true,
      allowRelative: true,
      exists: (path) => {
        seen = path;
        return existing.has(path);
      },
    });
    expect(seen).toBe('C:\\work\\rel.py');
    expect(out).toContain('](file:///C:/work/rel.py)');
  });

  it('rejects relative paths by default', () => {
    const out = rewriteMarkdown('./rel.py', { cwd: 'C:\\work', checkExists: true });
    expect(out).toBe('./rel.py');
  });

  it('rejects a bare slash', () => {
    expect(rewriteMarkdown('/', { checkExists: false })).toBe('/');
    expect(rewriteMarkdown('file:///', { checkExists: false })).toBe('file:///');
  });

  it('splits two absolute paths instead of merging them', () => {
    const out = rewriteMarkdown('C:\\repo\\a.py and C:\\repo\\b.py', { checkExists: false });
    expect(out.match(/\]\(file:\/\//g)?.length).toBe(2);
    expect(out).toContain('a.py](file:///');
    expect(out).toContain('b.py](file:///');
  });

  it('rejects encoded path separators in file URLs', () => {
    expect(rewriteMarkdown('file:///C:/foo%2Fbar', { checkExists: false })).toBe('file:///C:/foo%2Fbar');
    expect(rewriteMarkdown('file:///C:/foo%5Cbar', { checkExists: false })).toBe('file:///C:/foo%5Cbar');
  });

  it('encodes #, ?, and % in file URLs', () => {
    const out = rewriteMarkdown('/home/a#b?c%25.py', { checkExists: false });
    expect(out).toContain('%23');
    expect(out).toContain('%3F');
    expect(out).toContain('%25');
  });

  it('defaults to checkExists:false in pure', () => {
    expect(rewriteMarkdown('C:\\repo\\missing.py')).toContain('](file:///');
  });

  it('does not link a missing path when checkExists is true', () => {
    expect(rewriteMarkdown('C:\\repo\\missing.py', options())).toBe('C:\\repo\\missing.py');
  });

  it('does not fall back to an existing parent directory for a missing file', () => {
    existing.add('C:\\repo');
    const out = rewriteMarkdown('C:\\repo\\missing file.py', options());
    expect(out).toBe('C:\\repo\\missing file.py');
    existing.delete('C:\\repo');
  });

  it('links http(s) URLs without filesystem access', () => {
    const out = rewriteMarkdown('see https://example.com/a_(b)', options());
    expect(out).toContain('(https://example.com/a_%28b%29)');
  });

  it('exports parse/resolve/rewrite with the pure contract', () => {
    const { spans, maskedText } = parse('C:\\repo\\plain.py:2:1', options());
    expect(maskedText.length).toBe('C:\\repo\\plain.py:2:1'.length);
    expect(spans[0].line).toBe(2);
    expect(spans[0].column).toBe(1);
    const target = resolve(spans[0], 'C:\\work', options());
    expect(target.ok).toBe(true);
    expect(target.line).toBe(2);
    expect(target.column).toBe(1);
    expect(rewrite('C:\\repo\\plain.py:2:1', [target], 'plain')).toBe('C:\\repo\\plain.py:2:1');
    expect(rewrite('C:\\repo\\plain.py:2:1', [target], 'osc8')).toContain('\x1b]8;;file:///');
  });

  it('supports a custom lineFits callback', () => {
    const { spans } = parse('C:\\repo\\plain.py:2', options({
      lineFits: (_path, line) => ({ line }),
    }));
    expect(spans[0].line).toBe(2);
  });

  it('masks code before finding paths', () => {
    const input = '`C:\\repo\\plain.py`\n```\nC:\\repo\\plain.py\n```\nC:\\repo\\plain.py';
    const { maskedText, spans } = parse(input, options());
    expect(maskedText.length).toBe(input.length);
    expect(spans.length).toBe(1);
    expect(maskedText).not.toContain('`C:\\repo\\plain.py`');
  });
});
