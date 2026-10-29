export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new AppError(400, msg, details);
export const unauthorized = (msg = 'Please sign in to continue') => new AppError(401, msg);
export const forbidden = (msg = 'You do not have permission to do that') => new AppError(403, msg);
export const notFound = (msg = 'Not found') => new AppError(404, msg);
export const conflict = (msg, details) => new AppError(409, msg, details);

// Wraps async route handlers so rejected promises reach the error middleware
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
