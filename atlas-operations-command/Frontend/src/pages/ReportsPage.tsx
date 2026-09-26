import React, { useEffect, useState, useCallback } from 'react';
import { FileBarChart2, ShieldCheck } from 'lucide-react';
import {
  ReportFilters,
  MonthlyFinancialChart,
  TopCustomersTable,
  SalesByProductTable,
} from '../components/reports';
import { DemoDataBanner } from '../components/dashboard/DemoDataBanner';
import { ErrorState } from '../components/common/ErrorState';
import { reportService } from '../services/reportService';
import { localizationService } from '../services/localizationService';
import type {
  TopCustomer,
  SalesByProduct,
  MonthlyRevenueExpenditure,
  LocalizationConfig,
  FiscalYearInfo,
} from '../types';

export const ReportsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();

  // Filter State
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = full year
  const [topLimit, setTopLimit] = useState<number>(5);

  // Available Years
  const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  // Data States
  const [locConfig, setLocConfig] = useState<LocalizationConfig | null>(null);
  const [fiscalYear, setFiscalYear] = useState<FiscalYearInfo | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyRevenueExpenditure[]>([]);

  // Async States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Initial Config Load
  useEffect(() => {
    localizationService
      .getConfig()
      .then((cfg) => setLocConfig(cfg))
      .catch(() => {});

    localizationService
      .getCurrentFiscalYear()
      .then((fy) => {
        setFiscalYear(fy);
        if (fy?.fiscal_year) {
          setSelectedYear(fy.fiscal_year);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Report Telemetry
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartError(null);
    setCustomersError(null);
    setProductsError(null);

    try {
      // 1. Fetch Top Customers & Sales by Product concurrently
      const [customersRes, productsRes] = await Promise.allSettled([
        reportService.getTopCustomers(topLimit),
        reportService.getSalesByProduct(topLimit),
      ]);

      if (customersRes.status === 'fulfilled') {
        setTopCustomers(customersRes.value || []);
      } else {
        setCustomersError('Failed to load top customers report.');
      }

      if (productsRes.status === 'fulfilled') {
        setSalesByProduct(productsRes.value || []);
      } else {
        setProductsError('Failed to load product sales report.');
      }

      // 2. Fetch Monthly Financial Data
      if (selectedMonth > 0) {
        // Single Month
        try {
          const singleMonth = await reportService.getMonthlyRevenueExpenditure(
            selectedYear,
            selectedMonth
          );
          setMonthlyTrend([singleMonth]);
        } catch {
          setChartError(`Failed to load financial records for month ${selectedMonth}/${selectedYear}.`);
          setMonthlyTrend([]);
        }
      } else {
        // All 12 Months of selected Year
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        const monthPromises = months.map((m) =>
          reportService.getMonthlyRevenueExpenditure(selectedYear, m).catch(() => ({
            year: selectedYear,
            month: m,
            revenue: 0,
            expenditure: 0,
            profit: 0,
          }))
        );

        const allMonths = await Promise.all(monthPromises);
        setMonthlyTrend(allMonths);
      }

      // Check global failure
      if (
        customersRes.status === 'rejected' &&
        productsRes.status === 'rejected'
      ) {
        setError('Unable to load report telemetry from backend.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching reports.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, topLimit]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const currencySymbol = locConfig?.formatting?.currency_symbol || '$';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Persistent Demo Data Banner */}
      <DemoDataBanner />

      {/* 2. Executive Page Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <FileBarChart2 size={26} color="var(--primary)" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              Reports & Executive Analytics
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Authoritative periodic financial trajectory, enterprise revenue contribution, and commercial product performance.
          </p>
        </div>

        {fiscalYear && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck size={16} color="#3b82f6" />
            <span>
              Fiscal Year: <strong style={{ color: 'var(--text-primary)' }}>{fiscalYear.fiscal_year_label}</strong>
              {fiscalYear.fiscal_quarter_label ? ` (${fiscalYear.fiscal_quarter_label})` : ''}
            </span>
          </div>
        )}
      </div>

      {/* 3. Global Error Notice */}
      {error && (
        <div style={{ padding: '0 4px' }}>
          <ErrorState
            title="Reports Ingestion Notice"
            message={error}
            onRetry={fetchReports}
          />
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <ReportFilters
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        availableYears={availableYears}
        topLimit={topLimit}
        isLoading={isLoading}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        onLimitChange={setTopLimit}
        onRefresh={fetchReports}
      />

      {/* 5. Section A: Monthly Revenue vs Expenditure */}
      <section aria-label="Monthly Revenue and Expenditure Report">
        <MonthlyFinancialChart
          data={monthlyTrend}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          currencySymbol={currencySymbol}
          isLoading={isLoading}
          error={chartError}
          onRetry={fetchReports}
        />
      </section>

      {/* 6. Section B & C: Top Customers & Sales by Product Grid */}
      <section aria-label="Commercial Sales and Customer Distribution">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Top Customers Table */}
          <TopCustomersTable
            customers={topCustomers}
            currencySymbol={currencySymbol}
            isLoading={isLoading}
            error={customersError}
            onRetry={fetchReports}
          />

          {/* Sales by Product Table */}
          <SalesByProductTable
            products={salesByProduct}
            currencySymbol={currencySymbol}
            isLoading={isLoading}
            error={productsError}
            onRetry={fetchReports}
          />
        </div>
      </section>
    </div>
  );
};

export default ReportsPage;
