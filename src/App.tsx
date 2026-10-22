import { useEffect, useRef, useState } from 'react';
import NoteEditor from './NoteEditor';
import { Note, Task, Store, read, descendants, deleteNote, deleteTask } from './model';
type Page = 'home' | 'notes' | 'tasks';
export default function App() {
  const [store, setStore] = useState<Store>(read);
  const [page, setPage] = useState<Page>('home');
  const [selected, setSelected] = useState<string | null>(() => store.notes[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('open');
  const [saveError, setSaveError] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; value: string; action: (value: string) => void; confirm?: boolean } | null>(null);
  function ask(title: string, action: (value: string) => void, value = '') { setDialog({ title, value, action }); }
  function confirmAction(title: string, action: () => void) { setDialog({ title, value: '', action, confirm: true }); }
  const taskInput = useRef<HTMLInputElement>(null);
  useEffect(() => { try { localStorage.setItem('noted-v1', JSON.stringify(store)); setSaveError(false); } catch { setSaveError(true); } }, [store]);
  useEffect(() => { if (page === 'tasks') taskInput.current?.focus(); }, [page]);
  const note = store.notes.find(n => n.id === selected);
  const pending = store.tasks.filter(t => !t.done).length;
  function addNote(parentId?: string) {
    const id = crypto.randomUUID();
    setStore(s => ({ ...s, notes: [...s.notes, { id, title: 'Untitled', body: '', parentId }] }));
    setSelected(id); setPage('notes'); setQuery('');
  }
  function editNote(patch: Partial<Note>) { setStore(s => ({ ...s, notes: s.notes.map(n => n.id === selected ? { ...n, ...patch } : n) })); }
  function editTask(id: string, patch: Partial<Task>) { setStore(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) })); }
  function addTask(title: string, extra: Partial<Task> = {}) {
    if (!title.trim()) return;
    setStore(s => ({ ...s, tasks: [...s.tasks, { id: crypto.randomUUID(), title: title.trim(), done: false, priority: 'medium', ...extra }] }));
  }
  function newProject() {
    ask('Project name', name => {
      const id = crypto.randomUUID();
      setStore(s => ({ ...s, projects: [...s.projects, { id, name }] })); setProject(id);
    });
  }
  function openNote(id: string) { setSelected(id); setPage('notes'); setQuery(''); }
  const matches = (t: Task) => t.title.toLowerCase().includes(query.toLowerCase()) && (!project || t.projectId === project) && (!priority || t.priority === priority) && (status === 'all' || t.done === (status === 'done'));
  const rank = { high: 0, medium: 1, low: 2 };
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  function taskRows(list: Task[], depth = 0): React.ReactNode {
    return [...list].sort((a, b) => (a.done === b.done ? (a.due || '9999').localeCompare(b.due || '9999') || rank[a.priority || 'medium'] - rank[b.priority || 'medium'] : Number(a.done) - Number(b.done))).map(t => <div key={t.id} className="task-group">
      <div className="task detail" style={{ marginLeft: depth * 16 }}>
        <div className="task-line"><input type="checkbox" aria-label={'Complete ' + t.title} checked={t.done} onChange={e => editTask(t.id, { done: e.target.checked })} />
          <input className={t.done ? 'task-title done' : 'task-title'} aria-label="Task title" value={t.title} onChange={e => editTask(t.id, { title: e.target.value })} />
          <button title="Add subtask" aria-label={'Add subtask to ' + t.title} onClick={() => ask('Subtask title', title => addTask(title, { parentId: t.id, projectId: t.projectId, noteId: t.noteId }))}>＋</button>
          <button aria-label={'Delete ' + t.title} onClick={() => confirmAction('Delete this task and its subtasks?', () => setStore(s => deleteTask(s, t.id)))}>×</button>
        </div>
        <div className="task-meta">
          <select aria-label="Priority" value={t.priority || 'medium'} onChange={e => editTask(t.id, { priority: e.target.value as Task['priority'] })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
          <input aria-label="Deadline" className={!t.done && t.due && t.due < today ? 'overdue' : ''} type="date" value={t.due || ''} onChange={e => editTask(t.id, { due: e.target.value || undefined })} />
          <select aria-label="Project" value={t.projectId || ''} onChange={e => editTask(t.id, { projectId: e.target.value || undefined })}><option value="">No project</option>{store.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label="Linked note" value={t.noteId || ''} onChange={e => editTask(t.id, { noteId: e.target.value || undefined })}><option value="">No linked note</option>{store.notes.map(n => <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>)}</select>
          {t.noteId && <button onClick={() => openNote(t.noteId!)}>Open note ↗</button>}
        </div>
      </div>{taskRows(store.tasks.filter(c => c.parentId === t.id), depth + 1)}
    </div>);
  }
  function noteTree(parentId?: string, depth = 0): React.ReactNode {
    return store.notes.filter(n => n.parentId === parentId).map(n => <div key={n.id}><button style={{ paddingLeft: 11 + depth * 14 }} className={selected === n.id ? 'selected' : ''} onClick={() => openNote(n.id)}><strong>▤ {n.title || 'Untitled'}</strong><small>{n.body.slice(0,55) || 'Empty note'}</small></button>{noteTree(n.id, depth + 1)}</div>);
  }
  const visible = store.tasks.filter(matches);
  const visibleIds = new Set(visible.map(t => t.id));
  // Only render matching roots; their subtasks stay visible for context.
  const roots = visible.filter(t => { let parent = t.parentId; const seen = new Set<string>(); while (parent && !seen.has(parent)) { if (visibleIds.has(parent)) return false; seen.add(parent); parent = store.tasks.find(x => x.id === parent)?.parentId; } return true; });
  return <div className="app"><aside><div className="brand">✦ noted<span>.</span></div><small>WORKSPACE</small><nav>{(['home', 'notes', 'tasks'] as Page[]).map(p => <button key={p} className={page === p ? 'active' : ''} onClick={() => { setPage(p); setQuery(''); }}>{p === 'home' ? '⌂' : p === 'notes' ? '▤' : '☑'} &nbsp; {p[0].toUpperCase() + p.slice(1)}<em>{p === 'notes' ? store.notes.length : p === 'tasks' ? pending : ''}</em></button>)}</nav><small>QUICK CAPTURE</small><button className="nav-add" onClick={() => addNote()}>+ New note</button><button className="nav-add" onClick={() => { setPage('tasks'); taskInput.current?.focus(); }}>+ New task</button><footer>Personal workspace · Local</footer></aside>
    <main><header><span>Workspace / <b>{page[0].toUpperCase() + page.slice(1)}</b></span><input aria-label="Search current view" placeholder="Search this view…" value={query} onChange={e => setQuery(e.target.value)} /></header>{saveError && <div role="alert" className="error">Changes could not be saved. Browser storage may be full. Keep this tab open and free storage before continuing.</div>}<div className="content">
      {page === 'home' && <><label>YOUR PERSONAL WORKSPACE</label><h1>Make room for what matters <i>✦</i></h1><p>Capture your thoughts. Make progress on your plans.</p><div className="stats"><button onClick={() => setPage('notes')}>Notes<strong>{store.notes.length}</strong><small>Open notes →</small></button><button onClick={() => setPage('tasks')}>Tasks remaining<strong>{pending}</strong><small>Open tasks →</small></button></div><h2>Notes</h2><div className="cards">{store.notes.filter(n => (n.title + n.body).toLowerCase().includes(query.toLowerCase())).slice(-4).reverse().map(n => <button key={n.id} onClick={() => openNote(n.id)}>▤<strong>{n.title}</strong><small>{n.body.slice(0,90) || 'Empty note'}</small></button>)}</div><h2>Open tasks</h2>{taskRows(store.tasks.filter(t => !t.done && !t.parentId && t.title.toLowerCase().includes(query.toLowerCase())).slice(0,5))}</>}
      {page === 'notes' && <><div className="heading"><div><label>COLLECT YOUR THOUGHTS</label><h1>Notes</h1></div><button className="primary" onClick={() => addNote()}>+ New note</button></div><div className="notes"><div className="note-list">{query ? store.notes.filter(n => (n.title + n.body).toLowerCase().includes(query.toLowerCase())).map(n => <button key={n.id} onClick={() => openNote(n.id)}>{n.title || 'Untitled'}</button>) : noteTree()}</div><div className="editor">{note ? <>
        <div className="save"><span>{saveError ? 'Not saved' : '✓ Saved locally'}</span><button onClick={() => confirmAction('Delete this note? Child pages will be moved up and linked tasks kept.', () => { setStore(s => deleteNote(s, note.id)); setSelected(null); })}>Delete</button></div>
        <input aria-label="Note title" className="note-title" value={note.title} onChange={e => editNote({ title: e.target.value })} />
        <div className="note-actions"><select aria-label="Parent page" value={note.parentId || ''} onChange={e => editNote({ parentId: e.target.value || undefined })}><option value="">Top-level page</option>{store.notes.filter(n => !descendants(store.notes, note.id).has(n.id)).map(n => <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>)}</select><button onClick={() => addNote(note.id)}>+ Child page</button></div>
        <NoteEditor key={note.id} note={note} update={editNote} />
        <h2>Tasks in this note</h2><p className="hint">These tasks also appear in My Tasks. Changes update both views.</p>
        <form className="add-task" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const input = form.elements.namedItem('noteTask') as HTMLInputElement; addTask(input.value, { noteId: note.id }); input.value = ''; }}><input name="noteTask" aria-label="Task in note" placeholder="Add a task to this note…" required /><button className="primary">Add task</button></form>
        {taskRows(store.tasks.filter(t => t.noteId === note.id && !store.tasks.some(p => p.id === t.parentId && p.noteId === note.id)))}
      </> : <div className="empty">Select a note, or create a new one.</div>}</div></div></>}
      {page === 'tasks' && <><label>GET THINGS DONE</label><h1>My Tasks</h1><p>{pending} remaining</p><form className="add-task" onSubmit={e => { e.preventDefault(); addTask(draft, { projectId: project || undefined }); setDraft(''); }}><input ref={taskInput} aria-label="New task" placeholder="Add a task…" value={draft} onChange={e => setDraft(e.target.value)} required /><button className="primary">Add task</button></form>
        <div className="filters"><select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option value="open">Open tasks</option><option value="done">Completed</option><option value="all">All tasks</option></select><select aria-label="Filter by priority" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Filter by project" value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{store.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={newProject}>+ Project</button>
        {project && <><button onClick={() => ask('Project name', name => setStore(s => ({ ...s, projects: s.projects.map(p => p.id === project ? { ...p, name } : p) })), store.projects.find(p => p.id === project)?.name)}>Rename project</button><button onClick={() => confirmAction('Delete project? Its tasks will be kept.', () => { setStore(s => ({ ...s, projects: s.projects.filter(p => p.id !== project), tasks: s.tasks.map(t => t.projectId === project ? { ...t, projectId: undefined } : t) })); setProject(''); })}>Delete project</button></>}</div>
        <p className="hint">Sorted by deadline, then priority. Subtasks remain visible beneath matching tasks.</p>{taskRows(roots)}{!roots.length && <div className="empty">No matching tasks.</div>}</>}
    </div></main>{dialog && <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-label={dialog.title} onKeyDown={e => { if (e.key === 'Escape') setDialog(null); }} onSubmit={e => { e.preventDefault(); if (dialog.confirm || dialog.value.trim()) { dialog.action(dialog.value.trim()); setDialog(null); } }}><h2>{dialog.title}</h2>{!dialog.confirm && <input autoFocus aria-label={dialog.title} value={dialog.value} onChange={e => setDialog({ ...dialog, value: e.target.value })} required />}<div className="note-actions"><button autoFocus={dialog.confirm} type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary">{dialog.confirm ? 'Delete' : 'Save'}</button></div></form></div>}</div>;
}
