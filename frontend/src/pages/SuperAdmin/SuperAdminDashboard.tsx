import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import './SuperAdminDashboard.css';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  user_count: number;
  course_count: number;
  created_at: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [platformFee, setPlatformFee] = useState<number>(10);
  const [feeInput, setFeeInput] = useState('10');
  const [savingFee, setSavingFee] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);

  const load = async () => {
    const [{ data: tenantsData }, { data: settingsData }] = await Promise.all([
      api.get<Tenant[]>('/super-admin/tenants'),
      api.get<{ platformFeePercent: number }>('/super-admin/settings'),
    ]);
    setTenants(tenantsData);
    setPlatformFee(settingsData.platformFeePercent);
    setFeeInput(String(settingsData.platformFeePercent));
  };

  useEffect(() => { load(); }, []);

  const handleNameChange = (val: string) => {
    setNewName(val);
    setNewSlug(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const handleCreate = async () => {
    if (!newName || !newSlug) return;
    setCreating(true);
    try {
      await api.post('/super-admin/tenants', { name: newName, slug: newSlug });
      setShowModal(false);
      setNewName('');
      setNewSlug('');
      await load();
    } catch {
      alert('Error al crear la academia. El slug puede estar en uso.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveFee = async () => {
    const value = Number(feeInput);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      alert('La comisión debe ser un número entre 0 y 100.');
      return;
    }
    setSavingFee(true);
    setFeeSaved(false);
    try {
      await api.put('/super-admin/settings', { platformFeePercent: value });
      setPlatformFee(value);
      setFeeSaved(true);
    } catch {
      alert('Error al guardar la comisión.');
    } finally {
      setSavingFee(false);
    }
  };

  return (
    <div className="super-admin">
      <header className="super-admin-header">
        <div>
          <h1 className="super-admin-title">Atenea Platform</h1>
          <p className="super-admin-subtitle">Panel de administración global</p>
        </div>
        <button className="super-admin-btn-primary" onClick={() => setShowModal(true)}>
          + Nueva academia
        </button>
      </header>

      <div className="super-admin-table-wrap" style={{ padding: 24, marginBottom: 24 }}>
        <h2 className="super-admin-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
          Comisión de la plataforma (%)
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={feeInput}
            onChange={e => setFeeInput(e.target.value)}
            className="super-admin-input"
            style={{ maxWidth: 120 }}
          />
          <button className="super-admin-btn-primary" onClick={handleSaveFee} disabled={savingFee}>
            {savingFee ? 'Guardando...' : 'Guardar'}
          </button>
          {feeSaved && <span style={{ color: 'var(--color-success)' }}>Guardado</span>}
        </div>
        <p style={{ color: 'var(--color-on-surface-variant)', marginTop: 8, fontSize: '0.85rem' }}>
          Actual: {platformFee}% sobre cada venta de curso.
        </p>
      </div>

      <div className="super-admin-table-wrap">
        <table className="super-admin-table">
          <thead>
            <tr>
              <th>Academia</th>
              <th>Slug</th>
              <th>Usuarios</th>
              <th>Cursos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td className="super-admin-name">{t.name}</td>
                <td><code>/{t.slug}</code></td>
                <td>{t.user_count}</td>
                <td>{t.course_count}</td>
                <td>
                  <button
                    className="super-admin-btn-link"
                    onClick={() => window.open(`https://${t.slug}.atenea-courses.com`, '_blank')}
                  >
                    Ir →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="super-admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="super-admin-modal" onClick={e => e.stopPropagation()}>
            <h2>Nueva academia</h2>
            <label>Nombre</label>
            <input
              type="text"
              value={newName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Ej: Naza Barber"
              className="super-admin-input"
            />
            <label>Slug (URL)</label>
            <input
              type="text"
              value={newSlug}
              onChange={e => setNewSlug(e.target.value)}
              placeholder="naza-barber"
              className="super-admin-input"
            />
            <p className="super-admin-slug-preview">
              URL: <strong>{newSlug || '...'}</strong>.atenea-courses.com
            </p>
            <div className="super-admin-modal-actions">
              <button className="super-admin-btn-outline" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="super-admin-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creando...' : 'Crear academia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
