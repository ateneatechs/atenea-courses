import { Request, Response } from 'express';
import { query } from '../config/database';
import { getValidAccessToken, createPreference } from '../services/mercadopago';
import { getTenantFrontendUrl } from '../utils/tenantUrl';

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
    query(
      `SELECT id FROM course_purchases WHERE user_id = $1 AND course_id = $2 AND payment_status = 'approved'`,
      [userId, courseId]
    ),
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
        video_url: hasAccess ? l.video_url : null,
        progress: sameTenantUser
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
    const course = courseResult.rows[0];
    if (course.price) {
      res.status(400).json({ message: 'Este curso requiere pago. Usa el checkout.' });
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

    const result = await query(
      `INSERT INTO course_purchases (user_id, course_id, tenant_id, amount, payment_status)
       VALUES ($1, $2, $3, $4, 'approved') RETURNING *`,
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

export const createCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const courseResult = await query(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2 AND is_published = true',
      [id, req.tenantId!]
    );
    const course = courseResult.rows[0];
    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }
    if (!course.price) {
      res.status(400).json({ message: 'Este curso es gratuito' });
      return;
    }

    const existingResult = await query(
      'SELECT * FROM course_purchases WHERE user_id = $1 AND course_id = $2',
      [userId, id]
    );
    const existing = existingResult.rows[0];
    if (existing?.payment_status === 'approved') {
      res.status(400).json({ message: 'Ya tienes acceso a este curso' });
      return;
    }

    const tenantResult = await query(
      'SELECT id, slug, mp_access_token, mp_refresh_token, mp_connected_at FROM tenants WHERE id = $1',
      [req.tenantId!]
    );
    const tenant = tenantResult.rows[0];
    if (!tenant?.mp_access_token) {
      res.status(400).json({ message: 'Esta academia no tiene pagos configurados' });
      return;
    }

    const settingsResult = await query(
      `SELECT value FROM platform_settings WHERE key = 'platform_fee_percent'`
    );
    const feePercent = Number(settingsResult.rows[0]?.value || '10');
    const price = Number(course.price);
    const marketplaceFee = Math.round(price * feePercent) / 100;

    let purchaseId: string;
    if (existing) {
      purchaseId = existing.id;
      await query(
        `UPDATE course_purchases SET payment_status = 'pending', amount = $1 WHERE id = $2`,
        [price, purchaseId]
      );
    } else {
      const inserted = await query(
        `INSERT INTO course_purchases (user_id, course_id, tenant_id, amount, payment_status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
        [userId, id, req.tenantId!, price]
      );
      purchaseId = inserted.rows[0].id;
    }

    const accessToken = await getValidAccessToken(tenant);
    const courseUrl = `${getTenantFrontendUrl(tenant.slug)}/courses/${id}`;

    const preference = await createPreference({
      accessToken,
      title: course.title,
      price,
      marketplaceFee,
      externalReference: purchaseId,
      backUrls: {
        success: `${courseUrl}?payment=success`,
        failure: `${courseUrl}?payment=failure`,
        pending: `${courseUrl}?payment=pending`,
      },
      notificationUrl: `${process.env.BACKEND_URL}/api/payments/webhook`,
    });

    await query('UPDATE course_purchases SET mp_preference_id = $1 WHERE id = $2', [preference.id, purchaseId]);

    res.json({ init_point: preference.init_point });
  } catch (error) {
    console.error('CreateCheckout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
