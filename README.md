# Anchorfile

A command-line tool that scans a repository and writes a `CLAUDE.md` context file for AI coding agents (Claude Code, Cursor, Copilot). Those agents work better when the repository states its own stack, scripts and layout up front, and writing that file by hand is the kind of chore that goes stale immediately. Anchorfile reads what is already on disk, package manifests, lockfiles, config files and the top-level tree, and emits the file in one command, leaving marked sections for the judgement calls a scanner cannot make.

Published on npm as [`anchorfile`](https://www.npmjs.com/package/anchorfile).

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
- **Linter**, from `devDependencies` only: Biome, ESLint, or Prettier. ESLint is
  also detected from a legacy config file, but only these six exact names:
  `.eslintrc`, `.eslintrc.js`, `.eslintrc.cjs`, `.eslintrc.json`, `.eslintrc.yml`,
  `.eslintrc.yaml`. Flat config (`eslint.config.js`), the default since ESLint 9,
  is not recognised, so a repository using it and not listing eslint in
  `devDependencies` reports no linter.
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

<!-- site:case-study:start -->

## Architecture

465 lines of TypeScript in four files, with detection and emission kept apart:

- `src/index.ts` (46 lines): the CLI, built on commander. Defines `init`, resolves `--output`, calls the scanner and generator, writes the file.
- `src/scanner.ts` (291 lines): all detection. Every filesystem read is wrapped, so a missing or malformed file yields a default rather than an exception. Returns one `RepoContext`.
- `src/generator.ts` (111 lines): turns a `RepoContext` into markdown by pushing lines into an array. No filesystem access, so it is tested without a fixture repository.
- `src/types.ts` (17 lines): the `RepoContext` interface, the only contract between the two halves.

The split is what makes the tool checkable. The scanner is a function of a directory, so each kind of project it claims to understand is a small fixture directory in `test/fixtures/`, and its report is compared field by field with what the README says it detects. The generator is a function of one object, so its whole output is pinned by a snapshot.

## Tests

`npm test` builds `dist/` and runs 30 Vitest tests in 3 files:

- `test/scanner.test.ts` (25 tests) runs the scanner against four fixture repositories (a TypeScript app with npm, Vitest, ESLint, Docker and CI; a JavaScript app with Yarn and a flat ESLint config; a JavaScript app with a legacy `.eslintrc.json` and pnpm; a Python app with `requirements.txt`, `pyproject.toml` and `tests/`) and an empty directory. The two documented limits below are tested too, so they change only on purpose.
- `test/generator.test.ts` (3 tests) snapshots the full emitted file and checks the wording used when nothing was found.
- `test/cli.test.ts` (2 tests) runs the built CLI: `--version` must equal `package.json` (0.1.2 shipped to fix exactly that drift), and `init` run inside a fixture must write the file.

`npm run typecheck` checks the source and the tests under strict mode. `.github/workflows/ci.yml` runs typecheck, test and `npm pack --dry-run` on every push and pull request to `main`. There is no linter.

Writing the fixture tests turned up one defect: top-level folders were listed in the order the filesystem returned them, which differs between machines, so the same repository could produce two different files. They are now sorted.

## Known limits

- Detection is deliberately shallow. Language detection counts extensions in one directory rather than walking the tree, and frameworks are matched by exact package name, so anything outside the list above goes unreported.
- Python dependencies are read from `requirements.txt` only, not `pyproject.toml`.
- ESLint flat config (`eslint.config.js`) is not recognised; see the linter entry above.
- The output is a starting point rather than a finished context file: the sections it cannot infer are left marked for a human.

<!-- site:case-study:end -->

## Setup

```bash
npm install
npm run typecheck    # source and tests, strict
npm test             # builds dist/, then runs the suite
node dist/index.js init --verbose
```

## How this was built

Built solo in collaboration with Claude Code: the decisions stay with the author, the AI drafts to that direction, and nothing ships unread. The `CLAUDE.md` at the root of this repository is Anchorfile's own output, run on itself.

## Licence

MIT.
