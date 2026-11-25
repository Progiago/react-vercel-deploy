import { createHashRouter, RouterProvider } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { VersionHistory } from '../../components/VersionHistory';

export function App({ handleVersionUpdate }: { handleVersionUpdate: (version: string, notes: string) => void }) {
  const router = createHashRouter([
    {
      path: '/',
      element: <DashboardPage />,
      errorElement: <p>Página não encontrada</p>,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'biblioteca', element: <DashboardPage /> },
        { path: 'projetos', element: <DashboardPage /> },
        { path: 'unidades', element: <DashboardPage /> },
        { path: 'backups', element: <DashboardPage /> },
        { path: 'configuracoes', element: <DashboardPage /> },
        { path: 'perfil', element: <DashboardPage /> },
        { path: 'web', element: <DashboardPage /> },
      ]
    }
  ]);

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <VersionHistory
          currentVersion={handleVersionUpdate?.toString() || '1.0.0'}
          previousVersions={[]}
        />
        <router />
      </div>
    </QueryClientProvider>
  );
}