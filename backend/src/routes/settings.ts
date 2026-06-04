import { Router } from 'express';
import { resolveTenant } from '../middleware/tenant';
import { getPublicSettings, uploadLogo } from '../controllers/settingsController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { uploadLogo as multerLogo } from '../config/multer';

const router = Router();

router.get('/public', resolveTenant, getPublicSettings);
router.post('/logo', resolveTenant, authenticate, requireAdmin, multerLogo.single('logo'), uploadLogo);

export default router;
