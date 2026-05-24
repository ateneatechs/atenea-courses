import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Course, Lesson, AdminStats, Category, AdminTab } from '../../types';
import './AdminDashboard.css';

interface AdminUser {
  id: string; email: string; name: string; role: string;
  created_at: string; plan?: string; sub_status?: string; ends_at?: string;
}

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Course form
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseFormData, setCourseFormData] = useState({
    title: '', description: '', instructor_name: '', price: '',
    category_id: '', badge: '', total_duration: '',
    is_membership_exclusive: false, is_published: false, thumbnail_url: '',
  });
  const [courseThumbFile, setCourseThumbFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Lesson management
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonCourseId, setLessonCourseId] = useState('');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonFormData, setLessonFormData] = useState({
    title: '', description: '', duration: '',
    section_number: '1', section_title: '', order_index: '1', lesson_type: 'video', video_url: '',
  });

  const loadStats = useCallback(async () => {
    const { data } = await api.get<AdminStats>('/admin/stats');
    setStats(data);
  }, []);

  const loadCourses = useCallback(async () => {
    const { data } = await api.get<Course[]>('/admin/courses');
    setCourses(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await api.get<AdminUser[]>('/admin/users');
    setUsers(data);
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      alert('Error al cambiar el rol.');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Eliminar la cuenta de ${userName}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error al eliminar usuario.');
    }
  };

  useEffect(() => {
    api.get<Category[]>('/courses/categories').then(r => setCategories(r.data));
    loadStats();
    loadCourses();
  }, [loadStats, loadCourses]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab, loadUsers]);

  const loadLessons = async (courseId: string) => {
    if (lessons[courseId]) return;
    const { data } = await api.get<Lesson[]>(`/admin/courses/${courseId}/lessons`);
    setLessons(prev => ({ ...prev, [courseId]: data }));
  };

  const openCourseForm = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCourseFormData({
        title: course.title, description: course.description,
        instructor_name: course.instructor_name, price: course.price?.toString() || '',
        category_id: course.category_id || '', badge: course.badge || '',
        total_duration: course.total_duration || '',
        is_membership_exclusive: course.is_membership_exclusive,
        is_published: course.is_published,
        thumbnail_url: course.thumbnail_url || '',
      });
    } else {
      setEditingCourse(null);
      setCourseFormData({
        title: '', description: '', instructor_name: '', price: '',
        category_id: '', badge: '', total_duration: '',
        is_membership_exclusive: false, is_published: false, thumbnail_url: '',
      });
    }
    setCourseThumbFile(null);
    setShowCourseForm(true);
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(courseFormData).forEach(([k, v]) => fd.append(k, v.toString()));
      if (courseThumbFile) fd.append('thumbnail', courseThumbFile);
      if (editingCourse) {
        await api.put(`/admin/courses/${editingCourse.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/courses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowCourseForm(false);
      loadCourses();
      loadStats();
    } catch {
      alert('Error al guardar el curso.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('¿Eliminar este curso? Esta acción no se puede deshacer.')) return;
    await api.delete(`/admin/courses/${id}`);
    loadCourses(); loadStats();
  };

  const openLessonForm = (courseId: string, lesson?: Lesson) => {
    setLessonCourseId(courseId);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonFormData({
        title: lesson.title, description: lesson.description || '',
        duration: lesson.duration, section_number: lesson.section_number.toString(),
        section_title: lesson.section_title, order_index: lesson.order_index.toString(),
        lesson_type: lesson.lesson_type, video_url: lesson.video_url || '',
      });
    } else {
      setEditingLesson(null);
      setLessonFormData({ title: '', description: '', duration: '', section_number: '1', section_title: '', order_index: '1', lesson_type: 'video', video_url: '' });
    }
    setShowLessonForm(true);
  };

  const saveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('course_id', lessonCourseId);
      Object.entries(lessonFormData).forEach(([k, v]) => fd.append(k, v));
      if (editingLesson) {
        await api.put(`/admin/lessons/${editingLesson.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/lessons', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowLessonForm(false);
      setLessons(prev => { const n = { ...prev }; delete n[lessonCourseId]; return n; });
      await loadLessons(lessonCourseId);
      loadCourses();
    } catch {
      alert('Error al guardar la lección.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (lessonId: string, courseId: string) => {
    if (!confirm('¿Eliminar esta lección?')) return;
    await api.delete(`/admin/lessons/${lessonId}`);
    setLessons(prev => { const n = { ...prev }; delete n[courseId]; return n; });
    await loadLessons(courseId);
    loadCourses();
  };

  const navItems: { id: AdminTab; icon: string; label: string }[] = [
    { id: 'overview', icon: 'dashboard', label: 'Resumen' },
    { id: 'courses', icon: 'play_circle', label: 'Cursos' },
    { id: 'users', icon: 'group', label: 'Usuarios' },
  ];

  return (
    <div className="admin">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Panel de Admin</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`admin-nav-item${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="admin-main">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <h1 className="admin-page-title">Panel</h1>
            <p className="admin-page-subtitle">Bienvenido. Aquí tienes un resumen de tu academia.</p>

            <div className="stats-grid">
              {[
                { label: 'Total de estudiantes', value: stats?.totalUsers ?? '–', icon: 'group' },
                { label: 'Total de cursos', value: stats?.totalCourses ?? '–', icon: 'play_circle' },
                { label: 'Suscripciones activas', value: stats?.activeSubscriptions ?? '–', icon: 'workspace_premium' },
                { label: 'Ingresos totales', value: stats ? `$${stats.totalRevenue.toFixed(0)}` : '–', icon: 'payments' },
              ].map(s => (
                <div key={s.label} className="stat-card glass-card">
                  <div className="stat-card-header">
                    <span className="stat-card-label">{s.label}</span>
                    <span className="material-symbols-outlined stat-card-icon" style={{ fontSize: 22 }}>{s.icon}</span>
                  </div>
                  <span className="stat-card-value">{s.value}</span>
                </div>
              ))}
            </div>

            <div className="admin-section-header">
              <h2 className="admin-section-title">Cursos recientes</h2>
              <button className="btn-add" onClick={() => { setTab('courses'); openCourseForm(); }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Nuevo curso
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr>
                  <th>Curso</th>
                  <th>Instructor</th>
                  <th>Lecciones</th>
                  <th>Precio</th>
                  <th>Estado</th>
                </tr></thead>
                <tbody>
                  {courses.slice(0, 5).map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {c.thumbnail_url && <img className="table-thumb" src={c.thumbnail_url} alt="" />}
                          <span style={{ fontWeight: 500 }}>{c.title}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-on-surface-variant)' }}>{c.instructor_name}</td>
                      <td>{c.total_lessons}</td>
                      <td>{c.is_membership_exclusive ? 'Miembro' : c.price ? `$${c.price}` : 'Gratis'}</td>
                      <td>
                        <span className={`status-badge ${c.is_published ? 'published' : 'draft'}`}>
                          {c.is_published ? 'Publicado' : 'Borrador'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── COURSES ── */}
        {tab === 'courses' && (
          <>
            <div className="admin-section-header">
              <div>
                <h1 className="admin-page-title">Cursos</h1>
                <p className="admin-page-subtitle">Gestiona tu catálogo de cursos</p>
              </div>
              <button className="btn-add" onClick={() => openCourseForm()}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Nuevo curso
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr>
                  <th>Curso</th>
                  <th>Categoría</th>
                  <th>Lecciones</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr></thead>
                <tbody>
                  {courses.map(c => (
                    <React.Fragment key={c.id}>
                      <tr>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {c.thumbnail_url && <img className="table-thumb" src={c.thumbnail_url} alt="" />}
                            <div>
                              <div style={{ fontWeight: 500 }}>{c.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{c.instructor_name}</div>
                            </div>
                          </div>
                        </td>
                        <td>{c.category_name || '—'}</td>
                        <td>{c.total_lessons}</td>
                        <td>
                          {c.is_membership_exclusive
                            ? <span className="status-badge member-only">Miembro</span>
                            : c.price ? `$${c.price}` : 'Gratis'}
                        </td>
                        <td>
                          <span className={`status-badge ${c.is_published ? 'published' : 'draft'}`}>
                            {c.is_published ? 'Publicado' : 'Borrador'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="action-btn"
                              title="Gestionar lecciones"
                              onClick={() => {
                                if (expandedCourse === c.id) {
                                  setExpandedCourse(null);
                                } else {
                                  setExpandedCourse(c.id);
                                  loadLessons(c.id);
                                }
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>list</span>
                            </button>
                            <button className="action-btn" title="Edit" onClick={() => openCourseForm(c)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                            </button>
                            <button className="action-btn danger" title="Delete" onClick={() => deleteCourse(c.id)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Lessons sub-panel */}
                      {expandedCourse === c.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, background: 'var(--color-surface-container)' }}>
                            <div style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 'var(--text-label-caps)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
                                  Lecciones
                                </span>
                                <button className="btn-add" style={{ padding: '6px 14px', fontSize: 11 }} onClick={() => openLessonForm(c.id)}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                  Agregar lección
                                </button>
                              </div>
                              {(lessons[c.id] || []).length === 0 ? (
                                <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 14, fontStyle: 'italic' }}>Sin lecciones aún.</p>
                              ) : (
                                <table className="admin-table" style={{ border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-sm)' }}>
                                  <thead><tr>
                                    <th>#</th>
                                    <th>Título</th>
                                    <th>Sección</th>
                                    <th>Tipo</th>
                                    <th>Duración</th>
                                    <th>Acciones</th>
                                  </tr></thead>
                                  <tbody>
                                    {(lessons[c.id] || []).map((l, i) => (
                                      <tr key={l.id}>
                                        <td>{i + 1}</td>
                                        <td>{l.title}</td>
                                        <td>{l.section_number}. {l.section_title}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{l.lesson_type}</td>
                                        <td>{l.duration}</td>
                                        <td>
                                          <div className="table-actions">
                                            <button className="action-btn" onClick={() => openLessonForm(c.id, l)}>
                                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                            </button>
                                            <button className="action-btn danger" onClick={() => deleteLesson(l.id, c.id)}>
                                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <>
            <div className="admin-section-header">
              <div>
                <h1 className="admin-page-title">Usuarios</h1>
                <p className="admin-page-subtitle" style={{ marginBottom: 0 }}>Gestiona los estudiantes registrados y sus suscripciones</p>
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
                {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
              </span>
            </div>
            <div className="admin-table-wrap" style={{ marginTop: 24 }}>
              <table className="admin-table">
                <thead><tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Suscripción</th>
                  <th>Registrado</th>
                  <th>Acciones</th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                            color: 'var(--color-primary)', fontWeight: 700, fontSize: 13,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-on-surface-variant)', fontSize: 14 }}>{u.email}</td>
                      <td>
                        <span className={`user-role-badge ${u.role}`}>
                          {u.role === 'admin' ? 'Admin' : 'Usuario'}
                        </span>
                      </td>
                      <td>
                        {u.sub_status === 'active'
                          ? <span className="status-badge published">{u.plan} — activa</span>
                          : <span style={{ color: 'var(--color-on-surface-variant)', fontSize: 13 }}>Sin suscripción</span>
                        }
                      </td>
                      <td style={{ color: 'var(--color-on-surface-variant)', fontSize: 13 }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="user-actions">
                          <button
                            className={`role-toggle-btn ${u.role === 'admin' ? 'make-user' : 'make-admin'}`}
                            title={u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                            onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'user' : 'admin')}
                          >
                            {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                          </button>
                          <button
                            className="action-btn danger"
                            title="Eliminar cuenta"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* ── Course Form Modal ── */}
      {showCourseForm && (
        <div className="form-overlay" onClick={e => e.target === e.currentTarget && setShowCourseForm(false)}>
          <div className="form-box">
            <h2 className="form-box-title">{editingCourse ? 'Editar curso' : 'Nuevo curso'}</h2>
            <form onSubmit={saveCourse}>
              <div className="form-grid">
                <div className="form-group full">
                  <label className="form-label">Título *</label>
                  <input className="form-input" required value={courseFormData.title}
                    onChange={e => setCourseFormData(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-textarea" value={courseFormData.description}
                    onChange={e => setCourseFormData(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre del instructor *</label>
                  <input className="form-input" required value={courseFormData.instructor_name}
                    onChange={e => setCourseFormData(p => ({ ...p, instructor_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select className="form-input" value={courseFormData.category_id}
                    onChange={e => setCourseFormData(p => ({ ...p, category_id: e.target.value }))}>
                    <option value="">Seleccionar categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Precio (USD)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="Dejar en blanco si es gratis"
                    value={courseFormData.price}
                    onChange={e => setCourseFormData(p => ({ ...p, price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Duración (ej. 4h 20m)</label>
                  <input className="form-input" value={courseFormData.total_duration}
                    onChange={e => setCourseFormData(p => ({ ...p, total_duration: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Etiqueta de insignia</label>
                  <input className="form-input" placeholder="ej. Masterclass, Nuevo lanzamiento"
                    value={courseFormData.badge}
                    onChange={e => setCourseFormData(p => ({ ...p, badge: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">URL de miniatura</label>
                  <input className="form-input" placeholder="https://..."
                    value={courseFormData.thumbnail_url}
                    onChange={e => setCourseFormData(p => ({ ...p, thumbnail_url: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label className="form-label">O subir miniatura</label>
                  <input className="form-input" type="file" accept="image/*"
                    onChange={e => setCourseThumbFile(e.target.files?.[0] || null)} />
                </div>
                <div className="form-group">
                  <div className="form-check-row">
                    <input type="checkbox" id="exclusive" checked={courseFormData.is_membership_exclusive}
                      onChange={e => setCourseFormData(p => ({ ...p, is_membership_exclusive: e.target.checked }))} />
                    <label className="form-label" htmlFor="exclusive" style={{ cursor: 'pointer', marginBottom: 0 }}>
                      Exclusivo para miembros
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <div className="form-check-row">
                    <input type="checkbox" id="published" checked={courseFormData.is_published}
                      onChange={e => setCourseFormData(p => ({ ...p, is_published: e.target.checked }))} />
                    <label className="form-label" htmlFor="published" style={{ cursor: 'pointer', marginBottom: 0 }}>
                      Publicado
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: 28 }}>
                <button type="button" className="btn-cancel" onClick={() => setShowCourseForm(false)}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Guardando...' : (editingCourse ? 'Guardar cambios' : 'Crear curso')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lesson Form Modal ── */}
      {showLessonForm && (
        <div className="form-overlay" onClick={e => e.target === e.currentTarget && setShowLessonForm(false)}>
          <div className="form-box">
            <h2 className="form-box-title">{editingLesson ? 'Editar lección' : 'Nueva lección'}</h2>
            <form onSubmit={saveLesson}>
              <div className="form-grid">
                <div className="form-group full">
                  <label className="form-label">Título de la lección *</label>
                  <input className="form-input" required value={lessonFormData.title}
                    onChange={e => setLessonFormData(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-textarea" value={lessonFormData.description}
                    onChange={e => setLessonFormData(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Número de sección</label>
                  <input className="form-input" type="number" min="1" value={lessonFormData.section_number}
                    onChange={e => setLessonFormData(p => ({ ...p, section_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Título de sección</label>
                  <input className="form-input" placeholder="ej. Fundamentos" value={lessonFormData.section_title}
                    onChange={e => setLessonFormData(p => ({ ...p, section_title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Orden</label>
                  <input className="form-input" type="number" min="1" value={lessonFormData.order_index}
                    onChange={e => setLessonFormData(p => ({ ...p, order_index: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Duración (ej. 15 MIN)</label>
                  <input className="form-input" placeholder="ej. 15 MIN" value={lessonFormData.duration}
                    onChange={e => setLessonFormData(p => ({ ...p, duration: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={lessonFormData.lesson_type}
                    onChange={e => setLessonFormData(p => ({ ...p, lesson_type: e.target.value }))}>
                    <option value="video">Video</option>
                    <option value="quiz">Quiz</option>
                    <option value="resource">Recurso</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">URL de YouTube</label>
                  <input className="form-input" placeholder="https://youtube.com/watch?v=..." value={lessonFormData.video_url}
                    onChange={e => setLessonFormData(p => ({ ...p, video_url: e.target.value }))} />
                  <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 4, display: 'block' }}>
                    El video debe estar configurado como <strong>No listado</strong> en YouTube.
                  </span>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: 28 }}>
                <button type="button" className="btn-cancel" onClick={() => setShowLessonForm(false)}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Guardando...' : (editingLesson ? 'Guardar cambios' : 'Agregar lección')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
