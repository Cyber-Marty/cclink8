import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parse,
  resolve,
  rewrite,
  rewriteMarkdown,
  type RawSpan,
} from '../src/index.js';

let root = '';
let plain = '';
let chinese = '';
let parens = '';
let spaced = '';
let relative = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'cclink8-core-'));
  mkdirSync(join(root, 'space dir'), { recursive: true });
  plain = join(root, 'plain.py');
  chinese = join(root, 'space dir', '中文 文件.py');
  parens = join(root, 'file(1).py');
  spaced = join(root, 'README.md');
  relative = join(root, 'rel.py');
  writeFileSync(plain, 'one\ntwo\nthree\n');
  writeFileSync(chinese, '甲\n乙\n丙\n');
  writeFileSync(parens, 'a\nb\nc\n');
  writeFileSync(spaced, '# readme\nbody\n');
  writeFileSync(relative, 'rel\n');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function firstSpan(text: string, opts = {}): RawSpan {
  const { spans } = parse(text, { cwd: root, ...opts });
  expect(spans.length).toBeGreaterThan(0);
  return spans[0];
}

describe('rewriteMarkdown: positives', () => {
  it('links a Windows absolute path with line and preserves prose', () => {
    const out = rewriteMarkdown(`See ${plain}:2 for details.`, { cwd: root });
    expect(out).toContain('plain.py:2');
    expect(out).toContain('](file:///');
    expect(out).toContain(' for details.');
  });

  it('links a path with spaces and Chinese characters', () => {
    const out = rewriteMarkdown(`打开 ${chinese}:2 看看`, { cwd: root });
    expect(out).toContain('中文 文件.py:2');
    expect(out).toContain('](file:///');
    expect(out).toContain('%20');
  });

  it('links a path with parentheses', () => {
    const out = rewriteMarkdown(`see ${parens}`, { cwd: root });
    expect(out).toContain('](file:///');
    expect(out).toContain('%28');
    expect(out).toContain('%29');
  });

  it('links a UNC path when existence is disabled', () => {
    const out = rewriteMarkdown('\\\\server\\share\\file.txt:10', {
      cwd: root,
      checkExists: false,
    });
    expect(out).toContain('](file://server/share/file.txt)');
  });

  it('links a POSIX absolute path when existence is disabled', () => {
    const out = rewriteMarkdown('/home/user/中文 文件.py:3:1', {
      cwd: root,
      checkExists: false,
    });
    expect(out).toContain('](file:///home/user/');
  });

  it('links a file:// URL', () => {
    const url = `file:///${plain.replace(/\\/g, '/')}:2`;
    const out = rewriteMarkdown(url, { cwd: root });
    expect(out).toContain('](file:///');
    expect(out).toContain('plain.py:2');
  });

  it('links a vscode://file URL', () => {
    const url = `vscode://file/${plain.replace(/\\/g, '/')}:2:1`;
    const out = rewriteMarkdown(url, { cwd: root });
    expect(out).toContain('](file:///');
    expect(out).toContain('plain.py:2:1');
  });

  it('links http(s) URLs and encodes parentheses in the destination', () => {
    const out = rewriteMarkdown('see https://example.com/a_(b)?q=1', { cwd: root });
    expect(out).toContain('[https://example.com/a_(b)?q=1](');
    expect(out).toContain('(https://example.com/a_%28b%29?q=1)');
  });

  it('links a relative path only when it exists', () => {
    const out = rewriteMarkdown('see ./rel.py:1 and ./missing.py', { cwd: root });
    expect(out).toContain('[./rel.py:1](file:///');
    expect(out).not.toContain('missing.py](');
  });

  it('links multiple paths in one message', () => {
    const out = rewriteMarkdown(`${plain} and ${relative}`, { cwd: root });
    expect(out.match(/\]\(file:\/\//g)?.length).toBe(2);
  });

  it('strips trailing punctuation from the link', () => {
    const out = rewriteMarkdown(`see ${plain}.`, { cwd: root });
    expect(out).toContain('plain.py](');
    expect(out.endsWith(').')).toBe(true);
  });
});

describe('rewriteMarkdown: negatives and masking', () => {
  it('does not rewrite fenced code blocks', () => {
    const text = `before\n\`\`\`\n${plain}\n\`\`\`\nafter`;
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite inline code', () => {
    const text = `before \`${plain}\` after`;
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite existing markdown links', () => {
    const text = `[x](https://example.com) and [y](file:///C:/x)`;
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite HTML anchors', () => {
    const text = `<a href="x">${plain}</a>`;
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite versions, dates, times, or IPs', () => {
    const text = 'v1.2.3 2026-11-13 10:30:45 192.168.1.1';
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite unsafe schemes', () => {
    const text = 'javascript:alert(1) data:text/html,x smb://server/share';
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite a non-existent absolute path by default', () => {
    const text = 'see C:\\definitely\\missing\\file.py';
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does rewrite a non-existent absolute path when existence is disabled', () => {
    const text = 'see C:\\definitely\\missing\\file.py';
    expect(rewriteMarkdown(text, { cwd: root, checkExists: false })).toContain('](file:///');
  });

  it('does not rewrite an overlong URL', () => {
    const text = `https://example.com/${'a'.repeat(2100)}`;
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('does not rewrite control-character paths', () => {
    const text = 'C:\\repo\\\x1b]8;;https://evil\x1b\\file.py';
    expect(rewriteMarkdown(text, { cwd: root })).toBe(text);
  });

  it('keeps maskedText the same length as input and masks code spans', () => {
    const text = `\`${plain}\`\n\`\`\`\n${plain}\n\`\`\`\n${plain}`;
    const { maskedText } = parse(text, { cwd: root });
    expect(maskedText.length).toBe(text.length);
    expect((maskedText.match(/plain\.py/g) ?? []).length).toBe(1);
  });

  it('is idempotent', () => {
    const once = rewriteMarkdown(`see ${plain}:2`, { cwd: root });
    expect(rewriteMarkdown(once, { cwd: root })).toBe(once);
  });
});

describe('parse and resolve', () => {
  it('returns line and column spans and resolves them', () => {
    const span = firstSpan(`${plain}:2:1`);
    expect(span.line).toBe(2);
    expect(span.column).toBe(1);
    const target = resolve(span, root);
    expect(target.ok).toBe(true);
    expect(target.line).toBe(2);
    expect(target.column).toBe(1);
  });

  it('drops an out-of-range line but still links the file', () => {
    const span = firstSpan(`${plain}:999999`);
    expect(span.pathText).toBe(plain);
    expect(span.line).toBeUndefined();
    const target = resolve(span, root);
    expect(target.ok).toBe(true);
    expect(target.line).toBeUndefined();
  });

  it('drops line 0 and column 0', () => {
    const span = firstSpan(`${plain}:0`);
    expect(span.line).toBeUndefined();
  });

  it('drops the suffix when column exceeds the numeric limit', () => {
    const span = firstSpan(`${plain}:2:99999`);
    expect(span.line).toBeUndefined();
  });

  it('keeps a valid line but drops a column beyond the line length', () => {
    const span = firstSpan(`${plain}:2:9999`);
    expect(span.line).toBe(2);
    expect(span.column).toBeUndefined();
  });

  it('supports plain/osc8 rewrite modes', () => {
    const { spans } = parse(`${plain}:2`, { cwd: root });
    const target = resolve(spans[0], root);
    expect(rewrite(`${plain}:2`, [target], 'plain')).toBe(`${plain}:2`);
    expect(rewrite(`${plain}:2`, [target], 'osc8')).toContain('\x1b]8;;file:///');
  });

  it('produces non-overlapping sorted spans', () => {
    const text = `${plain} and https://example.com/x and ${relative}`;
    const { spans } = parse(text, { cwd: root });
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
    }
  });
});
