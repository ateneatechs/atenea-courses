import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await api.get<Tenant[]>('/super-admin/tenants');
    setTenants(data);
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
                    onClick={() => navigate(`/${t.slug}`)}
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
              URL: atenea-courses.com/<strong>{newSlug || '...'}</strong>
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
