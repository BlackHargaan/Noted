import { describe, it, expect } from 'vitest';
import { Store, initial, parseStore, parseBackup, backupText, trashItem, restoreItem, moveNote } from '../src/model';
const sample = (): Store => ({ notes: [{id:'n',title:'Parent',body:'Text'},{id:'child',title:'Child',body:'',parentId:'n'}], tasks:[{id:'t',title:'Task',done:false,noteId:'n'},{id:'sub',title:'Subtask',done:false,parentId:'t'}], projects:[] });
describe('workspace validation and backups', () => {
  it('loads legacy plain text and checkboxes', () => { expect(parseStore({notes:initial.notes,tasks:[]})).toEqual(initial); });
  it('round-trips rich text, references, task links and Trash', () => {
    const s=sample(); s.notes[0].html='<p><strong>Text</strong></p><div data-task-id="t"></div>';
    const trashed=trashItem(s,'tasks','t');expect(parseBackup(backupText(trashed))).toEqual(trashed);
  });
  it.each([
    {notes:[{id:'a',title:'A',body:'',parentId:'a'}],tasks:[]},
    {notes:[{id:'a',title:'A',body:'',parentId:'missing'}],tasks:[]},
    {notes:[...initial.notes,...initial.notes],tasks:[]},
    {notes:[],tasks:[{id:'t',title:'Task',done:'false'}]},
    {notes:[],tasks:[{id:'t',title:'Task',done:false,noteId:'missing'}]},
    {notes:[],tasks:[{id:'t',title:'Task',done:false,due:'2025-02-30'}]},
    {notes:[],tasks:[{id:'t',title:'Task',done:false,due:'2025-13-01'}]},
  ])('rejects invalid imports without normalization', v => { expect(()=>parseStore(v)).toThrow(); });
  it('rejects newer backup versions',()=>{expect(()=>parseBackup('{"format":"noted-backup","version":99,"workspace":{}}')).toThrow();});
});
describe('recoverable deletion and page ordering', () => {
  it('trashes a page subtree while keeping linked tasks intact',()=>{const s=sample();const next=trashItem(s,'notes','n');expect(next.notes.every(n=>!!n.deletedAt)).toBe(true);expect(next.tasks).toEqual(s.tasks);expect(s.notes[0].deletedAt).toBeUndefined();expect(restoreItem(next,'notes','n')).toEqual({...s,notes:s.notes.map(n=>({...n,deletedAt:undefined,deleteBatch:undefined}))});});
  it('restores a task batch without reviving previously deleted children',()=>{let s=sample();s=trashItem(s,'tasks','sub');s=trashItem(s,'tasks','t');s=restoreItem(s,'tasks','t');expect(s.tasks[0].deletedAt).toBeUndefined();expect(s.tasks[1].deletedAt).toBeTruthy();});
  it('restoring a child restores its required ancestors',()=>{let s=trashItem(sample(),'tasks','sub');s=trashItem(s,'tasks','t');expect(restoreItem(s,'tasks','sub').tasks.every(t=>!t.deletedAt)).toBe(true);});
  it('reorders siblings without changing parent relationships',()=>{const s=sample();s.notes.push({id:'other',title:'Other',body:''});expect(moveNote(s,'other',-1).notes.map(n=>n.id)).toEqual(['other','child','n']);expect(s.notes[0].id).toBe('n');});
});
