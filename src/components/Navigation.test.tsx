import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from './Navigation';

const mockAuthState = {
  user: { name: 'Test User', email: 'test@example.com' },
  logout: jest.fn(),
  roles: ['PMO'],
  availableRoles: ['PMO'],
  currentRole: 'PMO',
  setRole: jest.fn(),
  groups: ['PMO'],
  avpDecisions: [],
};

const mockPermissionsState = {
  canAccessRoute: jest.fn().mockReturnValue(true),
  hasPremiumFinanzasFeatures: false,
  role: 'PMO',
};

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

const mockUsePermissions = jest.fn(() => mockPermissionsState);

jest.mock('@/hooks/usePermissions', () => ({
  __esModule: true,
  default: () => mockUsePermissions(),
}));

jest.mock('@/components/Logo', () => ({
  Logo: ({ className }: { className?: string }) => (
    <div data-testid="logo" className={className ?? ''} />
  ),
}));

jest.mock('@/config/aws', () => ({
  logoutWithHostedUI: jest.fn(),
}));

describe('Navigation hub visibility', () => {
  beforeEach(() => {
    mockUsePermissions.mockClear();
    mockAuthState.roles = ['PMO'];
    mockAuthState.availableRoles = ['PMO'];
    mockAuthState.currentRole = 'PMO';
    mockAuthState.groups = ['PMO'];
    mockPermissionsState.role = 'PMO';
    mockPermissionsState.canAccessRoute = jest.fn().mockReturnValue(true);
    process.env.VITE_FINZ_ENABLED = 'true';
  });

  it('shows Hub link for PMO users with access', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/finanzas/hub']}>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hub de Desempeño')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('hides Hub link for vendor users without permission', () => {
    mockAuthState.roles = ['VENDOR'];
    mockAuthState.availableRoles = ['VENDOR'];
    mockAuthState.currentRole = 'VENDOR';
    mockAuthState.groups = ['VENDOR'];
    mockPermissionsState.role = 'VENDOR';
    mockPermissionsState.canAccessRoute = jest
      .fn()
      .mockImplementation((route: string) => route !== '/hub');

    render(
      <MemoryRouter initialEntries={['/finanzas/hub']}>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Hub de Desempeño')).not.toBeInTheDocument();
  });
});
