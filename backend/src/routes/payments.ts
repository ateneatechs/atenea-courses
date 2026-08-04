import { Router } from 'express';
import {
  createCourseCheckout,
  createSubscriptionCheckout,
  webhook,
  verifyPayment,
} from '../controllers/paymentController';
import { authenticate, requireSameTenant } from '../middleware/auth';
import { paymentsLimiter } from '../middleware/rateLimit';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

// Webhook is called by Mercado Pago's servers: no auth, tenant resolved from ?tenant= query.
// (already covered by webhookLimiter, applied in app.ts)
router.post('/webhook', webhook);

// Everything below is tenant- and auth-scoped.
router.post('/course', paymentsLimiter, resolveTenant, authenticate, requireSameTenant, createCourseCheckout);
router.post('/subscription', paymentsLimiter, resolveTenant, authenticate, requireSameTenant, createSubscriptionCheckout);
router.get('/verify', paymentsLimiter, resolveTenant, authenticate, requireSameTenant, verifyPayment);

export default router;
