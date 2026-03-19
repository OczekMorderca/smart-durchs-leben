import { useState, useEffect, useRef } from 'react';
import { useSpeech } from '../hooks/useSpeech';
import { addNote, addPhoto } from '../db';

export default function Dictaphone({ subprojectId, onNoteSaved }) {
  const { isListening, transcript, error, isSupported, start, stop, reset } = useSpeech('pl-PL');
  const [editText, setEditText] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (transcript) setEditText(transcript);
  }, [transcript]);

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(f => ({
      blob: f,
      url: URL.createObjectURL(f),
      mimeType: f.type,
    }));
    setPendingPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  }

  function removePhoto(index) {
    setPendingPhotos(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSave() {
    const text = editText.trim();
    if (!text || !subprojectId) return;
    const noteId = await addNote(subprojectId, text);
    for (const p of pendingPhotos) {
      await addPhoto(noteId, p.blob, p.mimeType);
      URL.revokeObjectURL(p.url);
    }
    reset();
    setEditText('');
    setPendingPhotos([]);
    onNoteSaved?.();
  }

  function handleClear() {
    pendingPhotos.forEach(p => URL.revokeObjectURL(p.url));
    setPendingPhotos([]);
    reset();
    setEditText('');
  }

  if (!isSupported) {
    return (
      <div className="dictaphone-unavailable">
        Rozpoznawanie mowy nie jest dostępne w tej przeglądarce.<br />
        Użyj Chrome lub Edge.
      </div>
    );
  }

  return (
    <div className="dictaphone">
      <div className="dictaphone-controls">
        <button className="btn btn-photo" onClick={() => fileInputRef.current?.click()} disabled={!subprojectId}>
          📷
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={handlePhotoChange}
        />
        {!isListening ? (
          <button className="btn btn-record" onClick={start} disabled={!subprojectId}>
            🎤 Nagraj
          </button>
        ) : (
          <button className="btn btn-stop" onClick={stop}>
            ⏹ Stop
          </button>
        )}
        {isListening && <span className="recording-indicator">● Nagrywanie…</span>}
      </div>

      {error && <div className="error">{error}</div>}

      {pendingPhotos.length > 0 && (
        <div className="photo-grid">
          {pendingPhotos.map((p, i) => (
            <div key={i} className="photo-thumb-wrap">
              <img src={p.url} className="photo-thumb" alt="" />
              <button className="photo-remove" onClick={() => removePhoto(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="transcript-editor"
        value={editText}
        onChange={e => setEditText(e.target.value)}
        placeholder={subprojectId ? 'Naciśnij Nagraj lub wpisz tekst…' : 'Wybierz podprojekt aby nagrywać'}
        rows={5}
      />

      <div className="dictaphone-actions">
        <button className="btn btn-save" onClick={handleSave} disabled={!editText.trim() || !subprojectId}>
          💾 Zapisz notatkę
        </button>
        {(editText || pendingPhotos.length > 0) && (
          <button className="btn btn-clear" onClick={handleClear}>
            ✕ Wyczyść
          </button>
        )}
      </div>
    </div>
  );
}
