import { useState, useRef, useEffect } from 'react';
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

async function collectPhotoData() {
  const projects = await getProjects();
  const photos = [];
  for (const project of projects) {
    const subs = await getSubprojects(project.id);
    for (const sub of subs) {
      const notes = await getNotes(sub.id);
      const base = `${project.name}.${sub.name}`;
      for (const note of notes) {
        const notePhotos = await getPhotos(note.id);
        const noteDate = new Date(note.createdAt)
          .toLocaleString('pl-PL')
          .replace(/[\s:]/g, '-')
          .replace(/,/g, '');
        notePhotos.forEach((p, i) => {
          const name = `${base}_${noteDate}_foto${String(i + 1).padStart(2, '0')}.jpg`;
          photos.push({ name, blob: p.blob });
        });
      }
    }
  }
  return photos;
}

export default function ExportPanel({ currentProject, currentSub }) {
  const [status, setStatus] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [preparedData, setPreparedData] = useState(null);
  const fileInputRef = useRef(null);
  const shareButtonRef = useRef(null);
  const preparedDataRef = useRef(null);

  useEffect(() => {
    preparedDataRef.current = preparedData;
  }, [preparedData]);

  useEffect(() => {
    const btn = shareButtonRef.current;
    if (!btn) return;

    function nativeShareHandler() {
      const data = preparedDataRef.current;
      if (!data) return;

      const txtFiles = data.subFiles.map(f =>
        new File([new Blob([f.text], { type: 'text/plain' })], f.name, { type: 'text/plain' })
      );
      const photoFiles = data.photos.map(p =>
        new File([p.blob], p.name, { type: 'image/jpeg' })
      );
      const allFiles = [...txtFiles, ...photoFiles];

      if (!navigator.share) {
        for (const file of txtFiles) {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url; a.download = file.name; a.click();
          URL.revokeObjectURL(url);
        }
        setPreparedData(null);
        preparedDataRef.current = null;
        setStatus(`Pobrano ${txtFiles.length} plików TXT.`);
        return;
      }

      let filesToShare = allFiles;
      try {
        if (!navigator.canShare({ files: allFiles })) {
          filesToShare = txtFiles;
        }
      } catch (_) {
        filesToShare = txtFiles;
      }

      navigator.share({ files: filesToShare, title: 'Dyktafon — notatki' })
        .then(() => {
          setPreparedData(null);
          preparedDataRef.current = null;
          setStatus('Udostępniono!');
        })
        .catch(e => {
          if (e.name !== 'AbortError') setStatus(`Błąd: ${e.message}`);
          else setStatus(null);
        });
    }

    btn.addEventListener('click', nativeShareHandler);
    return () => btn.removeEventListener('click', nativeShareHandler);
  }, []);

  async function handlePrepare() {
    try {
      setStatus('Przygotowuję...');
      const subFiles = await buildSubprojectFiles();
      if (!subFiles.length) {
        setStatus('Brak notatek do eksportu.');
        return;
      }
      const photos = await collectPhotoData();
      setPreparedData({ subFiles, photos });
      setStatus(`Gotowe: ${subFiles.length} plik(i) TXT${photos.length > 0 ? ` + ${photos.length} zdjęć` : ''}. Naciśnij "Udostępnij teraz".`);
    } catch (e) {
      setStatus(`Błąd przygotowania: ${e.message}`);
    }
  }

  async function handleShareJson() {
    try {
      setStatus('Przygotowuję kopię zapasową...');
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const now = new Date();
      const date = now.toLocaleDateString('pl-PL').replace(/\./g, '-');
      const time = now.toTimeString().slice(0, 5).replace(':', '-');
      const fileName = `Dyktafon_backup_${date}_${time}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      setStatus('Pobrano kopię zapasową — zapisz ją w bezpiecznym miejscu.');
    } catch (e) {
      setStatus(`Błąd: ${e.message}`);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

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
        Naciśnij "Przygotuj", poczekaj na potwierdzenie, a potem naciśnij "Udostępnij teraz".
      </p>

      <div className="export-buttons">
        <button className="btn btn-ms" onClick={handlePrepare}>
          📦 Przygotuj TXT + zdjęcia
        </button>
        <button
          ref={shareButtonRef}
          className="btn btn-share"
          style={{ display: preparedData ? 'inline-block' : 'none' }}
        >
          🚀 Udostępnij teraz
        </button>
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
