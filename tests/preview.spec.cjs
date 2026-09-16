const { test, expect, chromium } = require('@playwright/test');
const path = require('node:path');
test('preview layout, offline fonts and menu at desktop and narrow sizes', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1040, height: 790 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:4173');
    await page.getByRole('button', { name: 'Add task', exact: true }).click();
    await page.getByLabel('Task', { exact: true }).fill('Finish the moodboard');
    await page.getByRole('button', { name: 'Save task' }).click();
    await page.getByRole('button', { name: 'Add task', exact: true }).click();
    await page.getByLabel('Task', { exact: true }).fill('Pick up coffee beans');
    await page.getByRole('button', { name: 'Save task' }).click();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "Caveat Brush"'))).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('16px Manrope'))).toBe(true);
    await page.screenshot({ path: path.resolve('test-results/preview-desktop.png') });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: /Iced latte/ }).click();
    await expect(page.getByRole('button', { name: /Iced latte/ })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: path.resolve('test-results/preview-menu.png') });
    await page.setViewportSize({ width: 320, height: 820 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: path.resolve('test-results/preview-narrow.png'), fullPage: true });
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('A saved note');
    await page.getByRole('button', { name: 'Tasks', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Notes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('A saved note');
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
