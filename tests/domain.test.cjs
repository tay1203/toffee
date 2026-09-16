const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const domain = import('../electron/domain.mjs');
const now = '2026-09-17T08:00:00.000Z';
test('existing data gains default size; geometry is validated', async () => {
  const { emptyState, validateState, applyAction } = await domain;
  const old = emptyState(); delete old.settings.widgetSize; old.notes = 'Keep existing note';
  const s = validateState(old); assert.equal(s.settings.widgetSize, 192); assert.equal(s.notes, 'Keep existing note');
  assert.throws(() => applyAction(s, { type: 'geometry', x: 1, y: 2, size: 900 }));
  const next = applyAction(s, { type: 'geometry', x: -150, y: 20, size: 280 });
  assert.equal(next.settings.widgetSize, 280); assert.equal(next.position.x, -150);
});
test('undated tasks never trigger reminders', async () => {
  const { emptyState, applyAction, takeDueReminders } = await domain;
  const s = applyAction(emptyState(), { type: 'save-task', title: 'Coffee', dueAt: null, remindMinutes: 10 }, now, 'a');
  assert.equal(s.tasks[0].remindMinutes, null);
  assert.deepEqual(takeDueReminders(s, now).due, []);
});
test('catch up once after sleep and preserve delivery across reload', async () => {
  const { emptyState, applyAction, takeDueReminders } = await domain;
  const s = applyAction(emptyState(), { type: 'save-task', title: 'Due', dueAt: '2026-09-17T07:00:00Z', remindMinutes: 10 }, now, 'a');
  const first = takeDueReminders(s, now);
  assert.deepEqual(first.due, ['a']);
  assert.deepEqual(takeDueReminders(JSON.parse(JSON.stringify(first.state)), now).due, []);
});
test('snooze re-arms at ten minutes, and completion cancels it', async () => {
  const { emptyState, applyAction, takeDueReminders } = await domain;
  let s = applyAction(emptyState(), { type: 'save-task', title: 'Due', dueAt: now, remindMinutes: 0 }, now, 'a');
  s = takeDueReminders(s, now).state;
  s = applyAction(s, { type: 'snooze', id: 'a' }, now);
  assert.deepEqual(takeDueReminders(s, '2026-09-17T08:09:59Z').due, []);
  assert.deepEqual(takeDueReminders(s, '2026-09-17T08:10:00Z').due, ['a']);
  s = applyAction(s, { type: 'toggle-task', id: 'a' }, now);
  assert.deepEqual(takeDueReminders(s, '2026-09-17T09:00:00Z').due, []);
});
test('editing a deadline re-arms reminder; deleting clears pending', async () => {
  const { emptyState, applyAction, takeDueReminders } = await domain;
  let s = applyAction(emptyState(), { type: 'save-task', title: 'Due', dueAt: now, remindMinutes: 0 }, now, 'a');
  s = takeDueReminders(s, now).state;
  s = applyAction(s, { type: 'save-task', id: 'a', title: 'Later', dueAt: '2026-09-17T09:00:00Z', remindMinutes: 0 }, now);
  assert.deepEqual(s.pending, []);
  assert.equal(s.tasks[0].notifiedAt, null);
  s = takeDueReminders(s, '2026-09-17T09:01:00Z').state;
  s = applyAction(s, { type: 'delete-task', id: 'a' }, now);
  assert.equal(s.tasks.length, 0); assert.equal(s.pending.length, 0);
});
test('reject invalid dates and settings; preserve prior state', async () => {
  const { emptyState, applyAction } = await domain;
  const s = emptyState();
  assert.throws(() => applyAction(s, { type: 'save-task', title: 'x', dueAt: 'garbage', remindMinutes: 0 }));
  assert.throws(() => applyAction(s, { type: 'settings', key: '__proto__', value: {} }));
  assert.equal(s.tasks.length, 0);
});
test('atomic storage round trip, previous backup, corruption preserved', async () => {
  const { readState, writeState } = await import('../electron/storage.mjs');
  const { emptyState } = await domain;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brew-test-'));
  const file = path.join(dir, 'data.json');
  try {
    const s = emptyState(); writeState(file, s); s.notes = 'saved'; writeState(file, s);
    assert.equal(readState(file).notes, 'saved');
    assert.equal(JSON.parse(fs.readFileSync(file + '.backup')).notes, '');
    fs.writeFileSync(file, '{broken'); assert.throws(() => readState(file));
    assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  } finally { fs.rmSync(dir, { recursive: true }); }
});
