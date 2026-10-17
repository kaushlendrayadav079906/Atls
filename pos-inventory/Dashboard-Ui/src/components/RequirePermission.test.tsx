import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AccessDenied } from './AccessDenied';
import { RequirePermission } from './RequirePermission';
import * as AuthContextModule from '../contexts/AuthContext';

describe('AccessDenied Component', () => {
  it('renders 403 Forbidden with required permission badge and role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u-1',
        username: 'john_cashier',
        email: 'john@atlas.local',
        name: 'John Cashier',
        role: 'operator',
        is_active: true,
        token_version: 1,
        permissions: ['pos.access'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) => p === 'pos.access'),
      canAccess: vi.fn((m) => m === 'pos'),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AccessDenied requiredPermission="finance.view" moduleName="Financial Overview" />
      </MemoryRouter>
    );

    expect(html).toContain('403 Forbidden');
    expect(html).toContain('Access Restricted');
    expect(html).toContain('finance.view');
    expect(html).toContain('john_cashier');
    expect(html).toContain('operator');
  });
});

describe('RequirePermission Component Guard', () => {
  it('renders protected child component when user has required permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u-1',
        username: 'john_cashier',
        email: 'john@atlas.local',
        name: 'John Cashier',
        role: 'operator',
        is_active: true,
        token_version: 1,
        permissions: ['products.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) => p === 'products.view'),
      canAccess: vi.fn((m) => m === 'products'),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RequirePermission permission="products.view">
          <div id="secret-inventory">Confidential Product Catalog</div>
        </RequirePermission>
      </MemoryRouter>
    );

    expect(html).toContain('Confidential Product Catalog');
    expect(html).not.toContain('403 Forbidden');
  });

  it('renders AccessDenied when user lacks required permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u-1',
        username: 'john_cashier',
        email: 'john@atlas.local',
        name: 'John Cashier',
        role: 'operator',
        is_active: true,
        token_version: 1,
        permissions: ['products.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) => p === 'products.view'),
      canAccess: vi.fn((m) => m === 'products'),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RequirePermission permission="finance.view">
          <div id="finance-secrets">Confidential P&amp;L Statements</div>
        </RequirePermission>
      </MemoryRouter>
    );

    expect(html).not.toContain('Confidential P&amp;L Statements');
    expect(html).toContain('403 Forbidden');
    expect(html).toContain('finance.view');
  });

  it('blocks non-admin users from admin-only routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'u-1',
        username: 'john_cashier',
        email: 'john@atlas.local',
        name: 'John Cashier',
        role: 'operator',
        is_active: true,
        token_version: 1,
        permissions: ['dashboard.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) => p === 'dashboard.view'),
      canAccess: vi.fn((m) => m === 'dashboard'),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RequirePermission requireAdmin={true}>
          <div id="settings-admin">User Management Control Panel</div>
        </RequirePermission>
      </MemoryRouter>
    );

    expect(html).not.toContain('User Management Control Panel');
    expect(html).toContain('403 Forbidden');
    expect(html).toContain('reserved exclusively for ATLAS system administrators');
  });

  it('allows administrator access even without explicit module permission', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'adm-1',
        username: 'atlas_admin',
        email: 'admin@atlas.local',
        name: 'System Administrator',
        role: 'admin',
        is_active: true,
        token_version: 1,
        permissions: [],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn(() => true),
      canAccess: vi.fn(() => true),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RequirePermission requireAdmin={true}>
          <div id="settings-admin">User Management Control Panel</div>
        </RequirePermission>
      </MemoryRouter>
    );

    expect(html).toContain('User Management Control Panel');
    expect(html).not.toContain('403 Forbidden');
  });
});
