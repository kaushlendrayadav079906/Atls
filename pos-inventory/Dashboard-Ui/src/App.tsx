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
import { PosCheckoutPage } from './pages/pos/PosCheckoutPage';
import { ProductsStockPage } from './pages/ProductsStockPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReturnsApprovalsPage } from './pages/returns/ReturnsApprovalsPage';
import { InvoiceDetail } from './pages/sales/InvoiceDetail';
import { SalesList } from './pages/sales/SalesList';
import { SettingsUsersPage } from './pages/SettingsUsersPage';

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
              <Route path="products" element={<ProductsStockPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="pos" element={<PosCheckoutPage />} />
              <Route path="sales" element={<SalesList />} />
              <Route path="sales/:id" element={<InvoiceDetail />} />
              <Route path="returns" element={<ReturnsApprovalsPage />} />
              <Route path="analytics" element={<AtlasAnalyticsPage />} />
              <Route path="reports">
                <Route index element={<ReportsPage />} />
                <Route path="sales" element={<SalesReportPage />} />
                <Route path="invoice" element={<InvoiceReportPage />} />
                <Route path="payment" element={<PaymentReportPage />} />
                <Route path="inventory" element={<div className="p-8 text-slate-900">Inventory Report - Building...</div>} />
                <Route path="customer" element={<div className="p-8 text-slate-900">Customer Report - Building...</div>} />
                <Route path="ai" element={<div className="p-8 text-slate-900">AI Report - Building...</div>} />
              </Route>
              <Route path="settings" element={<SettingsUsersPage />} />
              {/* Fallback routes for "Coming soon" */}
              <Route path="*" element={<div className="p-8 text-center text-gray-500">Coming soon</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
