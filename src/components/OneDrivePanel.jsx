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
        '='.repeat(50), ''
      ];
      notes.sort((a, b) => a.createdAt - b.createdAt).forEach(n => {
        lines.push(`[${formatDate(n.createdAt)}]`);
        lines.push(n.text);
        lines.push('');
      });
      files.push({ name: buildFileName(project.name, sub.name, 'txt'), text: lines.join('\n') });
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
        const noteDate = new Date(note.createdAt).toLocaleString('pl-PL').replace(/[\s:]/g, '-').replace(/,/g, '');
        notePhotos.forEach((p, i) => {
          photos.push({ name: `${base}_${noteDate}_foto${String(i+1).padStart(2,'0')}.jpg`, blob: p.blob });
        });
      }
    }
  }
  return photos;
}

function canShareSafe(files) {
  try { return navigator.canShare({ files }); } catch { return false; }
}

function downloadAll(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  }
}

export default function ExportPanel({ currentProject, currentSub }) {
  const [status, setStatus] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [preparedData, setPreparedData] = useState(null);
  const fileInputRef = useRef(null);
  const shareButtonRef = useRef(null);
  const diagButtonRef = useRef(null);
  const preparedDataRef = useRef(null);

  useEffect(() => { preparedDataRef.current = preparedData; }, [preparedData]);

  // Natywny listener — diagnoza
  useEffect(() => {
    const btn = diagButtonRef.current;
    if (!btn) return;
    function diagHandler() {
      const isActive = navigator.userActivation ? String(navigator.userActivation.isActive) : 'brak';
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const canTest = canShareSafe([testFile]);
      setStatus(`isActive=${isActive} canShare(testFile)=${canTest} — próbuję share...`);
      navigator.share({ files: [testFile], title: 'Test' })
        .then(() => setStatus('DIAGNOZA OK: share działa!'))
        .catch(e => setStatus(`DIAGNOZA BŁĄD: ${e.name}: ${e.message}`));
    }
    btn.addEventListener('click', diagHandler);
    return () => btn.removeEventListener('click', diagHandler);
  }, []);

  // Natywny listener — właściwy share
  useEffect(() => {
    const btn = shareButtonRef.current;
    if (!btn) return;
    function nativeShareHandler() {
      const data = preparedDataRef.current;
      if (!data) return;

      const txtFiles = data.subFiles.map(f =>
        new File([f.text], f.name, { type: 'text/plain' })
      );
      const photoFiles = data.photos.map(p =>
        new File([p.blob], p.name, { type: 'image/jpeg' })
      );
      const allFiles = [...txtFiles, ...photoFiles];

      if (!navigator.share) {
        downloadAll(txtFiles);
        setPreparedData(null); preparedDataRef.current = null;
        setStatus(`Pobrano ${txtFiles.length} plików TXT.`);
        return;
      }

      // Kaskadowe sprawdzanie canShare
      const canAll  = canShareSafe(allFiles);
      const canTxt  = canShareSafe(txtFiles);
      const canOne  = txtFiles.length > 0 && canShareSafe([txtFiles[0]]);

      let filesToShare = null;
      if (canAll)       filesToShare = allFiles;
      else if (canTxt)  filesToShare = txtFiles;
      else if (canOne)  filesToShare = [txtFiles[0]];

      if (!filesToShare) {
        // canShare zwraca false dla wszystkich wariantów — pobierz zamiast share
        setStatus(`canShare: all=${canAll} txt=${canTxt} one=${canOne} — fallback: pobieranie plików`);
        downloadAll(txtFiles);
        return;
      }

      navigator.share({ files: filesToShare, title: 'Dyktafon — notatki' })
        .then(() => {
          setPreparedData(null); preparedDataRef.current = null;
          setStatus('Udostępniono!');
        })
        .catch(e => {
          if (e.name !== 'AbortError')
            setStatus(`Błąd: ${e.message} | canAll=${canAll} canTxt=${canTxt} canOne=${canOne} pliki=${filesToShare.length}`);
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
      if (!subFiles.length) { setStatus('Brak notatek do eksportu.'); return; }
      const photos = await collectPhotoData();
      setPreparedData({ subFiles, photos });
      setStatus(`Gotowe: ${subFiles.length} plik(i) TXT + ${photos.length} zdjęć. Naciśnij "Udostępnij teraz".`);
    } catch (e) { setStatus(`Błąd przygotowania: ${e.message}`); }
  }

  async function handleDownloadAll() {
    try {
      setStatus('Przygotowuję pliki...');
      const subFiles = await buildSubprojectFiles();
      if (!subFiles.length) { setStatus('Brak notatek.'); return; }
      const txtFiles = subFiles.map(f => new File([f.text], f.name, { type: 'text/plain' }));
      const photoData = await collectPhotoData();
      const photoFiles = photoData.map(p => new File([p.blob], p.name, { type: 'image/jpeg' }));
      downloadAll([...txtFiles, ...photoFiles]);
      setStatus(`Pobrano ${txtFiles.length} TXT + ${photoFiles.length} zdjęć → znajdziesz je w Pobrane.`);
    } catch (e) { setStatus(`Błąd: ${e.message}`); }
  }

  async function handleShareJson() {
    try {
      setStatus('Przygotowuję backup...');
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const now = new Date();
      const fileName = `Dyktafon_backup_${now.toLocaleDateString('pl-PL').replace(/\./g,'-')}_${now.toTimeString().slice(0,5).replace(':','-')}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      setStatus('Pobrano kopię zapasową.');
    } catch (e) { setStatus(`Błąd: ${e.message}`); }
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
      if (!data.projects || !data.subprojects || !data.notes) { setStatus('Błąd: nieprawidłowy plik.'); return; }
      setPendingData(data); setConfirmImport(true); setStatus(null);
    } catch { setStatus('Błąd: nie udało się odczytać pliku JSON.'); }
  }

  async function handleConfirmImport() {
    setConfirmImport(false);
    try {
      setStatus('Importuję dane...');
      await importAllData(pendingData);
      setPendingData(null);
      setStatus('Import zakończony! Odświeżam...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setStatus(`Błąd importu: ${e.message}`); }
  }

  function handleCancelImport() { setConfirmImport(false); setPendingData(null); setStatus(null); }

  return (
    <div className="onedrive-panel">
      <h3>☁️ Eksport</h3>
      <div className="export-buttons">
        <button className="btn btn-ms" onClick={handlePrepare}>
          📦 Przygotuj + Udostępnij
        </button>
        <button ref={shareButtonRef} className="btn btn-share"
          style={{ display: preparedData ? 'inline-block' : 'none' }}>
          🚀 Udostępnij teraz
        </button>
        <button className="btn btn-ms" onClick={handleDownloadAll} style={{background:'#1a73e8'}}>
          ⬇️ Pobierz pliki (Pobrane)
        </button>
        <button className="btn btn-sync" onClick={handleShareJson}>
          💾 Pobierz JSON (backup)
        </button>
        <button className="btn btn-import" onClick={handleImportClick}>
          📥 Importuj z JSON
        </button>
        <button ref={diagButtonRef} className="btn"
          style={{fontSize:'0.8em',background:'#555',color:'#fff',marginTop:'8px'}}>
          🔍 Test Share API
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".json" style={{display:'none'}} onChange={handleFileSelected} />

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
        <p className={status.startsWith('Błąd') ? 'error' : 'od-status-msg'} style={{wordBreak:'break-all',fontSize:'0.85em'}}>
          {status}
        </p>
      )}

      <p className="od-info" style={{marginTop:'12px'}}>
        "Pobierz pliki" → folder Pobrane → prześlij do OneDrive.<br/>
        JSON zawiera pełny backup wraz ze zdjęciami.
      </p>
    </div>
  );
}
