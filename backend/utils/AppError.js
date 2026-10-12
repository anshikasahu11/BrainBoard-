// An error with an HTTP status code and an optional per-field errors object.
// Throw it anywhere. The central error handler turns it into a JSON response.
export default class AppError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}