import { emptyState, applyAction, validateState, takeDueReminders } from '../electron/domain.mjs';
import type { State, Bridge } from './types';
export const isDesktop = Boolean(window.brew);
const key = 'daily-brew-preview-v1';
const listeners = new Set<(s: State) => void>();
const reminderListeners = new Set<() => void>();
let memory: State;
function read() { if (!memory) { const saved = localStorage.getItem(key); memory = (saved ? validateState(JSON.parse(saved)) : emptyState()) as State; } return memory; }
function save(s: State) { localStorage.setItem(key, JSON.stringify(s)); memory = s; listeners.forEach(cb => cb(s)); return s; }
const browser: Bridge = {
  gesture: async () => {},
  nudge: async () => {},
  getState: async () => read(),
  dispatch: async action => save(applyAction(read(), action) as State),
  togglePanel: async () => { window.dispatchEvent(new Event('brew-toggle-panel')); },
  hidePanel: async () => { window.dispatchEvent(new Event('brew-toggle-panel')); },
  exportData: async () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(read(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'daily-brew-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
  },
  onState: cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
  onReminder: cb => { reminderListeners.add(cb); return () => { reminderListeners.delete(cb); }; }
};
if (!isDesktop) setInterval(() => { try { const result = takeDueReminders(read()); if (result.due.length) { save(result.state as State); reminderListeners.forEach(cb => cb()); } } catch { /* Loading errors are shown by the app; never replace corrupt data. */ } }, 1000);
export const bridge = window.brew || browser;
