import { useState, useRef } from 'react';
import { exportAllData, importAllData, getProjects, getSubprojects, getNotes, getPhotos } from '../db';

function formatDate(ts) {
  return new Date(ts).toLocaleString('pl-PL');
}

function buildFileName(projectName, subName, ext) {
  const now = new Date();
  const date = now.toLocaleDateString('pl-PL').replace(/\./g, '-');
  const time = now.toTimeString().slice(0, 5).replace(':', '-');
  const base = subName ? `${projectName}.${subName}` : projectName;
  return `${base}_${date}_${time}.${ext}`;
}

async function buildSubprojectFiles() {
  const projects = await getProjects();
  const files = [];
  for (const project of projects) {
    const subs = await getSubprojects(project.id);
    for (const sub of subs) {
      const notes = await getNotes(sub.id);
      if (!notes.length) continue;
      const lines = [
        `PROJEKT: ${project.name}`,
        `PODPROJEKT: ${sub.name}`,
        '='.repeat(50),
        ''
      ];
      notes.sort((a, b) => a.createdAt - b.createdAt).forEach(n => {
        lines.push(`[${formatDate(n.createdAt)}]`);
        lines.push(n.text);
        lines.push('');
      });
      files.push({
        name: buildFileName(project.name, sub.name, 'txt'),
        text: lines.join('\n')
      });
    }
  }
  return files;
}

async function collectPhotoFiles() {
  const projects = await getProjects();
  const files = [];
  for (const project of projects) {
    const subs = await getSubprojects(project.id);
    for (const sub of subs) {
      const notes = await getNotes(sub.id);
      const base = `${project.name}.${sub.name}`;
      for (const note of notes) {
        const photos = await getPhotos(note.id);
        const noteDate = new Date(note.createdAt)
          .toLocaleString('pl-PL')
          .replace(/[\s:]/g, '-')
          .replace(/,/g, '');
        photos.forEach((p, i) => {
          const name = `${base}_${noteDate}_foto${String(i + 1).padStart(2, '0')}.jpg`;
          files.push(new File([p.blob], name, { type: 'image/jpeg' }));
        });
      }
    }
  }
  return files;
}

export default function ExportPanel() {
  const [status, setStatus] = useState(null);
  const [preparedFiles, setPreparedFiles] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const fileInputRef = useRef(null);

  // Krok 1: przygotuj pliki w tle (async)
  async function handlePrepare() {
    setPreparedFiles(null);
    setStatus('Przygotowuję pliki...');
    try {
      const subFiles = await buildSubprojectFiles();
      if (!subFiles.length) {
        setStatus('Brak notatek do eksportu.');
        return;
      }
      const txtFiles = subFiles.map(f =>
        new File([new Blob([f.text], { type: 'text/plain' })], f.name, { type: 'text/plain' })
      );
      const photoFiles = await collectPhotoFiles();
      const allFiles = [...txtFiles, ...photoFiles];
      setPreparedFiles(allFiles);
      setStatus(
        `Gotowe: ${txtFiles.length} TXT${photoFiles.length > 0 ? ` + ${photoFiles.length} zdjęć` : ''}. Naciśnij "Udostępnij".`
      );
    } catch (e) {
      setStatus(`Błąd: ${e.message}`);
    }
  }

  // Krok 2: udostępnij — wywołane bezpośrednio z user gesture, zero async przed share
  async function handleDoShare() {
    if (!preparedFiles) return;
    try {
      if (navigator.share && navigator.canShare({ files: preparedFiles })) {
        await navigator.share({ files: preparedFiles, title: 'Dyktafon — notatki' });
        setPreparedFiles(null);
        setStatus('Udostępniono!');
      } else {
        // Fallback desktop: pobierz pliki TXT
        const txtFiles = preparedFiles.filter(f => f.type === 'text/plain');
        for (const file of txtFiles) {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        }
        setPreparedFiles(null);
        setStatus(`Pobrano ${txtFiles.length} plików TXT.`);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setStatus(`Błąd: ${e.message}`);
      else setStatus(null);
    }
  }

  // JSON backup — zawsze download (konwersja base64 trwa za długo dla share)
  async function handleShareJson() {
    try {
      setStatus('Przygotowuję kopię zapasową...');
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const now = new Date();
      const date = now.toLocaleDateString('pl-PL').replace(/\./g, '-');
      const time = now.toTimeString().slice(0, 5).replace(':', '-');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dyktafon_backup_${date}_${time}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Pobrano kopię zapasową — zapisz ją w bezpiecznym miejscu.');
    } catch (e) {
      setStatus(`Błąd: ${e.message}`);
    }
  }

  function handleImportClick() { fileInputRef.current?.click(); }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      setStatus('Wczytuję plik...');
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.projects || !data.subprojects || !data.notes) {
        setStatus('Błąd: nieprawidłowy plik kopii zapasowej.');
        return;
      }
      setPendingData(data);
      setConfirmImport(true);
      setStatus(null);
    } catch {
      setStatus('Błąd: nie udało się odczytać pliku JSON.');
    }
  }

  async function handleConfirmImport() {
    setConfirmImport(false);
    try {
      setStatus('Importuję dane...');
      await importAllData(pendingData);
      setPendingData(null);
      setStatus('Import zakończony! Odświeżam...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setStatus(`Błąd importu: ${e.message}`);
    }
  }

  function handleCancelImport() {
    setConfirmImport(false);
    setPendingData(null);
    setStatus(null);
  }

  return (
    <div className="onedrive-panel">
      <h3>☁️ Eksport do OneDrive</h3>
      <p className="od-info">
        Naciśnij "Przygotuj", poczekaj aż pliki będą gotowe, potem naciśnij "Udostępnij".
      </p>

      <div className="export-buttons">
        <button className="btn btn-ms" onClick={handlePrepare}>
          📦 Przygotuj TXT + zdjęcia
        </button>
        {preparedFiles && (
          <button className="btn btn-share" onClick={handleDoShare}>
            🚀 Udostępnij teraz
          </button>
        )}
        <button className="btn btn-sync" onClick={handleShareJson}>
          💾 Pobierz JSON (backup)
        </button>
        <button className="btn btn-import" onClick={handleImportClick}>
          📥 Importuj z JSON
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {confirmImport && (
        <div className="import-confirm">
          <p>⚠️ Import nadpisze <strong>wszystkie</strong> obecne dane. Czy na pewno?</p>
          <div className="import-confirm-buttons">
            <button className="btn btn-danger" onClick={handleConfirmImport}>Tak, importuj</button>
            <button className="btn" onClick={handleCancelImport}>Anuluj</button>
          </div>
        </div>
      )}

      {status && (
        <p className={status.startsWith('Błąd') ? 'error' : 'od-status-msg'}>
          {status}
        </p>
      )}

      <p className="od-info" style={{marginTop: '12px'}}>
        Każdy podprojekt trafia do osobnego pliku TXT.<br/>
        JSON zawiera pełny backup wraz ze zdjęciami.
      </p>
    </div>
  );
}
