import { Request, Response } from 'express';
import { query } from '../config/database';

const checkAccess = async (
  userId: string,
  courseId: string,
  tenantId: string,
  role?: string
): Promise<boolean> => {
  if (role === 'admin' || role === 'super_admin') return true;
  const [sub, purchase] = await Promise.all([
    query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND tenant_id = $2 AND status = 'active' AND ends_at > NOW()`,
      [userId, tenantId]
    ),
    query('SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2', [userId, courseId]),
  ]);
  return sub.rows.length > 0 || purchase.rows.length > 0;
};

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, sort = 'newest' } = req.query;
    const params: unknown[] = [req.tenantId!];
    let sql = `
      SELECT c.*, cat.name AS category_name, cat.slug AS category_slug
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.is_published = true AND c.tenant_id = $1
    `;

    if (category && category !== 'all') {
      params.push(category);
      sql += ` AND cat.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.instructor_name ILIKE $${params.length})`;
    }

    const orderMap: Record<string, string> = {
      newest: 'c.created_at DESC',
      popular: 'c.total_lessons DESC',
      'price-desc': 'c.price DESC NULLS LAST',
    };
    sql += ` ORDER BY ${orderMap[sort as string] || orderMap.newest}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('GetCourses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseResult = await query(
      `SELECT c.*, cat.name AS category_name FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.is_published = true`,
      [id, req.tenantId!]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    let hasAccess = false;
    if (req.user) {
      hasAccess = await checkAccess(req.user.userId, id, req.tenantId!, req.user.role);
    }

    const lessonsQuery = req.user
      ? `SELECT l.*,
           lp.completed    AS lp_completed,
           lp.progress_seconds AS lp_seconds
         FROM lessons l
         LEFT JOIN lesson_progress lp
           ON lp.lesson_id = l.id AND lp.user_id = $2
         WHERE l.course_id = $1
         ORDER BY l.section_number, l.order_index`
      : 'SELECT * FROM lessons WHERE course_id = $1 ORDER BY section_number, order_index';

    const lessonsParams = req.user ? [id, req.user.userId] : [id];
    const lessonsResult = await query(lessonsQuery, lessonsParams);

    const lessons = lessonsResult.rows.map(l => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lp_completed, lp_seconds, ...lessonFields } = l;
      return {
        ...lessonFields,
        video_url: hasAccess ? l.video_url : null,
        progress: req.user
          ? { completed: lp_completed ?? false, progress_seconds: lp_seconds ?? 0 }
          : null,
      };
    });

    res.json({ ...courseResult.rows[0], lessons, hasAccess });
  } catch (error) {
    console.error('GetCourseById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getInstructors = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        c.instructor_name AS name,
        COUNT(c.id)::int AS course_count,
        MIN(c.thumbnail_url) AS avatar_url,
        COALESCE(
          array_agg(DISTINCT cat.name) FILTER (WHERE cat.name IS NOT NULL),
          '{}'::text[]
        ) AS categories
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.is_published = true AND c.tenant_id = $1
      GROUP BY c.instructor_name
      ORDER BY COUNT(c.id) DESC, c.instructor_name ASC
    `, [req.tenantId!]);
    res.json(result.rows);
  } catch (error) {
    console.error('GetInstructors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT * FROM categories WHERE tenant_id = $1 ORDER BY name',
      [req.tenantId!]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GetCategories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { plan = 'monthly' } = req.body;
    const userId = req.user!.userId;

    await query(
      `UPDATE subscriptions SET status = 'cancelled' WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [userId, req.tenantId!]
    );

    const startsAt = new Date();
    const endsAt = new Date();
    plan === 'annual' ? endsAt.setFullYear(endsAt.getFullYear() + 1) : endsAt.setMonth(endsAt.getMonth() + 1);

    const result = await query(
      `INSERT INTO subscriptions (user_id, tenant_id, plan, status, starts_at, ends_at)
       VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
      [userId, req.tenantId!, plan, startsAt, endsAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CreateSubscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const purchaseCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.body;
    const userId = req.user!.userId;

    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2 AND is_published = true',
      [courseId, req.tenantId!]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    const existing = await query(
      'SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'Course already purchased' });
      return;
    }

    const course = courseResult.rows[0];
    const result = await query(
      'INSERT INTO course_purchases (user_id, course_id, tenant_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, courseId, req.tenantId!, course.price]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('PurchaseCourse error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getLessonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const lessonResult = await query('SELECT * FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }

    const lesson = lessonResult.rows[0];
    const hasAccess = await checkAccess(userId, lesson.course_id, req.tenantId!, req.user!.role);

    if (!hasAccess) {
      res.status(403).json({ message: 'Access denied. Subscribe or purchase this course.' });
      return;
    }

    const progressResult = await query(
      'SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, id]
    );

    res.json({ ...lesson, progress: progressResult.rows[0] || null });
  } catch (error) {
    console.error('GetLessonById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateLessonProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { completed, progressSeconds } = req.body;
    const userId = req.user!.userId;

    const lessonResult = await query('SELECT course_id FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }

    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, progress_seconds, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, lesson_id)
       DO UPDATE SET completed = $4, progress_seconds = $5, updated_at = NOW()`,
      [userId, id, lessonResult.rows[0].course_id, completed || false, progressSeconds || 0]
    );

    res.json({ message: 'Progress updated' });
  } catch (error) {
    console.error('UpdateProgress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
