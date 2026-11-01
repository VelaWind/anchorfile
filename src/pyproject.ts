/**
 * Dependency names from a pyproject.toml, without a TOML library.
 *
 * Anchorfile needs three tables and nothing else from the file:
 *
 *   [project]                        dependencies = ["fastapi>=0.110", ...]
 *   [project.optional-dependencies]  test = ["pytest>=8"], ...
 *                                    (or optional-dependencies = { ... } inline in [project])
 *   [tool.poetry.dependencies]       django = "^5.0", sqlalchemy = { version = "^2" }, ...
 *
 * so this reads TOML line by line: table headers, `key = value` pairs, arrays
 * that span lines, quoted keys, both string quote styles and comments. Values
 * are never evaluated; only the strings inside arrays (PEP 621) or the keys
 * (Poetry) are kept. Anything else in the file is skipped, and a file it cannot
 * follow yields fewer names rather than an exception.
 *
 * Not handled, because none of the three tables needs it: multi-line strings,
 * dotted keys (`project.dependencies = [...]` at the top level), and Poetry
 * dependency groups (`[tool.poetry.group.<name>.dependencies]`).
 */

/** The text before an unquoted `#`. */
function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote === '"' && ch === '\\') { i++; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#') return line.slice(0, i);
  }
  return line;
}

/** True when every `[` and `{` outside a string has been closed. */
function isClosed(value: string): boolean {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote === '"' && ch === '\\') { i++; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
  }
  return depth <= 0;
}

/** The string literals that sit inside a `[...]` array, in order. */
function stringsInArrays(value: string): string[] {
  const out: string[] = [];
  let arrayDepth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '[') arrayDepth++;
    else if (ch === ']') arrayDepth--;
    else if (ch === '"' || ch === "'") {
      let j = i + 1;
      let text = '';
      while (j < value.length && value[j] !== ch) {
        if (ch === '"' && value[j] === '\\' && j + 1 < value.length) { text += value[j + 1]; j += 2; continue; }
        text += value[j];
        j++;
      }
      if (arrayDepth > 0) out.push(text);
      i = j;
    }
  }
  return out;
}

/** "FastAPI[standard] >= 0.110 ; python_version >= '3.9'" becomes "fastapi". */
export function requirementName(spec: string): string {
  return spec.trim().split(/[\s[\]=<>!~;@(),]/)[0].toLowerCase();
}

function unquote(key: string): string {
  const t = key.trim();
  return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t;
}

/** `[ tool . "poetry" . dependencies ]` becomes "tool.poetry.dependencies". */
function tableName(header: string): string {
  return header.split('.').map(unquote).join('.');
}

const KEY_VALUE = /^("[^"]*"|'[^']*'|[A-Za-z0-9_.-]+)\s*=\s*(.*)$/;

/**
 * Dependency names, lowercased and without version, extras or markers, in file
 * order with duplicates removed: [project] dependencies, then each
 * optional-dependencies group, then [tool.poetry.dependencies] (except python).
 */
export function parsePyprojectDependencies(text: string): string[] {
  const names: string[] = [];
  const add = (name: string) => { if (name && !names.includes(name)) names.push(name); };

  const take = (table: string, key: string, value: string) => {
    if (table === 'project' && key === 'dependencies') {
      stringsInArrays(value).forEach(s => add(requirementName(s)));
    } else if (table === 'project' && key === 'optional-dependencies') {
      stringsInArrays(value).forEach(s => add(requirementName(s)));
    } else if (table === 'project.optional-dependencies') {
      stringsInArrays(value).forEach(s => add(requirementName(s)));
    } else if (table === 'tool.poetry.dependencies' && key.toLowerCase() !== 'python') {
      add(key.toLowerCase());
    }
  };

  let table = '';
  let pending: { key: string; value: string } | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw).trim();

    if (pending) {
      pending.value += ' ' + line;
      if (isClosed(pending.value)) { take(table, pending.key, pending.value); pending = null; }
      continue;
    }
    if (!line) continue;

    if (line.startsWith('[[')) { table = ''; continue; } // array of tables: never one of ours
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) { table = tableName(header[1]); continue; }

    const kv = line.match(KEY_VALUE);
    if (!kv) continue;
    const key = unquote(kv[1]);
    const value = kv[2];
    if (isClosed(value)) take(table, key, value);
    else pending = { key, value };
  }

  return names;
}
