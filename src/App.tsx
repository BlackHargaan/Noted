import { useEffect, useRef, useState, useSyncExternalStore, lazy, Suspense } from 'react';
import { Note, Task, Store, active, descendants, trashItem, restoreItem, moveNote, localDate } from './model';
import { WorkspaceSession, desktop, exportBackup, importBackup, Recovery } from './persistence';
import Modal, { ModalRequest } from './Modal';
import { TaskContext } from './TaskContext';
import TaskList from './TaskList';
const NoteEditor = lazy(() => import('./NoteEditor'));
type Page = 'home' | 'notes' | 'tasks' | 'trash' | 'settings';
export default function App({ session }: { session: WorkspaceSession }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.snapshot);
  const store = snapshot.store, setStore = session.update;
  const notes = active(store.notes), tasks = active(store.tasks), projects = active(store.projects);
  const [page,setPage] = useState<Page>('home'), [selected,setSelected] = useState<string | null>(notes[0]?.id ?? null);
  const [query,setQuery] = useState(''), [draft,setDraft] = useState(''), [project,setProject] = useState(''), [priority,setPriority] = useState(''), [status,setStatus] = useState('open'), [due,setDue] = useState('');
  const [dialog,setDialog] = useState<ModalRequest | null>(null), [message,setMessage] = useState(''), [recoveries,setRecoveries] = useState<Recovery[]>([]);
  const search = useRef<HTMLInputElement>(null), taskInput = useRef<HTMLInputElement>(null);
  const note = notes.find(n => n.id === selected), today = localDate(), pending = tasks.filter(t => !t.done).length;
  const saving = snapshot.status === 'saving' ? 'Saving…' : snapshot.status === 'error' ? 'Not saved' : '✓ Saved locally';
  function ask(title: string, submit: (value: string) => void, initial = '') { setDialog({ title, submit, initial }); }
  function confirm(title: string, submit: () => void | Promise<void>, submitLabel = 'Move to Trash') { setDialog({ title, submit, confirm: true, submitLabel }); }
  function navigate(p: Page) { setPage(p); setQuery(''); }
  function openNote(id: string) { setSelected(id); navigate('notes'); }
  function addNote(parentId?: string) {
    const parent = notes.find(n => n.id === parentId);
    if (parent && breadcrumbs(parent).length >= 63) { setMessage('Pages support up to 64 nesting levels.'); return; }
    const id = crypto.randomUUID(); setStore(s => ({ ...s, notes: [...s.notes, { id, title: 'Untitled', body: '', parentId }] })); openNote(id);
  }
  function editNote(patch: Partial<Note>) { setStore(s => ({ ...s, notes: s.notes.map(n => n.id === selected ? { ...n,...patch } : n) })); }
  function editTask(id: string, patch: Partial<Task>) { setStore(s => ({ ...s,tasks: s.tasks.map(t => t.id === id ? { ...t,...patch } : t) })); }
  function addTask(title: string, extra: Partial<Task> = {}): string {
    let parent = extra.parentId, depth = 0;
    while (parent) { depth++; parent = store.tasks.find(t => t.id === parent)?.parentId; }
    if (depth >= 64) { setMessage('Tasks support up to 64 nesting levels.'); return ''; }
    const id = crypto.randomUUID();
    if (title.trim()) setStore(s => ({ ...s,tasks: [...s.tasks,{ id,title: title.trim(),done: false,priority:'medium',...extra }] }));
    return id;
  }
  function taskList(matches: Task[]) { return <TaskList matches={matches} addSubtask={t => ask('Subtask title', title => { addTask(title,{ parentId:t.id,projectId:t.projectId,noteId:t.noteId }); })} trash={id => confirm('Move this task and its subtasks to Trash?', () => setStore(s => trashItem(s,'tasks',id)))} />; }
  function newProject() { ask('Project name',name => { const id=crypto.randomUUID(); setStore(s=>({...s,projects:[...s.projects,{id,name}]})); setProject(id); }); }
  async function run(action: () => Promise<void>) { try { setMessage(''); await action(); } catch(e) { setMessage(String(e)); } }
  useEffect(() => { if (page === 'tasks' && !query) taskInput.current?.focus(); },[page]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || dialog) return;
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); search.current?.focus(); }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); addNote(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); void run(() => session.flush()); }
      if (e.key.toLowerCase() === 'j') { e.preventDefault(); navigate('tasks'); requestAnimationFrame(() => taskInput.current?.focus()); }
    };
    window.addEventListener('keydown',handler); return () => window.removeEventListener('keydown',handler);
  });
  function tree(parentId?: string, depth = 0): React.ReactNode {
    return notes.filter(n => n.parentId === parentId || (!parentId && !notes.some(p => p.id === n.parentId))).map(n => <div key={n.id}><button style={{paddingLeft:11+Math.min(depth,8)*14}} className={selected===n.id?'selected':''} onClick={()=>openNote(n.id)}><strong>▤ {n.title || 'Untitled'}</strong><small>{n.body.slice(0,55)||'Empty note'}</small></button>{tree(n.id,depth+1)}</div>);
  }
  function breadcrumbs(n: Note): Note[] { const parents: Note[]=[]; let p=notes.find(x=>x.id===n.parentId); while(p){parents.unshift(p);p=notes.find(x=>x.id===p!.parentId);} return parents; }
  const q=query.trim().toLowerCase();
  const noteMatches=notes.filter(n=>(n.title+' '+n.body).toLowerCase().includes(q));
  const taskMatches=tasks.filter(t=>t.title.toLowerCase().includes(q));
  const filtered=tasks.filter(t=>(!project||t.projectId===project)&&(!priority||(t.priority??'medium')===priority)&&(status==='all'||t.done===(status==='done'))&&(!due||(due==='today'?t.due===today:due==='overdue'?!!t.due&&t.due<today:!t.due)));
  const trashed = store.notes.filter(n=>n.deletedAt).length+store.tasks.filter(t=>t.deletedAt).length+store.projects.filter(p=>p.deletedAt).length;
  return <TaskContext.Provider value={{store,editTask,openNote}}><div className="app">
    <aside><div className="brand">✦ noted<span>.</span></div><small>WORKSPACE</small><nav>{(['home','notes','tasks','trash','settings'] as Page[]).map(p=><button key={p} aria-current={page===p?'page':undefined} className={page===p?'active':''} onClick={()=>navigate(p)}>{p==='home'?'⌂':p==='notes'?'▤':p==='tasks'?'☑':p==='trash'?'♲':'⚙'} &nbsp; {p[0].toUpperCase()+p.slice(1)}{' '}<em>{p==='notes'?notes.length:p==='tasks'?pending:p==='trash'?trashed:''}</em></button>)}</nav><small>QUICK CAPTURE</small><button className="nav-add" onClick={()=>addNote()}>+ New note</button><button className="nav-add" onClick={()=>{navigate('tasks');taskInput.current?.focus();}}>+ New task</button><footer>{desktop?'Desktop · SQLite':'Browser preview · Local'}<br/><span role="status">{saving}</span></footer></aside>
    <main><header><span>Workspace / <b>{q?'Search':page[0].toUpperCase()+page.slice(1)}</b></span><input ref={search} aria-label="Search workspace" placeholder="Search notes and tasks… (Ctrl/⌘ K)" value={query} onChange={e=>setQuery(e.target.value)}/></header>
      {snapshot.status==='error'&&<div className="error" role="alert"><strong>Changes have not been saved.</strong><p>{snapshot.error}</p><p>Keep Noted open. Retry saving or export your current workspace.</p><button onClick={()=>void run(()=>session.flush())}>Retry save</button><button onClick={()=>void run(async()=>{await exportBackup(store);})}>Export unsaved workspace</button></div>}
      {message&&<div className="notice" role="status">{message}<button aria-label="Dismiss message" onClick={()=>setMessage('')}>×</button></div>}
      <div className={'content' + (page==='notes'&&!q?' notes-content':'')}>
        {q?<><h1>Search results</h1><h2>Notes · {noteMatches.length}</h2><div className="cards">{noteMatches.map(n=><button key={n.id} onClick={()=>openNote(n.id)}><strong>{n.title||'Untitled'}</strong><small>{n.body.slice(0,100)}</small></button>)}</div><h2>Tasks · {taskMatches.length}</h2>{taskList(taskMatches)}</>:
        <>
          {page==='home'&&<><label>YOUR PERSONAL WORKSPACE</label><h1>Make room for what matters <i>✦</i></h1><p>Capture your thoughts. Make progress on your plans.</p><div className="stats"><button onClick={()=>navigate('notes')}>Notes<strong>{notes.length}</strong><small>Open notes →</small></button><button onClick={()=>navigate('tasks')}>Tasks remaining<strong>{pending}</strong><small>Open tasks →</small></button></div><h2>Notes</h2><div className="cards">{notes.slice(-4).reverse().map(n=><button key={n.id} onClick={()=>openNote(n.id)}>▤<strong>{n.title||'Untitled'}</strong><small>{n.body.slice(0,90)||'Empty note'}</small></button>)}</div><h2>Today and overdue</h2>{taskList(tasks.filter(t=>!t.done&&t.due&&t.due<=today))}</>}
          {page==='notes'&&<><div className="heading"><h1>Notes</h1><button className="primary" onClick={()=>addNote()}>+ New note</button></div><div className="notes"><div className="note-list">{tree()}</div><div className="editor">{note?<>
            <div className="save"><span>{saving}</span><button onClick={()=>confirm('Move this note and its child pages to Trash? Linked tasks will be kept.',()=>{setStore(s=>trashItem(s,'notes',note.id));setSelected(null);})}>Move to Trash</button></div>
            <div className="breadcrumbs">{breadcrumbs(note).map(n=><button key={n.id} onClick={()=>openNote(n.id)}>{n.title||'Untitled'} /</button>)}</div>
            <input aria-label="Note title" className="note-title" value={note.title} onChange={e=>editNote({title:e.target.value})}/>
            <div className="note-actions"><select aria-label="Parent page" value={note.parentId??''} onChange={e=>editNote({parentId:e.target.value||undefined})}><option value="">Top-level page</option>{notes.filter(n=>!descendants(store.notes,note.id).has(n.id)).map(n=><option key={n.id} value={n.id}>{n.title||'Untitled'}</option>)}</select><button onClick={()=>addNote(note.id)}>+ Child page</button><button aria-label="Move page up" onClick={()=>setStore(s=>moveNote(s,note.id,-1))}>↑</button><button aria-label="Move page down" onClick={()=>setStore(s=>moveNote(s,note.id,1))}>↓</button></div>
            <Suspense fallback={<p>Opening editor…</p>}><NoteEditor key={note.id} note={note} update={editNote} createTask={title=>addTask(title,{noteId:note.id})}/></Suspense>
            <h2>Tasks linked to this note</h2><p className="hint">Inline checkboxes and My Tasks share the same task. Removing a reference from the text keeps the task.</p>{taskList(tasks.filter(t=>t.noteId===note.id))}
          </>:<div className="empty">Select a note, or create a new one.</div>}</div></div></>}
          {page==='tasks'&&<><label>GET THINGS DONE</label><h1>My Tasks</h1><p>{pending} remaining</p><form className="add-task" onSubmit={e=>{e.preventDefault();addTask(draft,{projectId:project||undefined});setDraft('');}}><input ref={taskInput} aria-label="New task" placeholder="Add a task…" value={draft} onChange={e=>setDraft(e.target.value)} required/><button className="primary">Add task</button></form>
            <div className="filters"><select aria-label="Filter by status" value={status} onChange={e=>setStatus(e.target.value)}><option value="open">Open tasks</option><option value="done">Completed</option><option value="all">All tasks</option></select><select aria-label="Filter by deadline" value={due} onChange={e=>setDue(e.target.value)}><option value="">All deadlines</option><option value="today">Today</option><option value="overdue">Overdue</option><option value="none">No deadline</option></select><select aria-label="Filter by priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Filter by project" value={project} onChange={e=>setProject(e.target.value)}><option value="">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={newProject}>+ Project</button>
            {project&&<><button onClick={()=>ask('Project name',name=>setStore(s=>({...s,projects:s.projects.map(p=>p.id===project?{...p,name}:p)})),projects.find(p=>p.id===project)?.name)}>Rename project</button><button onClick={()=>confirm('Move this project to Trash? Tasks will be kept.',()=>{setStore(s=>trashItem(s,'projects',project));setProject('');})}>Move project to Trash</button></>}</div>
            <p className="hint">Sorted by deadline, then priority. Parent tasks are shown for context. Completing a parent leaves its subtasks unchanged.</p>{taskList(filtered)}
          </>}
          {page==='trash'&&<><h1>Trash</h1><p>Restore deleted items here. Restoring a page or task also restores items deleted with it and any required parent.</p>{(['notes','tasks','projects'] as const).map(kind=><section key={kind}><h2>{kind[0].toUpperCase()+kind.slice(1)}</h2>{store[kind].filter(i=>i.deletedAt).map(i=><div className="trash-row" key={i.id}><span>{'title' in i?i.title||'Untitled':i.name}</span><button onClick={()=>setStore(s=>restoreItem(s,kind,i.id))}>Restore</button></div>)}</section>)}{!trashed&&<p className="empty">Trash is empty.</p>}</>}
          {page==='settings'&&<><h1>Settings</h1><section className="settings-card"><h2>Workspace and backups</h2><p>{desktop?'Your workspace is saved in a local SQLite database. The previous 30 saved revisions are kept for recovery.':'This browser preview uses browser storage. Export a backup before clearing site data or moving to the desktop app.'}</p><div className="note-actions"><button onClick={()=>void run(async()=>{if(await exportBackup(store))setMessage('Backup exported.');})}>Export backup</button><button onClick={()=>void run(async()=>{
              const imported=await importBackup(); if(!imported)return;
              confirm('Replace this workspace with '+imported.notes.length+' notes and '+imported.tasks.length+' tasks? Export a backup first if you want to keep this workspace.',async()=>{await session.replace(imported);setSelected(active(imported.notes)[0]?.id??null);setProject('');setMessage('Backup restored.');},'Replace workspace');
            })}>Import backup</button><button disabled={!desktop} onClick={()=>void run(async()=>{setRecoveries(await session.recoveries());setMessage('Recovery history loaded.');})}>Load recovery history</button></div>
            {recoveries.map(r=><div className="trash-row" key={r.revision}><span>Revision {r.revision} · {new Date(Number(r.created)*1000).toLocaleString()}</span><button onClick={()=>void run(async()=>{const previous=await session.recovery(r.revision);confirm('Restore revision '+r.revision+'? The current saved workspace will remain in recovery history.',async()=>{await session.replace(previous);setSelected(active(previous.notes)[0]?.id??null);setProject('');setRecoveries(await session.recoveries());},'Restore revision');})}>Restore</button></div>)}
          </section><section className="settings-card"><h2>Keyboard shortcuts</h2><p>Ctrl/⌘ K: search · Ctrl/⌘ N: new note · Ctrl/⌘ J: tasks · Ctrl/⌘ S: save now</p><h2>About Noted</h2><p>Version 0.2.0 · Desktop beta. Offline notes and tasks.</p></section></>}
        </>}
      </div>
    </main>{dialog&&<Modal request={dialog} close={()=>setDialog(null)}/>}
  </div></TaskContext.Provider>;
}
