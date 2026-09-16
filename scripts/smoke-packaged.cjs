const { _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const dataDir = path.join(root, 'test-results', `packaged-${Date.now()}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const app = await electron.launch({ executablePath: path.join(root, 'release-v0.2/win-unpacked/Toffee.exe'), env: { ...process.env, BREW_TEST: '1', BREW_DATA_DIR: dataDir } });
  try {
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    let panel, widget;
    for (let i = 0; i < 80; i++) {
      panel = app.windows().find(p => p.url().includes('view=panel'));
      widget = app.windows().find(p => p.url().includes('view=widget'));
      if (panel && widget) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(panel && widget, 'Both packaged windows loaded');
    await panel.getByRole('button', { name: 'Add task', exact: true }).waitFor();
    await panel.evaluate(() => window.brew.dispatch({ type: 'save-task', title: 'Packaged smoke test', dueAt: null, remindMinutes: null }));
    await panel.getByRole('button', { name: 'Edit Packaged smoke test' }).waitFor();
    assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'daily-brew.json'))).tasks[0].title, 'Packaged smoke test');
    await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.showInactive(); });
    await widget.evaluate(() => document.fonts.ready);
    await widget.screenshot({ path: path.join(root, 'docs/screenshots/widget.png') });
    console.log('Packaged app passed: both windows, local assets, IPC, and persistent task creation.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
