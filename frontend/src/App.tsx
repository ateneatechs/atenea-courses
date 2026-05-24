import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar/Navbar';
import Footer from './components/layout/Footer/Footer';
import Home from './pages/Home/Home';
import Explorer from './pages/Explorer/Explorer';
import CourseDetail from './pages/CourseDetail/CourseDetail';
import Membership from './pages/Membership/Membership';
import AdminDashboard from './pages/Admin/AdminDashboard';
import './styles/globals.css';
import './App.css';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!isAuthenticated || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppLayout: React.FC = () => (
  <div className="app">
    <Navbar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/explorer" element={<Explorer />} />
      <Route path="/courses/:id" element={<CourseDetail />} />
      <Route path="/membership" element={<Membership />} />
      <Route path="/admin/*" element={
        <AdminRoute><AdminDashboard /></AdminRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Footer />
  </div>
);

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
