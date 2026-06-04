import React from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from '../../../contexts/TenantContext';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';

const TenantGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notFound } = useTenant();
  if (notFound) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const TenantLayout: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!tenantSlug) return <Navigate to="/" replace />;

  return (
    <TenantProvider tenantSlug={tenantSlug}>
      <TenantGuard>
        <div className="app">
          <Navbar />
          <Outlet />
          <Footer />
        </div>
      </TenantGuard>
    </TenantProvider>
  );
};

export default TenantLayout;
