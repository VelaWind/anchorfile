/**
 * The pyproject.toml reader on its own, fed strings. The scanner tests cover
 * the same reader through fixture repositories; these pin the TOML shapes it
 * claims to follow and the ones it deliberately skips.
 */
import { describe, expect, it } from 'vitest';
import { parsePyprojectDependencies, requirementName } from '../src/pyproject';

describe('requirementName', () => {
  it('drops extras, version pins, markers and URLs, and lowercases', () => {
    expect(requirementName('FastAPI[standard] >= 0.110')).toBe('fastapi');
    expect(requirementName("numpy ; python_version >= '3.10'")).toBe('numpy');
    expect(requirementName('pkg @ https://example.com/pkg.whl')).toBe('pkg');
    expect(requirementName('Django(>=5)')).toBe('django');
  });
});

describe('parsePyprojectDependencies', () => {
  it('reads a one-line PEP 621 dependency array', () => {
    expect(parsePyprojectDependencies('[project]\ndependencies = ["flask>=3", \'numpy\']\n')).toEqual(['flask', 'numpy']);
  });

  it('reads arrays that span lines, with comments, trailing commas and a # inside a string', () => {
    const text = [
      '[project]',
      'name = "x"  # comment',
      'dependencies = [',
      '  "flask",  # web',
      '  # whole-line comment',
      '  "pkg @ https://example.com/a#b",',
      ']',
    ].join('\n');
    expect(parsePyprojectDependencies(text)).toEqual(['flask', 'pkg']);
  });

  it('reads every [project.optional-dependencies] group after the main list', () => {
    const text = '[project]\ndependencies = ["flask"]\n\n[project.optional-dependencies]\ntest = ["pytest"]\ndocs = [\n  "mkdocs",\n]\n';
    expect(parsePyprojectDependencies(text)).toEqual(['flask', 'pytest', 'mkdocs']);
  });

  it('reads optional-dependencies written as an inline table, ignoring the group names', () => {
    const text = '[project]\noptional-dependencies = { test = ["pytest"], "dev" = ["ruff"] }\n';
    expect(parsePyprojectDependencies(text)).toEqual(['pytest', 'ruff']);
  });

  it('reads [tool.poetry.dependencies] keys, quoted or bare, skipping python', () => {
    const text = [
      '[tool.poetry.dependencies]',
      'python = "^3.11"',
      'Django = "^5.0"',
      '"SQLAlchemy" = { version = "^2.0", extras = ["asyncio"] }',
      "'pandas' = {version = \"^2\"}",
    ].join('\n');
    expect(parsePyprojectDependencies(text)).toEqual(['django', 'sqlalchemy', 'pandas']);
  });

  it('ignores dependencies keys in other tables, including Poetry groups (documented limit)', () => {
    const text = [
      '[tool.hatch.envs.default]',
      'dependencies = ["django"]',
      '[tool.poetry.group.dev.dependencies]',
      'pytest = "^8"',
      '[build-system]',
      'requires = ["setuptools"]',
      '[[tool.mypy.overrides]]',
      'dependencies = ["flask"]',
    ].join('\n');
    expect(parsePyprojectDependencies(text)).toEqual([]);
  });

  it('accepts spaced and quoted table headers and CRLF line endings', () => {
    expect(parsePyprojectDependencies('[ tool . "poetry" . dependencies ]\r\nflask = "*"\r\n')).toEqual(['flask']);
  });

  it('lists a name once when it appears in several tables', () => {
    const text = '[project]\ndependencies = ["flask"]\n[project.optional-dependencies]\nall = ["Flask[async]"]\n';
    expect(parsePyprojectDependencies(text)).toEqual(['flask']);
  });

  it('returns nothing, without throwing, for text it cannot follow', () => {
    expect(parsePyprojectDependencies('')).toEqual([]);
    expect(parsePyprojectDependencies('[project]\ndependencies = ["unterminated')).toEqual([]);
    expect(parsePyprojectDependencies('not toml at all\n= = =\n[')).toEqual([]);
  });
});
