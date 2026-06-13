import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { listTenants, createTenant, getTenant, assignAdmin, getPlatformSettings, updatePlatformSettings } from '../controllers/superAdminController';

const router = Router();
router.use(authenticate, requireSuperAdmin);

router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:id', getTenant);
router.post('/tenants/:id/admin', assignAdmin);
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);

export default router;
