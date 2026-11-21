'use strict';

const fs = require('node:fs');

function parseDotenvFallback(source) {
  const result = {};
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let rest = match[2];

    if (rest.startsWith("'")) {
      let value = '';
      let closed = false;
      let cursor = rest.slice(1);
      while (true) {
        const endQuote = cursor.indexOf("'");
        if (endQuote !== -1) {
          value += cursor.slice(0, endQuote);
          closed = true;
          break;
        }
        value += cursor;
        if (i + 1 >= lines.length) break;
        i += 1;
        value += '\n';
        cursor = lines[i];
      }
      result[key] = closed ? value : rest.trim();
    } else if (rest.startsWith('"')) {
      let rawQuoted = '';
      let cursor = rest.slice(1);
      while (true) {
        let escaped = false;
        let endIndex = -1;
        for (let idx = 0; idx < cursor.length; idx += 1) {
          const ch = cursor[idx];
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            endIndex = idx;
            break;
          }
        }
        if (endIndex !== -1) {
          rawQuoted += cursor.slice(0, endIndex);
          break;
        }
        rawQuoted += cursor;
        if (i + 1 >= lines.length) break;
        i += 1;
        rawQuoted += '\n';
        cursor = lines[i];
      }
      result[key] = rawQuoted
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else {
      const commentIndex = rest.search(/\s+#/);
      if (commentIndex !== -1) {
        rest = rest.slice(0, commentIndex);
      }
      result[key] = rest.trim();
    }
  }

  return result;
}

function loadDotenvParser() {
  try {
    const dotenv = require('dotenv');
    if (dotenv && typeof dotenv.parse === 'function') {
      return dotenv.parse;
    }
  } catch {
    // Release bundles exclude node_modules; fall back to the strict literal parser.
  }
  return parseDotenvFallback;
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parse = loadDotenvParser();
  const parsed = parse(content);
  if (parsed.NEXTAUTH_SECRET === '${AUTH_SECRET}' && typeof parsed.AUTH_SECRET === 'string') {
    parsed.NEXTAUTH_SECRET = parsed.AUTH_SECRET;
  }
  return parsed;
}

if (require.main === module) {
  try {
    const [filePath, ...keys] = process.argv.slice(2);
    if (!filePath) {
      console.error('Usage: node read-dotenv.cjs <env-file> [KEY...]');
      process.exit(1);
    }

    const parsed = parseEnvFile(filePath);
    for (const key of keys) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        console.error('Invalid environment variable name requested');
        process.exit(1);
      }
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        process.stdout.write(key + '\0' + String(parsed[key]) + '\0');
      }
    }
  } catch {
    console.error('Failed to read or parse environment file');
    process.exit(1);
  }
}

module.exports = { parseDotenvFallback, parseEnvFile };
