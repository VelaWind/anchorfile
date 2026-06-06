# Anchorfile

Scan a software repository and generate a `CLAUDE.md` context file for AI coding agents (Claude Code, Cursor, GitHub Copilot).

## Usage

```bash
npx anchorfile init
```

Run from the root of any software project. A `CLAUDE.md` file will be generated in the current directory.

### Options

```
--output <path>   Output file path (default: ./CLAUDE.md)
--verbose         Log what is being scanned
```

### Example

```bash
npx anchorfile init --verbose
npx anchorfile init --output docs/CLAUDE.md
```

## What it detects

- Project name and description (from `package.json`)
- Primary language (TypeScript, JavaScript, Python, Go, Rust, Java)
- Frameworks (React, Next.js, Vue, Express, and more)
- Package manager (npm, yarn, pnpm)
- Test framework (Jest, Vitest, Mocha, pytest, Cypress, Playwright)
- Linter (ESLint, Biome, Prettier)
- Docker and CI/CD presence
- Top-level folder structure and key files

## Development

```bash
npm install
npm run build
node dist/index.js init
```
