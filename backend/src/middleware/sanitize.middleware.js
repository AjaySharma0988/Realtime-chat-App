/**
 * sanitize.middleware.js
 * Strips MongoDB operator keys ($-prefixed) from request inputs to
 * prevent NoSQL injection attacks.
 */

function stripDollarKeys(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripDollarKeys);

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$")) continue; // drop operator keys
    cleaned[key] = stripDollarKeys(obj[key]);
  }
  return cleaned;
}

export const sanitizeRequest = (req, res, next) => {
  if (req.body) req.body = stripDollarKeys(req.body);
  if (req.query) req.query = stripDollarKeys(req.query);
  if (req.params) req.params = stripDollarKeys(req.params);
  next();
};
