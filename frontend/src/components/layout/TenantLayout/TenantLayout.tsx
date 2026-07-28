import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from '../../../contexts/TenantContext';
import { AuthModalProvider } from '../../../contexts/AuthModalContext';
import { getTenantSlug } from '../../../utils/tenant';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';

const TenantGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notFound } = useTenant();
  if (notFound) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const TenantLayout: React.FC = () => {
  const tenantSlug = getTenantSlug();

  if (!tenantSlug) return <Navigate to="/" replace />;

  return (
    <TenantProvider tenantSlug={tenantSlug}>
      <TenantGuard>
        <AuthModalProvider>
          <div className="app">
            <Navbar />
            <Outlet />
            <Footer />
          </div>
        </AuthModalProvider>
      </TenantGuard>
    </TenantProvider>
  );
};

export default TenantLayout;
