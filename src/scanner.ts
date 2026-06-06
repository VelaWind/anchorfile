import * as fs from 'fs';
import * as path from 'path';
import { RepoContext } from './types';

const FRAMEWORK_MAP: Record<string, string> = {
  react: 'React',
  next: 'Next.js',
  vue: 'Vue',
  nuxt: 'Nuxt',
  svelte: 'Svelte',
  express: 'Express',
  fastify: 'Fastify',
  '@nestjs/core': 'NestJS',
  prisma: 'Prisma',
  '@prisma/client': 'Prisma',
  '@trpc/server': 'tRPC',
  '@trpc/client': 'tRPC',
  tailwindcss: 'Tailwind CSS',
  vite: 'Vite',
  astro: 'Astro',
  // Python
  pygame: 'Pygame',
  flask: 'Flask',
  django: 'Django',
  fastapi: 'FastAPI',
  numpy: 'NumPy',
  pandas: 'Pandas',
  sqlalchemy: 'SQLAlchemy',
};

const TEST_FRAMEWORKS: Record<string, string> = {
  jest: 'Jest',
  vitest: 'Vitest',
  mocha: 'Mocha',
  pytest: 'pytest',
  cypress: 'Cypress',
  playwright: 'Playwright',
  '@playwright/test': 'Playwright',
};

const KEY_FILE_CANDIDATES = [
  'package.json',
  'tsconfig.json',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
  'README.md',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'prisma/schema.prisma',
  // Python
  'requirements.txt',
  'pyproject.toml',
  'setup.py',
  'main.py',
  'config.py',
  'manage.py',
];

const ESLINTRC_PATTERNS = ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'];

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function exists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readRequirementsTxt(rootPath: string): string[] {
  const filePath = path.join(rootPath, 'requirements.txt');
  try {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    return lines
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('-'))
      .map(l => l.toLowerCase().split(/[=<>!~\[@]/)[0].trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function hasPythonTestFiles(rootPath: string): boolean {
  const testPattern = /^(test_.+|.+_test)\.py$/;
  try {
    if (fs.readdirSync(rootPath).some(f => testPattern.test(f))) return true;
  } catch { /* ignore */ }
  try {
    if (fs.readdirSync(path.join(rootPath, 'tests')).some(f => testPattern.test(f))) return true;
  } catch { /* ignore */ }
  return false;
}

function detectPrimaryLanguage(rootPath: string, hasTsConfig: boolean): string {
  if (hasTsConfig) return 'TypeScript';

  const srcPath = path.join(rootPath, 'src');
  const searchDir = exists(srcPath) ? srcPath : rootPath;

  const extCounts: Record<string, number> = {};
  try {
    const entries = fs.readdirSync(searchDir);
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (ext) extCounts[ext] = (extCounts[ext] ?? 0) + 1;
    }
  } catch {
    // ignore read errors
  }

  const langMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
  };

  let best = '';
  let bestCount = 0;
  for (const [ext, lang] of Object.entries(langMap)) {
    const count = extCounts[ext] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = lang;
    }
  }

  return best || 'Unknown';
}

function detectFrameworks(allDeps: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const dep of allDeps) {
    const display = FRAMEWORK_MAP[dep];
    if (display && !seen.has(display)) {
      seen.add(display);
      result.push(display);
    }
  }

  return result;
}

function detectTestFramework(allDeps: string[], scripts: Record<string, string>, rootPath: string): { hasTests: boolean; testFramework: string } {
  for (const dep of allDeps) {
    const fw = TEST_FRAMEWORKS[dep];
    if (fw) return { hasTests: true, testFramework: fw };
  }

  const scriptValues = Object.values(scripts).join(' ').toLowerCase();
  if (scriptValues.includes('jest')) return { hasTests: true, testFramework: 'Jest' };
  if (scriptValues.includes('vitest')) return { hasTests: true, testFramework: 'Vitest' };
  if (scriptValues.includes('mocha')) return { hasTests: true, testFramework: 'Mocha' };
  if (scriptValues.includes('pytest')) return { hasTests: true, testFramework: 'pytest' };

  if (hasPythonTestFiles(rootPath)) return { hasTests: true, testFramework: 'pytest' };

  return { hasTests: false, testFramework: 'None' };
}

function detectLinter(devDeps: string[], rootPath: string): string {
  if (devDeps.includes('biome')) return 'Biome';
  if (devDeps.includes('@biomejs/biome')) return 'Biome';
  if (devDeps.includes('eslint')) return 'ESLint';
  for (const pattern of ESLINTRC_PATTERNS) {
    if (exists(path.join(rootPath, pattern))) return 'ESLint';
  }
  if (devDeps.includes('prettier')) return 'Prettier';
  return 'None';
}

export async function scanRepo(rootPath: string, verbose: boolean): Promise<RepoContext> {
  const log = (msg: string) => { if (verbose) console.log(`  [scan] ${msg}`); };

  log(`Scanning ${rootPath}`);

  const pkgPath = path.join(rootPath, 'package.json');
  const pkg = readJson(pkgPath) as {
    name?: string;
    description?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;

  const projectName = (pkg?.name as string | undefined) ?? path.basename(rootPath);
  const description = (pkg?.description as string | undefined) ?? '';
  const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {};
  const depNames = Object.keys((pkg?.dependencies as Record<string, string> | undefined) ?? {});
  const devDepNames = Object.keys((pkg?.devDependencies as Record<string, string> | undefined) ?? {});

  log(`Project: ${projectName}`);

  const hasTsConfig = exists(path.join(rootPath, 'tsconfig.json'));
  const primaryLanguage = detectPrimaryLanguage(rootPath, hasTsConfig);
  log(`Language: ${primaryLanguage}`);

  const pythonDeps = readRequirementsTxt(rootPath);
  const allDeps = [...depNames, ...devDepNames, ...pythonDeps];
  const frameworks = detectFrameworks(allDeps);
  log(`Frameworks: ${frameworks.join(', ') || 'none'}`);

  let packageManager = 'Unknown';
  if (exists(path.join(rootPath, 'yarn.lock'))) packageManager = 'Yarn';
  else if (exists(path.join(rootPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (exists(path.join(rootPath, 'package-lock.json'))) packageManager = 'npm';
  else if (
    exists(path.join(rootPath, 'requirements.txt')) ||
    exists(path.join(rootPath, 'pyproject.toml')) ||
    exists(path.join(rootPath, 'setup.py'))
  ) packageManager = 'pip';
  log(`Package manager: ${packageManager}`);

  const { hasTests, testFramework } = detectTestFramework(allDeps, scripts, rootPath);
  log(`Tests: ${hasTests ? testFramework : 'none'}`);

  let folderStructure: string[] = [];
  try {
    folderStructure = fs.readdirSync(rootPath, { withFileTypes: true })
      .filter(e => e.isDirectory() && !EXCLUDE_DIRS.has(e.name))
      .map(e => e.name);
  } catch {
    // ignore
  }
  log(`Top-level dirs: ${folderStructure.join(', ')}`);

  const keyFiles: string[] = [];
  for (const candidate of KEY_FILE_CANDIDATES) {
    if (exists(path.join(rootPath, candidate))) {
      keyFiles.push(candidate);
    }
  }
  for (const pattern of ESLINTRC_PATTERNS) {
    if (exists(path.join(rootPath, pattern))) {
      keyFiles.push(pattern);
      break;
    }
  }
  log(`Key files: ${keyFiles.join(', ')}`);

  const hasDocker = exists(path.join(rootPath, 'Dockerfile'));
  const hasCI =
    exists(path.join(rootPath, '.github', 'workflows')) ||
    exists(path.join(rootPath, '.circleci'));

  const linter = detectLinter(devDepNames, rootPath);
  log(`Linter: ${linter}`);

  return {
    projectName,
    description,
    primaryLanguage,
    frameworks,
    packageManager,
    hasTests,
    testFramework,
    folderStructure,
    keyFiles,
    scripts,
    dependencies: depNames,
    devDependencies: devDepNames,
    hasDocker,
    hasCI,
    linter,
  };
}
