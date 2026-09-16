const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('widget moves, resizes, has no label, and restores geometry', async () => {
  const dir = path.join(root, 'test-results', `geometry-${Date.now()}`);
  const launch = () => electron.launch({ args: [root], env: { ...process.env, BREW_TEST: '1', BREW_DATA_DIR: dir } });
  let app = await launch();
  const widgetPage = async () => {
    for (let i = 0; i < 70; i++) { const page = app.windows().find(w => w.url().includes('view=widget')); if (page) { await page.getByRole('button', { name: 'Open tasks' }).waitFor(); return page; } await new Promise(r => setTimeout(r, 100)); }
    throw new Error('No widget');
  };
  try {
    let page = await widgetPage();
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=widget')); w.setPosition(100, 100); w.show(); });
    await expect(page.getByText('Toffee', { exact: true })).toHaveCount(0);
    const original = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=widget')).getBounds());
    await page.getByRole('button', { name: 'Open tasks' }).focus();
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Resize drink' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await page.evaluate(() => window.brew.getState())).settings.widgetSize).toBe(202);
    const resized = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('view=widget')).getBounds());
    // Exercise the pointer gesture IPC with deterministic global cursor positions.
    await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: 300, y: 300 }); });
    await page.evaluate(() => window.brew.gesture('begin', 'move'));
    await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: 340, y: 280 }); });
    await page.evaluate(async () => { await window.brew.gesture('update'); await window.brew.gesture('end'); });
    const moved = await page.evaluate(() => window.brew.getState());
    expect(Math.abs(moved.position.x - (resized.x + 40))).toBeLessThanOrEqual(2);
    expect(Math.abs(moved.position.y - (resized.y - 20))).toBeLessThanOrEqual(2);
    await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: 300, y: 300 }); });
    await page.evaluate(() => window.brew.gesture('begin', 'resize'));
    await app.evaluate(({ screen }) => { screen.getCursorScreenPoint = () => ({ x: 350, y: 350 }); });
    await page.evaluate(async () => { await window.brew.gesture('update'); await window.brew.gesture('end'); });
    const saved = await page.evaluate(() => window.brew.getState());
    expect(saved.settings.widgetSize).toBe(252);
    await app.close(); app = await launch(); page = await widgetPage();
    const content = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    // Native bounds include platform/DPI adjustments; validate actual growth and no restart drift.
    expect(content.width).toBeGreaterThan(original.width + 40);
    expect((await page.evaluate(() => window.brew.getState())).settings.widgetSize).toBe(252);
    // Startup keeps the whole resized cup on its display.
    expect((await page.evaluate(() => window.brew.getState())).position).toEqual(saved.position);
    await app.close(); app = await launch(); page = await widgetPage();
    const second = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(second).toEqual(content);
    expect((await page.evaluate(() => window.brew.getState())).settings.widgetSize).toBe(252);
  } finally { await app.close(); }
});
