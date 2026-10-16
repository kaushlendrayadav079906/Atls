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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  // DEV PREVIEW MODE - Bypass auth during local development phases
  const DEV_PREVIEW = import.meta.env.DEV;

  if (isLoading && !DEV_PREVIEW) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;
  }
  
  if (!isAuthenticated && !DEV_PREVIEW) {
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
                <Route index element={<Dashboard />} />
                <Route path="product" element={<ProductLandingPage />} />
                <Route path="solutions" element={<SolutionsLandingPage />} />
                <Route path="products" element={<ProductsStockPage />} />
                <Route path="products/:id" element={<ProductsStockPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="pos" element={<PosCheckoutPage />} />
              <Route path="sales" element={<SalesList />} />
              <Route path="sales-orders" element={<SalesOrdersPage />} />
              <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="sales/:id" element={<InvoiceDetail />} />
              <Route path="returns" element={<ReturnsApprovalsPage />} />
              <Route path="analytics" element={<AtlasAnalyticsPage />} />
              <Route path="production">
                <Route index element={<ProductionOverviewPage />} />
                <Route path="orders" element={<ProductionOrdersPage />} />
                <Route path="item-wise" element={<ProductionItemWisePage />} />
                <Route path="rejection" element={<ProductionRejectionPage />} />
                <Route path="date-wise" element={<ProductionDateWisePage />} />
                <Route path="reports" element={<ProductionReportsPage />} />
              </Route>
              <Route path="finance">

                <Route index element={<FinanceOverviewPage />} />
                <Route path="overview" element={<FinanceOverviewPage />} />
                <Route path="purchase-invoices" element={<PurchaseInvoicesPage />} />
                <Route path="incoming-payments" element={<IncomingPaymentsPage />} />
                <Route path="outgoing-payments" element={<OutgoingPaymentsPage />} />
                <Route path="customer-analysis" element={<CustomerAnalysisPage />} />
                <Route path="supplier-analysis" element={<SupplierAnalysisPage />} />
                <Route path="profitability-reports" element={<ProfitabilityReportsPage />} />
              </Route>
              <Route path="reports">

                <Route index element={<ReportsPage />} />
                <Route path="sales" element={<SalesReportPage />} />
                <Route path="invoice" element={<InvoiceReportPage />} />
                <Route path="payment" element={<PaymentReportPage />} />
                <Route path="inventory" element={<InventoryReportPage />} />
                <Route
                  path="customer"
                  element={
                    <ReportPlaceholderPage
                      title="Customer Reports"
                      description="In-depth customer retention, repeat purchase patterns, account aging, and lifetime value analytics are currently being mapped to your SAP Business One schema."
                    />
                  }
                />
                <Route
                  path="ai"
                  element={
                    <ReportPlaceholderPage
                      title="AI Generated Reports"
                      description="Automated business intelligence narratives generated from your live SAP database. You can also ask queries directly using the ATLAS AI Assistant launcher."
                      isAI={true}
                    />
                  }
                />
              </Route>
              <Route path="contact" element={<ContactPage />} />
              <Route path="settings" element={<SettingsUsersPage />} />
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
