import mongoose from 'mongoose';
import multer from 'multer';
import { AppError } from '../utils/http.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ error: 'Please check the highlighted fields.', fields });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ error: `That ${field} is already in use.`, fields: { [field]: 'Already in use' } });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 5 MB or smaller.' : err.message });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.', ...(env.isProd ? {} : { detail: err.message }) });
}
