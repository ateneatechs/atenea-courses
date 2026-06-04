import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { resolveTenant, optionalResolveTenant } from '../middleware/tenant';

const router = Router();

router.post('/register', resolveTenant, register);
router.post('/login', optionalResolveTenant, login);
router.get('/me', authenticate, getMe);

export default router;
