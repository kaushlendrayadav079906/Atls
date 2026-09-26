import { lazy, Suspense } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { store } from './app/store';
import { queryClient } from './app/queryClient';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Loader from './components/Loader';
import Login from './pages/Login';
import './index.css';

// Lazy-load heavy pages so they are code-split into separate chunks.
// The Login page stays eager because it is the first thing users see.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const POS = lazy(() => import('./pages/POS'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Register = lazy(() => import('./pages/Register'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Branches = lazy(() => import('./pages/admin/Branches'));
const ExportReports = lazy(() => import('./pages/admin/ExportReports'));
const OperatorExportReports = lazy(() => import('./pages/OperatorExportReports'));
const ReturnsExchange = lazy(() => import('./pages/ReturnsExchange'));
const Approvals = lazy(() => import('./pages/admin/Approvals'));

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <BrowserRouter>
          <Suspense fallback={<Loader message="Loading..." />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Admin panel – admin role required */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="branches" element={<Branches />} />
                <Route path="reports" element={<ExportReports />} />
                <Route path="approvals" element={<Approvals />} />
              </Route>

              {/* POS – any authenticated user */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="pos" element={<POS />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="reports" element={<OperatorExportReports />} />
                <Route path="returns" element={<ReturnsExchange />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  );
}

export default App;

