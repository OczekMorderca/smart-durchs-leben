import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dictaphone from './components/Dictaphone';
import NoteList from './components/NoteList';
import OneDrivePanel from './components/OneDrivePanel';
import { getProjects, getSubprojects, getNotes } from './db';
import './App.css';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [subprojects, setSubprojects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState({ projectId: null, subprojectId: null });
  const [view, setView] = useState('notes'); // 'notes' | 'settings'
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    const p = await getProjects();
    setProjects(p);
    const allSubs = [];
    for (const proj of p) {
      const subs = await getSubprojects(proj.id);
      allSubs.push(...subs);
    }
    setSubprojects(allSubs);
  }, []);

  const loadNotes = useCallback(async () => {
    if (!selected.subprojectId) { setNotes([]); return; }
    const n = await getNotes(selected.subprojectId);
    setNotes(n);
  }, [selected.subprojectId]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  const currentProject = projects.find(p => p.id === selected.projectId);
  const currentSub = subprojects.find(s => s.id === selected.subprojectId);

  return (
    <div className="app">
      <header className="app-header">
        <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
        <h1 className="app-title">🎤 Dyktafon</h1>
        <button className="settings-btn" onClick={() => setView(v => v === 'settings' ? 'notes' : 'settings')}>
          ⚙️
        </button>
      </header>

      <div className={`layout ${sidebarOpen ? 'sidebar-visible' : ''}`}>
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        <Sidebar
          projects={projects}
          subprojects={subprojects}
          selected={selected}
          onSelect={(sel) => { setSelected(sel); if (sel.subprojectId) setSidebarOpen(false); }}
          onChanged={loadProjects}
        />

        <main className="main-content">
          {view === 'settings' ? (
            <OneDrivePanel />
          ) : (
            <>
              <div className="breadcrumb">
                {currentProject ? (
                  <span>{currentProject.name}{currentSub ? ` › ${currentSub.name}` : ''}</span>
                ) : (
                  <span className="breadcrumb-hint">← Wybierz projekt z menu</span>
                )}
              </div>

              <Dictaphone
                subprojectId={selected.subprojectId}
                onNoteSaved={loadNotes}
              />

              {selected.subprojectId && (
                <>
                  <h3 className="notes-heading">Zapisane notatki ({notes.length})</h3>
                  <NoteList notes={notes} onChanged={loadNotes} />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
