import { useState } from 'react';
import { exportAllData, getProjects, getSubprojects, getNotes, getPhotos } from '../db';

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

export default function ExportPanel({ currentProject, currentSub }) {
  const [status, setStatus] = useState(null);

  async function handleShareText() {
    try {
      setStatus('Przygotowuję...');
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

      if (navigator.share) {
        if (navigator.canShare({ files: allFiles })) {
          await navigator.share({ files: allFiles, title: 'Dyktafon — notatki' });
          setStatus(`Udostępniono ${txtFiles.length} plików TXT${photoFiles.length > 0 ? ` + ${photoFiles.length} zdjęć` : ''}`);
        } else {
          const sharablePhotos = photoFiles.filter(f => {
            try { return navigator.canShare({ files: [f] }); } catch { return false; }
          });
          const filesToShare = [...txtFiles, ...sharablePhotos];
          if (navigator.canShare({ files: filesToShare })) {
            await navigator.share({ files: filesToShare, title: 'Dyktafon — notatki' });
            setStatus(`Udostępniono ${txtFiles.length} plików TXT + ${sharablePhotos.length}/${photoFiles.length} zdjęć`);
          } else {
            await navigator.share({ files: txtFiles, title: 'Dyktafon — notatki' });
            setStatus(`Udostępniono ${txtFiles.length} plików TXT (zdjęcia pominięte)`);
          }
        }
      } else {
        for (const file of txtFiles) {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        }
        setStatus(`Pobrano ${txtFiles.length} plików — zapisz je do folderu OneDrive.`);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setStatus(`Błąd: ${e.message}`);
      else setStatus(null);
    }
  }

  async function handleShareJson() {
    try {
      setStatus('Przygotowuję...');
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const now = new Date();
      const date = now.toLocaleDateString('pl-PL').replace(/\./g, '-');
      const time = now.toTimeString().slice(0, 5).replace(':', '-');
      const file = new File([blob], `Dyktafon_backup_${date}_${time}.json`, { type: 'application/json' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Dyktafon — backup JSON' });
        setStatus('Udostępniono!');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Pobrano plik — zapisz go do folderu OneDrive.');
      }
    } catch (e) {
      if (e.name !== 'AbortError') setStatus(`Błąd: ${e.message}`);
      else setStatus(null);
    }
  }

  return (
    <div className="onedrive-panel">
      <h3>☁️ Eksport do OneDrive</h3>
      <p className="od-info">
        Naciśnij przycisk — Android otworzy menu "Udostępnij". Wybierz aplikację <strong>OneDrive</strong> i pliki zostaną tam zapisane.
      </p>

      <div className="export-buttons">
        <button className="btn btn-ms" onClick={handleShareText}>
          📄 Eksportuj TXT + zdjęcia
        </button>
        <button className="btn btn-sync" onClick={handleShareJson}>
          💾 Eksportuj jako JSON (backup)
        </button>
      </div>

      {status && (
        <p className={status.startsWith('Błąd') ? 'error' : 'od-status-msg'}>
          {status}
        </p>
      )}

      <p className="od-info" style={{marginTop: '12px'}}>
        Każdy podprojekt trafia do osobnego pliku TXT.<br/>
        Plik JSON służy do backupu i przywracania danych.
      </p>
    </div>
  );
}
