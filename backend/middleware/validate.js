import AppError from "../utils/AppError.js";

// Usage: router.post("/path", validate(someSchema), handler)
// On success, req.body is replaced with the cleaned data (trimmed, lowercased...).
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Build { fieldName: "first message for that field" }
      const errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] ?? "form";
        if (!errors[field]) errors[field] = issue.message;
      }
      throw new AppError(400, "Please correct the highlighted fields", errors);
    }

    req.body = result.data;
    next();
  };
}