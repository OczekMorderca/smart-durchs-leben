import { useState, useCallback } from 'react';

const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '';
const REDIRECT_URI = window.location.origin;
const SCOPES = ['Files.ReadWrite', 'User.Read'];

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    response_mode: 'fragment',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

function getTokenFromHash() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const expiresIn = params.get('expires_in');
  if (token) {
    const expiresAt = Date.now() + parseInt(expiresIn, 10) * 1000;
    localStorage.setItem('od_token', token);
    localStorage.setItem('od_expires', expiresAt);
    window.location.hash = '';
    return token;
  }
  return null;
}

function getSavedToken() {
  const token = localStorage.getItem('od_token');
  const expires = parseInt(localStorage.getItem('od_expires') || '0', 10);
  if (token && Date.now() < expires) return token;
  return null;
}

export function useOneDrive() {
  const [token, setToken] = useState(() => {
    const fromHash = getTokenFromHash();
    if (fromHash) return fromHash;
    return getSavedToken();
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);

  const isConnected = !!token;

  const login = useCallback(() => {
    if (!CLIENT_ID) {
      setSyncError('Brak konfiguracji CLIENT_ID. Ustaw VITE_ONEDRIVE_CLIENT_ID w pliku .env');
      return;
    }
    window.location.href = buildAuthUrl();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('od_token');
    localStorage.removeItem('od_expires');
    setToken(null);
  }, []);

  const uploadFile = useCallback(async (path, content) => {
    if (!token) throw new Error('Nie jesteś zalogowany do OneDrive');
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  }, [token]);

  const syncToOneDrive = useCallback(async (data) => {
    if (!token) return;
    setSyncing(true);
    setSyncError(null);
    try {
      // Upload full backup
      await uploadFile('Dyktafon/backup.json', data);

      // Upload per-project files
      const { projects, subprojects, notes } = data;
      for (const project of projects) {
        const projectSubs = subprojects.filter(s => s.projectId === project.id);
        for (const sub of projectSubs) {
          const subNotes = notes.filter(n => n.subprojectId === sub.id);
          const lines = subNotes
            .sort((a, b) => a.createdAt - b.createdAt)
            .map(n => `[${new Date(n.createdAt).toLocaleString('pl-PL')}]\n${n.text}`)
            .join('\n\n---\n\n');
          const safeProjName = project.name.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ \-_]/g, '_');
          const safeSubName = sub.name.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ \-_]/g, '_');
          const path = `Dyktafon/${safeProjName}/${safeSubName}.txt`;
          await uploadFile(path, lines || '(brak notatek)');
        }
      }

      setLastSync(new Date());
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [token, uploadFile]);

  return { isConnected, syncing, lastSync, syncError, login, logout, syncToOneDrive };
}
