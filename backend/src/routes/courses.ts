import { Router } from 'express';
import {
  getCourses, getCourseById, getCategories, getInstructors,
  getLessonById, updateLessonProgress, getMyCourses, getCourseCertificate, streamLessonVideo,
} from '../controllers/courseController';
import { authenticate, authenticateStream, optionalAuth, requireSameTenant } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();
router.use(resolveTenant);

router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/instructors', getInstructors);
router.get('/my-courses', authenticate, requireSameTenant, getMyCourses);
router.get('/:id/certificate', authenticate, requireSameTenant, getCourseCertificate);
router.get('/:id', optionalAuth, getCourseById);
router.get('/lessons/:id', authenticate, requireSameTenant, getLessonById);
router.put('/lessons/:id/progress', authenticate, requireSameTenant, updateLessonProgress);
router.get('/lessons/:id/stream', authenticateStream, requireSameTenant, streamLessonVideo);

export default router;
