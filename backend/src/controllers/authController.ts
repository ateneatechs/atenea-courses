import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { JwtPayload } from '../types';

const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, process.env.JWT_SECRET || 'fallback', { expiresIn: '7d' });

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ message: 'All fields are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }
    if (!req.tenantId) {
      res.status(400).json({ message: 'Tenant required for registration' });
      return;
    }

    const existing = await query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email.toLowerCase(), req.tenantId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, name, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email.toLowerCase(), passwordHash, name, req.tenantId]
    );

    const user = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    let result;
    if (req.tenantId) {
      // Tenant-scoped login; super_admin can log in from any tenant URL
      result = await query(
        "SELECT id, email, name, role, password_hash FROM users WHERE email = $1 AND (tenant_id = $2 OR (role = 'super_admin' AND tenant_id IS NULL))",
        [email.toLowerCase(), req.tenantId]
      );
    } else {
      result = await query(
        "SELECT id, email, name, role, password_hash FROM users WHERE email = $1 AND role = 'super_admin' AND tenant_id IS NULL",
        [email.toLowerCase()]
      );
    }

    if (result.rows.length === 0) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const subResult = await query(
      `SELECT id, plan, status, ends_at FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND ends_at > NOW()
       ORDER BY ends_at DESC LIMIT 1`,
      [req.user!.userId]
    );

    res.json({ ...result.rows[0], subscription: subResult.rows[0] || null });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
