import React from 'react';
import '../Explorer/Explorer.css';
import './Legal.css';

const SUPPORT_EMAIL = 'ateneatechs@gmail.com';

const Support: React.FC = () => (
  <div className="explorer">
    <header className="explorer-header">
      <h1 className="explorer-title">Contactar Soporte</h1>
      <p className="explorer-subtitle">
        ¿Tenés dudas, problemas técnicos o consultas sobre tu compra? Escribinos y te
        respondemos a la brevedad.
      </p>
    </header>

    <div className="support-card glass-card">
      <span className="material-symbols-outlined">mail</span>
      <div>
        <p className="support-email-label">Escribinos por correo</p>
        <a className="support-email-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </div>
    </div>
  </div>
);

export default Support;
