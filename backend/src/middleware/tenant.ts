import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export const resolveTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const slug = req.headers['x-tenant-slug'] as string | undefined;
  if (!slug) {
    res.status(400).json({ message: 'X-Tenant-Slug header required' });
    return;
  }
  try {
    const result = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (!result.rows[0]) {
      res.status(404).json({ message: `Tenant '${slug}' not found` });
      return;
    }
    req.tenantId = result.rows[0].id;
    next();
  } catch (error) {
    console.error('resolveTenant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const optionalResolveTenant = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const slug = req.headers['x-tenant-slug'] as string | undefined;
  if (!slug) { next(); return; }
  try {
    const result = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (result.rows[0]) req.tenantId = result.rows[0].id;
  } catch {
    // non-fatal for optional tenant resolution
  }
  next();
};
