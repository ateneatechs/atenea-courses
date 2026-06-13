import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback') as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback') as JwtPayload;
      req.user = decoded;
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
