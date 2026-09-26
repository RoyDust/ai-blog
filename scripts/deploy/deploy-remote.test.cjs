const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '../..');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const asPath = (p) => p.replaceAll('\\', '/');

function deploy(states, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkforge-deploy-test-'));
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  const valid = { DATABASE_URL: 'postgresql://user:password@localhost/test', AUTH_SECRET: 'valid-auth-value', NEXTAUTH_SECRET: 'valid-nextauth-value', NEXTAUTH_URL: 'http://localhost:3000', NEXT_PUBLIC_SITE_URL: 'https://site.test' };
  fs.writeFileSync(path.join(dir, '.env'), Object.entries({ ...valid, ...options.env }).map(([key, value]) => key + "='" + value + "'").join('\n'));
  fs.mkdirSync(path.join(dir, 'prisma/migrations/fixture'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'states'), states.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'logs'), options.logs ?? 'Error: ECONNREFUSED while checking database readiness\n');
  fs.writeFileSync(path.join(dir, 'log-error'), 'Docker logs read failed: token=read-failure-secret postgresql://user:password@localhost/test\n');
  fs.writeFileSync(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
set -eu
echo "$*" >> "$MOCK_ROOT/commands"
case "$*" in
  "image inspect my-next-app:latest --format {{.Id}}") echo "$MOCK_IMAGE_ID" ;;
  *check-web-readiness.cjs) node "$PREFLIGHT_CLI" ;;
  *" ps -a -q app") if [[ "$MISSING_APP" != "1" ]]; then echo fixture-container; fi ;;
  *" logs --no-color --no-log-prefix --tail 60 --since 5m app")
    if [[ "$MOCK_LOG_READ_STALL" == "1" ]]; then command -p sleep 8; fi
    if [[ "$MOCK_LOG_READ_FAILURE" == "1" ]]; then cat "$MOCK_ROOT/log-error" >&2; exit 42; fi
    cat "$MOCK_ROOT/logs"
    ;;
  inspect*)
    n=1; if [[ -f "$MOCK_ROOT/index" ]]; then n=$(cat "$MOCK_ROOT/index"); fi
    state=$(sed -n "$n p" "$MOCK_ROOT/states")
    if [[ -z "$state" ]]; then state=$(tail -n 1 "$MOCK_ROOT/states"); fi
    echo $((n + 1)) > "$MOCK_ROOT/index"
    if [[ "$state" == "unreadable" ]]; then exit 1; fi
    echo "$state"
    ;;
esac
`, { mode: 0o755 });
  try {
    const command = process.platform === 'win32'
      ? 'export PATH="$(cygpath -u "$MOCK_BIN"):$PATH"; exec bash "$DEPLOY_SCRIPT"'
      : 'export PATH="$MOCK_BIN:$PATH"; exec bash "$DEPLOY_SCRIPT"';
    const result = spawnSync(shell, ['-c', command], { cwd: dir, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, DEPLOY_PATH: asPath(dir), MOCK_ROOT: asPath(dir), MOCK_BIN: asPath(bin),
        DEPLOY_SCRIPT: asPath(path.join(project, 'scripts/deploy/deploy-remote.sh')),
        PREFLIGHT_CLI: asPath(path.join(project, 'scripts/check-web-readiness.cjs')), MISSING_APP: options.missing ? '1' : '0',
        MOCK_LOG_READ_FAILURE: options.logReadFailure ? '1' : '0', MOCK_LOG_READ_STALL: options.logReadStall ? '1' : '0',
        PREBUILT_IMAGE_ID: options.prebuiltImage ?? '', MOCK_IMAGE_ID: options.actualImage ?? '' } });
    if (result.error) throw result.error;
    const calls = fs.readFileSync(path.join(dir, 'commands'), 'utf8');
    return { ...result, calls };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

for (const states of [['running healthy'], ['running starting', 'running healthy']]) {
  test('only healthy succeeds: ' + states.join(' -> '), () => {
    const r = deploy(states); assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Deployment succeeded/);
    assert.ok(r.calls.indexOf('check-web-readiness.cjs') < r.calls.indexOf('prisma migrate deploy'));
    assert.ok(r.calls.indexOf('prisma migrate deploy') < r.calls.indexOf(' up -d'));
  });
}
for (const state of ['running starting', 'running unhealthy', 'exited ', 'running ', 'unreadable']) {
  test('fails deployment on ' + state, () => {
    const r = deploy([state]); assert.notEqual(r.status, 0); assert.doesNotMatch(r.stdout, /Deployment succeeded/);
    assert.doesNotMatch(r.calls, / down |rollback/);
    if (state === 'running starting') assert.equal(r.calls.split('\n').filter((line) => line.startsWith('inspect')).length, 12);
  });
}
test('missing service fails immediately', () => assert.notEqual(deploy(['running healthy'], { missing: true }).status, 0));

test('reuses an exact prebuilt image while retaining validation and migrations', () => {
  const image = 'sha256:' + 'a'.repeat(64);
  const r = deploy(['running healthy'], { prebuiltImage: image, actualImage: image });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.calls, / build app| load/);
  assert.match(r.calls, /check-web-readiness.cjs/);
  assert.match(r.calls, /prisma migrate deploy/);
});

for (const image of ['sha256:' + 'b'.repeat(64), 'invalid']) {
  test('rejects an unverified recovery image: ' + image, () => {
    const r = deploy(['running healthy'], { prebuiltImage: image, actualImage: 'sha256:' + 'a'.repeat(64) });
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.calls, /prisma migrate| up -d| build app/);
  });
}
test('failure prints bounded state and recent log signals without exposing values', () => {
  const secrets = ['valid-auth-value', 'valid-nextauth-value', 'postgresql://user:password@localhost/test', 'bearer-sensitive-token', 'cookie-sensitive-session', 'api-sensitive-key', 'arbitrary-env-sensitive'];
  const logs = [
    'ECONNREFUSED database connection ' + secrets[2],
    'Authorization: Bearer ' + secrets[3],
    'Cookie: sid=' + secrets[4],
    JSON.stringify({ error: 'P1001', api_key: secrets[5] }),
    ...secrets.map((secret) => 'unlabelled ' + secret),
    'ETIMEDOUT ' + 'x'.repeat(32000) + secrets.join(' '),
    ...Array.from({ length: 500 }, () => 'ENOTFOUND ' + secrets.join(' ')),
  ].join('\n');
  const r = deploy(['running unhealthy'], { logs, env: { UNUSUAL_CONFIG: secrets[6] } });
  const output = r.stdout + r.stderr;
  assert.equal(r.status, 1);
  assert.match(r.stderr, /app status: running; health: unhealthy/);
  assert.match(r.stderr, /Recent log signals/);
  assert.match(r.stderr, /ECONNREFUSED/);
  assert.match(r.stderr, /P1001/);
  assert.ok(Buffer.byteLength(output) < 5000, 'diagnostics must stay bounded');
  for (const secret of secrets) assert.ok(!output.includes(secret), 'secret leaked: ' + secret);
  assert.match(r.calls, /logs --no-color --no-log-prefix --tail 60 --since 5m app/);
  assert.doesNotMatch(r.calls, /\.Config|inspect(?! --format)/);
});
test('log read failure preserves deployment failure and omits tool stderr', () => {
  const r = deploy(['unreadable'], { logReadFailure: true });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /app status: unavailable; health: unavailable/);
  assert.match(r.stderr, /Recent logs unavailable/);
  assert.doesNotMatch(r.stdout + r.stderr, /read-failure-secret|password@localhost/);
  assert.doesNotMatch(r.stdout, /Deployment succeeded/);
});
test('unrecognized states and arbitrary log text never enter diagnostics', () => {
  const r = deploy(['running token=secret-health-value'], { logs: 'opaque-token-value\n{"secret":"unlabelled-secret"}\n' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /app status: unavailable; health: unavailable/);
  assert.match(r.stderr, /Unclassified log entries omitted/);
  assert.doesNotMatch(r.stdout + r.stderr, /secret-health-value|opaque-token-value|unlabelled-secret/);
});
test('frequent known failures produce at most twenty log signals', () => {
  const logs = Array.from({ length: 300 }, () => 'ECONNREFUSED private-hostname token=private-token-value').join('\n');
  const r = deploy(['running unhealthy'], { logs });
  assert.equal(r.status, 1);
  assert.equal((r.stderr.match(/\[log /g) ?? []).length, 20);
  assert.match(r.stderr, /Additional diagnostic signals omitted/);
  assert.doesNotMatch(r.stdout + r.stderr, /private-hostname|private-token-value/);
});
test('a stalled log reader times out without changing the failed exit', () => {
  const started = Date.now();
  const r = deploy(['running unhealthy'], { logReadStall: true });
  assert.equal(r.status, 1);
  assert.ok(Date.now() - started < 12000, 'bounded diagnostics must interrupt the stalled read');
  assert.match(r.stderr, /Recent logs unavailable or incomplete: bounded read failed/);
});
for (const env of [{ AUTH_SECRET: '' }, { AUTH_SECRET: 'replace-with-secret' }, { NEXT_PUBLIC_SITE_URL: '/relative' }]) {
  test('invalid config fails before migration and replacement: ' + JSON.stringify(env), () => {
    const r = deploy(['running healthy'], { env }); assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.calls, /prisma migrate| up -d/);
    assert.doesNotMatch(r.stdout + r.stderr, /valid-auth-value|password@localhost/);
  });
}
