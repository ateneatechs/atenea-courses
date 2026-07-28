import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import './Footer.css';

const Footer: React.FC = () => (
  <footer className="footer">
    <div className="footer-main">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">Atenea Courses</Link>
          <p className="footer-tagline">
            La plataforma de educación premium para barberos profesionales. Técnica, arte y negocio en un solo lugar.
          </p>
          <div className="footer-socials">
            <button className="footer-social-btn" title="Web">
              <span className="material-symbols-outlined">public</span>
            </button>
            <button className="footer-social-btn" title="Instagram">
              <FontAwesomeIcon icon={faInstagram} />
            </button>
            <button className="footer-social-btn" title="YouTube">
              <FontAwesomeIcon icon={faYoutube} />
            </button>
          </div>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <span className="footer-col-title">Explorar</span>
            <Link to="/explorer">Cursos</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Academia</span>
            <Link to="#">Sobre nosotros</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Soporte</span>
            <Link to="/privacidad">Política de privacidad</Link>
            <Link to="/terminos">Términos de servicio</Link>
            <Link to="/soporte">Contactar soporte</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">© {new Date().getFullYear()} Atenea Courses. Todos los derechos reservados.</p>
        <div className="footer-bottom-links">
          <Link to="#">Instagram</Link>
          <Link to="#">YouTube</Link>
          <Link to="#">TikTok</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
