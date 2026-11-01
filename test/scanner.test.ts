/**
 * The scanner, run against small fixture repositories in test/fixtures.
 *
 * Each fixture pins what Anchorfile reports for one kind of project, including
 * the limits the README states. A limit pinned by a test changes only when
 * someone changes it on purpose.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { countLanguageFiles, scanRepo } from '../src/scanner';

const fixture = (name: string) => join(__dirname, 'fixtures', name);

describe('a TypeScript app with npm, Vitest, ESLint, Docker and CI', async () => {
  const ctx = await scanRepo(fixture('ts-app'), false);

  it('reads name and description from package.json', () => {
    expect(ctx.projectName).toBe('ts-app');
    expect(ctx.description).toBe('A fixture TypeScript app.');
  });
  it('calls it TypeScript because tsconfig.json exists', () => {
    expect(ctx.primaryLanguage).toBe('TypeScript');
  });
  it('maps dependencies to frameworks once each, in dependency order', () => {
    expect(ctx.frameworks).toEqual(['React', 'Next.js', 'Prisma']);
  });
  it('takes the package manager from the lockfile', () => {
    expect(ctx.packageManager).toBe('npm');
  });
  it('finds the test framework from devDependencies', () => {
    expect(ctx.hasTests).toBe(true);
    expect(ctx.testFramework).toBe('Vitest');
  });
  it('finds ESLint in devDependencies', () => {
    expect(ctx.linter).toBe('ESLint');
  });
  it('sees Docker and CI', () => {
    expect(ctx.hasDocker).toBe(true);
    expect(ctx.hasCI).toBe(true);
  });
  it('lists top-level folders sorted, hidden ones included', () => {
    expect(ctx.folderStructure).toEqual(['.github', 'docs', 'src']);
  });
  it('lists key files in the fixed candidate order', () => {
    expect(ctx.keyFiles).toEqual(['package.json', 'tsconfig.json', 'Dockerfile', 'README.md']);
  });
  it('keeps scripts and dependency names as written', () => {
    expect(ctx.scripts).toEqual({ dev: 'vite', test: 'vitest run' });
    expect(ctx.dependencies).toEqual(['react', 'next', '@prisma/client', 'prisma']);
    expect(ctx.devDependencies).toEqual(['vitest', 'eslint', 'typescript']);
  });
});

describe('a JavaScript app with Yarn and flat ESLint config', async () => {
  const ctx = await scanRepo(fixture('js-flat-eslint'), false);

  it('counts files across the tree when there is no tsconfig.json', () => {
    expect(ctx.primaryLanguage).toBe('JavaScript');
  });
  it('takes Yarn from yarn.lock', () => {
    expect(ctx.packageManager).toBe('Yarn');
  });
  it('finds Mocha named in an npm script', () => {
    expect(ctx.testFramework).toBe('Mocha');
  });
  it('detects ESLint from eslint.config.js with eslint absent from devDependencies, ahead of Prettier', () => {
    expect(ctx.linter).toBe('ESLint');
    expect(ctx.keyFiles).toEqual(['package.json', 'eslint.config.js']);
  });
  it('reports no description when package.json has none', () => {
    expect(ctx.description).toBe('');
  });
});

describe('each ESLint flat config name, alone in a directory', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })));

  it.each(['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'])('%s is ESLint and a key file', async (name) => {
    const dir = mkdtempSync(join(tmpdir(), 'anchorfile-flat-'));
    dirs.push(dir);
    writeFileSync(join(dir, name), 'export default [];\n');
    const ctx = await scanRepo(dir, false);
    expect(ctx.linter).toBe('ESLint');
    expect(ctx.keyFiles).toEqual([name]);
  });

  it('lists both files when a legacy and a flat config sit side by side', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anchorfile-flat-'));
    dirs.push(dir);
    writeFileSync(join(dir, '.eslintrc.json'), '{}\n');
    writeFileSync(join(dir, 'eslint.config.mjs'), 'export default [];\n');
    const ctx = await scanRepo(dir, false);
    expect(ctx.keyFiles).toEqual(['.eslintrc.json', 'eslint.config.mjs']);
  });
});

describe('a JavaScript app with a legacy .eslintrc.json and pnpm', async () => {
  const ctx = await scanRepo(fixture('js-legacy-eslint'), false);

  it('detects ESLint from one of the six legacy config names', () => {
    expect(ctx.linter).toBe('ESLint');
    expect(ctx.keyFiles).toContain('.eslintrc.json');
  });
  it('takes pnpm from pnpm-lock.yaml', () => {
    expect(ctx.packageManager).toBe('pnpm');
  });
  it('reports no tests', () => {
    expect(ctx.hasTests).toBe(false);
    expect(ctx.testFramework).toBe('None');
  });
});

describe('a Python app with requirements.txt, pyproject.toml and tests/', async () => {
  const ctx = await scanRepo(fixture('python-app'), false);

  it('counts .py files across the tree, tests/ included', () => {
    expect(ctx.primaryLanguage).toBe('Python');
  });
  it('falls back to the directory name', () => {
    expect(ctx.projectName).toBe('python-app');
  });
  it('reads requirements.txt: case, version pins, extras, comments and -r lines', () => {
    expect(ctx.frameworks.slice(0, 3)).toEqual(['Flask', 'NumPy', 'Pandas']);
  });
  it('adds pyproject.toml [project] dependencies after the requirements.txt ones', () => {
    expect(ctx.frameworks).toEqual(['Flask', 'NumPy', 'Pandas', 'FastAPI']);
  });
  it('calls the package manager pip', () => {
    expect(ctx.packageManager).toBe('pip');
  });
  it('finds pytest from test_*.py files in tests/', () => {
    expect(ctx.testFramework).toBe('pytest');
  });
});

describe('a PEP 621 project with only pyproject.toml', async () => {
  const ctx = await scanRepo(fixture('pep621-app'), false);

  it('reads [project] dependencies across lines, with extras, spaces and markers', () => {
    expect(ctx.frameworks.slice(0, 3)).toEqual(['FastAPI', 'Pandas', 'NumPy']);
  });
  it('reads [project.optional-dependencies] groups after them', () => {
    expect(ctx.frameworks).toEqual(['FastAPI', 'Pandas', 'NumPy', 'SQLAlchemy']);
  });
  it('ignores a dependencies key in a [tool.*] table', () => {
    expect(ctx.frameworks).not.toContain('Django');
  });
  it('finds pytest from an optional-dependencies group, with no test files present', () => {
    expect(ctx.hasTests).toBe(true);
    expect(ctx.testFramework).toBe('pytest');
  });
  it('lists pyproject.toml as a key file and calls the package manager pip', () => {
    expect(ctx.keyFiles).toEqual(['pyproject.toml']);
    expect(ctx.packageManager).toBe('pip');
  });
});

describe('a Poetry project', async () => {
  const ctx = await scanRepo(fixture('poetry-app'), false);

  it('reads [tool.poetry.dependencies] keys, bare or quoted, skipping python', () => {
    expect(ctx.frameworks).toEqual(['Django', 'SQLAlchemy']);
  });
  it('does not read [tool.poetry.group.*.dependencies] (documented limit), so pytest there is not seen', () => {
    expect(ctx.hasTests).toBe(false);
  });
  it('finds Python in a package folder below the root', () => {
    expect(ctx.primaryLanguage).toBe('Python');
  });
});

describe('a repository whose code lives outside src/', async () => {
  const ctx = await scanRepo(fixture('code-outside-src'), false);

  it('is Python: six .py files in lib/ outweigh two build scripts in src/', () => {
    expect(ctx.primaryLanguage).toBe('Python');
  });
  it('counts nested folders and skips build/ even though it holds the most .js files', () => {
    expect(countLanguageFiles(fixture('code-outside-src'))).toEqual({ JavaScript: 2, Python: 6 });
  });
});

describe('the tree walk limits', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })));
  const tempDir = () => { const d = mkdtempSync(join(tmpdir(), 'anchorfile-walk-')); dirs.push(d); return d; };

  it('does not open folders deeper than maxDepth', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'top.js'), '');
    mkdirSync(join(dir, 'a', 'b', 'c'), { recursive: true });
    writeFileSync(join(dir, 'a', 'one.py'), '');
    writeFileSync(join(dir, 'a', 'b', 'two.py'), '');
    writeFileSync(join(dir, 'a', 'b', 'c', 'three.py'), '');
    expect(countLanguageFiles(dir, { maxDepth: 2, maxFiles: 100 })).toEqual({ JavaScript: 1, Python: 2 });
    expect(countLanguageFiles(dir, { maxDepth: 0, maxFiles: 100 })).toEqual({ JavaScript: 1 });
  });

  it('stops after maxFiles files, shallow ones first and in sorted order', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'deep'));
    ['a.go', 'b.go', 'c.rs', 'notes.txt'].forEach(f => writeFileSync(join(dir, f), ''));
    ['x.py', 'y.py', 'z.py'].forEach(f => writeFileSync(join(dir, 'deep', f), ''));
    expect(countLanguageFiles(dir, { maxDepth: 8, maxFiles: 3 })).toEqual({ Go: 2, Rust: 1 });
    expect(countLanguageFiles(dir, { maxDepth: 8, maxFiles: 5 })).toEqual({ Go: 2, Rust: 1, Python: 1 });
  });

  it('adds .ts and .tsx together as one language', async () => {
    const dir = tempDir();
    ['a.ts', 'b.ts', 'c.tsx', 'd.tsx', 'e.js', 'f.js', 'g.js'].forEach(f => writeFileSync(join(dir, f), ''));
    expect((await scanRepo(dir, false)).primaryLanguage).toBe('TypeScript');
  });
});

describe('an empty directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'anchorfile-empty-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const ctx = await scanRepo(dir, false);

  it('reports nothing it cannot see', () => {
    expect(ctx.primaryLanguage).toBe('Unknown');
    expect(ctx.packageManager).toBe('Unknown');
    expect(ctx.frameworks).toEqual([]);
    expect(ctx.folderStructure).toEqual([]);
    expect(ctx.keyFiles).toEqual([]);
    expect(ctx.hasTests).toBe(false);
    expect(ctx.linter).toBe('None');
    expect(ctx.hasDocker).toBe(false);
    expect(ctx.hasCI).toBe(false);
  });
});
