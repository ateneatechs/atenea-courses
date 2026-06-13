import { Router } from 'express';
import { authenticate, requireAdmin, requireSameTenant } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { uploadImage, uploadVideo } from '../config/multer';
import {
  getStats, getAllCourses, createCourse, updateCourse, deleteCourse,
  getLessons, createLesson, updateLesson, deleteLesson,
  getAllUsers, updateUserRole, deleteUser,
} from '../controllers/adminController';

const router = Router();
router.use(resolveTenant, authenticate, requireAdmin, requireSameTenant);

router.get('/stats', getStats);
router.get('/courses', getAllCourses);
router.post('/courses', uploadImage.single('thumbnail'), createCourse);
router.put('/courses/:id', uploadImage.single('thumbnail'), updateCourse);
router.delete('/courses/:id', deleteCourse);

router.get('/courses/:courseId/lessons', getLessons);
router.post('/lessons', uploadVideo.single('video'), createLesson);
router.put('/lessons/:id', uploadVideo.single('video'), updateLesson);
router.delete('/lessons/:id', deleteLesson);

router.get('/users', getAllUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

export default router;
