import rateLimit from 'express-rate-limit';

const make = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

export const authLimiter = make(10 * 60 * 1000, 10, 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.');
export const registerLimiter = make(60 * 60 * 1000, 5, 'Demasiados intentos de registro. Intenta de nuevo más tarde.');
export const webhookLimiter = make(60 * 1000, 30, 'Too many requests.');
