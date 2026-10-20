import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { SetPasswordPage } from '@/features/auth/SetPasswordPage';
import { LoadingState } from '@/components/ui';
import { SystemStatusPage } from '@/features/status/SystemStatusPage';
import { AppShell } from './AppShell';
import { HomePage } from './HomePage';
import { RootLayout } from './RootLayout';
import { NotFoundPage, RouteError } from './RouteError';

// Semester screens are loaded on demand to keep the first download small.
const lazyPage = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingState />,
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
              { path: 'semesters', lazy: lazyPage(() => import('./pages/SemestersRoute')) },
              {
                path: 'semesters/:semesterId',
                lazy: lazyPage(() => import('./pages/SemesterDetailRoute')),
              },
              {
                path: 'semesters/:semesterId/people',
                lazy: lazyPage(() => import('./pages/PeopleRoute')),
              },
              {
                path: 'semesters/:semesterId/domains',
                lazy: lazyPage(() => import('./pages/DomainsRoute')),
              },
              {
                path: 'semesters/:semesterId/roster',
                lazy: lazyPage(() => import('./pages/RosterRoute')),
              },
              {
                path: 'semesters/:semesterId/projects',
                lazy: lazyPage(() => import('./pages/ProjectsRoute')),
              },
              {
                path: 'semesters/:semesterId/assignments',
                lazy: lazyPage(() => import('./pages/AssignmentsRoute')),
              },
              {
                path: 'semesters/:semesterId/plan',
                lazy: lazyPage(() => import('./pages/PlanRoute')),
              },
              {
                path: 'semesters/:semesterId/panels',
                lazy: lazyPage(() => import('./pages/PanelsRoute')),
              },
              {
                path: 'semesters/:semesterId/review-queue',
                lazy: lazyPage(() => import('./pages/ReviewQueueRoute')),
              },
              {
                path: 'projects/:projectId',
                lazy: lazyPage(() => import('./pages/ProjectWorkspaceRoute')),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
