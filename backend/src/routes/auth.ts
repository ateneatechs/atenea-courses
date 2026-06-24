import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { resolveTenant, optionalResolveTenant } from '../middleware/tenant';
import { authLimiter, registerLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', registerLimiter, resolveTenant, register);
router.post('/login', authLimiter, optionalResolveTenant, login);
router.get('/me', authenticate, getMe);

export default router;
