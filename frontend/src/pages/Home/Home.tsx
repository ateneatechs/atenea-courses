import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Course } from '../../types';
import './Home.css';
import '../Membership/Membership.css';

const HERO_IMG = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1600&q=80';

const Home: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Course[]>('/courses?sort=newest').then(r => setCourses(r.data.slice(0, 3)));
  }, []);

  const [large, ...rest] = courses;

  return (
    <div className="home">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          <img src={HERO_IMG} alt="Barbero profesional trabajando" />
          <div className="hero-bg-overlay" />
        </div>
        <div className="hero-content">
          <span className="hero-eyebrow">Técnica • Arte • Negocio</span>
          <h1 className="hero-title">
            Lleva tu barbería al siguiente nivel.
          </h1>
          <p className="hero-subtitle">
            Accedé a masterclasses exclusivas de los mejores barberos del mundo. Técnicas de fade, barba, colorimetría y gestión de negocio para barberos que quieren crecer.
          </p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={() => navigate('explorer')}>
              Ver Cursos
            </button>
            <button className="btn-outline" onClick={() => navigate('membership')}>
              Explorar Membresía
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="stats">
        {[
          { number: '60+', label: 'Lecciones en Video' },
          { number: '6', label: 'Cursos Especializados' },
          { number: '500+', label: 'Barberos Formados' },
          { number: '98%', label: 'Satisfacción' },
        ].map(s => (
          <div key={s.label} className="stat-item">
            <span className="stat-number">{s.number}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Featured Courses ── */}
      {courses.length > 0 && (
        <section className="featured">
          <div className="section-header">
            <div>
              <span className="section-eyebrow">Currículo Curado</span>
              <h2 className="section-title">Domina los Fundamentos</h2>
            </div>
            <Link to="explorer" className="section-link">Ver todos los cursos</Link>
          </div>

          <div className="featured-grid">
            {large && (
              <div className="featured-large" onClick={() => navigate(`courses/${large.id}`)}>
                <div className="featured-large-image">
                  <img src={large.thumbnail_url} alt={large.title} />
                  <div className="featured-large-overlay" />
                  <div className="featured-large-body">
                    {large.badge && (
                      <span className="featured-large-badge">{large.badge}</span>
                    )}
                    <h3 className="featured-large-title">{large.title}</h3>
                    <p className="featured-large-desc">{large.description?.slice(0, 120)}...</p>
                  </div>
                </div>
              </div>
            )}

            <div className="featured-secondary">
              {rest.map(c => (
                <div key={c.id} className="secondary-card" onClick={() => navigate(`courses/${c.id}`)}>
                  <div className="secondary-card-image">
                    <img src={c.thumbnail_url} alt={c.title} />
                    <div className="secondary-card-overlay" />
                    <div className="secondary-card-body">
                      <h4 className="secondary-card-title">{c.title}</h4>
                      <p className="secondary-card-desc">{c.description?.slice(0, 80)}...</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Membership ── */}
      <section className="home-membership">
        <div className="membership-header">
          <span className="membership-eyebrow">Invertí en tu carrera</span>
          <h2 className="membership-title">Elegí tu plan</h2>
          <p className="membership-subtitle">
            Rutas de aprendizaje flexibles diseñadas para barberos que quieren crecer a su propio ritmo.
          </p>
        </div>
        <div className="membership-plans">
          <div className="plan-card glass-card">
            <div className="plan-icon-wrap primary">
              <span className="material-symbols-outlined plan-icon primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <h2 className="plan-name">Suscripción Mensual</h2>
            <p className="plan-desc">
              Acceso ilimitado a todos los cursos, recursos y contenido nuevo que se agregue cada mes.
            </p>
            <div className="plan-price">
              <span className="plan-price-amount">$49</span>
              <span className="plan-price-period"> / mes</span>
            </div>
            <ul className="plan-features">
              {[
                'Acceso a todos los cursos',
                'Nuevos cursos cada mes',
                'Acceso al foro de la comunidad',
                'Certificado de finalización',
                'Soporte prioritario',
              ].map(f => (
                <li key={f} className="plan-feature">
                  <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {f}
                </li>
              ))}
            </ul>
            <button className="plan-btn-primary" onClick={() => navigate('membership')}>
              Comenzar ahora
            </button>
          </div>

          <div className="plan-card glass-card">
            <div className="plan-icon-wrap secondary">
              <span className="material-symbols-outlined plan-icon secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                local_library
              </span>
            </div>
            <h2 className="plan-name">Curso Individual</h2>
            <p className="plan-desc">
              Comprá el curso que necesitás y tenés acceso de por vida. Ideal para habilidades específicas.
            </p>
            <div className="plan-price">
              <span className="plan-price-from">Desde</span>
              <span className="plan-price-amount">$129</span>
            </div>
            <ul className="plan-features">
              {[
                'Acceso de por vida al curso',
                'Videos en alta definición',
                'Material complementario',
                'Acceso desde cualquier dispositivo',
              ].map(f => (
                <li key={f} className="plan-feature">
                  <span className="material-symbols-outlined plan-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {f}
                </li>
              ))}
            </ul>
            <button className="plan-btn-outline" onClick={() => navigate('explorer')}>
              Ver cursos
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
