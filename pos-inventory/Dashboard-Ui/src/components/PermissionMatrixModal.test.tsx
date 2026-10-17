import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionMatrixModal } from './PermissionMatrixModal';
import * as EndpointsModule from '../api/endpoints';

describe('PermissionMatrixModal User Profile Verification', () => {
  const createTestQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  it('renders complete User Profile section with actual database values', () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(EndpointsModule.adminApi, 'getUserPermissions').mockResolvedValue({
      user_id: 'user-101',
      role: 'operator',
      effective_permissions: ['products.view', 'pos.access'],
    });
    vi.spyOn(EndpointsModule.adminApi, 'getRoles').mockResolvedValue([]);
    vi.spyOn(EndpointsModule.adminApi, 'getUser').mockResolvedValue({
      id: 'user-101',
      name: 'Kaushlendra Yadav',
      username: 'kaushal_operator',
      email: 'kaushal@atlas.local',
      role: 'operator',
      is_active: true,
      phone: '+919876543210',
      job_role: 'Inventory Manager',
    });

    const userProp = {
      id: 'user-101',
      name: 'Kaushlendra Yadav',
      username: 'kaushal_operator',
      email: 'kaushal@atlas.local',
      role: 'operator',
      is_active: true,
      phone: '+919876543210',
      job_role: 'Inventory Manager',
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PermissionMatrixModal user={userProp} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    // Profile card title
    expect(html).toContain('User Profile');

    // Values displayed
    expect(html).toContain('Kaushlendra Yadav');
    expect(html).toContain('kaushal@atlas.local');
    expect(html).toContain('+919876543210');
    expect(html).toContain('Inventory Manager');
    expect(html).toContain('@kaushal_operator');
    expect(html).toContain('operator');

    // Labels present
    expect(html).toContain('Full Name');
    expect(html).toContain('Email Address');
    expect(html).toContain('Phone Number');
    expect(html).toContain('Job Role / Designation');
    expect(html).toContain('Username');
    expect(html).toContain('Application Access Role');
  });

  it('displays "Not provided" for legacy users with missing phone and job_role', () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(EndpointsModule.adminApi, 'getUserPermissions').mockResolvedValue({
      user_id: 'legacy-99',
      role: 'user',
      effective_permissions: ['dashboard.view'],
    });
    vi.spyOn(EndpointsModule.adminApi, 'getRoles').mockResolvedValue([]);
    vi.spyOn(EndpointsModule.adminApi, 'getUser').mockResolvedValue({
      id: 'legacy-99',
      name: 'Legacy Cashier',
      username: 'legacy_user',
      email: 'legacy@atlas.local',
      role: 'user',
      is_active: true,
      phone: null,
      job_role: null,
    });

    const legacyUser = {
      id: 'legacy-99',
      name: 'Legacy Cashier',
      username: 'legacy_user',
      email: 'legacy@atlas.local',
      role: 'user',
      is_active: true,
      phone: null,
      job_role: null,
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PermissionMatrixModal user={legacyUser} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(html).toContain('Legacy Cashier');
    expect(html).toContain('@legacy_user');
    expect(html).toContain('Not provided');
    expect(html).toContain('Cashier'); // User role mapped to Cashier display label
  });

  it('correctly refreshes and displays profile when rendered for another user', () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(EndpointsModule.adminApi, 'getUserPermissions').mockResolvedValue({
      user_id: 'user-202',
      role: 'manager',
      effective_permissions: ['*'],
    });
    vi.spyOn(EndpointsModule.adminApi, 'getRoles').mockResolvedValue([]);
    vi.spyOn(EndpointsModule.adminApi, 'getUser').mockResolvedValue({
      id: 'user-202',
      name: 'Store Manager John',
      username: 'john_manager',
      email: 'john@atlas.local',
      role: 'manager',
      is_active: true,
      phone: '+1 555-0144',
      job_role: 'Store Manager',
    });

    const secondUser = {
      id: 'user-202',
      name: 'Store Manager John',
      username: 'john_manager',
      email: 'john@atlas.local',
      role: 'manager',
      is_active: true,
      phone: '+1 555-0144',
      job_role: 'Store Manager',
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PermissionMatrixModal user={secondUser} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    expect(html).toContain('Store Manager John');
    expect(html).toContain('john@atlas.local');
    expect(html).toContain('+1 555-0144');
    expect(html).toContain('Store Manager');
    expect(html).toContain('@john_manager');
    expect(html).toContain('manager');
  });

  it('renders search input and role template presets in the toolbar', () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(EndpointsModule.adminApi, 'getUserPermissions').mockResolvedValue({
      user_id: 'user-303',
      role: 'user',
      effective_permissions: [],
    });
    vi.spyOn(EndpointsModule.adminApi, 'getRoles').mockResolvedValue([]);
    vi.spyOn(EndpointsModule.adminApi, 'getUser').mockResolvedValue({
      id: 'user-303',
      name: 'Test Staff',
      username: 'test_staff',
      email: 'test@atlas.local',
      role: 'user',
      is_active: true,
      phone: null,
      job_role: null,
    });

    const userObj = {
      id: 'user-303',
      name: 'Test Staff',
      username: 'test_staff',
      email: 'test@atlas.local',
      role: 'user',
      is_active: true,
      phone: null,
      job_role: null,
    };

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PermissionMatrixModal user={userObj} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    // Apply Role Template toolbar and preset buttons
    expect(html).toContain('Apply Role Template:');
    expect(html).toContain('Admin');
    expect(html).toContain('Manager');
    expect(html).toContain('Operator');
    expect(html).toContain('Cashier');

    // Search input
    expect(html).toContain('placeholder="Search permissions..."');
    expect(html).toContain('aria-label="Search permissions or role templates"');
    expect(html).toContain('data-testid="permission-search-input"');
  });
});

