import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Course } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import CourseCard from '../../components/courses/CourseCard/CourseCard';
import { downloadCourseCertificate } from '../../utils/certificate';
import '../Explorer/Explorer.css';

const CourseCardWithDiploma: React.FC<{ course: Course }> = ({ course }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadCourseCertificate(course.id, course.title);
    } catch {
      alert('No se pudo generar el diploma. Intenta de nuevo en unos momentos.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <CourseCard course={course} />
      {course.completed && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary)', color: 'var(--color-on-primary)',
            border: 'none', fontWeight: 700, fontSize: 12, cursor: downloading ? 'not-allowed' : 'pointer',
            opacity: downloading ? 0.7 : 1, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>workspace_premium</span>
          {downloading ? 'Generando...' : 'Diploma'}
        </button>
      )}
    </div>
  );
};

const MyCourses: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    api.get<{ courses: Course[]; hasActiveSubscription: boolean }>('/courses/my-courses')
      .then(r => {
        setCourses(r.data.courses);
        setHasActiveSubscription(r.data.hasActiveSubscription);
      })
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || loading) {
    return <div className="explorer course-grid-empty">Cargando tus cursos...</div>;
  }

  const purchased = courses.filter(c => c.access_type === 'purchase');
  const viaMembership = courses.filter(c => c.access_type === 'membership');

  return (
    <div className="explorer">
      <header className="explorer-header">
        <h1 className="explorer-title">Mis Cursos</h1>
        <p className="explorer-subtitle">
          {courses.length === 0
            ? 'Todavía no compraste ningún curso. Explorá el catálogo para empezar a aprender.'
            : 'Todos los cursos a los que tenés acceso, para siempre que estén comprados.'}
        </p>
      </header>

      {courses.length === 0 ? (
        <div className="course-grid-empty">
          <button className="btn-primary" onClick={() => navigate('/explorer')}>Explorar cursos</button>
        </div>
      ) : (
        <>
          {purchased.length > 0 && (
            <div className="course-grid">
              {purchased.map(course => <CourseCardWithDiploma key={course.id} course={course} />)}
            </div>
          )}

          {hasActiveSubscription && viaMembership.length > 0 && (
            <>
              <h2 style={{ marginTop: 64, marginBottom: 24 }}>Incluidos en tu membresía</h2>
              <div className="course-grid">
                {viaMembership.map(course => <CourseCardWithDiploma key={course.id} course={course} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MyCourses;
