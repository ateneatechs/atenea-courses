import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TenantLayout from './components/layout/TenantLayout/TenantLayout';
import Home from './pages/Home/Home';
import Explorer from './pages/Explorer/Explorer';
import CourseDetail from './pages/CourseDetail/CourseDetail';
import Membership from './pages/Membership/Membership';
import AdminDashboard from './pages/Admin/AdminDashboard';
import Landing from './pages/Landing/Landing';
import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard';
import './styles/globals.css';
import './App.css';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading...</div>;
  const isSuperAdmin = user?.role === 'super_admin';
  if (!isAuthenticated || (!isAdmin && !isSuperAdmin)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!isAuthenticated || user?.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/super-admin/*"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            }
          />
          <Route path="/:tenantSlug" element={<TenantLayout />}>
            <Route index element={<Home />} />
            <Route path="explorer" element={<Explorer />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="membership" element={<Membership />} />
            <Route
              path="admin/*"
              element={<AdminRoute><AdminDashboard /></AdminRoute>}
            />
            <Route path="*" element={<Navigate to="" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
