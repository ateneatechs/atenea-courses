import { Router } from 'express';
import {
  getCourses, getCourseById, getCategories, getInstructors,
  createSubscription, purchaseCourse,
  getLessonById, updateLessonProgress,
} from '../controllers/courseController';
import { authenticate, optionalAuth } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();
router.use(resolveTenant);

router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/instructors', getInstructors);
router.get('/:id', optionalAuth, getCourseById);
router.post('/subscribe', authenticate, createSubscription);
router.post('/purchase', authenticate, purchaseCourse);
router.get('/lessons/:id', authenticate, getLessonById);
router.put('/lessons/:id/progress', authenticate, updateLessonProgress);

export default router;
