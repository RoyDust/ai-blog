// Compile only the shared pure policy and its existing resolvers for the Node 20 image CLI.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.generated/web-health');
fs.mkdirSync(out, { recursive: true });
for (const name of ['web-readiness-config', 'database-url', 'auth-secret']) {
  const source = fs.readFileSync(path.join(root, 'src/lib', name + '.ts'), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  fs.writeFileSync(path.join(out, name + '.js'), result.outputText);
}
