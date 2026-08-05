# Anchorfile

A command-line tool that scans a repository and writes a `CLAUDE.md` context file for AI coding agents (Claude Code, Cursor, Copilot). Those agents work better when the repository states its own stack, scripts and layout up front, and writing that file by hand is the kind of chore that goes stale immediately. Anchorfile reads what is already on disk, package manifests, lockfiles, config files and the top-level tree, and emits the file in one command, leaving marked sections for the judgement calls a scanner cannot make.

Published on npm as [`anchorfile`](https://www.npmjs.com/package/anchorfile) (0.1.2).

## Usage

```bash
npx anchorfile init
```

Run it from the root of a project. It writes `CLAUDE.md` into the current directory.

```
--output <path>   Output file path (default: ./CLAUDE.md)
--verbose         Log each detection step as it runs
```

```bash
npx anchorfile init --verbose
npx anchorfile init --output docs/CLAUDE.md
```

## What it detects

Everything below is read from the filesystem; nothing is inferred by a model.

- **Name and description** from `package.json`, falling back to the directory name when there is no manifest.
- **Primary language.** TypeScript if `tsconfig.json` exists; otherwise by counting file extensions in `src/` (or the root, when there is no `src/`) across TypeScript, JavaScript, Python, Go, Rust and Java.
- **Frameworks**, matched by exact dependency name against `package.json` and `requirements.txt`: React, Next.js, Vue, Nuxt, Svelte, Express, Fastify, NestJS, Prisma, tRPC, Tailwind CSS, Vite, Astro, Pygame, Flask, Django, FastAPI, NumPy, Pandas, SQLAlchemy.
- **Package manager** from the lockfile: Yarn, pnpm, npm, or pip (`requirements.txt`, `pyproject.toml`, `setup.py`).
- **Test framework**: Jest, Vitest, Mocha, pytest, Cypress or Playwright, found as a dependency, named inside an npm script, or as `test_*.py` / `*_test.py` files in the root or `tests/`.
- **Linter**: Biome, ESLint (dependency or any `.eslintrc*` file), or Prettier.
- **Docker and CI**: a `Dockerfile`, and `.github/workflows` or `.circleci`.
- **Layout**: top-level folders (skipping `node_modules`, `.git`, `dist`, `build`, `.next`) and key files from a fixed list (`package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `README.md`, the Vite and Next configs, `prisma/schema.prisma`, `requirements.txt`, `pyproject.toml`, `setup.py`, `main.py`, `config.py`, `manage.py`).
- **Scripts and dependencies**: every npm script with its command, and the dependency and devDependency name lists.

## Generated output

The emitted file has these sections:

```
## Project Overview
## Tech Stack
## Project Structure
## Available Scripts
## Dependencies
## Testing
## Key Conventions
## What to Avoid
## Files to Know
```

`Key Conventions` is filled from what was detected (package manager, language, strict TypeScript, linter, test framework). `What to Avoid` and `Files to Know` carry HTML comments asking to be completed by hand, since neither can be read off a file tree.

## Architecture

462 lines of TypeScript in four files, with detection and emission kept apart:

- `src/index.ts` (46 lines): the CLI, built on commander. Defines `init`, resolves `--output`, calls the scanner and generator, writes the file.
- `src/scanner.ts` (288 lines): all detection. Every filesystem read is wrapped, so a missing or malformed file yields a default rather than an exception. Returns one `RepoContext`.
- `src/generator.ts` (111 lines): turns a `RepoContext` into markdown by pushing lines into an array. No filesystem access, which makes it testable without a fixture repository.
- `src/types.ts` (17 lines): the `RepoContext` interface, the only contract between the two halves.

## Setup

```bash
npm install
npm run build        # tsc, strict, to dist/
node dist/index.js init --verbose
```

## Tests

There are none, and there is no CI. Verification so far has been manual: `npm run build` compiles clean, and `node dist/index.js init --verbose` run against this repository produces a correct `CLAUDE.md` (TypeScript, npm, no frameworks, no tests, no linter, which is right). The seam is there for tests, since `generateClaudeMd` is a pure function of `RepoContext` and the scanner takes a root path, so both can be exercised against fixture directories without mocking. That work has not been done.

Two limits worth knowing. Detection is deliberately shallow: language detection counts extensions in one directory rather than walking the tree, frameworks are matched by exact package name so anything outside the list above goes unreported, and Python dependencies are read from `requirements.txt` only, not `pyproject.toml`. And the output is a starting point rather than a finished context file: the sections it cannot infer are left marked for a human.

## Licence

MIT.
