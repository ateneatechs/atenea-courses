import { Router } from 'express';
import {
  getCourses, getCourseById, getCategories, getInstructors,
  createSubscription, purchaseCourse, createCheckout,
  getLessonById, updateLessonProgress,
} from '../controllers/courseController';
import { authenticate, optionalAuth, requireSameTenant } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();
router.use(resolveTenant);

router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/instructors', getInstructors);
router.get('/:id', optionalAuth, getCourseById);
router.post('/subscribe', authenticate, requireSameTenant, createSubscription);
router.post('/purchase', authenticate, requireSameTenant, purchaseCourse);
router.post('/:id/checkout', authenticate, requireSameTenant, createCheckout);
router.get('/lessons/:id', authenticate, requireSameTenant, getLessonById);
router.put('/lessons/:id/progress', authenticate, requireSameTenant, updateLessonProgress);

export default router;
