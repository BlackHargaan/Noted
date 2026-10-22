import { useEffect, useRef, useState } from 'react';
export type ModalRequest = { title: string; initial?: string; confirm?: boolean; submitLabel?: string; submit: (value: string) => void | Promise<void> };
export default function Modal({ request, close }: { request: ModalRequest; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(request.initial ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const d = ref.current!; const previous = document.activeElement as HTMLElement; d.showModal(); return () => { d.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
    <form onSubmit={async e => { e.preventDefault(); if (!request.confirm && !value.trim()) return; setBusy(true); try { await request.submit(value.trim()); close(); } catch (err) { setError(String(err)); setBusy(false); } }}>
      <h2 id="modal-title">{request.title}</h2>{!request.confirm && <input autoFocus aria-label={request.title} value={value} onChange={e => setValue(e.target.value)} required maxLength={500} />}
      {error && <p role="alert">{error}</p>}<div className="note-actions"><button autoFocus={request.confirm} type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Working…' : request.submitLabel || 'Save'}</button></div>
    </form>
  </dialog>;
}
