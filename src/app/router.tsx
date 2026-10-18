import { createBrowserRouter } from 'react-router';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SetPasswordPage } from '@/features/auth/SetPasswordPage';
import { PeoplePage } from '@/features/people/PeoplePage';
import { SemesterDetailPage } from '@/features/semesters/SemesterDetailPage';
import { SemestersPage } from '@/features/semesters/SemestersPage';
import { SystemStatusPage } from '@/features/status/SystemStatusPage';
import { AppShell } from './AppShell';
import { HomePage } from './HomePage';
import { RootLayout } from './RootLayout';
import { NotFoundPage, RouteError } from './RouteError';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'auth/set-password', element: <SetPasswordPage /> },
      {
        path: 'status',
        element: (
          <div className="mx-auto max-w-6xl px-4 py-6">
            <SystemStatusPage />
          </div>
        ),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'semesters', element: <SemestersPage /> },
              { path: 'semesters/:semesterId', element: <SemesterDetailPage /> },
              { path: 'semesters/:semesterId/people', element: <PeoplePage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
