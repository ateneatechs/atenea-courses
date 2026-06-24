import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { query } from '../config/database';
import { renderCertificatePdf } from '../services/certificate';

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

const isMembershipEnabled = async (tenantId: string): Promise<boolean> => {
  const result = await query(
    `SELECT value FROM site_settings WHERE tenant_id = $1 AND key = 'membership_enabled'`,
    [tenantId]
  );
  return result.rows.length === 0 || result.rows[0].value === 'true';
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

    if (!(await isMembershipEnabled(req.tenantId!))) {
      sql += ` AND c.is_membership_exclusive = false`;
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

    const course = courseResult.rows[0];
    if (course.is_membership_exclusive && !(await isMembershipEnabled(req.tenantId!))) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    // A JWT minted for another tenant must not grant access/progress here.
    const sameTenantUser =
      req.user && (req.user.role === 'super_admin' || req.user.tenantId === req.tenantId)
        ? req.user
        : undefined;

    let hasAccess = false;
    if (sameTenantUser) {
      hasAccess = await checkAccess(sameTenantUser.userId, id, req.tenantId!, sameTenantUser.role);
    }

    const lessonsQuery = sameTenantUser
      ? `SELECT l.*,
           lp.completed    AS lp_completed,
           lp.progress_seconds AS lp_seconds
         FROM lessons l
         LEFT JOIN lesson_progress lp
           ON lp.lesson_id = l.id AND lp.user_id = $2
         WHERE l.course_id = $1
         ORDER BY l.section_number, l.order_index`
      : 'SELECT * FROM lessons WHERE course_id = $1 ORDER BY section_number, order_index';

    const lessonsParams = sameTenantUser ? [id, sameTenantUser.userId] : [id];
    const lessonsResult = await query(lessonsQuery, lessonsParams);

    const lessons = lessonsResult.rows.map(l => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lp_completed, lp_seconds, ...lessonFields } = l;
      return {
        ...lessonFields,
        // video_url is intentionally omitted here — it leaks every lesson's
        // YouTube ID in one response. Fetch it per-lesson via GET /lessons/:id
        // (getLessonById), which gates access per request.
        video_url: null,
        progress: sameTenantUser
          ? { completed: lp_completed ?? false, progress_seconds: lp_seconds ?? 0 }
          : null,
      };
    });

    res.json({ ...course, lessons, hasAccess });
  } catch (error) {
    console.error('GetCourseById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMyCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    const subResult = await query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND tenant_id = $2 AND status = 'active' AND ends_at > NOW()`,
      [userId, tenantId]
    );
    const hasActiveSubscription = subResult.rows.length > 0;

    const result = await query(
      `SELECT c.*, cat.name AS category_name, cp.purchased_at,
              CASE WHEN cp.id IS NOT NULL THEN 'purchase' ELSE 'membership' END AS access_type,
              COALESCE(lc.total, 0) AS lesson_count,
              COALESCE(pc.completed, 0) AS completed_lesson_count
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN course_purchases cp ON cp.course_id = c.id AND cp.user_id = $1
       LEFT JOIN (
         SELECT course_id, COUNT(*) AS total FROM lessons GROUP BY course_id
       ) lc ON lc.course_id = c.id
       LEFT JOIN (
         SELECT course_id, COUNT(*) AS completed FROM lesson_progress
         WHERE user_id = $1 AND completed = true GROUP BY course_id
       ) pc ON pc.course_id = c.id
       WHERE c.tenant_id = $2 AND c.is_published = true
         AND (cp.id IS NOT NULL OR $3 = true)
       ORDER BY cp.purchased_at DESC NULLS LAST, c.created_at DESC`,
      [userId, tenantId, hasActiveSubscription]
    );

    const courses = result.rows.map(({ lesson_count, completed_lesson_count, ...course }) => ({
      ...course,
      completed: Number(lesson_count) > 0 && Number(completed_lesson_count) >= Number(lesson_count),
    }));

    res.json({ courses, hasActiveSubscription });
  } catch (error) {
    console.error('GetMyCourses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCourseCertificate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const tenantId = req.tenantId!;

    const courseResult = await query(
      'SELECT title, instructor_name FROM courses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ message: 'Curso no encontrado' });
      return;
    }
    const course = courseResult.rows[0];

    // Completion is proven by lesson_progress rows, which can only be written
    // while the user had access (see updateLessonProgress) — so we don't need
    // to re-check current access here. This lets a diploma stay downloadable
    // even after a membership lapses, matching "para siempre" course access.
    const [totalResult, progressResult] = await Promise.all([
      query('SELECT COUNT(*)::int AS total FROM lessons WHERE course_id = $1', [id]),
      query(
        `SELECT COUNT(*)::int AS completed, MAX(updated_at) AS last_completed_at
         FROM lesson_progress WHERE course_id = $1 AND user_id = $2 AND completed = true`,
        [id, userId]
      ),
    ]);
    const total = totalResult.rows[0].total;
    const { completed, last_completed_at } = progressResult.rows[0];

    if (total === 0 || completed < total) {
      res.status(400).json({ message: 'Todavía no completaste todas las lecciones de este curso.' });
      return;
    }

    const [userResult, tenantResult, logoResult] = await Promise.all([
      query('SELECT name FROM users WHERE id = $1', [userId]),
      query('SELECT name FROM tenants WHERE id = $1', [tenantId]),
      query(`SELECT value FROM site_settings WHERE tenant_id = $1 AND key = 'logo_url'`, [tenantId]),
    ]);

    const studentName = userResult.rows[0]?.name || 'Estudiante';
    const tenantName = tenantResult.rows[0]?.name || 'Atenea';
    const logoUrl = logoResult.rows[0]?.value as string | undefined;
    const logoPath = logoUrl ? path.join(process.cwd(), logoUrl.replace(/^\//, '')) : null;

    const certificateId = crypto
      .createHash('sha256')
      .update(`${userId}:${id}`)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase();

    const safeFilename = `Diploma - ${course.title}`.replace(/[\\/:*?"<>|]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);

    renderCertificatePdf(res, {
      studentName,
      courseTitle: course.title,
      instructorName: course.instructor_name,
      tenantName,
      logoPath,
      completedAt: last_completed_at ? new Date(last_completed_at) : new Date(),
      certificateId,
    });
  } catch (error) {
    console.error('GetCourseCertificate error:', error);
    res.status(500).json({ message: 'No se pudo generar el certificado.' });
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

export const getLessonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // JOIN courses to enforce tenant isolation — prevents cross-tenant lesson access
    const lessonResult = await query(
      `SELECT l.* FROM lessons l
       JOIN courses c ON c.id = l.course_id
       WHERE l.id = $1 AND c.tenant_id = $2`,
      [id, req.tenantId!]
    );
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

    // JOIN courses to enforce tenant isolation
    const lessonResult = await query(
      `SELECT l.course_id FROM lessons l
       JOIN courses c ON c.id = l.course_id
       WHERE l.id = $1 AND c.tenant_id = $2`,
      [id, req.tenantId!]
    );
    if (lessonResult.rows.length === 0) {
      res.status(404).json({ message: 'Lesson not found' });
      return;
    }

    // Verify user has access to this course before writing progress
    const hasAccess = await checkAccess(userId, lessonResult.rows[0].course_id, req.tenantId!, req.user!.role);
    if (!hasAccess) {
      res.status(403).json({ message: 'Access denied.' });
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
