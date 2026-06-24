import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';
import ToggleSwitch from '../../components/common/ToggleSwitch/ToggleSwitch';

interface PaymentSettings {
  enabled: boolean;
  has_token: boolean;
  has_webhook_secret: boolean;
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--color-primary)',
};

const PaymentsTab: React.FC = () => {
  const { refreshSettings } = useTenant();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [token, setToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<PaymentSettings>('/admin/payment-settings').then(r => setSettings(r.data));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const body: { enabled: boolean; access_token?: string; webhook_secret?: string } = { enabled: settings.enabled };
      if (token.trim()) body.access_token = token.trim();
      if (webhookSecret.trim()) body.webhook_secret = webhookSecret.trim();
      const { data } = await api.put<PaymentSettings>('/admin/payment-settings', body);
      setSettings(data);
      setToken('');
      setWebhookSecret('');
      await refreshSettings();
      setSuccess(true);
    } catch {
      alert('Error al guardar la configuración de pagos.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>
          Mercado Pago
        </h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Conecta tu cuenta de Mercado Pago para cobrar suscripciones y cursos. Pegá tu
          <strong> Access Token</strong> de producción (lo encontrás en{' '}
          <a
            href="https://www.mercadopago.com.ar/developers/panel/app"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
          >
            tu panel de desarrollador
          </a>{' '}
          → Credenciales de producción). Para probar sin cobrar de verdad, usá un token de prueba que
          empiece con <code>TEST-</code>.
        </p>
      </div>

      <div style={{
        padding: 12, borderRadius: 'var(--radius-md)',
        background: settings.has_token ? 'color-mix(in srgb, var(--color-success, #3fb950) 12%, transparent)' : 'var(--color-surface-container)',
        color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)',
      }}>
        {settings.has_token
          ? '✓ Hay un Access Token configurado. Dejá el campo vacío para conservarlo.'
          : 'Todavía no hay ningún Access Token cargado.'}
      </div>

      <ToggleSwitch
        checked={settings.enabled}
        onChange={checked => setSettings(p => p && { ...p, enabled: checked })}
        label={settings.enabled ? 'Pagos activados' : 'Pagos desactivados'}
      />

      {settings.enabled && !settings.has_token && !token.trim() && (
        <p style={{ color: 'var(--color-error, #e5484d)', fontSize: 'var(--text-body-md)' }}>
          Para activar los pagos necesitás cargar un Access Token.
        </p>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={labelStyle}>Access Token</span>
        <input
          className="form-input"
          type="password"
          autoComplete="off"
          placeholder={settings.has_token ? '•••••••••••• (sin cambios)' : 'APP_USR-... o TEST-...'}
          value={token}
          onChange={e => setToken(e.target.value)}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={labelStyle}>Firma secreta del Webhook (opcional, recomendado)</span>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-sm, 13px)', margin: 0 }}>
          La encontrás en tu panel de Mercado Pago → Tus integraciones → Webhooks → "Firma secreta".
          Si la cargás, el sistema verifica que las notificaciones de pago realmente vengan de Mercado Pago.
        </p>
        <input
          className="form-input"
          type="password"
          autoComplete="off"
          placeholder={settings.has_webhook_secret ? '•••••••••••• (sin cambios)' : 'Sin configurar'}
          value={webhookSecret}
          onChange={e => setWebhookSecret(e.target.value)}
        />
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '12px 28px', background: 'var(--color-primary)', color: 'var(--color-on-primary)',
          border: 'none', borderRadius: 'var(--radius-full)', fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </button>

      {success && (
        <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          Configuración de pagos actualizada correctamente.
        </p>
      )}
    </div>
  );
};

export default PaymentsTab;
