import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './Landing.css';

const FEATURES = [
  { icon: 'palette', title: 'Marca propia', desc: 'Logo, nombre y dominio exclusivo para tu academia.' },
  { icon: 'play_circle', title: 'Cursos ilimitados', desc: 'Subí videos, quizzes y recursos sin límite de contenido.' },
  { icon: 'group', title: 'Gestión de alumnos', desc: 'Panel de admin con usuarios, suscripciones e ingresos.' },
  { icon: 'workspace_premium', title: 'Membresías y ventas', desc: 'Vendé acceso mensual o por curso individualmente.' },
  { icon: 'smartphone', title: 'Optimizado para móvil', desc: 'Tus alumnos aprenden desde cualquier dispositivo.' },
  { icon: 'lock', title: 'Contenido protegido', desc: 'Solo alumnos con acceso pueden ver tus videos.' },
];

const Landing: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <span className="landing-nav-logo">Atenea Courses</span>
        <button className="landing-nav-theme" onClick={toggleTheme} title="Cambiar tema">
          <span className="material-symbols-outlined">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <p className="landing-eyebrow">Plataforma SaaS para academias</p>
        <h1 className="landing-title">
          Tu academia online,<br />tu marca, tu dominio.
        </h1>
        <p className="landing-subtitle">
          Creamos la plataforma para que vos te enfoques en enseñar. Subí tus cursos, gestioná tus alumnos y cobrá — todo desde un solo lugar con tu nombre.
        </p>
        <a
          className="landing-cta"
          href="mailto:hola@atenea-courses.com?subject=Quiero%20mi%20academia"
        >
          Quiero mi academia
        </a>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2 className="landing-features-title">Todo lo que necesitás</h2>
        <div className="landing-features-grid">
          {FEATURES.map(f => (
            <div key={f.icon} className="landing-feature-card">
              <span className="material-symbols-outlined landing-feature-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
                {f.icon}
              </span>
              <h3 className="landing-feature-name">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="landing-bottom-cta">
        <h2 className="landing-bottom-title">¿Listo para lanzar tu academia?</h2>
        <p className="landing-bottom-sub">Hablemos. Te tenemos operativo en menos de 48 horas.</p>
        <a
          className="landing-cta"
          href="mailto:hola@atenea-courses.com?subject=Quiero%20mi%20academia"
        >
          Contactanos
        </a>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Atenea Courses</span>
      </footer>
    </div>
  );
};

export default Landing;
