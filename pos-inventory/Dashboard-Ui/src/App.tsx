import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SalesReportPage } from './pages/reports/SalesReportPage';
import { InvoiceReportPage } from './pages/reports/InvoiceReportPage';
import { PaymentReportPage } from './pages/reports/PaymentReportPage';

import { AtlasAnalyticsPage } from './pages/AtlasAnalyticsPage';
import { CustomersPage } from './pages/CustomersPage';
import { InventoryReportPage } from './pages/InventoryReportPage';
import { PosCheckoutPage } from './pages/pos/PosCheckoutPage';
import { ProductsStockPage } from './pages/ProductsStockPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReturnsApprovalsPage } from './pages/returns/ReturnsApprovalsPage';
import { InvoiceDetail } from './pages/sales/InvoiceDetail';
import { SalesList } from './pages/sales/SalesList';
import SalesOrdersPage from './pages/SalesOrdersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import { SettingsUsersPage } from './pages/SettingsUsersPage';
import { ProductionOverviewPage } from './pages/production/ProductionOverviewPage';
import { ProductionOrdersPage } from './pages/production/ProductionOrdersPage';
import { ProductionItemWisePage } from './pages/production/ProductionItemWisePage';
import { ProductionRejectionPage } from './pages/production/ProductionRejectionPage';
import { ProductionDateWisePage } from './pages/production/ProductionDateWisePage';
import { ProductionReportsPage } from './pages/production/ProductionReportsPage';
import { FinanceOverviewPage } from './pages/finance/FinanceOverviewPage';
import { PurchaseInvoicesPage } from './pages/finance/PurchaseInvoicesPage';
import { IncomingPaymentsPage } from './pages/finance/IncomingPaymentsPage';
import { OutgoingPaymentsPage } from './pages/finance/OutgoingPaymentsPage';
import { CustomerAnalysisPage } from './pages/finance/CustomerAnalysisPage';
import { SupplierAnalysisPage } from './pages/finance/SupplierAnalysisPage';
import { ProfitabilityReportsPage } from './pages/finance/ProfitabilityReportsPage';
import { ProductLandingPage } from './pages/ProductLandingPage';
import { SolutionsLandingPage } from './pages/SolutionsLandingPage';
import { ContactPage } from './pages/ContactPage';
import { ReportPlaceholderPage } from './components/ReportPlaceholderPage';
import { AIAssistantProvider } from './contexts/AIAssistantContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { RequirePermission } from './components/RequirePermission';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AIAssistantProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RequirePermission permission="dashboard.view"><Dashboard /></RequirePermission>} />
                <Route path="product" element={<RequirePermission permission="products.view"><ProductLandingPage /></RequirePermission>} />
                <Route path="solutions" element={<RequirePermission module="solutions"><SolutionsLandingPage /></RequirePermission>} />
                <Route path="products" element={<RequirePermission permission="products.view"><ProductsStockPage /></RequirePermission>} />
                <Route path="products/:id" element={<RequirePermission permission="products.view"><ProductsStockPage /></RequirePermission>} />
                <Route path="customers" element={<RequirePermission permission="customers.view"><CustomersPage /></RequirePermission>} />
                <Route path="pos" element={<RequirePermission permission="pos.access"><PosCheckoutPage /></RequirePermission>} />
                <Route path="sales" element={<RequirePermission permission="invoices.view"><SalesList /></RequirePermission>} />
                <Route path="sales-orders" element={<RequirePermission permission="sales_orders.view"><SalesOrdersPage /></RequirePermission>} />
                <Route path="purchase-orders" element={<RequirePermission permission="purchase_orders.view"><PurchaseOrdersPage /></RequirePermission>} />
                <Route path="sales/:id" element={<RequirePermission permission="invoices.view"><InvoiceDetail /></RequirePermission>} />
                <Route path="returns" element={<RequirePermission permission="returns.view"><ReturnsApprovalsPage /></RequirePermission>} />
                <Route path="analytics" element={<RequirePermission permission="dashboard.view"><AtlasAnalyticsPage /></RequirePermission>} />
                <Route path="production">
                  <Route index element={<RequirePermission permission="production.view"><ProductionOverviewPage /></RequirePermission>} />
                  <Route path="orders" element={<RequirePermission permission="production.orders.view"><ProductionOrdersPage /></RequirePermission>} />
                  <Route path="item-wise" element={<RequirePermission permission="production.view"><ProductionItemWisePage /></RequirePermission>} />
                  <Route path="rejection" element={<RequirePermission permission="production.view"><ProductionRejectionPage /></RequirePermission>} />
                  <Route path="date-wise" element={<RequirePermission permission="production.view"><ProductionDateWisePage /></RequirePermission>} />
                  <Route path="reports" element={<RequirePermission permission="production.reports.view"><ProductionReportsPage /></RequirePermission>} />
                </Route>
                <Route path="finance">
                  <Route index element={<RequirePermission permission="finance.view"><FinanceOverviewPage /></RequirePermission>} />
                  <Route path="overview" element={<RequirePermission permission="finance.view"><FinanceOverviewPage /></RequirePermission>} />
                  <Route path="purchase-invoices" element={<RequirePermission permission="finance.invoices.view"><PurchaseInvoicesPage /></RequirePermission>} />
                  <Route path="incoming-payments" element={<RequirePermission permission="finance.payments.view"><IncomingPaymentsPage /></RequirePermission>} />
                  <Route path="outgoing-payments" element={<RequirePermission permission="finance.payments.view"><OutgoingPaymentsPage /></RequirePermission>} />
                  <Route path="customer-analysis" element={<RequirePermission permission="finance.view"><CustomerAnalysisPage /></RequirePermission>} />
                  <Route path="supplier-analysis" element={<RequirePermission permission="finance.view"><SupplierAnalysisPage /></RequirePermission>} />
                  <Route path="profitability-reports" element={<RequirePermission permission="finance.reports.view"><ProfitabilityReportsPage /></RequirePermission>} />
                </Route>
                <Route path="reports">
                  <Route index element={<RequirePermission permission="reports.view"><ReportsPage /></RequirePermission>} />
                  <Route path="sales" element={<RequirePermission permission="reports.view"><SalesReportPage /></RequirePermission>} />
                  <Route path="invoice" element={<RequirePermission permission="reports.view"><InvoiceReportPage /></RequirePermission>} />
                  <Route path="payment" element={<RequirePermission permission="reports.view"><PaymentReportPage /></RequirePermission>} />
                  <Route path="inventory" element={<RequirePermission permission="reports.view"><InventoryReportPage /></RequirePermission>} />
                  <Route
                    path="customer"
                    element={
                      <RequirePermission permission="reports.view">
                        <ReportPlaceholderPage
                          title="Customer Reports"
                          description="In-depth customer retention, repeat purchase patterns, account aging, and lifetime value analytics are currently being mapped to your SAP Business One schema."
                        />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="ai"
                    element={
                      <RequirePermission permission="reports.view">
                        <ReportPlaceholderPage
                          title="AI Generated Reports"
                          description="Automated business intelligence narratives generated from your live SAP database. You can also ask queries directly using the ATLAS AI Assistant launcher."
                          isAI={true}
                        />
                      </RequirePermission>
                    }
                  />
                </Route>
                <Route path="contact" element={<ContactPage />} />
                <Route path="settings" element={<RequirePermission requireAdmin={true}><SettingsUsersPage /></RequirePermission>} />
                {/* Fallback routes for "Coming soon" */}
                <Route path="*" element={<div className="p-8 text-center text-gray-500">Coming soon</div>} />
              </Route>
            </Routes>
        </AIAssistantProvider>
      </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
