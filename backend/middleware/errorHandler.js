import AppError from "../utils/AppError.js";

// Runs when no route matched.
export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler. Never leaks internal details for unexpected errors.
export function errorHandler(err, req, res, next) {
  // Translate a few well-known errors into friendly ones.
  if (err.code === 11000) {
    err = new AppError(409, "That value is already in use");
  } else if (err.type === "entity.parse.failed") {
    err = new AppError(400, "Request body is not valid JSON");
  } else if (err.type === "entity.too.large") {
    err = new AppError(413, "That is too large to save");
  } else if (err.name === "ValidationError") {
    err = new AppError(400, "Invalid data");
  }

  const status = err.statusCode || 500;
  if (status === 500) console.error(err);

  res.status(status).json({
    message: status === 500 ? "Internal server error" : err.message,
    ...(err.errors && { errors: err.errors }),
  });
}