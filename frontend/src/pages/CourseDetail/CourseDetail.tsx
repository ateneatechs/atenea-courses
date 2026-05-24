import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Course, Lesson, CourseTab } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import './CourseDetail.css';

const getYouTubeEmbedUrl = (url: string): string => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (!match) return '';
  const id = match[1];
  return `https://www.youtube-nocookie.com/embed/${id}?modestbranding=1&rel=0&iv_load_policy=3&color=white`;
};

const CourseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeTab, setActiveTab] = useState<CourseTab>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<Course>(`/courses/${id}`)
      .then(r => {
        setCourse(r.data);
        if (r.data.lessons && r.data.lessons.length > 0) {
          setActiveLesson(r.data.lessons[0]);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ paddingTop: 'calc(var(--navbar-height) + 40px)', textAlign: 'center', color: 'var(--color-on-surface-variant)', minHeight: '100vh' }}>
        Cargando curso...
      </div>
    );
  }
  if (!course) {
    return (
      <div style={{ paddingTop: 'calc(var(--navbar-height) + 40px)', textAlign: 'center', color: 'var(--color-on-surface-variant)', minHeight: '100vh' }}>
        Curso no encontrado.
      </div>
    );
  }

  const hasAccess = course.hasAccess;
  const lessons = course.lessons || [];

  const sections = lessons.reduce<Record<number, { title: string; lessons: Lesson[] }>>((acc, l) => {
    if (!acc[l.section_number]) acc[l.section_number] = { title: l.section_title, lessons: [] };
    acc[l.section_number].lessons.push(l);
    return acc;
  }, {});

  const completedCount = 0;
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="course-detail">
      <div className="course-detail-layout">
        {/* Main */}
        <section className="course-main">
          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link to="/explorer">Cursos</Link>
            <span className="material-symbols-outlined breadcrumb-sep">chevron_right</span>
            <span>{course.category_name || 'All'}</span>
            <span className="material-symbols-outlined breadcrumb-sep">chevron_right</span>
            <span className="current">{course.title}</span>
          </nav>

          {/* Video Player */}
          <div className="video-player-wrap">
            {hasAccess && activeLesson?.video_url ? (
              <div className="yt-embed-wrap">
                <iframe
                  key={activeLesson.id}
                  src={getYouTubeEmbedUrl(activeLesson.video_url)}
                  className="yt-iframe"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeLesson.title}
                />
                <div className="yt-overlay-title" />
                <div className="yt-overlay-logo" />
              </div>
            ) : hasAccess ? (
              <>
                {course.thumbnail_url && (
                  <img className="video-thumbnail" src={course.thumbnail_url} alt={course.title} style={{ opacity: 0.4 }} />
                )}
                <div className="video-coming-soon">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>schedule</span>
                  <p>Video próximamente</p>
                </div>
              </>
            ) : (
              <>
                {course.thumbnail_url && (
                  <img className="video-thumbnail" src={course.thumbnail_url} alt={course.title} />
                )}
                <div className="video-lock-overlay">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>lock</span>
                  <p>Suscríbete o compra este curso para acceder</p>
                </div>
              </>
            )}
          </div>

          {/* Lesson Header */}
          <div className="lesson-header">
            <h1 className="lesson-title">{activeLesson?.title || course.title}</h1>
            <p className="lesson-subtitle">
              {activeLesson?.description || course.description}
            </p>
          </div>

          {/* Access Gate */}
          {!hasAccess && (
            <div className="access-gate glass-card">
              <h2 className="access-gate-title">Desbloquear este curso</h2>
              <p className="access-gate-text">
                {course.is_membership_exclusive
                  ? 'Este curso está incluido en la Membresía Lumière. Suscríbete para obtener acceso ilimitado.'
                  : `Compra este curso por $${course.price} USD o suscríbete para acceder a todos los cursos.`}
              </p>
              <div className="access-gate-btns">
                <button className="btn-primary" onClick={() => navigate('/membership')}>
                  {course.is_membership_exclusive ? 'Suscribirse ahora' : 'Obtener Membresía'}
                </button>
                {!course.is_membership_exclusive && course.price && isAuthenticated && (
                  <button className="btn-outline" onClick={async () => {
                    try {
                      await api.post('/courses/purchase', { courseId: course.id });
                      const { data } = await api.get<Course>(`/courses/${id}`);
                      setCourse(data);
                    } catch {
                      alert('Error al comprar. Por favor intenta de nuevo.');
                    }
                  }}>
                    Comprar por ${course.price}
                  </button>
                )}
                {!isAuthenticated && (
                  <button className="btn-outline" onClick={() => navigate('/')}>
                    Iniciar sesión
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="course-tabs">
            {(['overview', 'resources', 'discussion'] as CourseTab[]).map(tab => (
              <button
                key={tab}
                className={`course-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {{ overview: 'Descripción', resources: 'Recursos', discussion: 'Discusión' }[tab]}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          <div className={`tab-content ${activeTab === 'overview' ? 'active' : ''}`}>
            <div className="tab-overview-grid">
              <div>
                <h3 className="objectives-title">Objetivos de aprendizaje</h3>
                <div className="objective-list">
                  {[
                    'Dominá la técnica profesional con guía paso a paso de expertos del sector.',
                    'Comprendé los fundamentos de cada método para que el aprendizaje sea duradero y aplicable.',
                    'Perfeccioná tu trabajo con técnicas de acabado que marcan la diferencia en el resultado final.',
                  ].map((obj, i) => (
                    <div key={i} className="objective-item">
                      <span className="material-symbols-outlined objective-icon" style={{ fontSize: 22 }}>check_circle</span>
                      <p className="objective-text">{obj}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="educator-card glass-card">
                <div className="educator-avatar">
                  <img src={course.thumbnail_url} alt={course.instructor_name} />
                </div>
                <span className="educator-label">Instructor</span>
                <h4 className="educator-name">{course.instructor_name}</h4>
                <p className="educator-bio">
                  Barbero premiado con más de 10 años de experiencia en competencias internacionales, especializado en técnica de precisión y formación profesional.
                </p>
                <button className="educator-link">Ver perfil</button>
              </div>
            </div>
          </div>

          {/* Resources Tab */}
          <div className={`tab-content ${activeTab === 'resources' ? 'active' : ''}`}>
            <div className="resources-list">
              {[
                { icon: 'picture_as_pdf', name: 'Diagrama técnico', meta: 'PDF • 4.2 MB' },
                { icon: 'inventory', name: 'Lista de herramientas recomendadas', meta: 'PDF • 1.1 MB' },
              ].map(r => (
                <div key={r.name} className="resource-item glass-card">
                  <div className="resource-item-left">
                    <span className="resource-icon">
                      <span className="material-symbols-outlined">{r.icon}</span>
                    </span>
                    <div>
                      <p className="resource-name">{r.name}</p>
                      <p className="resource-meta">{r.meta}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined resource-download">download</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discussion Tab */}
          <div className={`tab-content ${activeTab === 'discussion' ? 'active' : ''}`}>
            {isAuthenticated ? (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-full)',
                  background: 'color-mix(in srgb, var(--color-primary-fixed) 30%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0
                }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <textarea
                    style={{
                      width: '100%', background: 'var(--color-surface-container-low)',
                      border: 'none', borderBottom: '1px solid var(--color-outline-variant)',
                      color: 'var(--color-on-surface)', padding: '8px 0', fontSize: 14, outline: 'none',
                      resize: 'vertical', minHeight: 80,
                    }}
                    placeholder="Únete a la discusión..."
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn-primary" style={{ padding: '8px 24px', fontSize: 11 }}>Publicar</button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>
                Inicia sesión para unirte a la discusión.
              </p>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="curriculum-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-top">
              <span className="sidebar-label">Contenido del curso</span>
              <span className="sidebar-progress-pct">{progressPct}% Completado</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {Object.entries(sections).map(([secNum, sec]) => (
            <div key={secNum}>
              <div className="section-header-item">
                <span className={`section-header-title ${activeLesson && sec.lessons.some(l => l.id === activeLesson.id) ? 'active' : 'inactive'}`}>
                  Sección {secNum.padStart(2, '0')}: {sec.title}
                </span>
              </div>
              {sec.lessons.map(lesson => {
                const isPlaying = activeLesson?.id === lesson.id;
                const lessonTypeIcon = lesson.lesson_type === 'quiz'
                  ? 'quiz'
                  : lesson.lesson_type === 'resource'
                    ? 'description'
                    : isPlaying ? 'play_circle' : 'check_circle';

                return (
                  <div
                    key={lesson.id}
                    className={`lesson-item${isPlaying ? ' playing' : ''}`}
                    onClick={() => setActiveLesson(lesson)}
                  >
                    <span className={`material-symbols-outlined lesson-icon${isPlaying ? '' : ' done'}`}
                      style={{ fontSize: 18, fontVariationSettings: isPlaying ? "'FILL' 0" : "'FILL' 1" }}>
                      {lessonTypeIcon}
                    </span>
                    <div className="lesson-info">
                      <p className={`lesson-item-title${isPlaying ? ' playing' : ''}`}>{lesson.title}</p>
                      <p className={`lesson-item-meta${isPlaying ? ' playing' : ''}`}>
                        {isPlaying ? 'Reproduciendo ahora' : `${lesson.lesson_type.toUpperCase()} • ${lesson.duration}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <button className="sidebar-next-btn">Siguiente lección</button>
        </aside>
      </div>
    </div>
  );
};

export default CourseDetail;
