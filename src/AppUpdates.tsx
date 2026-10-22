import { useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { desktop, type WorkspaceSession } from './persistence';
import { version } from '../package.json';

export default function AppUpdates({ session, visible, lock }: { session: WorkspaceSession; visible: boolean; lock: (busy: boolean) => void }) {
  const pending = useRef<Update | null>(null);
  const working = useRef(false);
  const [current, setCurrent] = useState(version);
  const [available, setAvailable] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState(false);
  async function perform(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(false);
    try { await action(); }
    catch { setError(true); setStatus('Could not complete the update. Check your connection and try again. If no release has been published yet, try again later.'); }
    finally { working.current = false; setBusy(false); lock(false); }
  }
  async function checkForUpdates() {
    await perform(async () => {
      setStatus('Checking for updates…');
      setCurrent(await getVersion());
      const next = await check({ timeout: 20000 });
      await pending.current?.close(); pending.current = next;
      setAvailable(next?.version ?? ''); setNotes(next?.body ?? '');
      setStatus(next ? `Noted ${next.version} is available.` : 'You’re up to date.');
    });
  }
  async function install() {
    await perform(async () => {
      if (installed) { lock(true); await session.flush(); await relaunch(); return; }
      const update = pending.current;
      if (!update) return;
      let received = 0, total: number | undefined;
      setStatus('Downloading update…');
      await update.download(event => {
        if (event.event === 'Started') { total = event.data.contentLength; received = 0; }
        if (event.event === 'Progress') received += event.data.chunkLength;
        setStatus(event.event === 'Finished' ? 'Download complete. Verifying update…' : total ? `Downloading update… ${Math.min(100, Math.floor(received / total * 100))}%` : `Downloading update… ${Math.round(received / 1024)} KB`);
      }, { timeout: 120000 });
      lock(true);
      setStatus('Saving your workspace…');
      try { await session.flush(); }
      catch { setError(true); setStatus('Update paused because your workspace could not be saved. Retry saving before installing.'); return; }
      setStatus('Installing update… Noted will restart.');
      await update.install();
      setInstalled(true); setStatus('Update installed. Restart Noted to finish.');
      await relaunch();
    });
  }
  return <section className="settings-card" hidden={!visible} aria-label="App updates">
    <h2>App updates</h2><p>Noted {current}</p>
    <p>{desktop ? 'Check for new versions and install them here. Your workspace is saved before Noted restarts.' : 'Updates are available in the installed desktop app.'}</p>
    <div className="note-actions">
      <button disabled={!desktop || busy || installed} onClick={() => void checkForUpdates()}>Check for updates</button>
      {available && <button disabled={busy} onClick={() => void install()}>{installed ? 'Restart Noted' : `Download and install ${available}`}</button>}
    </div>
    {status && <p role={error ? 'alert' : 'status'}>{status}</p>}
    {notes && <details><summary>What’s new</summary><p className="release-notes">{notes}</p></details>}
  </section>;
}
