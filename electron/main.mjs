import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerMonitor, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyAction, takeDueReminders } from './domain.mjs';
import { readState, writeState } from './storage.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, '../dist/index.html');
const testMode = process.env.BREW_TEST === '1';
if (process.env.BREW_DATA_DIR) app.setPath('userData', process.env.BREW_DATA_DIR);
else if (!app.isPackaged) app.setPath('userData', path.join(here, '../.daily-brew-dev'));
// Retain the original data directory so the rename preserves existing tasks.
else app.setPath('userData', path.join(app.getPath('appData'), 'Daily Brew'));
app.setAppUserModelId('com.toffee.desktop');
let widget, panel, toast, tray, state, dataFile, interval, moveTimer, toastTimer, toastId, gesture, widgetSize;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { widget?.show(); openPanel(); });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Toffee', error.message); app.quit(); });
}
function broadcast() { for (const w of [widget, panel, toast]) if (w && !w.isDestroyed()) w.webContents.send('brew:state', state); }
function commit(next) { writeState(dataFile, next); state = next; broadcast(); }
function safeBounds(point, width, height) {
  const area = screen.getDisplayNearestPoint(point).workArea;
  return { x: Math.round(Math.max(area.x, Math.min(point.x, area.x + area.width - width))), y: Math.round(Math.max(area.y, Math.min(point.y, area.y + area.height - height))), width: Math.min(width, area.width), height: Math.min(height, area.height) };
}
function positionPanel() {
  if (!widget || !panel) return;
  const b = widget.getBounds(), area = screen.getDisplayMatching(b).workArea;
  const width = 400, height = Math.min(650, area.height - 24);
  const x = b.x - width - 8 >= area.x ? b.x - width - 8 : b.x + b.width + 8;
  panel.setBounds(safeBounds({ x, y: b.y + b.height - height }, width, height));
}
function openPanel(inactive = false) {
  if (!panel) return;
  positionPanel();
  if (inactive) { panel.setAlwaysOnTop(true); panel.showInactive(); }
  else { panel.setAlwaysOnTop(state.settings.alwaysOnTop); panel.show(); panel.focus(); }
}
function secureWindow(options) {
  const w = new BrowserWindow({ show: false, icon: path.join(here, '../dist/assets/app-icon.png'), frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, ...options, webPreferences: { preload: path.join(here, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', event => event.preventDefault());
  w.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(false));
  w.on('close', event => { if (!app.isQuitting) { event.preventDefault(); w.hide(); } });
  return w;
}
function showReminder() {
  const id = state.pending[0];
  if (!id) { toast.hide(); clearTimeout(toastTimer); toastId = null; return; }
  if (toastId === id && toast.isVisible()) return;
  toastId = id;
  const area = screen.getDisplayMatching(widget.getBounds()).workArea;
  toast.setBounds({ x: area.x + area.width - 352, y: area.y + area.height - 192, width: 340, height: 180 });
  toast.showInactive();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { try { commit(applyAction(state, { type: 'dismiss', id })); showReminder(); } catch (e) { console.error(e); } }, 30000);
}
function saveGeometry() {
  const b = widget.getBounds();
  // Persist the requested size, not DPI-rounded OS bounds, to avoid growth on each restart.
  commit(applyAction(state, { type: 'geometry', x: b.x, y: b.y, size: widgetSize }));
}
function checkReminders() {
  const result = takeDueReminders(state);
  if (!result.due.length) return;
  try { commit(result.state); } catch (e) { console.error('Reminder save failed:', e.message); return; }
  showReminder();
}
function authorized(event) {
  if (![widget?.webContents, panel?.webContents, toast?.webContents].includes(event.sender) || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith(pathToFileURL(entry).href)) throw new Error('Untrusted request.');
}
async function start() {
  dataFile = path.join(app.getPath('userData'), 'daily-brew.json');
  // Never overwrite unreadable user data with an empty state.
  try { state = readState(dataFile); } catch { throw new Error(`Could not read saved data. Your files have been preserved. Check ${dataFile} and its .backup file.`); }
  const area = screen.getPrimaryDisplay().workArea;
  const position = state.position || { x: area.x + area.width - 232, y: area.y + area.height - 238 };
  widgetSize = state.settings.widgetSize;
  widget = secureWindow({ ...safeBounds(position, widgetSize, widgetSize), useContentSize: true, alwaysOnTop: state.settings.alwaysOnTop });
  panel = secureWindow({ width: 400, height: 650, alwaysOnTop: state.settings.alwaysOnTop });
  toast = secureWindow({ width: 340, height: 180, alwaysOnTop: true });
  widget.on('move', () => { positionPanel(); clearTimeout(moveTimer); moveTimer = setTimeout(() => { try { saveGeometry(); } catch (e) { console.error(e); } }, 300); });
  for (const event of ['display-removed', 'display-metrics-changed']) screen.on(event, () => { const b = widget.getBounds(); widget.setBounds(safeBounds(b, b.width, b.height)); positionPanel(); });
  ipcMain.handle('brew:get', event => { authorized(event); return state; });
  ipcMain.handle('brew:action', (event, action) => {
    authorized(event);
    if (['position', 'geometry'].includes(action.type)) throw new Error('Position is managed by the app.');
    const next = applyAction(state, action);
    if (action.type === 'settings' && action.key === 'startAtLogin') {
      if (!app.isPackaged) throw new Error('Startup is available in the packaged app.');
      app.setLoginItemSettings({ openAtLogin: action.value, path: process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe') });
    }
    commit(next);
    widget.setAlwaysOnTop(state.settings.alwaysOnTop);
    panel.setAlwaysOnTop(state.settings.alwaysOnTop);
    if (toast.isVisible()) showReminder();
    return state;
  });
  ipcMain.handle('brew:gesture', (event, phase, mode) => {
    authorized(event);
    if (event.sender !== widget.webContents) throw new Error('Only the widget can move itself.');
    if (phase === 'begin' && ['move', 'resize'].includes(mode)) gesture = { mode, start: screen.getCursorScreenPoint(), bounds: widget.getBounds(), size: widgetSize };
    else if (phase === 'update' && gesture) {
      const cursor = screen.getCursorScreenPoint(), dx = cursor.x - gesture.start.x, dy = cursor.y - gesture.start.y, b = gesture.bounds;
      if (gesture.mode === 'move') widget.setPosition(Math.round(b.x + dx), Math.round(b.y + dy));
      else { widgetSize = Math.max(110, Math.min(380, Math.round(gesture.size + Math.max(dx, dy)))); widget.setContentSize(widgetSize, widgetSize); }
    } else if (phase === 'end') { gesture = null; clearTimeout(moveTimer); saveGeometry(); }
  });
  ipcMain.handle('brew:nudge', (event, x, y, size) => {
    authorized(event);
    if (event.sender !== widget.webContents || ![x, y, size].every(n => Number.isFinite(n) && Math.abs(n) <= 20)) throw new Error('Invalid movement.');
    const b = widget.getBounds(); widgetSize = Math.max(110, Math.min(380, widgetSize + size));
    widget.setPosition(b.x + x, b.y + y); if (size) widget.setContentSize(widgetSize, widgetSize); saveGeometry();
  });
  ipcMain.handle('brew:panel', event => { authorized(event); panel.isVisible() ? panel.hide() : openPanel(); });
  ipcMain.handle('brew:hide', event => { authorized(event); panel.hide(); });
  ipcMain.handle('brew:export', async event => {
    authorized(event);
    const result = await dialog.showSaveDialog(panel, { defaultPath: 'daily-brew-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!result.canceled && result.filePath) { fs.writeFileSync(result.filePath, JSON.stringify(state, null, 2)); return true; }
    return false;
  });
  const sprite = nativeImage.createFromPath(path.join(here, '../dist/assets/drinks.png'));
  const size = sprite.getSize();
  const icon = sprite.isEmpty() ? nativeImage.createEmpty() : sprite.crop({ x: 0, y: 0, width: Math.floor(size.width / 3), height: size.height }).resize({ width: 24, height: 24 });
  tray = new Tray(icon);
  tray.setToolTip('Toffee');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Toffee', click: () => { widget.show(); openPanel(); } },
    { label: 'Show / hide cup', click: () => widget.isVisible() ? widget.hide() : widget.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', () => { widget.show(); openPanel(); });
  await Promise.all([widget.loadFile(entry, { query: { view: 'widget' } }), panel.loadFile(entry, { query: { view: 'panel' } }), toast.loadFile(entry, { query: { view: 'reminder' } })]);
  if (!testMode) { widget.showInactive(); if (!state.tasks.length && !state.notes) openPanel(); }
  if (state.pending.length && !testMode) showReminder();
  interval = setInterval(checkReminders, 10000);
  powerMonitor.on('resume', checkReminders);
  if (!testMode) checkReminders();
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { app.isQuitting = true; clearInterval(interval); clearTimeout(moveTimer); clearTimeout(toastTimer); });
