import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Course, Category, SortOption } from '../../types';
import CourseCard from '../../components/courses/CourseCard/CourseCard';
import './Explorer.css';

const Explorer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const filterMasterclass = searchParams.get('filter') === 'masterclass';

  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sort });
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (search) params.set('search', search);
      const { data } = await api.get<Course[]>(`/courses?${params}`);
      setCourses(data);
      // Wait for React to paint new courses before fading back in
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)));
    } catch {
      setFading(false);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search, sort]);

  useEffect(() => {
    api.get<Category[]>('/courses/categories').then(r => setCategories(r.data));
  }, []);

  useEffect(() => {
    // Fade out IMMEDIATELY when any filter changes, then fetch after debounce
    setFading(true);
    const t = setTimeout(fetchCourses, 300);
    return () => clearTimeout(t);
  }, [fetchCourses]);

  return (
    <div className="explorer">
      {/* Header */}
      <header className="explorer-header">
        <h1 className="explorer-title">
          {filterMasterclass ? 'Masterclasses' : 'Explorador de Cursos'}
        </h1>
        <p className="explorer-subtitle">
          {filterMasterclass
            ? 'Los cursos más avanzados de nuestra academia, impartidos por maestros barberos con trayectoria internacional.'
            : 'Perfeccioná tu técnica con cursos curados dirigidos por maestros barberos profesionales de todo el mundo.'}
        </p>
      </header>

      {/* Controls */}
      <div className="explorer-controls">
        <div className="search-wrap">
          <label className="search-label">Buscar cursos</label>
          <div className="search-input-wrap">
            <input
              className="search-input"
              type="text"
              placeholder="ej. Recogidos esculturales"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="material-symbols-outlined search-icon">search</span>
          </div>
        </div>

        <div className="sort-wrap">
          <span className="sort-label">Ordenar por</span>
          <select
            className="sort-select"
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
          >
            <option value="newest">Más recientes</option>
            <option value="popular">Más populares</option>
            <option value="price-desc">Precio: Mayor a menor</option>
          </select>
        </div>
      </div>

      {/* Category Chips */}
      <div className="category-chips">
        <button
          className={`chip ${activeCategory === 'all' ? 'active' : 'inactive'}`}
          onClick={() => setActiveCategory('all')}
        >
          Todas las colecciones
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`chip ${activeCategory === cat.slug ? 'active' : 'inactive'}`}
            onClick={() => setActiveCategory(cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="course-grid-empty">Cargando masterclasses...</div>
      ) : (
        <div className={`course-grid${fading ? ' fading' : ''}`}>
          {(() => {
            const displayed = filterMasterclass
              ? courses.filter(c => c.badge?.toLowerCase().includes('masterclass'))
              : courses;
            return displayed.length === 0
              ? <div className="course-grid-empty">No se encontraron cursos. Intenta con otra búsqueda.</div>
              : displayed.map(course => <CourseCard key={course.id} course={course} />);
          })()}
        </div>
      )}

      {/* Load More */}
      {!fading && courses.length > 0 && (
        <div className="load-more-wrap">
          <button className="load-more-btn">Cargar más cursos</button>
          <p className="load-more-count">Mostrando {courses.length} masterclasses</p>
        </div>
      )}
    </div>
  );
};

export default Explorer;
