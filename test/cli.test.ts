/**
 * The built CLI end to end: `init` against a fixture writes the file, and
 * `--version` agrees with package.json (0.1.2 shipped after a drift there).
 * Runs dist/, so `npm run build` comes first; `npm test` does both.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';

const cli = join(__dirname, '..', 'dist', 'index.js');
const out = mkdtempSync(join(tmpdir(), 'anchorfile-cli-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

it('prints the version from package.json', () => {
  const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  expect(execFileSync(process.execPath, [cli, '--version']).toString().trim()).toBe(version);
});

it('init writes CLAUDE.md for the repository it is run in', () => {
  const target = join(out, 'CLAUDE.md');
  execFileSync(process.execPath, [cli, 'init', '--output', target], { cwd: join(__dirname, 'fixtures', 'ts-app') });
  const written = readFileSync(target, 'utf8');
  expect(written.split('\n')[0]).toBe('# CLAUDE.md — AI Context for ts-app');
  expect(written).toContain('- **Frameworks:** React, Next.js, Prisma');
});
