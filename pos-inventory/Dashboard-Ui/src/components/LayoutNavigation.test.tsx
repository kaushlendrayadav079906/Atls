import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';
import * as AuthContextModule from '../contexts/AuthContext';
import * as SystemHealthModule from '../hooks/useSystemHealth';
import * as AIAssistantContextModule from '../contexts/AIAssistantContext';

describe('Layout Top Navigation and Sidebar RBAC Verification', () => {
  beforeEach(() => {
    vi.spyOn(SystemHealthModule, 'useSystemHealth').mockReturnValue({
      isSapConnected: true,
      isDbConnected: true,
      isLoading: false,
      sapDetails: null,
      lastChecked: null,
      checkHealth: vi.fn(),
    });

    vi.spyOn(AIAssistantContextModule, 'useAIAssistant').mockReturnValue({
      isOpen: false,
      setIsOpen: vi.fn(),
      toggleOpen: vi.fn(),
      isFullscreen: false,
      setIsFullscreen: vi.fn(),
      chatInput: '',
      setChatInput: vi.fn(),
      chatHistory: [],
      setChatHistory: vi.fn(),
      conversationId: null,
      setConversationId: vi.fn(),
      loadingChat: false,
      pageContext: 'dashboard',
      pageFilters: {},
      setPageFilters: vi.fn(),
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      handleSendChat: vi.fn(),
      chatScrollRef: { current: null },
    });
  });

  it('renders all 5 top navbar sections (Product, Solutions, Reports, Contact, Settings) for administrator', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'admin-1',
        username: 'Admin',
        email: 'admin@atlas.local',
        name: 'Kaushlendra Yadav',
        role: 'admin',
        is_active: true,
        token_version: 1,
        permissions: ['*'],
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
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    // Verify all 5 top navbar sections exist for admin
    expect(html).toContain('Product');
    expect(html).toContain('Solutions');
    expect(html).toContain('Reports');
    expect(html).toContain('Contact');
    expect(html).toContain('Settings');
  });

  it('shows only Product and Contact for base cashier/employee without Solutions or Settings permissions', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        username: 'ky1234',
        email: 'ky1234@atlas.local',
        name: 'Kaushlendra Yadav',
        role: 'user',
        is_active: true,
        token_version: 1,
        permissions: ['products.view', 'pos.access', 'invoices.view', 'customers.view', 'returns.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) =>
        ['products.view', 'pos.access', 'invoices.view', 'customers.view', 'returns.view'].includes(p)
      ),
      canAccess: vi.fn((m) =>
        ['products', 'pos', 'sales', 'customers', 'returns'].includes(m.toLowerCase())
      ),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    // Visible
    expect(html).toContain('Product');
    expect(html).toContain('Contact');

    // Solutions, Reports, and Settings must NOT be visible
    expect(html).not.toContain('<span>Solutions</span>');
    expect(html).not.toContain('<span>Reports</span>');
    expect(html).not.toContain('<span>Settings</span>');
  });

  it('renders Solutions for employee when granted production.view', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-2',
        username: 'factory_worker',
        email: 'factory@atlas.local',
        name: 'Factory Supervisor',
        role: 'operator',
        is_active: true,
        token_version: 1,
        permissions: ['products.view', 'production.view', 'production.orders.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) =>
        ['products.view', 'production.view', 'production.orders.view'].includes(p)
      ),
      canAccess: vi.fn((m) =>
        ['products', 'production', 'solutions'].includes(m.toLowerCase())
      ),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    expect(html).toContain('Product');
    expect(html).toContain('<span>Solutions</span>');
    expect(html).toContain('Contact');
    expect(html).not.toContain('<span>Settings</span>');
  });

  it('renders Solutions for employee when granted finance.view', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-3',
        username: 'accountant',
        email: 'accountant@atlas.local',
        name: 'Accounts Executive',
        role: 'user',
        is_active: true,
        token_version: 1,
        permissions: ['finance.view', 'finance.invoices.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) =>
        ['finance.view', 'finance.invoices.view'].includes(p)
      ),
      canAccess: vi.fn((m) =>
        ['finance', 'solutions'].includes(m.toLowerCase())
      ),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    expect(html).toContain('<span>Solutions</span>');
    expect(html).toContain('Contact');
    expect(html).not.toContain('<span>Settings</span>');
  });

  it('renders Settings for non-admin user if explicitly granted settings.view policy', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-4',
        username: 'it_auditor',
        email: 'auditor@atlas.local',
        name: 'IT Auditor',
        role: 'manager',
        is_active: true,
        token_version: 1,
        permissions: ['settings.view', 'dashboard.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn((p) => ['settings.view', 'dashboard.view'].includes(p)),
      canAccess: vi.fn((m) => ['settings'].includes(m.toLowerCase())),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    expect(html).toContain('<span>Settings</span>');
  });

  it('renders user profile section with user details and logout option when user is logged in', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-5',
        username: 'kaushlendra_yadav',
        email: 'kaushlendra@atlas.local',
        name: 'Kaushlendra Kamlesh Kumar Yadav',
        role: 'operator',
        branch_id: 'SH',
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
      hasPermission: vi.fn(() => true),
      canAccess: vi.fn(() => true),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    );

    // Verify initials, name, role, and logout button are rendered
    expect(html).toContain('KK');
    expect(html).toContain('Kaushlendra Kamlesh Kumar Yadav');
    expect(html).toContain('kaushlendra@atlas.local');
    expect(html).toContain('operator');
    expect(html).toContain('Logout');
    expect(html).toContain('id="user-logout-button"');
  });
});

