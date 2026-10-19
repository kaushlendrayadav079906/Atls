import { describe, it, expect } from 'vitest';
import { resolveInternalRoute, INTERNAL_ROUTES } from './routeRegistry';

describe('Route Registry Security and Validation', () => {
  it('resolves standard registered modules safely', () => {
    const dash = resolveInternalRoute('dashboard');
    expect(dash).not.toBeNull();
    expect(dash?.path).toBe('/');
    expect(dash?.name).toBe('Dashboard');

    const products = resolveInternalRoute('products');
    expect(products?.path).toBe('/products');
    expect(products?.name).toBe('Products & Inventory');

    const orders = resolveInternalRoute('production_orders');
    expect(orders?.path).toBe('/production/orders');

    const finance = resolveInternalRoute('finance_overview');
    expect(finance?.path).toBe('/finance');

    const incoming = resolveInternalRoute('finance_incoming_payments');
    expect(incoming?.path).toBe('/finance/incoming-payments');

    const aiReports = resolveInternalRoute('reports_ai');
    expect(aiReports?.path).toBe('/reports/ai');

    const alias = resolveInternalRoute('/finance/overview');
    expect(alias?.path).toBe('/finance');
  });

  it('safely attaches authorized filter parameters to registered routes', () => {
    const res = resolveInternalRoute('products', {
      search: 'AMIT000121',
      openDetails: 'true',
    });
    expect(res).not.toBeNull();
    expect(res?.path).toBe('/products?search=AMIT000121&openDetails=true');

    const finRes = resolveInternalRoute('finance_overview', {
      range: 'monthly',
      branch: 'SH',
    });
    expect(finRes?.path).toBe('/finance?range=monthly&branch=SH');
  });

  it('safely handles routes with existing query string', () => {
    const res = resolveInternalRoute('/products?search=AMIT000121&openDetails=true');
    expect(res).not.toBeNull();
    expect(res?.path).toContain('/products');
    expect(res?.path).toContain('search=AMIT000121');
  });

  it('resolves product details sub-paths safely', () => {
    const res = resolveInternalRoute('/products/AMIT000121');
    expect(res).not.toBeNull();
    expect(res?.path).toBe('/products/AMIT000121');
    expect(res?.name).toBe('Product Details');
  });

  it('strictly blocks arbitrary and external URLs', () => {
    expect(resolveInternalRoute('https://malicious-website.com')).toBeNull();
    expect(resolveInternalRoute('http://attacker.com/steal-token')).toBeNull();
    expect(resolveInternalRoute('/unregistered/unknown/path')).toBeNull();
    expect(resolveInternalRoute('javascript:alert(1)')).toBeNull();
  });

  it('guarantees all registered routes have valid internal paths starting with /', () => {
    for (const r of INTERNAL_ROUTES) {
      expect(r.path.startsWith('/')).toBe(true);
      expect(r.path).not.toContain('http://');
      expect(r.path).not.toContain('https://');
    }
  });
});
