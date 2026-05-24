import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => (
  <footer className="footer">
    <div className="footer-main">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">Lumière Academy</Link>
          <p className="footer-tagline">
            El destino global para la educación avanzada en peluquería. Elevando los estándares de la industria a través del dominio y el arte.
          </p>
          <div className="footer-socials">
            <button className="footer-social-btn" title="Web">
              <span className="material-symbols-outlined">public</span>
            </button>
            <button className="footer-social-btn" title="Instagram">
              <span className="material-symbols-outlined">photo_camera</span>
            </button>
            <button className="footer-social-btn" title="YouTube">
              <span className="material-symbols-outlined">movie</span>
            </button>
          </div>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <span className="footer-col-title">Explorar</span>
            <Link to="/explorer">Colecciones</Link>
            <Link to="/explorer">Instructores</Link>
            <Link to="#">Tarjetas de regalo</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Academia</span>
            <Link to="#">Sobre nosotros</Link>
            <Link to="#">Empleo</Link>
            <Link to="#">Prensa</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Soporte</span>
            <Link to="#">Política de privacidad</Link>
            <Link to="#">Términos de servicio</Link>
            <Link to="#">Contactar soporte</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">© {new Date().getFullYear()} Lumière Academy. Todos los derechos reservados.</p>
        <div className="footer-bottom-links">
          <Link to="#">Instagram</Link>
          <Link to="#">YouTube</Link>
          <Link to="#">Pinterest</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
