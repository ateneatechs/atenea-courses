import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import { listTenants, createTenant, getTenant, assignAdmin } from '../controllers/superAdminController';

const router = Router();
router.use(authenticate, requireSuperAdmin);

router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:id', getTenant);
router.post('/tenants/:id/admin', assignAdmin);

export default router;
