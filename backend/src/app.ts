import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import adminRoutes from './routes/admin';
import settingsRoutes from './routes/settings';
import superAdminRoutes from './routes/superAdmin';
import paymentRoutes from './routes/payments';
import { authLimiter, registerLimiter, webhookLimiter } from './middleware/rateLimit';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/payments/webhook', webhookLimiter);

app.use('/api/auth',        authRoutes);
app.use('/api/courses',     courseRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/settings',    settingsRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/payments',    paymentRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

export default app;
