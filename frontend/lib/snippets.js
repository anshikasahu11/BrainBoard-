// The languages a snippet can have. `value` matches the backend; `hljs` is the
// name the highlighter knows it by (HTML uses the "xml" grammar).
export const LANGUAGES = [
  { value: "javascript", label: "JavaScript", hljs: "javascript" },
  { value: "typescript", label: "TypeScript", hljs: "typescript" },
  { value: "python", label: "Python", hljs: "python" },
  { value: "java", label: "Java", hljs: "java" },
  { value: "cpp", label: "C++", hljs: "cpp" },
  { value: "sql", label: "SQL", hljs: "sql" },
  { value: "html", label: "HTML", hljs: "xml" },
  { value: "css", label: "CSS", hljs: "css" },
  { value: "json", label: "JSON", hljs: "json" },
  { value: "bash", label: "Bash", hljs: "bash" },
  { value: "plaintext", label: "Plain text", hljs: "plaintext" },
];

export const MAX_CODE_LENGTH = 50000;
export const MAX_TAGS = 8;

export const languageInfo = (value) =>
  LANGUAGES.find((language) => language.value === value) ?? LANGUAGES[LANGUAGES.length - 1];

// "Auth, jwt , AUTH" becomes ["auth", "jwt"]: trimmed, lowercased, no duplicates.
// (The server tidies tags the same way, so what you see is what gets saved.)
export function parseTags(text) {
  return [
    ...new Set(
      text
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

export function sameList(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

// Copies text to the clipboard. `source` is the text itself, or a promise for it.
// The promise form keeps the browser treating it as "the user clicked Copy" while
// the text is still being fetched, which Safari insists on.
export async function copyText(source) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    const blob = Promise.resolve(source).then((text) => new Blob([text], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return;
  }

  const text = await source;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Last resort for old browsers: a hidden text box and the old copy command.
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(box);
  if (!copied) throw new Error("Copy failed");
}