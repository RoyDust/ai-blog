const fs = require('node:fs');
const { parse } = require('dotenv');
const { isPlaceholderAuthSecret } = require('../.generated/web-health/auth-secret.js');
const { parseWebReadinessConfig } = require('../.generated/web-health/web-readiness-config.js');

try {
  const file = process.argv[2];
  if (!file) throw new Error();
  const source = fs.readFileSync(file, 'utf8');
  // Validate only the supplied production file, never inherited CI test defaults.
  const env = parse(source);
  const additions = [];
  let normalized = false;
  if (env.NEXTAUTH_SECRET === '${AUTH_SECRET}') env.NEXTAUTH_SECRET = env.AUTH_SECRET;
  if ((!env.NEXTAUTH_SECRET?.trim() || isPlaceholderAuthSecret(env.NEXTAUTH_SECRET)) &&
      env.AUTH_SECRET?.trim() && !isPlaceholderAuthSecret(env.AUTH_SECRET)) {
    env.NEXTAUTH_SECRET = env.AUTH_SECRET;
    // Both Bash source and Compose resolve this alias without rewriting AUTH_SECRET.
    additions.push('NEXTAUTH_SECRET="${AUTH_SECRET}"');
    normalized = true;
  }
  const project = process.env.DEPLOY_COMPOSE_PROJECT_NAME?.trim() || env.COMPOSE_PROJECT_NAME?.trim();
  if (!project || !/^[a-z0-9][a-z0-9_-]*$/.test(project)) {
    console.error('Production preflight failed: COMPOSE_PROJECT_NAME is missing or invalid');
    process.exitCode = 1;
  } else if (!parseWebReadinessConfig(env).valid) {
    console.error('Production preflight failed: required Web configuration is invalid');
    process.exitCode = 1;
  } else {
    if (env.COMPOSE_PROJECT_NAME !== project) additions.push('COMPOSE_PROJECT_NAME=' + project);
    if (additions.length) fs.appendFileSync(file, '\n' + additions.join('\n') + '\n');
    if (normalized) console.log('NEXTAUTH_SECRET aligned with existing AUTH_SECRET');
    console.log('Production environment preflight passed');
  }
} catch {
  console.error('Production environment preflight could not read or validate configuration');
  process.exitCode = 1;
}
