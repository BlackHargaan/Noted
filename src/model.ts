export type Note = { id: string; title: string; body: string; html?: string; parentId?: string };
export type Task = { id: string; title: string; done: boolean; priority?: 'low' | 'medium' | 'high'; due?: string; projectId?: string; parentId?: string; noteId?: string };
export type Project = { id: string; name: string };
export type Store = { notes: Note[]; tasks: Task[]; projects: Project[] };
export const initial: Store = { notes: [{ id: 'welcome', title: 'Welcome to Noted', body: 'A quiet place for your thoughts and tasks.' }], tasks: [], projects: [] };
export function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem('noted-v1') || 'null');
    if (!v || !Array.isArray(v.notes) || !Array.isArray(v.tasks)) return initial;
    return { ...v, projects: Array.isArray(v.projects) ? v.projects : [] };
  } catch { return initial; }
}
export function descendants<T extends { id: string; parentId?: string }>(items: T[], id: string): Set<string> {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) if (item.parentId && found.has(item.parentId) && !found.has(item.id)) { found.add(item.id); changed = true; }
  }
  return found;
}
export function deleteNote(s: Store, id: string): Store {
  return { ...s, notes: s.notes.filter(n => n.id !== id).map(n => n.parentId === id ? { ...n, parentId: s.notes.find(x => x.id === id)?.parentId } : n),
    tasks: s.tasks.map(t => t.noteId === id ? { ...t, noteId: undefined } : t) };
}
export function deleteTask(s: Store, id: string): Store {
  const ids = descendants(s.tasks, id);
  return { ...s, tasks: s.tasks.filter(t => !ids.has(t.id)) };
}
