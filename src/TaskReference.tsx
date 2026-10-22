import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import { useTasks } from './TaskContext';
function TaskReferenceView({ node }: NodeViewProps) {
  const { store, editTask } = useTasks();
  const task = store.tasks.find(t => t.id === node.attrs.taskId);
  return <NodeViewWrapper className="task-reference" contentEditable={false}>
    {task && !task.deletedAt ? <label><input type="checkbox" aria-label={'Complete inline task ' + task.title} checked={task.done} onChange={e => editTask(task.id, { done: e.target.checked })} /><span className={task.done ? 'done' : ''}>{task.title || 'Untitled task'}</span></label> : <span>Task in Trash or unavailable</span>}
  </NodeViewWrapper>;
}
export const TaskReference = Node.create({
  name: 'taskReference', group: 'block', atom: true,
  addAttributes() { return { taskId: { default: '', parseHTML: el => el.getAttribute('data-task-id'), renderHTML: attrs => ({ 'data-task-id': attrs.taskId }) } }; },
  parseHTML() { return [{ tag: 'div[data-task-id]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'task-reference' }), 'Linked task']; },
  addNodeView() { return ReactNodeViewRenderer(TaskReferenceView); },
});
