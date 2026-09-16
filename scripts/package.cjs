const path = require('node:path');
const { spawnSync } = require('node:child_process');
const env = { ...process.env };
// Some managed terminals omit Windows PowerShell from PATH; electron-builder uses it.
if (process.platform === 'win32') {
  const key = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'Path';
  const system = env.SystemRoot || 'C:\\Windows';
  env[key] = [path.join(system, 'System32', 'WindowsPowerShell', 'v1.0'), path.join(system, 'System32'), env[key] || ''].join(path.delimiter);
}
const result = spawnSync(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), '--win', 'portable'], { env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
