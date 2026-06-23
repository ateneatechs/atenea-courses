import { Router } from 'express';
import {
  createCourseCheckout,
  createSubscriptionCheckout,
  webhook,
  verifyPayment,
} from '../controllers/paymentController';
import { authenticate, requireSameTenant } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

// Webhook is called by Mercado Pago's servers: no auth, tenant resolved from ?tenant= query.
router.post('/webhook', webhook);

// Everything below is tenant- and auth-scoped.
router.post('/course', resolveTenant, authenticate, requireSameTenant, createCourseCheckout);
router.post('/subscription', resolveTenant, authenticate, requireSameTenant, createSubscriptionCheckout);
router.get('/verify', resolveTenant, authenticate, requireSameTenant, verifyPayment);

export default router;
