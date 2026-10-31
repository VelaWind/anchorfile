/**
 * The generator is a pure function of RepoContext, so its whole output is
 * pinned by a snapshot. A change to the emitted file fails here until the
 * snapshot is updated on purpose (`npx vitest run -u`).
 */
import { describe, expect, it } from 'vitest';
import { generateClaudeMd } from '../src/generator';
import type { RepoContext } from '../src/types';

const base: RepoContext = {
  projectName: 'ts-app',
  description: 'A fixture TypeScript app.',
  primaryLanguage: 'TypeScript',
  frameworks: ['React', 'Next.js'],
  packageManager: 'npm',
  hasTests: true,
  testFramework: 'Vitest',
  folderStructure: ['docs', 'src'],
  keyFiles: ['package.json', 'tsconfig.json'],
  scripts: { test: 'vitest run' },
  dependencies: ['react', 'next'],
  devDependencies: ['vitest'],
  hasDocker: false,
  hasCI: true,
  linter: 'ESLint',
};

describe('generateClaudeMd', () => {
  it('emits the full file for a typical TypeScript project', () => {
    expect(generateClaudeMd(base)).toMatchSnapshot();
  });

  it('marks the sections a scanner cannot fill for a human to complete', () => {
    const out = generateClaudeMd(base);
    expect(out).toContain('<!-- Fill this in manually');
    expect(out).toContain('<!-- Add the most important files');
  });

  it('says what it could not find instead of leaving sections empty', () => {
    const out = generateClaudeMd({
      ...base, description: '', frameworks: [], folderStructure: [], keyFiles: [],
      scripts: {}, dependencies: [], devDependencies: [], hasTests: false, testFramework: 'None', linter: 'None',
    });
    expect(out).toContain('No description provided.');
    expect(out).toContain('None detected');
    expect(out).toContain('No scripts defined.');
    expect(out).toContain('No test framework detected.');
    expect(out).not.toContain('Linting via');
  });
});
