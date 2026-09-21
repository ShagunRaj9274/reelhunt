import { badRequest } from '../lib/errors.js';

/**
 * Validates req[source] against a zod schema and stores the parsed (typed,
 * defaulted) result on req.valid[source]. Invalid input => 400 with details.
 */
export const validate = (schema, source = 'query') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(badRequest('Invalid request parameters', details));
  }
  req.valid = { ...(req.valid ?? {}), [source]: result.data };
  next();
};
