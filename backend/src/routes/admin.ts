import { Router } from 'express';
import { authenticate, requireAdmin, requireSameTenant } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimit';
import { resolveTenant } from '../middleware/tenant';
import { uploadImage, uploadVideo } from '../config/multer';
import {
  getStats, getAllCourses, createCourse, updateCourse, toggleCoursePublished, deleteCourse,
  getLessons, createLesson, updateLesson, deleteLesson,
  getAllUsers, updateUserRole, deleteUser,
} from '../controllers/adminController';
import {
  getMembershipSettings, updateMembershipSettings,
  getPaymentSettings, updatePaymentSettings,
} from '../controllers/settingsController';

const router = Router();
router.use(adminLimiter, resolveTenant, authenticate, requireAdmin, requireSameTenant);

router.get('/stats', getStats);
router.get('/courses', getAllCourses);
router.post('/courses', uploadImage.single('thumbnail'), createCourse);
router.put('/courses/:id', uploadImage.single('thumbnail'), updateCourse);
router.patch('/courses/:id/published', toggleCoursePublished);
router.delete('/courses/:id', deleteCourse);

router.get('/courses/:courseId/lessons', getLessons);
router.post('/lessons', uploadVideo.single('video'), createLesson);
router.put('/lessons/:id', uploadVideo.single('video'), updateLesson);
router.delete('/lessons/:id', deleteLesson);

router.get('/users', getAllUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

router.get('/membership-settings', getMembershipSettings);
router.put('/membership-settings', updateMembershipSettings);

router.get('/payment-settings', getPaymentSettings);
router.put('/payment-settings', updatePaymentSettings);

export default router;
