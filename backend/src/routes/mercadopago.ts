import { Router } from 'express';
import { authenticate, requireAdmin, requireSameTenant } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import {
  connectMercadoPago,
  getMercadoPagoStatus,
  disconnectMercadoPago,
  mercadopagoCallback,
  handleWebhook,
} from '../controllers/mercadopagoController';

const router = Router();

router.get(
  '/admin/mercadopago/connect',
  resolveTenant, authenticate, requireAdmin, requireSameTenant,
  connectMercadoPago
);
router.get(
  '/admin/mercadopago/status',
  resolveTenant, authenticate, requireAdmin, requireSameTenant,
  getMercadoPagoStatus
);
router.delete(
  '/admin/mercadopago/disconnect',
  resolveTenant, authenticate, requireAdmin, requireSameTenant,
  disconnectMercadoPago
);

// Public — no tenant header available on these requests
router.get('/mercadopago/callback', mercadopagoCallback);
router.post('/payments/webhook', handleWebhook);

export default router;
