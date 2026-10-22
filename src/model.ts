type TrashFields = { deletedAt?: string; deleteBatch?: string };
export type Note = TrashFields & { id: string; title: string; body: string; html?: string; parentId?: string };
export type Task = TrashFields & { id: string; title: string; done: boolean; priority?: 'low' | 'medium' | 'high'; due?: string; projectId?: string; parentId?: string; noteId?: string };
export type Project = TrashFields & { id: string; name: string };
export type Store = { notes: Note[]; tasks: Task[]; projects: Project[] };
export const MAX_BYTES = 25 * 1024 * 1024;
export const initial: Store = { notes: [{ id: 'welcome', title: 'Welcome to Noted', body: 'A quiet place for your thoughts and tasks.' }], tasks: [], projects: [] };
export const active = <T extends TrashFields>(items: T[]) => items.filter(i => !i.deletedAt);
export function descendants<T extends { id: string; parentId?: string }>(items: T[], id: string): Set<string> {
  const found = new Set([id]); let changed = true;
  while (changed) { changed = false; for (const item of items) if (item.parentId && found.has(item.parentId) && !found.has(item.id)) { found.add(item.id); changed = true; } }
  return found;
}
export function parseStore(value: unknown): Store {
  const fail = (): never => { throw new Error('Invalid workspace. Check item IDs, dates, relationships, and backup version.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(k => !['notes', 'tasks', 'projects'].includes(k))) return fail();
  if (!Array.isArray(raw.notes) || !Array.isArray(raw.tasks) || (raw.projects !== undefined && !Array.isArray(raw.projects))) return fail();
  const s = { notes: raw.notes, tasks: raw.tasks, projects: raw.projects ?? [] } as Store;
  if (s.notes.length + s.tasks.length + s.projects.length > 50_000 || new TextEncoder().encode(JSON.stringify(s)).length > MAX_BYTES) return fail();
  function check(items: unknown[], required: string[], optional: string[], task = false) {
    const ids = new Set<string>();
    for (const v of items) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
      const i = v as Record<string, unknown>;
      if (required.some(k => typeof i[k] !== 'string') || optional.some(k => i[k] !== undefined && typeof i[k] !== 'string')) return fail();
      if (Object.keys(i).some(k => ![...required, ...optional, ...(task ? ['done'] : [])].includes(k))) return fail();
      if (typeof i.id !== 'string' || !i.id || new TextEncoder().encode(i.id).length > 200 || ids.has(i.id)) return fail();
      ids.add(i.id);
    }
    return ids;
  }
  const trash = ['deletedAt', 'deleteBatch'];
  const notes = check(s.notes, ['id','title','body'], ['html','parentId',...trash]);
  check(s.tasks, ['id','title'], ['priority','due','parentId','projectId','noteId',...trash], true);
  const projects = check(s.projects, ['id','name'], trash);
  function tree(items: { id: string; parentId?: string }[]) {
    const parents = new Map(items.map(i => [i.id, i.parentId]));
    for (const i of items) {
      const seen = new Set<string>(); let id: string | undefined = i.id;
      while (id !== undefined) { if (seen.has(id) || seen.size >= 64 || !parents.has(id)) return fail(); seen.add(id); id = parents.get(id); }
    }
  }
  tree(s.notes); tree(s.tasks);
  for (const t of s.tasks) {
    if (typeof t.done !== 'boolean' || (t.priority !== undefined && !['low','medium','high'].includes(t.priority))) return fail();
    if (t.noteId !== undefined && !notes.has(t.noteId) || t.projectId !== undefined && !projects.has(t.projectId)) return fail();
    if (t.due !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(t.due) || t.due < '0001-01-01' || !Number.isFinite(Date.parse(t.due)) || new Date(t.due).toISOString().slice(0,10) !== t.due)) return fail();
  }
  return structuredClone(s);
}
export function parseBackup(text: string): Store {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Backup exceeds 25 MB.');
  const value = JSON.parse(text);
  if (value && typeof value === 'object' && 'format' in value) {
    if (value.format !== 'noted-backup' || value.version !== 1) throw new Error('Unsupported backup version.');
    return parseStore(value.workspace);
  }
  return parseStore(value);
}
export function backupText(store: Store) {
  const text = JSON.stringify({ format: 'noted-backup', version: 1, exportedAt: new Date().toISOString(), workspace: store });
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Backup exceeds 25 MB.');
  return text;
}
export function trashItem(s: Store, kind: 'notes' | 'tasks' | 'projects', id: string): Store {
  const ids = kind === 'projects' ? new Set([id]) : descendants<Note | Task>(s[kind], id);
  const deletedAt = new Date().toISOString(), deleteBatch = crypto.randomUUID();
  return { ...s, [kind]: s[kind].map(i => ids.has(i.id) && !i.deletedAt ? { ...i, deletedAt, deleteBatch } : i) };
}
export function restoreItem(s: Store, kind: 'notes' | 'tasks' | 'projects', id: string): Store {
  const item = s[kind].find(i => i.id === id);
  const ids = new Set(s[kind].filter(i => i.id === id || (item?.deleteBatch && i.deleteBatch === item.deleteBatch)).map(i => i.id));
  if (kind !== 'projects') {
    for (const key of ids) {
      let parent = (s[kind].find(i => i.id === key) as Note | Task | undefined)?.parentId;
      while (parent) { ids.add(parent); parent = (s[kind].find(i => i.id === parent) as Note | Task | undefined)?.parentId; }
    }
  }
  return { ...s, [kind]: s[kind].map(i => ids.has(i.id) ? { ...i, deletedAt: undefined, deleteBatch: undefined } : i) };
}
export function moveNote(s: Store, id: string, direction: -1 | 1): Store {
  const index = s.notes.findIndex(n => n.id === id);
  if (index < 0) return s;
  const siblings = s.notes.map((n,i) => ({n,i})).filter(({n}) => !n.deletedAt && n.parentId === s.notes[index].parentId);
  const target = siblings[siblings.findIndex(x => x.n.id === id) + direction]?.i;
  if (target === undefined) return s;
  const notes = [...s.notes]; [notes[index], notes[target]] = [notes[target], notes[index]]; return { ...s, notes };
}
export function localDate(date = new Date()) { return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-'); }
