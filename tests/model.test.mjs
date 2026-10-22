import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/model.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { read, descendants, deleteTask, deleteNote } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('legacy notes and tasks survive loading without projects or rich text', () => {
  const legacy = { notes: [{ id: 'n', title: 'Old note', body: '<plain text>' }], tasks: [{ id: 't', title: 'Old task', done: true }] };
  globalThis.localStorage = { getItem: () => JSON.stringify(legacy) };
  assert.deepEqual(read(), { ...legacy, projects: [] });
});
test('deleting a page keeps child pages and detaches its tasks', () => {
  const s = { notes: [{ id: 'a' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }], tasks: [{ id: 't', noteId: 'b', done: false }], projects: [] };
  const next = deleteNote(s, 'b');
  assert.equal(next.notes.find(n => n.id === 'c').parentId, 'a');
  assert.equal(next.tasks[0].noteId, undefined);
  assert.equal(next.tasks[0].done, false);
  assert.equal(s.tasks[0].noteId, 'b');
});
test('deleting a task removes all its descendants but preserves other tasks', () => {
  const s = { notes: [], tasks: [{ id: 'a' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }, { id: 'd' }], projects: [] };
  assert.deepEqual([...descendants(s.tasks, 'a')], ['a', 'b', 'c']);
  assert.deepEqual(deleteTask(s, 'a').tasks.map(t => t.id), ['d']);
});
test('invalid storage falls back without throwing', () => {
  globalThis.localStorage = { getItem: () => '{' };
  assert.equal(read().notes[0].id, 'welcome');
});
