const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const asPath = (value) => value.replaceAll('\\', '/');

function backup(mode, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkforge-backup-test-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);

  if (options.sharedEnv !== undefined) {
    fs.mkdirSync(path.join(dir, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'shared/.env'), options.sharedEnv);
  }
  if (options.candidateEnv !== undefined) {
    fs.writeFileSync(path.join(dir, '.env'), options.candidateEnv);
  }
  if (options.existingDumps) {
    const backupDir = path.join(dir, 'shared/backups');
    fs.mkdirSync(backupDir, { recursive: true });
    options.existingDumps.forEach((name, idx) => {
      const full = path.join(backupDir, name);
      fs.writeFileSync(full, 'existing-dump-' + idx);
      const ts = new Date(Date.UTC(2026, 10, 1, 0, 0, idx));
      fs.utimesSync(full, ts, ts);
    });
  }
  if (options.existingTags) {
    fs.writeFileSync(path.join(dir, 'existing-tags'), options.existingTags.join('\n') + '\n');
  }

  fs.writeFileSync(path.join(bin, 'docker'), [
    '#!/usr/bin/env bash',
    'set -eu',
    'echo "$*" >> "$MOCK_ROOT/commands"',
    'case "$*" in',
    '  "image ls --format {{.Repository}}:{{.Tag}} my-next-app:pre-*")',
    '    if [[ -f "$MOCK_ROOT/existing-tags" ]]; then cat "$MOCK_ROOT/existing-tags"; fi ;;',
    '  "image rm "*) ;;',
    '  "image inspect"*) if [[ "$MODE" == client-missing || "$MODE" == client-pull-failure ]]; then exit 1; fi ;;',
    '  pull*) if [[ "$MODE" == client-pull-failure ]]; then exit 1; fi ;;',
    '  *" ps -q app")',
    '    if [[ "$MODE" != missing && "$MODE" != stopped && "$MODE" != initial ]]; then echo owned-old-container; fi ;;',
    '  *" ps -a -q app")',
    '    if [[ "$MODE" == stopped ]]; then echo stopped-old-container;',
    '    elif [[ "$MODE" != missing && "$MODE" != initial ]]; then echo owned-old-container; fi ;;',
    '  exec*) printf "%s\\n" "PG_VERSION=16" "DATABASE_URL=postgresql://user:test-only-backup-secret@database/test" ;;',
    '  "run --rm --network "*" --env-file "*" my-next-app:latest node -e "*)',
    '    if [[ "$MODE" == preflight-failure ]]; then echo test-only-backup-secret >&2; exit 1; fi',
    '    env_arg=""',
    '    prev=""',
    '    for arg in "$@"; do',
    '      if [[ "$prev" == "--env-file" ]]; then env_arg="$arg"; break; fi',
    '      prev="$arg"',
    '    done',
    '    cp "$env_arg" "$MOCK_ROOT/captured-raw-env"',
    '    if grep -q "new-database" "$env_arg" 2>/dev/null; then',
    '      printf "%s\\n" "PG_VERSION=16" "DATABASE_URL=postgresql://user:target-secret@new-database:5432/next_db"',
    '    else',
    '      printf "%s\\n" "PG_VERSION=16" "DATABASE_URL=postgresql://user:test-only-backup-secret@database/test"',
    '    fi ;;',
    '  inspect*)',
    '    if [[ "$*" == *".Image"* ]]; then echo sha256:old-image;',
    '    elif [[ "$*" == *".NetworkSettings.Networks"* ]]; then echo inkforge_default;',
    '    else echo false; fi ;;',
    '  tag*)',
    '    echo "${3:-}" >> "$MOCK_ROOT/existing-tags" ;;',
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
    const capturedRawEnv = fs.existsSync(path.join(dir, 'captured-raw-env'))
      ? fs.readFileSync(path.join(dir, 'captured-raw-env'), 'utf8')
      : '';
    return {
      ...result,
      capturedRawEnv,
      calls: fs.existsSync(path.join(dir, 'commands')) ? fs.readFileSync(path.join(dir, 'commands'), 'utf8') : '',
      files: fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [],
    };
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
  assert.doesNotMatch(result.calls, /^pull /m);
  assert.doesNotMatch(result.stdout + result.stderr, /test-only-backup-secret/);
});

test('loads a matching client only when it is not cached', () => {
  const result = backup('client-missing');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /^pull postgres:16$/m);
  assert.match(result.calls, /^stop /m);
});

for (const mode of ['dump-failure', 'invalid', 'empty', 'missing', 'client-pull-failure']) {
  test('backup ' + mode + ' prevents stop and removes temporary credentials', () => {
    const result = backup(mode);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.calls, /^stop /m);
    assert.equal(result.files.length, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /test-only-backup-secret/);
  });
}

test('stopped previous container backs up via shared/.env without shell expansion and tags stopped image', () => {
  const pwnFile = asPath(path.join(os.tmpdir(), 'inkforge-backup-never-eval-' + process.pid));
  const rawDbUrl = `postgresql://user:p@ss!word$LITERAL$(touch ${pwnFile})\`id\`@database:5432/test?schema=public`;
  const sharedEnv = [
    `DATABASE_URL='${rawDbUrl}'`,
    `UNRELATED_SECRET="value with spaces ! $HOME \`uname\` $(touch ${pwnFile})"`,
  ].join('\n');

  const result = backup('stopped', { sharedEnv });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(pwnFile), false, 'dotenv values must never be evaluated by bash');
  assert.equal(result.capturedRawEnv.trim(), `DATABASE_URL=${rawDbUrl}`);
  assert.equal(result.files.filter((file) => file.endsWith('.dump')).length, 1);
  assert.equal(result.files.length, 1, 'temporary credentials must be removed');
  assert.match(result.calls, /tag sha256:old-image my-next-app:pre-/);
  assert.match(result.calls, /pg_dump --format=custom/);
  assert.match(result.calls, /pg_restore --list/);
  assert.doesNotMatch(result.calls, /^stop /m);
  assert.match(result.stdout, /already stopped; previous image retained/);
  assert.doesNotMatch(result.stdout + result.stderr + result.calls, /test-only-backup-secret|p@ss!word/);
});

test('initial deploy with no previous container backs up database via shared/.env without tagging or stopping', () => {
  const sharedEnv = 'DATABASE_URL="postgresql://user:init-secret!@127.0.0.1:5432/test?schema=public"\n';
  const result = backup('initial', { sharedEnv });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.files.filter((file) => file.endsWith('.dump')).length, 1);
  assert.equal(result.files.length, 1);
  assert.doesNotMatch(result.calls, /^tag /m);
  assert.doesNotMatch(result.calls, /^stop /m);
  assert.match(result.calls, /--network host/);
  assert.match(result.stdout, /Initial deployment backup completed/);
  assert.doesNotMatch(result.stdout + result.stderr + result.calls, /init-secret!/);
});

test('retains only the newest 5 dump backups and newest 5 pre-deploy image tags', () => {
  const existingDumps = [
    'pre-' + 'f'.repeat(40) + '-20261101T000001Z.dump',
    'pre-' + 'e'.repeat(40) + '-20261101T000002Z.dump',
    'pre-' + 'd'.repeat(40) + '-20261101T000003Z.dump',
    'pre-' + 'c'.repeat(40) + '-20261101T000004Z.dump',
    'pre-' + 'b'.repeat(40) + '-20261101T000005Z.dump',
    'pre-' + '9'.repeat(40) + '-20261101T000006Z.dump',
  ];
  const existingTags = [
    'my-next-app:pre-' + '9'.repeat(40) + '-20261101T000006Z',
    'my-next-app:pre-' + 'b'.repeat(40) + '-20261101T000005Z',
    'my-next-app:pre-' + 'c'.repeat(40) + '-20261101T000004Z',
    'my-next-app:pre-' + 'd'.repeat(40) + '-20261101T000003Z',
    'my-next-app:pre-' + 'e'.repeat(40) + '-20261101T000002Z',
    'my-next-app:pre-' + 'f'.repeat(40) + '-20261101T000001Z',
  ];
  const result = backup('success', { existingDumps, existingTags });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.files.length, 5);
  assert.ok(!result.files.includes(existingDumps[0]), 'oldest dump 01Z must be pruned');
  assert.ok(!result.files.includes(existingDumps[1]), 'second-oldest dump 02Z must be pruned after new backup is added');
  assert.ok(result.files.includes(existingDumps[5]), 'recent dump 06Z must be kept');
  assert.match(result.calls, new RegExp('image rm ' + existingTags[5]));
  assert.match(result.calls, new RegExp('image rm ' + existingTags[4]));
  assert.doesNotMatch(result.calls, new RegExp('image rm ' + existingTags[0]));
});

test('backs up both running DB and candidate target DB before stopping when candidate .env switches DATABASE_URL', () => {
  const candidateEnv = 'DATABASE_URL="postgresql://user:target-secret@new-database:5432/next_db?schema=public"\n';
  const result = backup('success', { candidateEnv });
  assert.equal(result.status, 0, result.stderr);
  const dumps = result.files.filter((file) => file.endsWith('.dump'));
  assert.equal(dumps.length, 2, 'both running DB and candidate target DB must be backed up');
  assert.ok(dumps.some((f) => f.startsWith('pre-' + 'a'.repeat(40))));
  assert.ok(dumps.some((f) => f.startsWith('pre-running-' + 'a'.repeat(40))));
  assert.equal(result.files.length, 2, 'temporary credentials must be removed');
  const stopIdx = result.calls.indexOf('stop --time 30 owned-old-container');
  const lastRestoreIdx = result.calls.lastIndexOf('pg_restore --list');
  assert.ok(stopIdx > lastRestoreIdx, 'old container must only stop after both dumps are validated');
  assert.doesNotMatch(result.stdout + result.stderr, /target-secret|test-only-backup-secret/);
});

test('does not stop running container when candidate target DATABASE_URL preflight fails', () => {
  const candidateEnv = 'DATABASE_URL="postgresql://user:target-secret@new-database:5432/next_db?schema=public"\n';
  const result = backup('preflight-failure', { candidateEnv });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.calls, /^stop /m);
  assert.equal(result.files.length, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /target-secret|test-only-backup-secret/);
});
