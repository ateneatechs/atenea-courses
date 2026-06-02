import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Course } from '../../../types';
import './CourseCard.css';

interface Props {
  course: Course;
}

const CourseCard: React.FC<Props> = ({ course }) => {
  const navigate = useNavigate();

  const badgeClass = course.is_membership_exclusive ? 'primary' : 'glass';

  const priceLabel = course.is_membership_exclusive
    ? 'Incluido'
    : course.price
      ? `$${course.price} USD`
      : 'Gratis';

  return (
    <div className="course-card" onClick={() => navigate(`courses/${course.id}`)}>
      <div className="course-card-image-wrap glass-card">
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title} loading="lazy" />
        )}
        {course.badge && (
          <div className="course-card-badge">
            <span className={`badge-pill ${badgeClass}`}>{course.badge}</span>
          </div>
        )}
        <div className="course-card-overlay-body">
          <h3 className="course-card-overlay-title">{course.title}</h3>
          <span className="course-card-overlay-price">{priceLabel}</span>
        </div>
      </div>

      <div className="course-card-info">
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-instructor">con {course.instructor_name}</p>
        <div className="course-card-meta">
          <span className="course-card-price">{priceLabel}</span>
          <span className="course-card-duration">
            {course.total_lessons} Lecciones • {course.total_duration}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
