import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './Membership.css';

const Membership: React.FC = () => {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const hasActiveSub = !!user?.subscription;

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    if (!isAuthenticated) { navigate('/'); return; }
    setLoading(plan);
    try {
      await api.post('/courses/subscribe', { plan });
      await refreshUser();
      alert(`¡Suscripción al plan ${plan} exitosa!`);
    } catch {
      alert('Error al suscribirse. Por favor intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="membership">
      <div className="membership-header">
        <span className="membership-eyebrow">Invierte en ti</span>
        <h1 className="membership-title">Elige tu camino</h1>
        <p className="membership-subtitle">
          Rutas de aprendizaje flexibles diseñadas para tu agenda profesional y tus metas de carrera.
        </p>
      </div>

      {hasActiveSub && (
        <div className="membership-active-banner">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: 24 }}>verified</span>
          <div>
            <strong>Membresía activa</strong> — Tu plan {user?.subscription?.plan} está activo hasta el{' '}
            {new Date(user?.subscription?.ends_at || '').toLocaleDateString()}
          </div>
        </div>
      )}

      <div className="membership-plans">
        {/* Monthly */}
        <div className="plan-card glass-card">
          <div className="plan-icon-wrap primary">
            <span className="material-symbols-outlined plan-icon primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <h2 className="plan-name">Suscripción Mensual</h2>
          <p className="plan-desc">
            Acceso ilimitado a toda nuestra biblioteca de masterclasses, recursos y eventos en vivo.
          </p>
          <div className="plan-price">
            <span className="plan-price-amount">$49</span>
            <span className="plan-price-period"> / mes</span>
          </div>
          <ul className="plan-features">
            {[
              '200+ Lecciones en Video',
              'Sesiones mensuales de preguntas en vivo',
              'Acceso al foro de la comunidad',
              'Certificado de finalización',
              'Nuevos cursos cada mes',
            ].map(f => (
              <li key={f} className="plan-feature">
                <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            className="plan-btn-primary"
            onClick={() => handleSubscribe('monthly')}
            disabled={loading === 'monthly' || hasActiveSub}
          >
            {loading === 'monthly' ? 'Procesando...' : hasActiveSub ? 'Actualmente activo' : 'Comenzar prueba de 7 días gratis'}
          </button>
        </div>

        {/* Individual */}
        <div className="plan-card glass-card">
          <div className="plan-icon-wrap secondary">
            <span className="material-symbols-outlined plan-icon secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_library
            </span>
          </div>
          <h2 className="plan-name">Curso Individual</h2>
          <p className="plan-desc">
            Adquiere un masterclass específico de por vida. Ideal para el desarrollo enfocado de habilidades a tu propio ritmo.
          </p>
          <div className="plan-price">
            <span className="plan-price-from">Desde</span>
            <span className="plan-price-amount">$129</span>
          </div>
          <ul className="plan-features">
            {[
              'Acceso de por vida al curso adquirido',
              'Videos en alta definición',
              'Guías de técnicas descargables',
              'Retroalimentación privada del curso',
            ].map(f => (
              <li key={f} className="plan-feature">
                <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {f}
              </li>
            ))}
          </ul>
          <button className="plan-btn-outline" onClick={() => navigate('/explorer')}>
            Ver cursos
          </button>
        </div>
      </div>
    </div>
  );
};

export default Membership;
