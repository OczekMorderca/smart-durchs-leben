import { useState } from 'react';
import { addProject, deleteProject, addSubproject, deleteSubproject } from '../db';

export default function Sidebar({ projects, subprojects, selected, onSelect, onChanged }) {
  const [newProjectName, setNewProjectName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [expandedProject, setExpandedProject] = useState(null);
  const [addingSubTo, setAddingSubTo] = useState(null);

  async function handleAddProject() {
    if (!newProjectName.trim()) return;
    await addProject(newProjectName.trim());
    setNewProjectName('');
    onChanged?.();
  }

  async function handleDeleteProject(e, id) {
    e.stopPropagation();
    if (!confirm('Usunąć projekt i wszystkie jego dane?')) return;
    await deleteProject(id);
    if (selected.projectId === id) onSelect({ projectId: null, subprojectId: null });
    onChanged?.();
  }

  async function handleAddSub(projectId) {
    if (!newSubName.trim()) return;
    await addSubproject(projectId, newSubName.trim());
    setNewSubName('');
    setAddingSubTo(null);
    onChanged?.();
  }

  async function handleDeleteSub(e, id) {
    e.stopPropagation();
    if (!confirm('Usunąć podprojekt i wszystkie notatki?')) return;
    await deleteSubproject(id);
    if (selected.subprojectId === id) onSelect({ ...selected, subprojectId: null });
    onChanged?.();
  }

  return (
    <nav className="sidebar">
      <h2 className="sidebar-title">Projekty</h2>

      <div className="add-row">
        <input
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddProject()}
          placeholder="Nowy projekt…"
          className="input-inline"
        />
        <button className="btn btn-add" onClick={handleAddProject}>+</button>
      </div>

      {projects.map(project => (
        <div key={project.id} className="project-item">
          <div
            className={`project-header ${selected.projectId === project.id ? 'active' : ''}`}
            onClick={() => {
              setExpandedProject(expandedProject === project.id ? null : project.id);
              onSelect({ projectId: project.id, subprojectId: null });
            }}
          >
            <span className="project-name">
              {expandedProject === project.id ? '▾' : '▸'} {project.name}
            </span>
            <div className="project-btns">
              <button className="btn-icon" onClick={e => { e.stopPropagation(); setAddingSubTo(addingSubTo === project.id ? null : project.id); }} title="Dodaj podprojekt">＋</button>
              <button className="btn-icon danger" onClick={e => handleDeleteProject(e, project.id)} title="Usuń projekt">✕</button>
            </div>
          </div>

          {addingSubTo === project.id && (
            <div className="add-row sub-add">
              <input
                value={newSubName}
                onChange={e => setNewSubName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSub(project.id)}
                placeholder="Nowy podprojekt…"
                className="input-inline"
                autoFocus
              />
              <button className="btn btn-add" onClick={() => handleAddSub(project.id)}>+</button>
            </div>
          )}

          {expandedProject === project.id && (
            <div className="subproject-list">
              {subprojects
                .filter(s => s.projectId === project.id)
                .map(sub => (
                  <div
                    key={sub.id}
                    className={`subproject-item ${selected.subprojectId === sub.id ? 'active' : ''}`}
                    onClick={() => onSelect({ projectId: project.id, subprojectId: sub.id })}
                  >
                    <span>{sub.name}</span>
                    <button className="btn-icon danger" onClick={e => handleDeleteSub(e, sub.id)} title="Usuń podprojekt">✕</button>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
