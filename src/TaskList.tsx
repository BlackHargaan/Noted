import { Task, active, localDate } from './model';
import { useTasks } from './TaskContext';
export default function TaskList({ matches, addSubtask, trash }: { matches: Task[]; addSubtask: (t: Task) => void; trash: (id: string) => void }) {
  const { store, editTask, openNote } = useTasks();
  const tasks = active(store.tasks), matched = new Set(matches.map(t => t.id)), included = new Set(matched);
  const byId = new Map(tasks.map(t => [t.id,t]));
  const children = new Map<string | undefined, Task[]>();
  for (const t of tasks) { const key = t.parentId && byId.has(t.parentId) ? t.parentId : undefined; const list=children.get(key)??[]; list.push(t); children.set(key,list); }
  for (const id of included) { const parent = byId.get(id)?.parentId; if (parent) included.add(parent); }
  const rank = { high: 0, medium: 1, low: 2 }, today = localDate();
  function rows(parentId?: string, depth = 0): React.ReactNode {
    return (children.get(parentId)??[]).filter(t => included.has(t.id)).sort((a,b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999') || rank[a.priority ?? 'medium'] - rank[b.priority ?? 'medium']).map(t => <div className="task-group" key={t.id}>
      <div className={'task detail ' + (!matched.has(t.id) ? 'context-task' : '')} style={{ marginLeft: Math.min(depth, 8) * 16 }}>
        {!matched.has(t.id) && <small>Parent task · shown for context</small>}
        <div className="task-line"><input type="checkbox" aria-label={'Complete ' + t.title} checked={t.done} onChange={e => editTask(t.id, { done: e.target.checked })} /><input className={'task-title ' + (t.done ? 'done' : '')} aria-label="Task title" value={t.title} onChange={e => editTask(t.id, { title: e.target.value })} /><button aria-label={'Add subtask to ' + t.title} onClick={() => addSubtask(t)}>＋</button><button aria-label={'Move ' + t.title + ' to Trash'} onClick={() => trash(t.id)}>×</button></div>
        <div className="task-meta"><select aria-label="Priority" value={t.priority ?? 'medium'} onChange={e => editTask(t.id, { priority: e.target.value as Task['priority'] })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
          <input type="date" aria-label="Deadline" className={!t.done && t.due && t.due < today ? 'overdue' : ''} value={t.due ?? ''} onChange={e => editTask(t.id, { due: e.target.value || undefined })} />
          {!t.done && t.due && t.due < today && <small className="overdue">Overdue</small>}
          <select aria-label="Project" value={t.projectId ?? ''} onChange={e => editTask(t.id, { projectId: e.target.value || undefined })}><option value="">No project</option>{store.projects.map(p => <option key={p.id} value={p.id} disabled={!!p.deletedAt}>{p.name}{p.deletedAt ? ' (in Trash)' : ''}</option>)}</select>
          <select aria-label="Linked note" value={t.noteId ?? ''} onChange={e => editTask(t.id, { noteId: e.target.value || undefined })}><option value="">No linked note</option>{store.notes.map(n => <option key={n.id} value={n.id} disabled={!!n.deletedAt}>{n.title || 'Untitled'}{n.deletedAt ? ' (in Trash)' : ''}</option>)}</select>
          {t.noteId && !store.notes.find(n => n.id === t.noteId)?.deletedAt && <button onClick={() => openNote(t.noteId!)}>Open note ↗</button>}
        </div>
      </div>{rows(t.id, depth + 1)}
    </div>);
  }
  return <>{matches.length ? rows() : <p className="empty">No matching tasks.</p>}</>;
}
