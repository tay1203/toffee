import fs from 'node:fs';
import path from 'node:path';
import { emptyState, validateState } from './domain.mjs';
export function readState(file) {
  if (!fs.existsSync(file)) return emptyState();
  return validateState(JSON.parse(fs.readFileSync(file, 'utf8')));
}
export function writeState(file, state) {
  validateState(state);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
  // Preserve the previous valid snapshot before atomically replacing the live file.
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.backup');
  fs.renameSync(temp, file);
}
