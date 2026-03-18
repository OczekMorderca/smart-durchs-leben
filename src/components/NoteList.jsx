import { useState } from 'react';
import { deleteNote, updateNote } from '../db';

export default function NoteList({ notes, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  function startEdit(note) {
    setEditingId(note.id);
    setEditText(note.text);
  }

  async function saveEdit(id) {
    await updateNote(id, editText);
    setEditingId(null);
    onChanged?.();
  }

  async function handleDelete(id) {
    if (!confirm('Usunąć notatkę?')) return;
    await deleteNote(id);
    onChanged?.();
  }

  if (!notes.length) return <p className="empty-msg">Brak notatek. Nagraj pierwszą!</p>;

  return (
    <div className="note-list">
      {notes.sort((a, b) => b.createdAt - a.createdAt).map(note => (
        <div key={note.id} className="note-card">
          <div className="note-meta">
            {new Date(note.createdAt).toLocaleString('pl-PL')}
          </div>
          {editingId === note.id ? (
            <>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={4}
                className="note-edit-area"
              />
              <div className="note-actions">
                <button className="btn btn-save" onClick={() => saveEdit(note.id)}>Zapisz</button>
                <button className="btn btn-clear" onClick={() => setEditingId(null)}>Anuluj</button>
              </div>
            </>
          ) : (
            <>
              <p className="note-text">{note.text}</p>
              <div className="note-actions">
                <button className="btn btn-edit" onClick={() => startEdit(note)}>✏️</button>
                <button className="btn btn-delete" onClick={() => handleDelete(note.id)}>🗑️</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
