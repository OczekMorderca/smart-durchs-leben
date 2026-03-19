import { openDB } from 'idb';

const DB_NAME = 'dyktafon-db';
const DB_VERSION = 2;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('projects')) {
          const projects = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
          projects.createIndex('name', 'name');
        }
        if (!db.objectStoreNames.contains('subprojects')) {
          const sub = db.createObjectStore('subprojects', { keyPath: 'id', autoIncrement: true });
          sub.createIndex('projectId', 'projectId');
        }
        if (!db.objectStoreNames.contains('notes')) {
          const notes = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          notes.createIndex('subprojectId', 'subprojectId');
          notes.createIndex('createdAt', 'createdAt');
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('photos')) {
          const photos = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
          photos.createIndex('noteId', 'noteId');
        }
      }
    },
  });
}

// Projects
export async function getProjects() {
  const db = await getDB();
  return db.getAll('projects');
}
export async function addProject(name) {
  const db = await getDB();
  return db.add('projects', { name, createdAt: Date.now() });
}
export async function deleteProject(id) {
  const db = await getDB();
  const subs = await db.getAllFromIndex('subprojects', 'projectId', id);
  for (const sub of subs) {
    await deleteSubproject(sub.id);
  }
  return db.delete('projects', id);
}

// Subprojects
export async function getSubprojects(projectId) {
  const db = await getDB();
  return db.getAllFromIndex('subprojects', 'projectId', projectId);
}
export async function addSubproject(projectId, name) {
  const db = await getDB();
  return db.add('subprojects', { projectId, name, createdAt: Date.now() });
}
export async function deleteSubproject(id) {
  const db = await getDB();
  const notes = await db.getAllFromIndex('notes', 'subprojectId', id);
  for (const note of notes) {
    await deleteNote(note.id);
  }
  return db.delete('subprojects', id);
}

// Notes
export async function getNotes(subprojectId) {
  const db = await getDB();
  return db.getAllFromIndex('notes', 'subprojectId', subprojectId);
}
export async function addNote(subprojectId, text) {
  const db = await getDB();
  return db.add('notes', { subprojectId, text, createdAt: Date.now() });
}
export async function updateNote(id, text) {
  const db = await getDB();
  const note = await db.get('notes', id);
  return db.put('notes', { ...note, text, updatedAt: Date.now() });
}
export async function deleteNote(id) {
  const db = await getDB();
  const photos = await db.getAllFromIndex('photos', 'noteId', id);
  for (const p of photos) {
    await db.delete('photos', p.id);
  }
  return db.delete('notes', id);
}

// Photos
export async function getPhotos(noteId) {
  const db = await getDB();
  return db.getAllFromIndex('photos', 'noteId', noteId);
}
export async function addPhoto(noteId, blob, mimeType) {
  const db = await getDB();
  return db.add('photos', { noteId, blob, mimeType, createdAt: Date.now() });
}
export async function deletePhoto(id) {
  const db = await getDB();
  return db.delete('photos', id);
}

// Export all data as JSON
export async function exportAllData() {
  const db = await getDB();
  const projects = await db.getAll('projects');
  const subprojects = await db.getAll('subprojects');
  const notes = await db.getAll('notes');
  return { projects, subprojects, notes, exportedAt: new Date().toISOString() };
}
