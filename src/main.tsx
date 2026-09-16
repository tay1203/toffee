import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, X, Settings2, Check, ChevronLeft, Trash2, MoveDiagonal2, Pin, Download, Clock3 } from 'lucide-react';
import '@fontsource/caveat-brush/400.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import './styles.css';
import './widget.css';
import { bridge, isDesktop } from './bridge';
import type { Action, Drink, State, Task } from './types';

const drinks: { id: Drink; label: string; number: string }[] = [{ id: 'espresso', label: 'Espresso', number: '01' }, { id: 'latte', label: 'Iced latte', number: '02' }, { id: 'matcha', label: 'Matcha', number: '03' }];
const dateLabel = (value: string) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function localDate(value: string | null) { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function DrinkArt({ drink, className = '' }: { drink: Drink; className?: string }) { return <span aria-hidden="true" className={`drink-art ${drink} ${className}`} />; }
function CupWidget({ state, count }: { state: State; count: number }) {
  const active = useRef<{ x: number; y: number; moved: boolean; mode: string } | null>(null);
  function start(e: React.PointerEvent<HTMLButtonElement>, mode: string) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = { x: e.screenX, y: e.screenY, moved: false, mode };
    void bridge.gesture('begin', mode);
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const a = active.current;
    if (!a) return;
    if (Math.hypot(e.screenX - a.x, e.screenY - a.y) > 4) a.moved = true;
    if (a.moved) void bridge.gesture('update');
  }
  function end(e: React.PointerEvent<HTMLButtonElement>, cancel = false) {
    const a = active.current; active.current = null;
    if (!a) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    void bridge.gesture('end');
    if (!cancel && !a.moved && a.mode === 'move') void bridge.togglePanel();
  }
  function key(e: React.KeyboardEvent, resize = false) {
    const step = e.shiftKey ? 20 : 10;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = directions[e.key]; if (!d) return;
    e.preventDefault(); void bridge.nudge(resize ? 0 : d[0], resize ? 0 : d[1], resize ? d[0] + d[1] : 0);
  }
  return <div className={`widget ${state.settings.reduceMotion ? 'reduced' : ''}`}>
    <button className="cup" aria-label="Open tasks" title="Drag to move · Click to open" onPointerDown={e => start(e, 'move')} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onKeyDown={e => key(e)} onClick={e => { if (e.detail === 0) void bridge.togglePanel(); }}><DrinkArt drink={state.settings.drink} />{count > 0 && <span className="cup-count">{count}</span>}</button>
    <button className="resize-handle" aria-label="Resize drink" title="Drag to resize · Arrow keys adjust size" onPointerDown={e => start(e, 'resize')} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onKeyDown={e => key(e, true)}><MoveDiagonal2 size={15} /></button>
  </div>;
}

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('tasks');
  const [panelOpen, setPanelOpen] = useState(true);
  const [editor, setEditor] = useState<Task | 'new' | null>(null);
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState('');
  const noteDirty = useRef(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRevision = useRef(0);
  const noteValue = useRef('');
  const [notice, setNotice] = useState('');
  const view = new URLSearchParams(location.search).get('view');
  const widgetOnly = view === 'widget';
  const preview = !isDesktop && view !== 'panel';
  useEffect(() => {
    let active = true;
    const update = (s: State) => { if (!active) return; setState(s); if (!noteDirty.current) { setNote(s.notes); noteValue.current = s.notes; } };
    bridge.getState().then(update).catch(e => setError(String(e.message)));
    const off = bridge.onState(update);
    const offReminder = bridge.onReminder(() => { setPanelOpen(true); });
    const toggle = () => setPanelOpen(p => !p);
    window.addEventListener('brew-toggle-panel', toggle);
    return () => { active = false; off(); offReminder(); window.removeEventListener('brew-toggle-panel', toggle); };
  }, []);
  useEffect(() => { document.body.className = widgetOnly ? 'widget-body' : view === 'reminder' ? 'toast-body' : isDesktop || view === 'panel' ? 'panel-body' : 'preview-body'; }, [widgetOnly, view]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (editor) setEditor(null); else void closePanel(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  async function dispatch(action: Action) {
    try { setError(''); const next = await bridge.dispatch(action); setState(next); return true; }
    catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Could not save.'); return false; }
  }
  async function saveNote() {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    if (!noteDirty.current) return true;
    const revision = noteRevision.current;
    const ok = await dispatch({ type: 'notes', value: noteValue.current });
    if (revision === noteRevision.current) { noteDirty.current = !ok; setNoteStatus(ok ? 'Saved' : 'Not saved'); }
    return ok;
  }
  function changeNote(value: string) {
    setNote(value); noteValue.current = value; noteDirty.current = true; noteRevision.current++; setNoteStatus('Saving…');
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => void saveNote(), 400);
  }
  async function closePanel() { if (await saveNote()) await bridge.hidePanel(); }
  async function changePage(next: string) { if (await saveNote()) { setPage(next); setEditor(null); setNotice(''); } }
  if (!state) return <div className="load-state" role="status">{error || 'Loading…'}</div>;
  const openTasks = state.tasks.filter(t => !t.completedAt);
  const visibleTasks = state.tasks.filter(t => filter === 'open' ? !t.completedAt : t.completedAt).sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || b.createdAt.localeCompare(a.createdAt));
  const pending = state.pending.map(id => state.tasks.find(t => t.id === id)).filter((t): t is Task => Boolean(t && !t.completedAt));
  const cup = <CupWidget state={state} count={openTasks.length} />;
  if (widgetOnly) return cup;
  if (view === 'reminder') return pending[0] ? <section className="toast" aria-label="Task reminder"><div className="toast-heading"><Clock3 size={14}/><span>Reminder{pending.length > 1 ? ` · ${pending.length}` : ''}</span><button className="icon-button" aria-label="Dismiss reminder" onClick={() => void dispatch({ type: 'dismiss', id: pending[0].id })}><X size={15}/></button></div><p className="toast-title" title={pending[0].title}>{pending[0].title}</p><div className="toast-actions"><button className="primary small" onClick={() => void dispatch({ type: 'toggle-task', id: pending[0].id })}>Done</button><button className="quiet small" onClick={() => void dispatch({ type: 'snooze', id: pending[0].id })}>Snooze 10 min</button></div>{error && <span role="alert">{error}</span>}</section> : null;
  return <main className={preview ? 'desktop-preview' : 'desktop-panel'} data-reduced-motion={state.settings.reduceMotion}>
    {preview && <div className="preview-widget">{cup}</div>}
    {(!preview || panelOpen) && <section className="receipt" aria-label="Toffee">
      <header className="panel-header"><span className="wordmark">Toffee</span><div className="header-actions"><button className={`icon-button ${page === 'settings' ? 'active' : ''}`} aria-label="Settings" onClick={() => void changePage(page === 'settings' ? 'tasks' : 'settings')}><Settings2 size={17} /></button><button className="icon-button" aria-label="Close panel" onClick={() => void closePanel()}><X size={18} /></button></div></header>
      <div className="receipt-rule" />
      <nav aria-label="Main navigation">{['tasks', 'notes', 'menu'].map(p => <button key={p} onClick={() => void changePage(p)} aria-current={page === p ? 'page' : undefined}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>)}</nav>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="panel-content">
        {pending.length > 0 && <section className="reminder" aria-label="Task reminder"><div className="reminder-top"><span><Clock3 size={13} />{pending[0].dueAt && Date.parse(pending[0].dueAt) <= Date.now() ? 'Due' : 'Coming up'}</span><button className="icon-button" aria-label="Dismiss reminder" onClick={() => void dispatch({ type: 'dismiss', id: pending[0].id })}><X size={14} /></button></div><h2>{pending[0].title}</h2><p>{pending[0].dueAt ? dateLabel(pending[0].dueAt) : ''}{pending.length > 1 ? ` · +${pending.length - 1} more` : ''}</p><div className="reminder-actions"><button className="primary small" onClick={() => void dispatch({ type: 'toggle-task', id: pending[0].id })}>Done</button><button className="quiet small" onClick={() => void dispatch({ type: 'snooze', id: pending[0].id })}>Snooze 10 min</button></div></section>}
        {page === 'tasks' && <>
          {editor ? <TaskEditor task={editor} cancel={() => setEditor(null)} save={async data => { if (await dispatch(data)) setEditor(null); }} /> : <>
            <div className="section-heading"><h1>Tasks <span>{openTasks.length.toString().padStart(2, '0')}</span></h1><button className="text-button" onClick={() => { setFilter(filter === 'open' ? 'done' : 'open'); setConfirmDelete(null); }}>{filter === 'open' ? 'Completed' : 'Back to tasks'}</button></div>
            {visibleTasks.length === 0 && <div className="empty"><span className="empty-circle"><Check size={19} strokeWidth={1.4} /></span><p>{filter === 'open' ? 'No tasks' : 'No completed tasks'}</p></div>}
            <div className="task-list">{visibleTasks.map(task => <article className={`task-row ${task.completedAt ? 'completed' : ''}`} key={task.id}>
              <button className="checkbox" aria-label={`${task.completedAt ? 'Reopen' : 'Complete'} ${task.title}`} aria-pressed={Boolean(task.completedAt)} onClick={() => void dispatch({ type: 'toggle-task', id: task.id })}>{task.completedAt && <Check size={13} />}</button>
              <button className="task-text" onClick={() => setEditor(task)} aria-label={`Edit ${task.title}`}><span>{task.title}</span><small className={!task.completedAt && task.dueAt && Date.parse(task.dueAt) < Date.now() ? 'overdue' : ''}>{task.dueAt ? dateLabel(task.dueAt) : 'No date'}{task.snoozedUntil ? ' · Snoozed' : ''}</small></button>
              <button className="icon-button delete" aria-label={`Delete ${task.title}`} onClick={() => setConfirmDelete(confirmDelete === task.id ? null : task.id)}><Trash2 size={14} /></button>
              {confirmDelete === task.id && <div className="delete-confirm"><span>Delete task?</span><button className="text-button" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="text-button danger" onClick={() => { void dispatch({ type: 'delete-task', id: task.id }); setConfirmDelete(null); }}>Delete</button></div>}
            </article>)}</div>
            <button className="add-task" onClick={() => setEditor('new')}><Plus size={16} />Add task</button>
          </>}
        </>}
        {page === 'notes' && <section className="notes"><div className="section-heading"><h1>Notes</h1><span className="save-status" role="status">{noteStatus}</span></div><textarea aria-label="Notes" placeholder="Write a note…" value={note} maxLength={200000} onChange={e => changeNote(e.target.value)} onBlur={() => void saveNote()} /><div className="notes-footer"><span>{note.length.toLocaleString()} characters</span><button className="text-button" onClick={() => void saveNote()}>Save</button></div></section>}
        {page === 'menu' && <section className="menu"><div className="section-heading"><h1>Menu</h1><span className="eyebrow">03 DRINKS</span></div><div className="drink-options">{drinks.map(drink => <button className={`drink-option ${state.settings.drink === drink.id ? 'selected' : ''}`} key={drink.id} aria-pressed={state.settings.drink === drink.id} onClick={() => void dispatch({ type: 'settings', key: 'drink', value: drink.id })}><span className="drink-number">{drink.number}</span><DrinkArt drink={drink.id} /><span className="drink-name">{drink.label}</span><span className="selection-dot">{state.settings.drink === drink.id && <Check size={12} />}</span></button>)}</div></section>}
        {page === 'settings' && <section className="settings"><div className="section-heading"><h1>Settings</h1></div>{([{ key: 'alwaysOnTop', label: 'Keep on top' }, { key: 'startAtLogin', label: 'Start with Windows' }, { key: 'reduceMotion', label: 'Reduce motion' }] as const).map(item => <label className="setting-row" key={item.key}><span>{item.label}</span><input type="checkbox" role="switch" checked={state.settings[item.key]} disabled={!isDesktop && item.key !== 'reduceMotion'} onChange={e => void dispatch({ type: 'settings', key: item.key, value: e.target.checked })} /></label>)}<button className="export" onClick={async () => { try { if (await bridge.exportData()) setNotice('Backup exported'); } catch { setError('Could not export backup.'); } }}><Download size={16} />Export backup</button><p className="settings-detail">{isDesktop ? 'Saved on this device' : 'Browser preview · saved in this browser'}</p><p className="settings-detail">{isDesktop ? 'Quit from the tray menu' : 'Desktop controls are available in the app'}</p><span role="status" className="save-status">{notice}</span></section>}
      </div>
      <footer className="panel-footer"><span className="footer-dot" />{drinks.find(d => d.id === state.settings.drink)?.label}<span className="footer-right">{isDesktop ? <Pin size={12} /> : 'PREVIEW'}</span></footer>
    </section>}
  </main>;
}
function TaskEditor({ task, cancel, save }: { task: Task | 'new'; cancel(): void; save(action: Action): Promise<void> }) {
  const editing = task !== 'new';
  const [title, setTitle] = useState(editing ? task.title : '');
  const [due, setDue] = useState(editing ? localDate(task.dueAt) : '');
  const [reminder, setReminder] = useState(editing && task.remindMinutes !== null ? String(task.remindMinutes) : 'none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <form className="task-editor" onSubmit={async e => { e.preventDefault(); if (saving) return; const parsed = due ? new Date(due) : null; if (parsed && !Number.isFinite(parsed.getTime())) { setError('Choose a valid date.'); return; } setSaving(true); try { await save({ type: 'save-task', id: editing ? task.id : undefined, title, dueAt: parsed?.toISOString() || null, remindMinutes: reminder === 'none' ? null : Number(reminder) }); } finally { setSaving(false); } }}>
    <div className="section-heading"><h1>{editing ? 'Edit task' : 'New task'}</h1><button type="button" className="icon-button" aria-label="Cancel editing" onClick={cancel}><ChevronLeft size={18} /></button></div>
    <label className="field">Task<input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Task name" /></label>
    <label className="field">Date & time <span className="optional">Optional</span><input type="datetime-local" value={due} onChange={e => { setDue(e.target.value); if (e.target.value && !due) setReminder('10'); }} /></label>
    {due && <><button type="button" className="text-button clear-date" onClick={() => { setDue(''); setReminder('none'); }}>Remove date</button><label className="field">Reminder<select value={reminder} onChange={e => setReminder(e.target.value)}><option value="none">None</option><option value="0">At target time</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label></>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="form-actions"><button type="button" className="quiet" onClick={cancel}>Cancel</button><button className="primary" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save task'}</button></div>
  </form>;
}
createRoot(document.getElementById('root')!).render(<App />);
