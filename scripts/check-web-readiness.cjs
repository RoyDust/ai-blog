const { getWebReadinessConfig } = require('../.generated/web-health/web-readiness-config.js');
try {
  if (!getWebReadinessConfig().valid) throw new Error('invalid configuration');
  console.log('Web configuration preflight passed');
} catch {
  console.error('Web configuration preflight failed');
  process.exitCode = 1;
}
