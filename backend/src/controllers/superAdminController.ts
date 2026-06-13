import { Request, Response } from 'express';
import { query } from '../config/database';

export const listTenants = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        t.id, t.slug, t.name, t.created_at,
        COUNT(DISTINCT u.id)::int AS user_count,
        COUNT(DISTINCT c.id)::int AS course_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id AND u.role != 'super_admin'
      LEFT JOIN courses c ON c.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('ListTenants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug, name } = req.body;
    if (!slug || !name) {
      res.status(400).json({ message: 'slug and name are required' });
      return;
    }
    const result = await query(
      'INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING *',
      [slug.toLowerCase().replace(/\s+/g, '-'), name]
    );
    const tenant = result.rows[0];

    await query(
      `INSERT INTO site_settings (tenant_id, key, value) VALUES ($1, 'site_name', $2), ($1, 'logo_url', NULL)`,
      [tenant.id, name]
    );

    res.status(201).json(tenant);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '23505') {
      res.status(400).json({ message: 'Slug already exists' });
      return;
    }
    console.error('CreateTenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [tenantResult, statsResult, adminResult] = await Promise.all([
      query('SELECT * FROM tenants WHERE id = $1', [id]),
      query(`
        SELECT
          COUNT(DISTINCT u.id) FILTER (WHERE u.role != 'super_admin')::int AS user_count,
          COUNT(DISTINCT c.id)::int AS course_count,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active' AND s.ends_at > NOW())::int AS active_subscriptions
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id
        LEFT JOIN courses c ON c.tenant_id = t.id
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        WHERE t.id = $1
      `, [id]),
      query(
        "SELECT id, email, name FROM users WHERE tenant_id = $1 AND role = 'admin' LIMIT 1",
        [id]
      ),
    ]);

    if (!tenantResult.rows[0]) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    res.json({
      ...tenantResult.rows[0],
      stats: statsResult.rows[0],
      admin: adminResult.rows[0] || null,
    });
  } catch (error) {
    console.error('GetTenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const assignAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const userResult = await query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email.toLowerCase(), id]
    );
    if (!userResult.rows[0]) {
      res.status(404).json({ message: 'User not found in this tenant' });
      return;
    }

    await query(
      "UPDATE users SET role = 'admin' WHERE id = $1",
      [userResult.rows[0].id]
    );

    res.json({ message: 'Admin assigned' });
  } catch (error) {
    console.error('AssignAdmin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPlatformSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`SELECT value FROM platform_settings WHERE key = 'platform_fee_percent'`);
    res.json({ platformFeePercent: Number(result.rows[0]?.value ?? '10') });
  } catch (error) {
    console.error('GetPlatformSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updatePlatformSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platformFeePercent } = req.body;
    if (typeof platformFeePercent !== 'number' || platformFeePercent < 0 || platformFeePercent > 100) {
      res.status(400).json({ message: 'platformFeePercent must be a number between 0 and 100' });
      return;
    }
    await query(
      `INSERT INTO platform_settings (key, value) VALUES ('platform_fee_percent', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(platformFeePercent)]
    );
    res.json({ platformFeePercent });
  } catch (error) {
    console.error('UpdatePlatformSettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
