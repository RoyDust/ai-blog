const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const asPath = (value) => value.replaceAll('\\', '/');

function backup(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkforge-backup-test-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'docker'), [
    '#!/usr/bin/env bash',
    'set -eu',
    'echo "$*" >> "$MOCK_ROOT/commands"',
    'case "$*" in',
    '  compose*) if [[ "$MODE" != missing ]]; then echo owned-old-container; fi ;;',
    '  exec*) printf "%s\\n" "PG_VERSION=16" "DATABASE_URL=postgresql://user:test-only-backup-secret@database/test" ;;',
    '  inspect*) if [[ "$*" == *".Image"* ]]; then echo sha256:old-image; else echo false; fi ;;',
    '  run*pg_dump*)',
    '    if [[ "$MODE" == dump-failure ]]; then echo test-only-backup-secret >&2; exit 1; fi',
    '    if [[ "$MODE" != empty ]]; then echo custom-format-fixture; fi ;;',
    '  run*pg_restore*) if [[ "$MODE" == invalid ]]; then echo test-only-backup-secret >&2; exit 1; fi ;;',
    'esac',
  ].join('\n') + '\n', { mode: 0o755 });
  try {
    const command = process.platform === 'win32'
      ? 'export PATH="$(cygpath -u "$MOCK_BIN"):$PATH"; exec bash "$BACKUP_SCRIPT"'
      : 'export PATH="$MOCK_BIN:$PATH"; exec bash "$BACKUP_SCRIPT"';
    const result = spawnSync(shell, ['-c', command], {
      cwd: dir, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, DEPLOY_PATH: asPath(dir), RELEASE_SHA: 'a'.repeat(40),
        MOCK_ROOT: asPath(dir), MOCK_BIN: asPath(bin), MODE: mode,
        BACKUP_SCRIPT: asPath(path.join(__dirname, 'backup-production.sh')) },
    });
    if (result.error) throw result.error;
    const backupDir = path.join(dir, 'shared/backups');
    return { ...result, calls: fs.readFileSync(path.join(dir, 'commands'), 'utf8'),
      files: fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [] };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('preserves the previous image and validates backup before stopping senders', () => {
  const result = backup('success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.files.filter((file) => file.endsWith('.dump')).length, 1);
  assert.equal(result.files.length, 1, 'temporary credentials must be removed');
  const stop = result.calls.indexOf('stop --time 30 owned-old-container');
  assert.ok(stop > result.calls.indexOf('tag sha256:old-image my-next-app:pre-'));
  assert.ok(stop > result.calls.indexOf('pg_dump --format=custom'));
  assert.ok(stop > result.calls.indexOf('pg_restore --list'));
  assert.match(result.stdout, /Validated database backup/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-only-backup-secret/);
});

for (const mode of ['dump-failure', 'invalid', 'empty', 'missing']) {
  test('backup ' + mode + ' prevents stop and removes temporary credentials', () => {
    const result = backup(mode);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.calls, /^stop /m);
    assert.equal(result.files.length, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /test-only-backup-secret/);
  });
}
