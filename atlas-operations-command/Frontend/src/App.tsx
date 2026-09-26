import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { FactoriesPage } from './pages/FactoriesPage';
import { FactoryDetailPage } from './pages/FactoryDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { AiPage } from './pages/AiPage';
import { RealtimePage } from './pages/RealtimePage';
import { UploadsPage } from './pages/UploadsPage';
import { SapWorkPage } from './pages/SapWorkPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes inside AppShell */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/factories"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <FactoriesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/factories/:factoryId"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <FactoryDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ReportsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/ai"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AiPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/realtime"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <RealtimePage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/uploads"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <UploadsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/sap"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SapWorkPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SettingsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Fallback & Root Redirection */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
