import { useEffect, useState } from 'react';
import App from './App';
import { openSession, WorkspaceSession, desktop } from './persistence';
export default function WorkspaceApp() {
  const [session, setSession] = useState<WorkspaceSession>();
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    openSession().then(s => { if (!cancelled) setSession(s); }).catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!session) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { if (session.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    let dispose: (() => void) | undefined, stopped = false;
    if (desktop) void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const unlisten = await win.onCloseRequested(async event => {
        if (session.dirty) { event.preventDefault(); try { await session.flush(); await win.close(); } catch { /* Keep unsaved work open. */ } }
      });
      if (stopped) unlisten(); else dispose = unlisten;
    });
    return () => { stopped = true; dispose?.(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [session]);
  if (error) return <main className="startup"><h1>Your workspace could not be opened</h1><p role="alert">{error}</p><p>Existing data has not been replaced. Reopen Noted after resolving the storage problem.</p><button onClick={() => window.location.reload()}>Try again</button></main>;
  if (!session) return <main className="startup" role="status">Opening your workspace…</main>;
  return <App session={session} />;
}
