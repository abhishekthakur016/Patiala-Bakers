import { ZodError } from 'zod';
import { badRequest } from '../utils/http.js';

// validate({ body, query, params }) — replaces each part with the parsed (coerced, stripped) value
export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const part of ['body', 'query', 'params']) {
      if (schemas[part]) {
        const parsed = schemas[part].parse(req[part] ?? {});
        if (part === 'query') Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
        else req[part] = parsed;
      }
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const fields = {};
      for (const issue of err.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      return next(badRequest('Please check the highlighted fields.', { fields }));
    }
    next(err);
  }
};
