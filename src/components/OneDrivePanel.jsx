import { useOneDrive } from '../hooks/useOneDrive';
import { exportAllData } from '../db';

export default function OneDrivePanel() {
  const { isConnected, syncing, lastSync, syncError, login, logout, syncToOneDrive } = useOneDrive();

  async function handleSync() {
    const data = await exportAllData();
    await syncToOneDrive(data);
  }

  return (
    <div className="onedrive-panel">
      <h3>☁️ OneDrive</h3>
      {!isConnected ? (
        <button className="btn btn-ms" onClick={login}>
          Zaloguj przez Microsoft
        </button>
      ) : (
        <div className="od-connected">
          <span className="od-status">✅ Połączono</span>
          <button className="btn btn-sync" onClick={handleSync} disabled={syncing}>
            {syncing ? '⏳ Synchronizuję…' : '🔄 Synchronizuj teraz'}
          </button>
          <button className="btn btn-logout" onClick={logout}>Wyloguj</button>
          {lastSync && (
            <p className="od-last-sync">
              Ostatnia sync: {lastSync.toLocaleString('pl-PL')}
            </p>
          )}
        </div>
      )}
      {syncError && <p className="error">{syncError}</p>}
      <p className="od-info">
        Pliki zapisywane w: <code>OneDrive/Dyktafon/</code>
      </p>
    </div>
  );
}
