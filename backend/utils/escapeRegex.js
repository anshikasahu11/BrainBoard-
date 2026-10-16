// Turns user text into a safe regular-expression fragment, so characters like
// . * ( [ are matched literally instead of being treated as pattern syntax.
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}