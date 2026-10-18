import { render, screen } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import type { ActiveContext } from '@/domain/context';
import { AuthContext, type AuthState } from './authContext';
import { RequireAuth } from './RequireAuth';

const activeContext: ActiveContext = {
  active: true,
  user_id: 'u1',
  profile: { full_name: 'Test User', email: 'test@example.test', designation: null },
  system_roles: [],
  memberships: [],
};

function renderWith(state: Partial<AuthState>) {
  const value: AuthState = {
    loading: false,
    session: null,
    context: null,
    inactive: false,
    contextError: null,
    refreshContext: vi.fn(),
    signOut: vi.fn(),
    ...state,
  };
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login screen</p> },
      {
        element: <RequireAuth />,
        children: [{ path: '/private', element: <p>Private screen</p> }],
      },
    ],
    { initialEntries: ['/private'] },
  );
  render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
}

const session = { user: { id: 'u1' } } as Session;

describe('RequireAuth', () => {
  it('sends signed-out users to the login screen', async () => {
    renderWith({});
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });

  it('shows the screen to signed-in active users', async () => {
    renderWith({ session, context: activeContext });
    expect(await screen.findByText('Private screen')).toBeInTheDocument();
  });

  it('blocks deactivated accounts', async () => {
    renderWith({ session, inactive: true });
    expect(await screen.findByText('Account deactivated')).toBeInTheDocument();
    expect(screen.queryByText('Private screen')).not.toBeInTheDocument();
  });

  it('waits while the session loads', () => {
    renderWith({ loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });
});
