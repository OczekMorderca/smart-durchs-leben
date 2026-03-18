import { useState, useEffect } from 'react';
import { useSpeech } from '../hooks/useSpeech';
import { addNote } from '../db';

export default function Dictaphone({ subprojectId, onNoteSaved }) {
  const { isListening, transcript, error, isSupported, start, stop, reset } = useSpeech('pl-PL');
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (transcript) setEditText(transcript);
  }, [transcript]);

  async function handleSave() {
    const text = editText.trim();
    if (!text || !subprojectId) return;
    await addNote(subprojectId, text);
    reset();
    setEditText('');
    onNoteSaved?.();
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
        {editText && (
          <button className="btn btn-clear" onClick={() => { reset(); setEditText(''); }}>
            ✕ Wyczyść
          </button>
        )}
      </div>
    </div>
  );
}
