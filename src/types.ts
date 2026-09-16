export type Drink = 'espresso' | 'latte' | 'matcha';
export interface Task { id: string; title: string; dueAt: string | null; remindMinutes: number | null; createdAt: string; completedAt: string | null; notifiedAt: string | null; snoozedUntil: string | null }
export interface State { version: number; tasks: Task[]; notes: string; pending: string[]; settings: { drink: Drink; alwaysOnTop: boolean; startAtLogin: boolean; reduceMotion: boolean; widgetSize: number }; position: { x: number; y: number } | null }
export type Action = { type: string; [key: string]: unknown };
export interface Bridge { getState(): Promise<State>; dispatch(action: Action): Promise<State>; togglePanel(): Promise<void>; hidePanel(): Promise<void>; gesture(phase: string, mode?: string): Promise<void>; nudge(x: number, y: number, size: number): Promise<void>; exportData(): Promise<boolean>; onState(callback: (s: State) => void): () => void; onReminder(callback: () => void): () => void }
declare global { interface Window { brew?: Bridge } }
