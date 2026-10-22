import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Repository, WorkspaceSession, repository, openSession } from '../src/persistence';
import { Store, initial } from '../src/model';
function memoryRepo(): Repository & { writes: Store[] } {
  return { writes:[], async load(){return {store:initial,revision:0};}, async save(s,r){this.writes.push(s);return r+1;},async recoveries(){return [];},async recovery(){return initial;} };
}
beforeEach(()=>{localStorage.clear();});
describe('save lifecycle',()=>{
  it('keeps the saved indicator correct when a page cannot move farther',async()=>{
    const repo=memoryRepo();const session=await openSession(repo);session.update(s=>s);await session.flush();
    expect(session.snapshot().status).toBe('saved');expect(repo.writes).toHaveLength(0);
  });
  it('serializes rapid edits arriving while a save is in flight',async()=>{
    const repo=memoryRepo();let finish: (()=>void)|undefined;const writes:Store[]=[];
    repo.save=async(s,r)=>{writes.push(s);if(writes.length===1)await new Promise<void>(resolve=>{finish=resolve;});return r+1;};
    const session=await openSession(repo);
    session.update(s=>({...s,tasks:[{id:'a',title:'First',done:false}]}));const saving=session.flush();
    session.update(s=>({...s,tasks:[...s.tasks,{id:'b',title:'Second',done:false}]}));finish!();await saving;
    expect(writes).toHaveLength(2);expect(writes[1].tasks).toHaveLength(2);expect(session.dirty).toBe(false);
  });
  it('keeps failed saves in memory and retries the latest content',async()=>{
    const repo=memoryRepo();repo.save=vi.fn().mockRejectedValueOnce(new Error('Disk full')).mockResolvedValue(1);
    const session=await openSession(repo);session.update(s=>({...s,tasks:[{id:'a',title:'Keep me',done:false}]}));
    await expect(session.flush()).rejects.toThrow('Disk full');expect(session.snapshot().status).toBe('error');expect(session.snapshot().store.tasks[0].title).toBe('Keep me');
    await session.flush();expect(session.dirty).toBe(false);
  });
  it('can save after a clean flush and protects existing data from invalid replacement',async()=>{
    const repo=memoryRepo();const session=await openSession(repo);await session.flush();session.update(s=>({...s,tasks:[{id:'a',title:'A',done:false}]}));await session.flush();expect(repo.writes).toHaveLength(1);
    await expect(session.replace({notes:[],tasks:[{id:'bad'}],projects:[]} as Store)).rejects.toThrow();expect(session.snapshot().store.tasks[0].id).toBe('a');
  });
});
describe('browser migration',()=>{
  it('retains the original browser data when migrating',async()=>{
    localStorage.setItem('noted-v1',JSON.stringify(initial));const session=await openSession(repository());
    session.update(s=>({...s,tasks:[{id:'t',title:'New',done:false}]}));await session.flush();
    expect(JSON.parse(localStorage.getItem('noted-v1')!)).toEqual(initial);expect((await repository().load()).store?.tasks[0].title).toBe('New');
  });
  it('does not silently overwrite corrupt storage',async()=>{localStorage.setItem('noted-v1','{');await expect(openSession(repository())).rejects.toThrow();expect(localStorage.getItem('noted-v1')).toBe('{');});
  it('detects a stale tab before replacing saved content',async()=>{
    const a=await openSession(repository()),b=await openSession(repository());
    a.update(s=>({...s,tasks:[{id:'a',title:'A',done:false}]}));await a.flush();
    b.update(s=>({...s,tasks:[{id:'b',title:'B',done:false}]}));await expect(b.flush()).rejects.toThrow('another tab');
    expect((await repository().load()).store?.tasks[0].id).toBe('a');
  });
});
