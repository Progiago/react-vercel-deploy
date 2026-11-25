import { createHashRouter, RouterProvider } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './style.css';
import { App } from './features/app/App';

function Root() {
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [previousVersions, setPreviousVersions] = useState<Array<{ version: string; date: string; notes: string }>>([]);

  useEffect(() => {
    // Fetch version info from GitHub API or local storage
    // This would be replaced with actual version fetching logic
    const stored = localStorage.getItem('version-history');
    if (stored) {
      setPreviousVersions(JSON.parse(stored));
    }
  }, []);

  const handleVersionUpdate = (newVersion: string, notes: string) => {
    setCurrentVersion(newVersion);
    setPreviousVersions(prev => [
      { version: newVersion, date: new Date().toLocaleDateString(), notes },
      ...prev.filter(v => v.version !== newVersion)
    ]);
    localStorage.setItem('version-history', JSON.stringify([
      { version: newVersion, date: new Date().toLocaleDateString(), notes },
      ...previousVersions
    ]));
  };

  return (
    <RouterProvider router={createHashRouter([
      { path: '/', element: <App handleVersionUpdate={handleVersionUpdate} /> },
      { path: '*', element: <p>Página não encontrada</p> }
    ])} />
  );
}

export default Root;