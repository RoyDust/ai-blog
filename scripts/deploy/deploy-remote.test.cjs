const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '../..');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const asPath = (p) => p.replaceAll('\\', '/');

function makeSymlink(target, linkPath) {
  try {
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {}
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function deploy(states, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkforge-deploy-test-'));
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  const valid = { DATABASE_URL: 'postgresql://user:password@localhost/test', AUTH_SECRET: 'valid-auth-value', NEXTAUTH_SECRET: 'valid-nextauth-value', NEXTAUTH_URL: 'http://localhost:3000', NEXT_PUBLIC_SITE_URL: 'https://site.test' };
  const rawEnvContent = options.rawEnv ?? Object.entries({ ...valid, ...options.env }).map(([key, value]) => key + "='" + value + "'").join('\n');
  fs.writeFileSync(path.join(dir, '.env'), rawEnvContent);
  if (options.withMigrations !== false) {
    fs.mkdirSync(path.join(dir, 'prisma/migrations/fixture'), { recursive: true });
  } else if (options.withEmptyMigrationsDir) {
    fs.mkdirSync(path.join(dir, 'prisma/migrations'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'prisma/migrations/migration_lock.toml'), 'provider = "postgresql"\n');
  }
  fs.writeFileSync(path.join(dir, 'states'), states.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'logs'), options.logs ?? 'Error: ECONNREFUSED while checking database readiness\n');
  fs.writeFileSync(path.join(dir, 'log-error'), 'Docker logs read failed: token=read-failure-secret postgresql://user:password@localhost/test\n');
  fs.writeFileSync(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
set -eu
echo "$*" >> "$MOCK_ROOT/commands"
case "$*" in
  "image ls --format {{.Repository}}:{{.Tag}} my-next-app:pre-*")
    if [[ -f "$MOCK_ROOT/pre-tags" ]]; then cat "$MOCK_ROOT/pre-tags"; fi ;;
  "image rm "*) ;;
  "image inspect my-next-app:latest --format {{.Id}}") echo "$MOCK_IMAGE_ID" ;;
  *"build app")
    printf 'NEXTAUTH_URL=%s\nNEXT_PUBLIC_SITE_URL=%s\nCOMPOSE_PROJECT_NAME=%s\nHTTP_PROXY=%s\n' \
      "\${NEXTAUTH_URL:-}" "\${NEXT_PUBLIC_SITE_URL:-}" "\${COMPOSE_PROJECT_NAME:-}" "\${HTTP_PROXY:-}" > "$MOCK_ROOT/captured-build-env"
    ;;
  *check-web-readiness.cjs)
    node -e '
      const fs = require("node:fs");
      const { parseEnvFile } = require(process.argv[1]);
      const { parseWebReadinessConfig } = require(process.argv[2]);
      const parsed = parseEnvFile(".env");
      if (!parseWebReadinessConfig(parsed).valid) {
        console.error("Web configuration preflight failed");
        process.exit(1);
      }
      console.log("Web configuration preflight passed");
    ' "$READ_DOTENV_CLI" "$READINESS_POLICY_MODULE"
    ;;
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
      env: { ...process.env, MSYS: 'winsymlinks:nativestrict', DEPLOY_PATH: asPath(dir), MOCK_ROOT: asPath(dir), MOCK_BIN: asPath(bin),
        DEPLOY_SCRIPT: asPath(path.join(project, 'scripts/deploy/deploy-remote.sh')),
        READ_DOTENV_CLI: asPath(path.join(project, 'scripts/deploy/read-dotenv.cjs')),
        READINESS_POLICY_MODULE: asPath(path.join(project, '.generated/web-health/web-readiness-config.js')),
        MISSING_APP: options.missing ? '1' : '0',
        MOCK_LOG_READ_FAILURE: options.logReadFailure ? '1' : '0', MOCK_LOG_READ_STALL: options.logReadStall ? '1' : '0',
        PREBUILT_IMAGE_ID: options.prebuiltImage ?? '', MOCK_IMAGE_ID: options.actualImage ?? '' } });
    if (result.error) throw result.error;
    const calls = fs.existsSync(path.join(dir, 'commands')) ? fs.readFileSync(path.join(dir, 'commands'), 'utf8') : '';
    const capturedBuildEnv = fs.existsSync(path.join(dir, 'captured-build-env'))
      ? fs.readFileSync(path.join(dir, 'captured-build-env'), 'utf8')
      : '';
    return { ...result, calls, capturedBuildEnv };
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

test('parses .env with $, !, backticks, $(), and spaces without shell execution', () => {
  const marker = asPath(path.join(os.tmpdir(), 'inkforge-never-executed-' + process.pid));
  const rawEnv = [
    `DATABASE_URL="postgresql://user:pa$$w0rd!@localhost:5432/test?schema=public"`,
    `AUTH_SECRET='auth!secret$(touch ${marker})\`touch ${marker}\` with spaces'`,
    `NEXTAUTH_SECRET="nextauth!secret$(touch ${marker})\`id\` $PATH"`,
    `NEXTAUTH_URL="https://blog.example.com"`,
    `NEXT_PUBLIC_SITE_URL="https://blog.example.com"`,
    `COMPOSE_PROJECT_NAME="inkforge_prod"`,
    `HTTP_PROXY="http://127.0.0.1:7890"`,
    `UNQUOTED_SPECIAL=literal!value$(touch ${marker})`,
  ].join('\n');

  const r = deploy(['running healthy'], { rawEnv });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(marker), false, 'command substitutions in .env must never execute');
  assert.match(r.capturedBuildEnv, /NEXTAUTH_URL=https:\/\/blog\.example\.com/);
  assert.match(r.capturedBuildEnv, /NEXT_PUBLIC_SITE_URL=https:\/\/blog\.example\.com/);
  assert.match(r.capturedBuildEnv, /COMPOSE_PROJECT_NAME=inkforge_prod/);
  assert.match(r.capturedBuildEnv, /HTTP_PROXY=\r?$/m, 'loopback proxy from .env must still be cleared');
});

for (const withEmptyMigrationsDir of [false, true]) {
  test('missing prisma migrations fails immediately without prisma db push (emptyDir=' + withEmptyMigrationsDir + ')', () => {
    const r = deploy(['running healthy'], { withMigrations: false, withEmptyMigrationsDir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Missing Prisma migrations in prisma\/migrations/);
    assert.doesNotMatch(r.calls, /db push/);
    assert.doesNotMatch(r.calls, /up -d/);
  });
}

test('deploy.yml enforces RESOLVED_SHA, safe newline append, DEPLOY_KNOWN_HOSTS, and delayed current cutover', () => {
  const workflow = fs.readFileSync(path.join(project, '.github/workflows/deploy.yml'), 'utf8');
  assert.doesNotMatch(workflow, /\$\{\{\s*github\.sha\s*\}\}/, 'github.sha must not be used for release paths or summary');
  assert.match(workflow, /RESOLVED_SHA="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /echo "RESOLVED_SHA=\$\{RESOLVED_SHA\}" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /\[ -z "\$\(tail -c 1 app\.env\)" \] \|\| printf '\\n' >> app\.env/);
  assert.doesNotMatch(workflow, /\bsource\s+app\.env\b/);
  assert.doesNotMatch(workflow, /\bssh-keyscan\b/);
  assert.match(workflow, /Missing DEPLOY_KNOWN_HOSTS secret/);

  const remoteRunIndex = workflow.indexOf('bash scripts/deploy/deploy-remote.sh');
  const currentLinkIndex = workflow.indexOf('ln -sfn "${DEPLOY_PATH}/releases/${RESOLVED_SHA}" "${DEPLOY_PATH}/current"');
  assert.ok(remoteRunIndex > -1 && currentLinkIndex > remoteRunIndex, 'current symlink must only switch after deploy-remote.sh succeeds');

  const deployScript = fs.readFileSync(path.join(project, 'scripts/deploy/deploy-remote.sh'), 'utf8');
  assert.doesNotMatch(deployScript, /\bsource\s+\.env\b/);
  assert.doesNotMatch(deployScript, /prisma db push/);
});

function createDrillEnvironment() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkforge-recovery-drill-'));
  const bin = path.join(root, 'bin');
  const sharedDir = path.join(root, 'shared');
  const releasesDir = path.join(root, 'releases');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(sharedDir, { recursive: true });
  fs.mkdirSync(releasesDir, { recursive: true });

  const oldSha = '1'.repeat(40);
  const newSha = '2'.repeat(40);
  const oldImageId = 'sha256:' + 'a'.repeat(64);
  const newImageId = 'sha256:' + 'b'.repeat(64);

  fs.writeFileSync(
    path.join(sharedDir, '.env'),
    [
      'DATABASE_URL="postgresql://postgres:drill-db-pass!@database:5432/inkforge?schema=public"',
      'AUTH_SECRET="drill-production-auth-secret"',
      'NEXTAUTH_SECRET="drill-production-nextauth-secret"',
      'NEXTAUTH_URL="https://blog.roydust.top"',
      'NEXT_PUBLIC_SITE_URL="https://blog.roydust.top"',
      'COMPOSE_PROJECT_NAME="inkforge"',
    ].join('\n') + '\n',
  );

  for (const sha of [oldSha, newSha]) {
    const rel = path.join(releasesDir, sha);
    fs.mkdirSync(path.join(rel, 'prisma/migrations/20260926_init'), { recursive: true });
    fs.writeFileSync(path.join(rel, 'docker-compose.prod.yml'), 'services:\n  app:\n    image: my-next-app:latest\n');
    fs.copyFileSync(path.join(sharedDir, '.env'), path.join(rel, '.env'));
  }
  fs.writeFileSync(
    path.join(releasesDir, newSha, '.env'),
    fs.readFileSync(path.join(sharedDir, '.env'), 'utf8') + 'CANDIDATE_ONLY_MARKER="new-release-marker"\n',
  );
  fs.writeFileSync(
    path.join(sharedDir, 'last-healthy-release'),
    [
      `RELEASE_SHA=${oldSha}`,
      `IMAGE_ID=${oldImageId}`,
      `LAST_BACKUP_DIR=${asPath(path.join(sharedDir, 'backups'))}`,
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(releasesDir, newSha, 'my-next-app.tar.gz'), 'mock-tarball');

  makeSymlink(path.join(releasesDir, oldSha), path.join(root, 'current'));

  const stateFile = path.join(root, 'daemon-state.json');
  fs.writeFileSync(
    stateFile,
    JSON.stringify({
      containerRunning: true,
      containerExists: true,
      containerImage: oldImageId,
      latestImage: oldImageId,
      loadedTarballImage: newImageId,
      tags: { 'my-next-app:latest': oldImageId },
      healthyImages: [oldImageId],
      failMigrateForImage: '',
    }),
  );

  fs.writeFileSync(path.join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'gzip'), '#!/usr/bin/env bash\ncat "${2:-}"\n', { mode: 0o755 });
  const mockDriver = path.join(root, 'mock-docker.cjs');
  fs.writeFileSync(
    mockDriver,
    `
const fs = require('node:fs');
const path = require('node:path');
const {
  DRILL_ROOT: root,
  READ_DOTENV_CLI: readDotenvCli,
  READINESS_POLICY_MODULE: readinessPolicyModule,
} = process.env;
const stateFile = path.join(root, 'daemon-state.json');
const args = process.argv.slice(2);
const cmd = args.join(' ');
fs.appendFileSync(path.join(root, 'docker-calls.log'), cmd + '\\n');
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));

if (args[0] === 'load') {
  state.latestImage = state.loadedTarballImage;
  state.tags['my-next-app:latest'] = state.loadedTarballImage;
  save();
} else if (cmd === 'image inspect my-next-app:latest --format {{.Id}}') {
  process.stdout.write(state.tags['my-next-app:latest'] + '\\n');
} else if (args[0] === 'image' && args[1] === 'inspect' && args[3] === '--format' && args[4] === '{{.Id}}') {
  const id = state.tags[args[2]];
  if (!id) process.exit(1);
  process.stdout.write(id + '\\n');
} else if (args[0] === 'image' && args[1] === 'inspect') {
  process.exit(0);
} else if (args[0] === 'image' && args[1] === 'ls') {
  const preTags = Object.keys(state.tags).filter((t) => t.startsWith('my-next-app:pre-')).reverse();
  if (preTags.length) process.stdout.write(preTags.join('\\n') + '\\n');
} else if (args[0] === 'image' && args[1] === 'rm') {
  delete state.tags[args[2]];
  save();
} else if (args[0] === 'tag') {
  const resolved = state.tags[args[1]] || args[1];
  state.tags[args[2]] = resolved;
  if (args[2] === 'my-next-app:latest') state.latestImage = resolved;
  save();
} else if (cmd.includes('check-web-readiness.cjs')) {
  const { parseEnvFile } = require(readDotenvCli);
  const { parseWebReadinessConfig } = require(readinessPolicyModule);
  if (!parseWebReadinessConfig(parseEnvFile('.env')).valid) process.exit(1);
  process.stdout.write('Web configuration preflight passed\\n');
} else if (cmd.endsWith('ps -q app')) {
  if (state.containerExists && state.containerRunning) process.stdout.write('app-container-1\\n');
} else if (cmd.endsWith('ps -a -q app')) {
  if (state.containerExists) process.stdout.write('app-container-1\\n');
} else if (args[0] === 'exec') {
  process.stdout.write('PG_VERSION=16\\nDATABASE_URL=postgresql://postgres:drill-db-pass!@database:5432/inkforge\\n');
} else if (args[0] === 'run' && cmd.includes('pg_dump')) {
  process.stdout.write('PGDMP-custom-archive-bytes\\n');
} else if (args[0] === 'run' && cmd.includes('pg_restore')) {
  process.exit(0);
} else if (args[0] === 'stop') {
  state.containerRunning = false;
  save();
} else if (cmd.includes('prisma migrate deploy')) {
  if (state.failMigrateForImage && state.tags['my-next-app:latest'] === state.failMigrateForImage) {
    process.stderr.write('Error: P3009 migrate found failed migrations\\n');
    process.exit(1);
  }
} else if (cmd.includes('up -d --no-build --remove-orphans')) {
  state.containerExists = true;
  state.containerRunning = true;
  state.containerImage = state.tags['my-next-app:latest'];
  save();
} else if (args[0] === 'inspect') {
  const fmt = args[2] || '';
  if (fmt === '{{.Image}}') {
    process.stdout.write(state.containerImage + '\\n');
  } else if (fmt === '{{.State.Running}}') {
    process.stdout.write(String(state.containerRunning) + '\\n');
  } else if (fmt.includes('.State.Health')) {
    if (!state.containerRunning) {
      process.stdout.write('exited \\n');
    } else if (state.healthyImages.includes(state.containerImage)) {
      process.stdout.write('running healthy\\n');
    } else {
      process.stdout.write('running unhealthy\\n');
    }
  }
} else if (cmd.includes('logs --no-color')) {
  process.stdout.write('READINESS FAIL /api/health/ready returned 503\\n');
}
`,
  );
  fs.writeFileSync(
    path.join(bin, 'docker'),
    '#!/usr/bin/env bash\nexec node "$(if command -v cygpath >/dev/null 2>&1; then cygpath -m "$MOCK_DOCKER_JS"; else printf "%s" "$MOCK_DOCKER_JS"; fi)" "$@"\n',
    { mode: 0o755 },
  );

  const runBash = (scriptBody, cwd, extraEnv = {}) => {
    const prefix = process.platform === 'win32'
      ? 'export PATH="$(cygpath -u "$MOCK_BIN"):$PATH"\n'
      : 'export PATH="$MOCK_BIN:$PATH"\n';
    const res = spawnSync(shell, ['-c', prefix + scriptBody], {
      cwd,
      encoding: 'utf8',
      timeout: 20000,
      env: {
        ...process.env,
        MSYS: 'winsymlinks:nativestrict',
        DRILL_ROOT: root,
        MOCK_BIN: asPath(bin),
        MOCK_DOCKER_JS: asPath(mockDriver),
        DEPLOY_SCRIPT: asPath(path.join(project, 'scripts/deploy/deploy-remote.sh')),
        READ_DOTENV_CLI: asPath(path.join(project, 'scripts/deploy/read-dotenv.cjs')),
        READINESS_POLICY_MODULE: asPath(path.join(project, '.generated/web-health/web-readiness-config.js')),
        ...extraEnv,
      },
    });
    if (res.error) throw res.error;
    return res;
  };

  const readState = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const updateState = (patch) => {
    const next = { ...readState(), ...patch };
    fs.writeFileSync(stateFile, JSON.stringify(next));
  };

  return { root, oldSha, newSha, oldImageId, newImageId, releasesDir, sharedDir, runBash, readState, updateState };
}

test('recovery drill (a): migration failure after stopping old container recovers cleanly via pre-* image to running healthy', () => {
  const drill = createDrillEnvironment();
  try {
    drill.updateState({ failMigrateForImage: drill.newImageId });
    const newReleaseDir = path.join(drill.releasesDir, drill.newSha);

    // 1. Deploy new release -> backup stops old container, then prisma migrate deploy fails.
    const failedDeploy = drill.runBash(
      'BACKUP_BEFORE_DEPLOY=1 RELEASE_SHA="$RELEASE_SHA" DEPLOY_PATH="$DEPLOY_PATH" RELEASE_DIR="$RELEASE_DIR" bash "$DEPLOY_SCRIPT"',
      newReleaseDir,
      {
        RELEASE_SHA: drill.newSha,
        DEPLOY_PATH: asPath(drill.root),
        RELEASE_DIR: asPath(newReleaseDir),
      },
    );
    assert.notEqual(failedDeploy.status, 0, 'migration failure must abort deploy');
    const afterFailure = drill.readState();
    assert.equal(afterFailure.containerRunning, false, 'old container was stopped by backup-production.sh');
    assert.equal(
      fs.realpathSync(path.join(drill.root, 'current')),
      fs.realpathSync(path.join(drill.releasesDir, drill.oldSha)),
      'current symlink must remain on previous healthy release when deploy fails',
    );
    assert.ok(
      !fs.readFileSync(path.join(drill.sharedDir, '.env'), 'utf8').includes('CANDIDATE_ONLY_MARKER'),
      'shared/.env must remain untouched when candidate deploy fails',
    );
    assert.ok(
      !fs.readFileSync(path.join(drill.releasesDir, drill.oldSha, '.env'), 'utf8').includes('CANDIDATE_ONLY_MARKER'),
      'previous release .env must remain isolated when candidate deploy fails',
    );
    assert.match(
      fs.readFileSync(path.join(drill.sharedDir, 'last-healthy-release'), 'utf8'),
      new RegExp(`RELEASE_SHA=${drill.oldSha}`),
      'last-healthy-release must remain on previous healthy release when deploy fails',
    );
    const backups = fs.readdirSync(path.join(drill.sharedDir, 'backups')).filter((f) => f.endsWith('.dump'));
    assert.equal(backups.length, 1, 'pre-deploy database dump must be preserved');

    // 2. Execute p2-recovery-runbook.md recovery flow using retained my-next-app:pre-<sha>-<ts> tag.
    const recovery = drill.runBash(
      `
      set -euo pipefail
      PREV_TAG=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 'my-next-app:pre-*' | head -n 1)
      PREV_IMAGE_ID=$(docker image inspect "$PREV_TAG" --format '{{.Id}}')
      docker tag "$PREV_TAG" my-next-app:latest
      cd "$DEPLOY_PATH/current"
      BACKUP_BEFORE_DEPLOY=0 DEPLOY_PATH="$DEPLOY_PATH" PREBUILT_IMAGE_ID="$PREV_IMAGE_ID" bash "$DEPLOY_SCRIPT"
      `,
      drill.root,
      { DEPLOY_PATH: asPath(drill.root) },
    );
    assert.equal(recovery.status, 0, recovery.stderr);
    assert.match(recovery.stdout, /Reusing previously validated image for release recovery/);
    assert.match(recovery.stdout, /Deployment succeeded: app is healthy/);

    const afterRecovery = drill.readState();
    assert.equal(afterRecovery.containerRunning, true);
    assert.equal(afterRecovery.containerImage, drill.oldImageId);
    assert.ok(afterRecovery.healthyImages.includes(afterRecovery.containerImage), '/api/health/ready must be passing');
  } finally {
    fs.rmSync(drill.root, { recursive: true, force: true });
  }
});

test('recovery drill (b): readiness probe failure (running unhealthy) recovers cleanly via pre-* image and prunes >5 artifacts on healthy cutover', () => {
  const drill = createDrillEnvironment();
  try {
    // Seed 6 older releases, 6 older dumps, and 6 older pre-* tags to also verify 5-item retention on healthy deploy.
    for (let i = 1; i <= 6; i += 1) {
      const sha = String(i + 2).repeat(40);
      const dirPath = path.join(drill.releasesDir, sha);
      fs.mkdirSync(dirPath, { recursive: true });
      const ts = new Date(Date.UTC(2026, 9, i, 0, 0, 0));
      fs.utimesSync(dirPath, ts, ts);
    }
    const oldRelTs = new Date(Date.UTC(2026, 10, 10, 0, 0, 0));
    const newRelTs = new Date(Date.UTC(2026, 10, 11, 0, 0, 0));
    fs.utimesSync(path.join(drill.releasesDir, drill.oldSha), oldRelTs, oldRelTs);
    fs.utimesSync(path.join(drill.releasesDir, drill.newSha), newRelTs, newRelTs);

    const newReleaseDir = path.join(drill.releasesDir, drill.newSha);

    // 1. Deploy new release -> migrations pass, new container starts but fails /api/health/ready (running unhealthy).
    const failedDeploy = drill.runBash(
      'BACKUP_BEFORE_DEPLOY=1 RELEASE_SHA="$RELEASE_SHA" DEPLOY_PATH="$DEPLOY_PATH" RELEASE_DIR="$RELEASE_DIR" bash "$DEPLOY_SCRIPT"',
      newReleaseDir,
      {
        RELEASE_SHA: drill.newSha,
        DEPLOY_PATH: asPath(drill.root),
        RELEASE_DIR: asPath(newReleaseDir),
      },
    );
    assert.equal(failedDeploy.status, 1);
    assert.match(failedDeploy.stderr, /app status: running; health: unhealthy/);
    assert.match(failedDeploy.stderr, /readiness check failed/);
    assert.equal(
      fs.realpathSync(path.join(drill.root, 'current')),
      fs.realpathSync(path.join(drill.releasesDir, drill.oldSha)),
      'current symlink must NOT switch to unhealthy release',
    );

    // 2. Operator stops unhealthy container, retags retained my-next-app:pre-* image, and reruns deploy-remote.sh from current.
    const recovery = drill.runBash(
      `
      set -euo pipefail
      docker stop app-container-1
      PREV_TAG=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 'my-next-app:pre-*' | head -n 1)
      PREV_IMAGE_ID=$(docker image inspect "$PREV_TAG" --format '{{.Id}}')
      docker tag "$PREV_TAG" my-next-app:latest
      cd "$DEPLOY_PATH/current"
      BACKUP_BEFORE_DEPLOY=0 DEPLOY_PATH="$DEPLOY_PATH" PREBUILT_IMAGE_ID="$PREV_IMAGE_ID" bash "$DEPLOY_SCRIPT"
      `,
      drill.root,
      { DEPLOY_PATH: asPath(drill.root) },
    );
    assert.equal(recovery.status, 0, recovery.stderr);
    assert.match(recovery.stdout, /Deployment succeeded: app is healthy/);

    const afterRecovery = drill.readState();
    assert.equal(afterRecovery.containerRunning, true);
    assert.equal(afterRecovery.containerImage, drill.oldImageId);
    assert.equal(
      fs.realpathSync(path.join(drill.root, 'current')),
      fs.realpathSync(path.join(drill.releasesDir, drill.oldSha)),
    );

    const remainingReleases = fs.readdirSync(drill.releasesDir);
    assert.equal(remainingReleases.length, 5, 'only newest 5 release directories must be retained');
    assert.ok(remainingReleases.includes(drill.oldSha), 'active current release must never be deleted');
  } finally {
    fs.rmSync(drill.root, { recursive: true, force: true });
  }
});

test('healthy release cutover updates current symlink after health gate and enforces 5-item retention across releases, backups, and pre-* tags', () => {
  const drill = createDrillEnvironment();
  try {
    const seededTags = { 'my-next-app:latest': drill.oldImageId };
    const backupDir = path.join(drill.sharedDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    for (let i = 1; i <= 6; i += 1) {
      const sha = String(i + 2).repeat(40);
      const relPath = path.join(drill.releasesDir, sha);
      fs.mkdirSync(relPath, { recursive: true });
      const ts = new Date(Date.UTC(2026, 9, i, 0, 0, 0));
      fs.utimesSync(relPath, ts, ts);

      const stamp = `2026100${i}T000000Z`;
      const dumpFile = path.join(backupDir, `pre-${sha}-${stamp}.dump`);
      fs.writeFileSync(dumpFile, 'old-dump-' + i);
      fs.utimesSync(dumpFile, ts, ts);
      seededTags[`my-next-app:pre-${sha}-${stamp}`] = drill.oldImageId;
    }
    const oldRelTs = new Date(Date.UTC(2026, 10, 10, 0, 0, 0));
    const newRelTs = new Date(Date.UTC(2026, 10, 11, 0, 0, 0));
    fs.utimesSync(path.join(drill.releasesDir, drill.oldSha), oldRelTs, oldRelTs);
    fs.utimesSync(path.join(drill.releasesDir, drill.newSha), newRelTs, newRelTs);

    drill.updateState({
      healthyImages: [drill.oldImageId, drill.newImageId],
      tags: seededTags,
    });

    const newReleaseDir = path.join(drill.releasesDir, drill.newSha);
    const okDeploy = drill.runBash(
      'BACKUP_BEFORE_DEPLOY=1 RELEASE_SHA="$RELEASE_SHA" DEPLOY_PATH="$DEPLOY_PATH" RELEASE_DIR="$RELEASE_DIR" bash "$DEPLOY_SCRIPT"',
      newReleaseDir,
      {
        RELEASE_SHA: drill.newSha,
        DEPLOY_PATH: asPath(drill.root),
        RELEASE_DIR: asPath(newReleaseDir),
      },
    );
    assert.equal(okDeploy.status, 0, okDeploy.stderr);
    assert.match(okDeploy.stdout, /Deployment succeeded: app is healthy/);
    assert.equal(
      fs.realpathSync(path.join(drill.root, 'current')),
      fs.realpathSync(newReleaseDir),
      'current symlink must switch to new release after healthy check passes',
    );
    assert.match(
      fs.readFileSync(path.join(drill.sharedDir, '.env'), 'utf8'),
      /CANDIDATE_ONLY_MARKER="new-release-marker"/,
      'shared/.env must update from candidate .env after healthy check passes',
    );
    const healthyMeta = fs.readFileSync(path.join(drill.sharedDir, 'last-healthy-release'), 'utf8');
    assert.match(healthyMeta, new RegExp(`^RELEASE_SHA=${drill.newSha}$`, 'm'));
    assert.match(healthyMeta, new RegExp(`^IMAGE_ID=${drill.newImageId}$`, 'm'));
    assert.match(healthyMeta, /^LAST_BACKUP_DIR=.*\/shared\/backups$/m);

    const remainingReleases = fs.readdirSync(drill.releasesDir);
    assert.equal(remainingReleases.length, 5);
    assert.ok(remainingReleases.includes(drill.newSha));
    assert.ok(remainingReleases.includes(drill.oldSha));

    const remainingDumps = fs.readdirSync(backupDir).filter((f) => f.endsWith('.dump'));
    assert.equal(remainingDumps.length, 5);

    const finalState = drill.readState();
    const remainingPreTags = Object.keys(finalState.tags).filter((t) => t.startsWith('my-next-app:pre-'));
    assert.equal(remainingPreTags.length, 5);
  } finally {
    fs.rmSync(drill.root, { recursive: true, force: true });
  }
});
