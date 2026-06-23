import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './PaymentResult.css';

type Status = 'loading' | 'approved' | 'pending' | 'rejected' | 'unknown';

const COPY: Record<Exclude<Status, 'loading'>, { icon: string; title: string; text: string }> = {
  approved: {
    icon: 'check_circle',
    title: '¡Pago aprobado!',
    text: 'Tu acceso ya está activo. ¡Que disfrutes el contenido!',
  },
  pending: {
    icon: 'schedule',
    title: 'Pago pendiente',
    text: 'Tu pago está siendo procesado. Te daremos acceso en cuanto se confirme.',
  },
  rejected: {
    icon: 'cancel',
    title: 'Pago rechazado',
    text: 'No pudimos procesar tu pago. Podés intentar nuevamente.',
  },
  unknown: {
    icon: 'help',
    title: 'No pudimos verificar el pago',
    text: 'Si el cobro se realizó, tu acceso se activará automáticamente en unos minutos.',
  },
};

const PaymentResult: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const paymentId = params.get('payment_id') || params.get('collection_id');
    if (!paymentId) { setStatus('unknown'); return; }

    api.get<{ status: Status }>('/payments/verify', { params: { payment_id: paymentId } })
      .then(async ({ data }) => {
        setStatus(data.status || 'unknown');
        if (data.status === 'approved') await refreshUser();
      })
      .catch(() => setStatus('unknown'));
  }, [params, refreshUser]);

  if (status === 'loading') {
    return (
      <div className="payment-result">
        <span className="material-symbols-outlined payment-result-spinner">progress_activity</span>
        <p>Verificando tu pago...</p>
      </div>
    );
  }

  const copy = COPY[status];

  return (
    <div className="payment-result">
      <span
        className={`material-symbols-outlined payment-result-icon ${status}`}
        style={{ fontVariationSettings: "'FILL' 1", fontSize: 64 }}
      >
        {copy.icon}
      </span>
      <h1 className="payment-result-title">{copy.title}</h1>
      <p className="payment-result-text">{copy.text}</p>
      <div className="payment-result-btns">
        <button className="btn-primary" onClick={() => navigate('/explorer')}>Ir a mis cursos</button>
        <button className="btn-outline" onClick={() => navigate('/')}>Volver al inicio</button>
      </div>
    </div>
  );
};

export default PaymentResult;
