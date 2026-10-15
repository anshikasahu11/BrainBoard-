const OBJECT_ID = /^[a-f\d]{24}$/i;

// True if the value looks like a MongoDB id. Checking first means a bad id in
// a URL gets a clean 404 instead of a database error.
export function isObjectId(value) {
  return typeof value === "string" && OBJECT_ID.test(value);
}