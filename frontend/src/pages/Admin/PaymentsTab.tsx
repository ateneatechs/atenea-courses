import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { MercadoPagoStatus } from '../../types';

const PaymentsTab: React.FC = () => {
  const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MercadoPagoStatus>('/admin/mercadopago/status');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.get<{ url: string }>('/admin/mercadopago/connect');
      window.location.href = data.url;
    } catch {
      alert('Error al iniciar la conexión con Mercado Pago.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Mercado Pago? Dejarás de recibir pagos hasta volver a conectar.')) return;
    setDisconnecting(true);
    try {
      await api.delete('/admin/mercadopago/disconnect');
      await loadStatus();
    } catch {
      alert('Error al desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--color-on-surface-variant)' }}>Cargando...</p>;
  }

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>
          Mercado Pago
        </h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Conecta tu cuenta de Mercado Pago para recibir pagos de los cursos de tu academia.
          Atenea Courses cobra una comisión automática por cada venta.
        </p>
      </div>

      <div style={{
        padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span className="material-symbols-outlined" style={{ color: status?.connected ? 'var(--color-success)' : 'var(--color-on-surface-variant)' }}>
          {status?.connected ? 'check_circle' : 'cancel'}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>
          {status?.connected ? 'Conectado' : 'No conectado'}
        </span>
      </div>

      {status?.connected ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{
            padding: '12px 28px', background: 'transparent', color: 'var(--color-error)',
            border: '1px solid var(--color-error)', borderRadius: 'var(--radius-full)',
            fontWeight: 700, cursor: disconnecting ? 'not-allowed' : 'pointer',
            opacity: disconnecting ? 0.7 : 1, alignSelf: 'flex-start',
          }}
        >
          {disconnecting ? 'Desconectando...' : 'Desconectar'}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            padding: '12px 28px', background: 'var(--color-primary)', color: 'var(--color-on-primary)',
            border: 'none', borderRadius: 'var(--radius-full)', fontWeight: 700,
            cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.7 : 1, alignSelf: 'flex-start',
          }}
        >
          {connecting ? 'Conectando...' : 'Conectar con Mercado Pago'}
        </button>
      )}
    </div>
  );
};

export default PaymentsTab;
