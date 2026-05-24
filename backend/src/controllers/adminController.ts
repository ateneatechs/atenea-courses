import { Request, Response } from 'express';
import { query } from '../config/database';

export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [users, courses, subs, revenue] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM users WHERE role = 'user'"),
      query('SELECT COUNT(*) AS count FROM courses'),
      query("SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'active' AND ends_at > NOW()"),
      query('SELECT COALESCE(SUM(amount), 0) AS total FROM course_purchases'),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalCourses: parseInt(courses.rows[0].count),
      activeSubscriptions: parseInt(subs.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].total),
    });
  } catch (error) {
    console.error('GetStats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllCourses = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT c.*, cat.name AS category_name, cat.slug AS category_slug
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('GetAllCourses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title, description, instructor_name, price,
      category_id, badge, total_duration,
      is_membership_exclusive = false, is_published = false,
      thumbnail_url: bodyThumb,
    } = req.body;

    const thumbnail_url = req.file ? `/uploads/images/${req.file.filename}` : (bodyThumb || '');

    const result = await query(
      `INSERT INTO courses
        (title, description, instructor_name, thumbnail_url, price, category_id, badge, total_duration, is_membership_exclusive, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [title, description, instructor_name, thumbnail_url,
        price || null, category_id || null, badge || null, total_duration || null,
        is_membership_exclusive === 'true' || is_membership_exclusive === true,
        is_published === 'true' || is_published === true]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title, description, instructor_name, price, category_id,
      badge, total_duration, is_membership_exclusive, is_published, thumbnail_url: bodyThumb,
    } = req.body;

    const thumbnail_url = req.file ? `/uploads/images/${req.file.filename}` : bodyThumb;

    const result = await query(
      `UPDATE courses SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        instructor_name = COALESCE($3, instructor_name),
        thumbnail_url = COALESCE($4, thumbnail_url),
        price = $5,
        category_id = COALESCE($6, category_id),
        badge = $7,
        total_duration = COALESCE($8, total_duration),
        is_membership_exclusive = COALESCE($9::boolean, is_membership_exclusive),
        is_published = COALESCE($10::boolean, is_published),
        updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [title, description, instructor_name, thumbnail_url,
        price !== undefined && price !== '' ? price : null,
        category_id, badge || null, total_duration,
        is_membership_exclusive != null ? (is_membership_exclusive === 'true' || is_membership_exclusive === true) : null,
        is_published != null ? (is_published === 'true' || is_published === true) : null,
        id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (error) {
    console.error('DeleteCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getLessons = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT * FROM lessons WHERE course_id = $1 ORDER BY section_number, order_index',
      [req.params.courseId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GetLessons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      course_id, title, description, duration,
      order_index, section_number, section_title, lesson_type, video_url: bodyUrl,
    } = req.body;

    const video_url = req.file ? `/uploads/videos/${req.file.filename}` : (bodyUrl || '');

    const result = await query(
      `INSERT INTO lessons
        (course_id, title, description, video_url, duration, order_index, section_number, section_title, lesson_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [course_id, title, description || '', video_url, duration || '',
        parseInt(order_index) || 1, parseInt(section_number) || 1,
        section_title || 'Section 1', lesson_type || 'video']
    );

    await query(
      'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1), updated_at = NOW() WHERE id = $1',
      [course_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateLesson error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title, description, duration,
      order_index, section_number, section_title, lesson_type, video_url: bodyUrl,
    } = req.body;

    const video_url = req.file ? `/uploads/videos/${req.file.filename}` : bodyUrl;

    const result = await query(
      `UPDATE lessons SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        video_url = COALESCE($3, video_url),
        duration = COALESCE($4, duration),
        order_index = COALESCE($5::int, order_index),
        section_number = COALESCE($6::int, section_number),
        section_title = COALESCE($7, section_title),
        lesson_type = COALESCE($8, lesson_type),
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [title, description, video_url, duration,
        order_index ? parseInt(order_index) : null,
        section_number ? parseInt(section_number) : null,
        section_title, lesson_type, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateLesson error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const lessonResult = await query('SELECT course_id FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }
    const { course_id } = lessonResult.rows[0];
    await query('DELETE FROM lessons WHERE id = $1', [id]);
    await query(
      'UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = $1), updated_at = NOW() WHERE id = $1',
      [course_id]
    );
    res.json({ message: 'Lesson deleted' });
  } catch (error) {
    console.error('DeleteLesson error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ message: 'Rol inválido' });
      return;
    }
    if (id === req.user?.userId) {
      res.status(400).json({ message: 'No puedes cambiar tu propio rol.' });
      return;
    }
    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, id]
    );
    if (result.rows.length === 0) { res.status(404).json({ message: 'User not found' }); return; }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UpdateUserRole error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (id === req.user?.userId) {
      res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });
      return;
    }
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT u.id, u.email, u.name, u.role, u.created_at,
             s.plan, s.status AS sub_status, s.ends_at
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active' AND s.ends_at > NOW()
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
