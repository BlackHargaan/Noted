import { it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { WorkspaceSession, Repository } from '../src/persistence';
import { Store } from '../src/model';
function setup(store: Store) {
  const repo: Repository={async load(){return {store,revision:0};},async save(_,r){return r+1;},async recoveries(){return [];},async recovery(){return store;}};
  const session=new WorkspaceSession(repo,{store,revision:0});render(<App session={session}/>);return {session,user:userEvent.setup()};
}
it('edits the same task through its note reference and task list',async()=>{
  const {user,session}=setup({notes:[{id:'n',title:'Release',body:'',html:'<p>Plan</p><div data-task-id="t" data-type="task-reference">Linked task</div>'}],tasks:[{id:'t',title:'Ship',done:false,noteId:'n'}],projects:[]});
  await user.click(screen.getByRole('button',{name:/Release/}));
  const inline=await screen.findByLabelText('Complete inline task Ship',{}, {timeout:10000});await user.click(inline);
  expect(session.snapshot().store.tasks[0].done).toBe(true);
  await user.click(screen.getByRole('button',{name:/Tasks 0/}));await user.selectOptions(screen.getByLabelText('Filter by status'),'done');
  expect((screen.getByLabelText('Complete Ship') as HTMLInputElement).checked).toBe(true);await session.flush();
});
it('trashes and restores notes without losing their task links',async()=>{
  const {user,session}=setup({notes:[{id:'n',title:'Keep',body:'Text'}],tasks:[{id:'t',title:'Linked',done:false,noteId:'n'}],projects:[]});
  await user.click(screen.getByRole('button',{name:/▤Keep|▤ Keep/}));await user.click(screen.getByRole('button',{name:'Move to Trash',exact:true}));
  const dialog=screen.getByRole('dialog');await user.click(within(dialog).getByRole('button',{name:'Move to Trash',exact:true}));
  expect(session.snapshot().store.tasks[0].noteId).toBe('n');await user.click(screen.getByRole('button',{name:/Trash 1/}));await user.click(screen.getByRole('button',{name:'Restore',exact:true}));
  expect(session.snapshot().store.notes[0].deletedAt).toBeUndefined();await session.flush();
});
it('searches notes and tasks together and excludes unrelated subtasks from filters',async()=>{
  const {user,session}=setup({notes:[{id:'n',title:'Release',body:'Plan'}],tasks:[{id:'p',title:'Parent',done:true},{id:'a',title:'Ship',done:false,parentId:'p',priority:'high'},{id:'b',title:'Other',done:false,parentId:'p',priority:'low'}],projects:[]});
  await user.type(screen.getByLabelText('Search workspace'),'Ship');expect(screen.getAllByDisplayValue('Ship')).toHaveLength(2);expect(screen.queryByDisplayValue('Other')).toBeNull();
  await user.clear(screen.getByLabelText('Search workspace'));await user.click(screen.getByRole('button',{name:/Tasks 2/}));await user.selectOptions(screen.getByLabelText('Filter by priority'),'high');
  expect(screen.getByDisplayValue('Parent')).toBeTruthy();expect(screen.getByDisplayValue('Ship')).toBeTruthy();expect(screen.queryByDisplayValue('Other')).toBeNull();await session.flush();
});
