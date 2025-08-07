// Centralized error handler utility for controllers and services
export function sendError(res, code = 500, msg = "Something went wrong while processing the request") {
  return res.status(code).json({ status: false, msg });
}

// Optional: input validation helper
export function requireFields(obj, fields = []) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      return field;
    }
  }
  return null;
}
