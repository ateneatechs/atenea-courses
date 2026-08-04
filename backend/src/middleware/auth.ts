import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { JWT_SECRET } from '../config/jwt';
import { query } from '../config/database';

// Always trust the DB's current role/tenant, not the JWT's cached claims — closes
// the window where a demoted/deleted user keeps old permissions until the 7-day
// token naturally expires. Also enforces token_version for real logout support.
const resolveUserFromToken = async (token: string): Promise<JwtPayload | null> => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const result = await query(
      'SELECT role, tenant_id, token_version FROM users WHERE id = $1',
      [decoded.userId]
    );
    const dbUser = result.rows[0];
    if (!dbUser || dbUser.token_version !== decoded.tokenVersion) return null;
    return { ...decoded, role: dbUser.role, tenantId: dbUser.tenant_id };
  } catch {
    return null;
  }
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const user = await resolveUserFromToken(token);
    if (!user) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Same as `authenticate`, but also accepts the JWT via `?token=` — needed for
// <video>/<img>-style requests, which can't attach a custom Authorization header.
// Only wire this to routes that genuinely need it (the lesson stream endpoint);
// everything else should keep using `authenticate`.
export const authenticateStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const token = headerToken || queryToken;

  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }
  const user = await resolveUserFromToken(token);
  if (!user) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }
  req.user = user;
  next();
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const result = await query(
        'SELECT role, tenant_id, token_version FROM users WHERE id = $1',
        [decoded.userId]
      );
      const dbUser = result.rows[0];
      if (dbUser && dbUser.token_version === decoded.tokenVersion) {
        req.user = { ...decoded, role: dbUser.role, tenantId: dbUser.tenant_id };
      }
    }
  } catch {
    // ignore for optional routes
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ message: 'Super-admin access required' });
    return;
  }
  next();
};

// Ensures the authenticated user's own tenant matches the tenant resolved from
// X-Tenant-Slug. Without this, a valid JWT from tenant A could be replayed
// against tenant B's subdomain to access/modify tenant B's data.
// super_admin (tenantId = null) is exempt — they manage all tenants.
export const requireSameTenant = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role === 'super_admin') {
    next();
    return;
  }
  if (!req.user || req.user.tenantId !== req.tenantId) {
    res.status(403).json({ message: 'Forbidden for this tenant' });
    return;
  }
  next();
};
