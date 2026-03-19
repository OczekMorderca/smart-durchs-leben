import { useState, useEffect, useRef } from 'react';
import { deleteNote, updateNote, getPhotos, addPhoto, deletePhoto } from '../db';

function NoteCard({ note, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let urls = [];
    getPhotos(note.id).then(ps => {
      urls = ps.map(p => ({ ...p, url: URL.createObjectURL(p.blob) }));
      setPhotos(urls);
    });
    return () => urls.forEach(p => URL.revokeObjectURL(p.url));
  }, [note.id]);

  function startEdit() {
    setEditingId(note.id);
    setEditText(note.text);
    setRemovedPhotoIds([]);
    setNewPhotos([]);
  }

  function cancelEdit() {
    newPhotos.forEach(p => URL.revokeObjectURL(p.url));
    setNewPhotos([]);
    setRemovedPhotoIds([]);
    setEditingId(null);
  }

  async function saveEdit() {
    await updateNote(note.id, editText);
    for (const id of removedPhotoIds) await deletePhoto(id);
    for (const p of newPhotos) {
      await addPhoto(note.id, p.blob, p.mimeType);
      URL.revokeObjectURL(p.url);
    }
    setEditingId(null);
    setNewPhotos([]);
    setRemovedPhotoIds([]);
    onChanged?.();
  }

  async function handleDelete() {
    if (!confirm('Usunąć notatkę?')) return;
    await deleteNote(note.id);
    onChanged?.();
  }

  function handleNewPhoto(e) {
    const files = Array.from(e.target.files);
    const added = files.map(f => ({ blob: f, url: URL.createObjectURL(f), mimeType: f.type }));
    setNewPhotos(prev => [...prev, ...added]);
    e.target.value = '';
  }

  const visiblePhotos = photos.filter(p => !removedPhotoIds.includes(p.id));

  return (
    <div className="note-card">
      <div className="note-meta">{new Date(note.createdAt).toLocaleString('pl-PL')}</div>

      {editingId === note.id ? (
        <>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={4}
            className="note-edit-area"
          />
          {(visiblePhotos.length > 0 || newPhotos.length > 0) && (
            <div className="photo-grid">
              {visiblePhotos.map(p => (
                <div key={p.id} className="photo-thumb-wrap">
                  <img src={p.url} className="photo-thumb" alt="" />
                  <button className="photo-remove" onClick={() => setRemovedPhotoIds(prev => [...prev, p.id])}>✕</button>
                </div>
              ))}
              {newPhotos.map((p, i) => (
                <div key={'new-' + i} className="photo-thumb-wrap">
                  <img src={p.url} className="photo-thumb" alt="" />
                  <button className="photo-remove" onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setNewPhotos(prev => prev.filter((_, j) => j !== i));
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="note-actions">
            <button className="btn btn-photo" onClick={() => fileInputRef.current?.click()}>📷</button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleNewPhoto} />
            <button className="btn btn-save" onClick={saveEdit}>Zapisz</button>
            <button className="btn btn-clear" onClick={cancelEdit}>Anuluj</button>
          </div>
        </>
      ) : (
        <>
          <p className="note-text">{note.text}</p>
          {photos.length > 0 && (
            <div className="photo-grid">
              {photos.map(p => (
                <div key={p.id} className="photo-thumb-wrap">
                  <img src={p.url} className="photo-thumb" alt="" onClick={() => window.open(p.url)} />
                </div>
              ))}
            </div>
          )}
          <div className="note-actions">
            <button className="btn btn-edit" onClick={startEdit}>✏️</button>
            <button className="btn btn-delete" onClick={handleDelete}>🗑️</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function NoteList({ notes, onChanged }) {
  if (!notes.length) return <p className="empty-msg">Brak notatek. Nagraj pierwszą!</p>;

  return (
    <div className="note-list">
      {[...notes].sort((a, b) => b.createdAt - a.createdAt).map(note => (
        <NoteCard key={note.id} note={note} onChanged={onChanged} />
      ))}
    </div>
  );
}
