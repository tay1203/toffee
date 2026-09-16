export function emptyState() {
  return { version: 1, tasks: [], notes: '', pending: [], settings: { drink: 'espresso', alwaysOnTop: true, startAtLogin: false, reduceMotion: false, widgetSize: 192 }, position: null };
}
const drinks = ['espresso', 'latte', 'matcha'];
const minutes = [null, 0, 10, 30, 60];
function date(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
export function validateState(s) {
  if (!s || s.version !== 1 || !Array.isArray(s.tasks) || s.tasks.length > 10000 || typeof s.notes !== 'string' || s.notes.length > 200000 || !Array.isArray(s.pending)) throw new Error('Invalid data file.');
  const ids = new Set();
  for (const t of s.tasks) {
    if (typeof t.id !== 'string' || ids.has(t.id) || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 200 || !date(t.createdAt) || !minutes.includes(t.remindMinutes)) throw new Error('Invalid task.');
    for (const field of ['dueAt', 'completedAt', 'notifiedAt', 'snoozedUntil']) if (t[field] !== null && !date(t[field])) throw new Error('Invalid task date.');
    ids.add(t.id);
  }
  if (s.pending.some(id => !ids.has(id)) || new Set(s.pending).size !== s.pending.length) throw new Error('Invalid reminder queue.');
  if (!s.settings || !drinks.includes(s.settings.drink) || ['alwaysOnTop', 'startAtLogin', 'reduceMotion'].some(k => typeof s.settings[k] !== 'boolean')) throw new Error('Invalid settings.');
  if (s.settings.widgetSize === undefined) s.settings.widgetSize = 192;
  if (!Number.isInteger(s.settings.widgetSize) || s.settings.widgetSize < 110 || s.settings.widgetSize > 380) throw new Error('Invalid widget size.');
  if (s.position !== null && (!s.position || !Number.isFinite(s.position.x) || !Number.isFinite(s.position.y))) throw new Error('Invalid position.');
  return s;
}
export function applyAction(current, action, now = new Date().toISOString(), id = globalThis.crypto.randomUUID()) {
  const s = structuredClone(current);
  const task = s.tasks.find(t => t.id === action.id);
  switch (action.type) {
    case 'save-task': {
      const title = typeof action.title === 'string' ? action.title.trim() : '';
      if (!title || title.length > 200) throw new Error('Enter a task of up to 200 characters.');
      const dueAt = action.dueAt || null;
      if (dueAt && !date(dueAt)) throw new Error('Choose a valid date and time.');
      const remindMinutes = dueAt ? action.remindMinutes : null;
      if (!minutes.includes(remindMinutes)) throw new Error('Choose a valid reminder.');
      if (action.id && !task) throw new Error('Task no longer exists.');
      if (task) {
        const changed = task.dueAt !== dueAt || task.remindMinutes !== remindMinutes;
        Object.assign(task, { title, dueAt, remindMinutes });
        if (changed) { task.notifiedAt = null; task.snoozedUntil = null; s.pending = s.pending.filter(x => x !== task.id); }
      } else s.tasks.push({ id, title, dueAt, remindMinutes, createdAt: now, completedAt: null, notifiedAt: null, snoozedUntil: null });
      break;
    }
    case 'toggle-task':
      if (!task) throw new Error('Task no longer exists.');
      task.completedAt = task.completedAt ? null : now;
      s.pending = s.pending.filter(x => x !== task.id);
      break;
    case 'delete-task': s.tasks = s.tasks.filter(t => t.id !== action.id); s.pending = s.pending.filter(x => x !== action.id); break;
    case 'notes':
      if (typeof action.value !== 'string' || action.value.length > 200000) throw new Error('Note is too long.');
      s.notes = action.value; break;
    case 'settings':
      if (action.key === 'drink' && drinks.includes(action.value)) s.settings.drink = action.value;
      else if (['alwaysOnTop', 'startAtLogin', 'reduceMotion'].includes(action.key) && typeof action.value === 'boolean') s.settings[action.key] = action.value;
      else throw new Error('Invalid setting.');
      break;
    case 'dismiss': s.pending = s.pending.filter(x => x !== action.id); break;
    case 'snooze':
      if (!task || task.completedAt) throw new Error('Task no longer available.');
      task.snoozedUntil = new Date(Date.parse(now) + 600000).toISOString();
      task.notifiedAt = null;
      s.pending = s.pending.filter(x => x !== task.id); break;
    case 'position': s.position = { x: Math.round(action.x), y: Math.round(action.y) }; break;
    case 'geometry': s.position = { x: Math.round(action.x), y: Math.round(action.y) }; s.settings.widgetSize = action.size; break;
    default: throw new Error('Unknown action.');
  }
  return validateState(s);
}
export function takeDueReminders(current, now = new Date().toISOString()) {
  const s = structuredClone(current), due = [];
  for (const t of s.tasks) {
    if (t.completedAt || t.notifiedAt || s.pending.includes(t.id)) continue;
    const at = t.snoozedUntil || (t.dueAt && t.remindMinutes !== null ? new Date(Date.parse(t.dueAt) - t.remindMinutes * 60000).toISOString() : null);
    if (at && Date.parse(at) <= Date.parse(now)) { t.notifiedAt = now; t.snoozedUntil = null; s.pending.push(t.id); due.push(t.id); }
  }
  return { state: s, due };
}
