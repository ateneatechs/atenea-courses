import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useTenant } from '../../contexts/TenantContext';
import ToggleSwitch from '../../components/common/ToggleSwitch/ToggleSwitch';

interface MembershipSettings {
  enabled: boolean;
  monthly_price: number;
  annual_price: number;
}

const MembershipTab: React.FC = () => {
  const { refreshSettings } = useTenant();
  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<MembershipSettings>('/admin/membership-settings').then(r => setSettings(r.data));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const { data } = await api.put<MembershipSettings>('/admin/membership-settings', settings);
      setSettings(data);
      await refreshSettings();
      setSuccess(true);
    } catch {
      alert('Error al guardar la configuración de membresías.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-on-surface)', marginBottom: 8 }}>
          Membresías
        </h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Configura si tu academia ofrece suscripciones y a qué precio.
        </p>
      </div>

      <ToggleSwitch
        checked={settings.enabled}
        onChange={checked => setSettings(p => p && { ...p, enabled: checked })}
        label={settings.enabled ? 'Membresías activas' : 'Membresías desactivadas'}
      />

      {!settings.enabled && (
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 'var(--text-body-md)' }}>
          Los cursos marcados como exclusivos de membresía no se mostrarán a los alumnos mientras
          las membresías estén desactivadas.
        </p>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Precio mensual (ARS)
        </span>
        <input
          className="form-input"
          type="number"
          min={0}
          step="1"
          disabled={!settings.enabled}
          value={settings.monthly_price}
          onChange={e => setSettings(p => p && { ...p, monthly_price: Number(e.target.value) })}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
          Precio anual (ARS)
        </span>
        <input
          className="form-input"
          type="number"
          min={0}
          step="1"
          disabled={!settings.enabled}
          value={settings.annual_price}
          onChange={e => setSettings(p => p && { ...p, annual_price: Number(e.target.value) })}
        />
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '12px 28px',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-full)',
          fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {success && (
        <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          Configuración de membresías actualizada correctamente.
        </p>
      )}
    </div>
  );
};

export default MembershipTab;
