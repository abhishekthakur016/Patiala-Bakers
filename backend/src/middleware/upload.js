import multer from 'multer';
import { badRequest } from '../utils/http.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Only JPG, PNG, WebP or GIF images can be uploaded.'));
  },
});
