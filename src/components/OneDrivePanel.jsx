import { useState } from 'react';
import { exportAllData, getProjects, getSubprojects, getNotes } from '../db';

function formatDate(ts) {
  return new Date(ts).toLocaleString('pl-PL');
}

async function buildTextExport() {
  const projects = await getProjects();
  const lines = [`DYKTAFON — eksport ${formatDate(Date.now())}`, '='.repeat(50), ''];

  for (const project of projects) {
    lines.push(`PROJEKT: ${project.name}`);
    lines.push('─'.repeat(40));
    const subs = await getSubprojects(project.id);
    if (!subs.length) {
      lines.push('  (brak podprojektów)');
    }
    for (const sub of subs) {
      lines.push(`\n  PODPROJEKT: ${sub.name}`);
      const notes = await getNotes(sub.id);
      if (!notes.length) {
        lines.push('  (brak notatek)');
      } else {
        notes.sort((a, b) => a.createdAt - b.createdAt).forEach(n => {
          lines.push(`\n  [${formatDate(n.createdAt)}]`);
          lines.push(`  ${n.text}`);
        });
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export default function ExportPanel() {
  const [status, setStatus] = useState(null);

  async function handleShareText() {
    try {
      setStatus('Przygotowuję...');
      const text = await buildTextExport();
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], `dyktafon_${new Date().toISOString().slice(0,10)}.txt`, { type: 'text/plain' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Dyktafon — notatki' });
        setStatus('Udostępniono!');
      } else {
        // Fallback: download
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

  async function handleShareJson() {
    try {
      setStatus('Przygotowuję...');
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const file = new File([blob], `dyktafon_backup_${new Date().toISOString().slice(0,10)}.json`, { type: 'application/json' });

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
        Naciśnij przycisk — Android otworzy menu "Udostępnij". Wybierz aplikację <strong>OneDrive</strong> i plik zostanie tam zapisany.
      </p>

      <div className="export-buttons">
        <button className="btn btn-ms" onClick={handleShareText}>
          📄 Eksportuj jako TXT
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
        Plik TXT możesz otworzyć w Notatniku na komputerze.<br/>
        Plik JSON służy do backupu i przywracania danych.
      </p>
    </div>
  );
}
