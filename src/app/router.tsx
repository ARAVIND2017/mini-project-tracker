import { createBrowserRouter } from 'react-router';
import { SystemStatusPage } from '@/features/status/SystemStatusPage';
import { AppShell } from './AppShell';
import { HomePage } from './HomePage';
import { NotFoundPage, RouteError } from './RouteError';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'status', element: <SystemStatusPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
