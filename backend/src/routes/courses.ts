import { Router } from 'express';
import {
  getCourses, getCourseById, getCategories, getInstructors,
  createSubscription, purchaseCourse,
  getLessonById, updateLessonProgress,
} from '../controllers/courseController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/:id', optionalAuth, getCourseById);
router.post('/subscribe', authenticate, createSubscription);
router.post('/purchase', authenticate, purchaseCourse);
router.get('/lessons/:id', authenticate, getLessonById);
router.put('/lessons/:id/progress', authenticate, updateLessonProgress);

export default router;
