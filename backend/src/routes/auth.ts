import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { resolveTenant, optionalResolveTenant } from '../middleware/tenant';
import { authLimiter, registerLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', registerLimiter, resolveTenant, register);
router.post('/login', authLimiter, optionalResolveTenant, login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
