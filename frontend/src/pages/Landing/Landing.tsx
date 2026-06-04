import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  course_count: number;
  user_count: number;
}

const Landing: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Tenant[]>('/super-admin/tenants').catch(() => {
      setTenants([{ id: '1', slug: 'naza-barber', name: 'Naza Barber', course_count: 0, user_count: 0 }]);
    }).then(r => {
      if (r) setTenants(r.data);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--color-background)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-xl)', color: 'var(--color-primary)', marginBottom: 8 }}>
        Atenea Courses
      </h1>
      <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: 48, fontSize: 'var(--text-body-lg)' }}>
        Plataforma de academias online
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
        {tenants.map(t => (
          <div
            key={t.id}
            onClick={() => navigate(`/${t.slug}`)}
            style={{
              cursor: 'pointer',
              padding: '32px 40px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface-container-low)',
              textAlign: 'center',
              minWidth: 220,
              transition: 'transform 200ms, box-shadow 200ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = '';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>{t.name}</div>
            <div style={{ fontSize: 'var(--text-label-caps)', color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.course_count} cursos
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Landing;
