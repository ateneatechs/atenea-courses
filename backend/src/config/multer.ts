import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const makeStorage = (subdir: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'uploads', subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + path.extname(file.originalname));
    },
  });

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'));
};

const videoFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Only videos allowed'));
};

export const uploadImage = multer({
  storage: makeStorage('images'),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadVideo = multer({
  storage: makeStorage('videos'),
  fileFilter: videoFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

export const uploadLogo = multer({
  storage: makeStorage('logos'),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
