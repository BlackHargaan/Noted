import { createContext, useContext } from 'react';
import { Store, Task } from './model';
export type TasksContext = { store: Store; editTask: (id: string, patch: Partial<Task>) => void; openNote: (id: string) => void };
export const TaskContext = createContext<TasksContext | null>(null);
export function useTasks() { const value = useContext(TaskContext); if (!value) throw new Error('Task provider missing'); return value; }
