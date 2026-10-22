import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Note } from './model';
import { useState } from 'react';

function escape(text: string) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
export default function NoteEditor({ note, update }: { note: Note; update: (patch: Partial<Note>) => void }) {
  const [link, setLink] = useState<string | null>(null);
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Placeholder.configure({ placeholder: 'Start writing…' })],
    content: note.html ?? '<p>' + escape(note.body) + '</p>',
    onUpdate: ({ editor }) => update({ html: editor.getHTML(), body: editor.getText() }),
  });
  if (!editor) return null;
  const buttons: [string, () => void, boolean][] = [
    ['Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['Heading', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading')],
    ['Bullets', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
    ['Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
    ['Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote')],
    ['Code', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock')],
  ];
  return <><div className="toolbar" aria-label="Text formatting">{buttons.map(([label, action, active]) => <button key={label} type="button" aria-pressed={active} onClick={action}>{label}</button>)}
    <button type="button" onClick={() => setLink(editor.getAttributes('link').href || '')}>Link</button>
    <button type="button" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
    <button type="button" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
  </div>{link !== null && <form className="add-task" onSubmit={e => { e.preventDefault(); editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); setLink(null); }}><input autoFocus aria-label="Link URL" type="url" pattern="https?://.*" placeholder="https://example.com" required value={link} onChange={e => setLink(e.target.value)} /><button className="primary">Apply</button><button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setLink(null); }}>Remove link</button><button type="button" onClick={() => setLink(null)}>Cancel</button></form>}<EditorContent editor={editor} aria-label="Note content" /></>;
}
