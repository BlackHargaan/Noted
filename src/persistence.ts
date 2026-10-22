import { invoke, isTauri } from '@tauri-apps/api/core';
import { Store, initial, parseStore, parseBackup, backupText, MAX_BYTES } from './model';
export type Loaded = { store: Store | null; revision: number };
export type Recovery = { revision: number; created: string };
export interface Repository {
  load(): Promise<Loaded>;
  save(store: Store, revision: number): Promise<number>;
  recoveries(): Promise<Recovery[]>;
  recovery(revision: number): Promise<Store>;
}
const KEY = 'noted-v2';
export const desktop = isTauri();
export function repository(): Repository {
  if (desktop) return {
    load: () => invoke('load_workspace'),
    save: (store, revision) => invoke('save_workspace', { store, revision }),
    recoveries: () => invoke('list_recoveries'),
    recovery: revision => invoke('read_recovery', { revision }),
  };
  return {
    async load() {
      const text = localStorage.getItem(KEY);
      if (text !== null) { const v = JSON.parse(text); if (!Number.isSafeInteger(v.revision) || v.revision < 1) throw new Error('Invalid workspace revision.'); return { store: parseStore(v.store), revision: v.revision }; }
      const legacy = localStorage.getItem('noted-v1');
      return { store: legacy === null ? null : parseStore(JSON.parse(legacy)), revision: 0 };
    },
    async save(store, revision) {
      const current = localStorage.getItem(KEY); const actual = current === null ? 0 : JSON.parse(current).revision;
      if (actual !== revision) throw new Error('Workspace changed in another tab. Export your unsaved work, then reload.');
      localStorage.setItem(KEY, JSON.stringify({ store, revision: revision + 1 }));
      return revision + 1;
    },
    async recoveries() { return []; },
    async recovery() { throw new Error('Automatic recovery is available in the desktop app.'); },
  };
}
export type Snapshot = { store: Store; status: 'saved' | 'saving' | 'error'; error?: string };
export class WorkspaceSession {
  private current: Snapshot;
  private saved: Store;
  private revision: number;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private writing?: Promise<void>;
  constructor(private repo: Repository, loaded: Loaded) {
    const store = parseStore(loaded.store ?? initial);
    this.current = { store, status: 'saved' }; this.saved = store; this.revision = loaded.revision;
  }
  snapshot = () => this.current;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(next: Snapshot) { this.current = next; for (const l of this.listeners) l(); }
  get dirty() { return this.current.store !== this.saved; }
  update = (updater: Store | ((s: Store) => Store)) => {
    const store = typeof updater === 'function' ? updater(this.current.store) : parseStore(updater);
    if (store === this.current.store) return;
    this.emit({ store, status: 'saving' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 250);
  };
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.writing) return this.writing;
    if (!this.dirty) return Promise.resolve();
    this.writing = (async () => {
      try {
        while (this.dirty) {
          const store = this.current.store;
          this.revision = await this.repo.save(store, this.revision);
          this.saved = store;
        }
        this.emit({ store: this.current.store, status: 'saved' });
      } catch (e) {
        this.emit({ store: this.current.store, status: 'error', error: String(e) }); throw e;
      } finally { this.writing = undefined; }
    })();
    return this.writing;
  };
  async replace(store: Store) { await this.flush(); this.update(parseStore(store)); await this.flush(); }
  recoveries() { return this.repo.recoveries(); }
  recovery(revision: number) { return this.repo.recovery(revision); }
}
export async function openSession(repo = repository()) { return new WorkspaceSession(repo, await repo.load()); }
export async function exportBackup(store: Store) {
  if (desktop) return invoke<boolean>('export_backup', { store });
  const url = URL.createObjectURL(new Blob([backupText(store)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'Noted-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
}
export async function importBackup(): Promise<Store | null> {
  if (desktop) { const store = await invoke<Store | null>('import_backup'); return store === null ? null : parseStore(store); }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => { try { const file = input.files?.[0]; if (!file) return resolve(null); if (file.size > MAX_BYTES) throw new Error('Backup exceeds 25 MB.'); resolve(parseBackup(await file.text())); } catch (e) { reject(e); } };
    input.click();
  });
}
