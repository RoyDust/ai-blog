'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_KEEP_COUNT = 5;

function extractStamp(name, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = name.match(new RegExp('(\\d{8}T\\d{6}Z)' + escaped + '$'));
  return match ? match[1] : '';
}

function safeRealpath(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return null;
  }
}

function pruneBackups(deployRoot, keepCount = DEFAULT_KEEP_COUNT) {
  const backupsDir = path.join(deployRoot, 'shared', 'backups');
  if (!fs.existsSync(backupsDir)) return;

  const entries = fs.readdirSync(backupsDir)
    .filter((name) => name.endsWith('.dump'))
    .map((name) => {
      const fullPath = path.join(backupsDir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        fullPath,
        stamp: extractStamp(name, '.dump'),
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter((entry) => fs.statSync(entry.fullPath).isFile());

  entries.sort((a, b) => {
    if (a.stamp && b.stamp && a.stamp !== b.stamp) {
      return b.stamp.localeCompare(a.stamp);
    }
    if (b.mtimeMs !== a.mtimeMs) {
      return b.mtimeMs - a.mtimeMs;
    }
    return b.name.localeCompare(a.name);
  });

  for (const stale of entries.slice(keepCount)) {
    fs.rmSync(stale.fullPath, { force: true });
  }
}

function pruneReleases(deployRoot, activeReleaseDir, keepCount = DEFAULT_KEEP_COUNT) {
  const releasesDir = path.join(deployRoot, 'releases');
  if (!fs.existsSync(releasesDir)) return;

  const releasesRootReal = safeRealpath(releasesDir);
  if (!releasesRootReal) return;

  const protectedPaths = new Set();
  const currentReal = safeRealpath(path.join(deployRoot, 'current'));
  if (currentReal) protectedPaths.add(currentReal);
  const activeReal = activeReleaseDir ? safeRealpath(activeReleaseDir) : null;
  if (activeReal) protectedPaths.add(activeReal);

  const entries = fs.readdirSync(releasesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => {
      const fullPath = path.join(releasesDir, dirent.name);
      const realPath = safeRealpath(fullPath);
      const stat = fs.statSync(fullPath);
      return {
        name: dirent.name,
        fullPath,
        realPath,
        mtimeMs: stat.mtimeMs,
      };
    });

  entries.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) {
      return b.mtimeMs - a.mtimeMs;
    }
    return b.name.localeCompare(a.name);
  });

  for (const stale of entries.slice(keepCount)) {
    if (!stale.realPath) continue;
    if (protectedPaths.has(stale.realPath)) continue;
    const rel = path.relative(releasesRootReal, stale.realPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    fs.rmSync(stale.fullPath, { recursive: true, force: true });
  }
}

function selectStaleImageTags(stdinText, keepCount = DEFAULT_KEEP_COUNT) {
  const seen = new Set();
  const entries = [];

  for (const rawLine of String(stdinText).replace(/\r\n?/g, '\n').split('\n')) {
    const tag = rawLine.trim();
    if (!tag.startsWith('my-next-app:pre-') || seen.has(tag)) continue;
    seen.add(tag);
    entries.push({
      tag,
      stamp: extractStamp(tag),
      order: entries.length,
    });
  }

  entries.sort((a, b) => {
    if (a.stamp && b.stamp && a.stamp !== b.stamp) {
      return b.stamp.localeCompare(a.stamp);
    }
    return a.order - b.order;
  });

  return entries.slice(keepCount).map((entry) => entry.tag);
}

function switchCurrentSymlink(targetDir, linkPath) {
  const resolvedTarget = path.resolve(targetDir);
  const resolvedLink = path.resolve(linkPath);
  if (process.platform === 'win32') {
    fs.rmSync(resolvedLink, { recursive: true, force: true });
    fs.symlinkSync(resolvedTarget, resolvedLink, 'junction');
  } else {
    const tempLink = resolvedLink + '.tmp.' + process.pid;
    fs.rmSync(tempLink, { force: true });
    fs.symlinkSync(resolvedTarget, tempLink, 'dir');
    fs.renameSync(tempLink, resolvedLink);
  }
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === '--switch-current') {
    const targetDir = process.argv[3];
    const linkPath = process.argv[4];
    if (!targetDir || !linkPath) process.exit(1);
    switchCurrentSymlink(targetDir, linkPath);
  } else if (mode === '--prune-backups') {
    const deployRoot = process.argv[3];
    const keep = Number(process.argv[4] || DEFAULT_KEEP_COUNT);
    if (deployRoot) pruneBackups(deployRoot, keep);
  } else if (mode === '--prune-files') {
    const deployRoot = process.argv[3];
    const activeReleaseDir = process.argv[4] || '';
    const keep = Number(process.argv[5] || DEFAULT_KEEP_COUNT);
    if (deployRoot) {
      pruneReleases(deployRoot, activeReleaseDir, keep);
      pruneBackups(deployRoot, keep);
    }
  } else if (mode === '--select-stale-tags') {
    const keep = Number(process.argv[3] || DEFAULT_KEEP_COUNT);
    const input = fs.readFileSync(0, 'utf8');
    for (const staleTag of selectStaleImageTags(input, keep)) {
      process.stdout.write(staleTag + '\0');
    }
  } else {
    console.error('Unknown prune-artifacts mode');
    process.exit(1);
  }
}

module.exports = { pruneBackups, pruneReleases, selectStaleImageTags };
