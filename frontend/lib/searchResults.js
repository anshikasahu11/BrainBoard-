// Pure helpers for the search window: highlighting matches, turning grouped results into
// one list the keyboard can walk through, links, and the keyboard shortcut.
// Plain JavaScript with no app imports, so it can be tested on its own.

export const MIN_QUERY_LENGTH = 2;

// The groups, in the order they're shown.
export const GROUPS = [
  { key: "documents", type: "document", label: "Documents" },
  { key: "tasks", type: "task", label: "Tasks" },
  { key: "snippets", type: "snippet", label: "Snippets" },
  { key: "members", type: "member", label: "People" },
];

// Where a result leads. Documents have their own page. The others open the page they live on.
export function resultHref(type, item, workspaceId) {
  const base = `/workspaces/${workspaceId}`;

  switch (type) {
    case "document":
      return `${base}/documents/${encodeURIComponent(item.id)}`;
    case "task":
      return `${base}/tasks`;
    case "snippet":
      return `${base}/snippets`;
    case "member":
      return `${base}/members`;
    default:
      return base;
  }
}

// The server's grouped answer as ONE list, in display order. Each entry is
// { type, group, item, href }. Groups with nothing in them leave no trace.
export function flattenResults(results, workspaceId) {
  const options = [];

  for (const group of GROUPS) {
    for (const item of results?.[group.key]?.items ?? []) {
      options.push({
        type: group.type,
        group: group.key,
        item,
        href: resultHref(group.type, item, workspaceId),
      });
    }
  }
  return options;
}

// The same list, split back into groups for drawing. `index` is the position in the flat list,
// which is what the keyboard moves through. Empty groups are left out.
export function groupedOptions(options, results) {
  return GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    hasMore: Boolean(results?.[group.key]?.hasMore),
    entries: options
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => option.group === group.key),
  })).filter((group) => group.entries.length > 0);
}

// A stable name for an entry, used to notice when the list changed.
export const optionKey = (option) => `${option.type}:${option.item.id ?? option.item.title}`;

// Moves the highlight up or down, wrapping at the ends. -1 means "nothing highlighted".
export function moveIndex(index, delta, count) {
  if (count <= 0) return -1;
  if (index < 0) return delta > 0 ? 0 : count - 1;
  return (index + delta + count) % count;
}

// Cuts text into pieces, marking the parts that match the search (ignoring case).
// Always: joining the pieces gives back exactly the original text.
// [{ text: "Launch ", match: false }, { text: "road", match: true }, { text: "map", match: false }]
export function highlightParts(text, query) {
  const source = String(text ?? "");
  const needle = String(query ?? "").trim();

  if (!source) return [];
  if (!needle) return [{ text: source, match: false }];

  let hay = source.toLowerCase();
  let target = needle.toLowerCase();

  // A few characters change length when lowercased, which would put every position out.
  // For those texts, match exact case instead of risking a wrong highlight.
  if (hay.length !== source.length || target.length !== needle.length) {
    hay = source;
    target = needle;
  }

  const parts = [];
  let from = 0;

  while (from < source.length) {
    const at = hay.indexOf(target, from);
    if (at === -1) break;

    if (at > from) parts.push({ text: source.slice(from, at), match: false });
    parts.push({ text: source.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }

  if (from < source.length) parts.push({ text: source.slice(from), match: false });
  return parts;
}

// Ctrl + K, or Cmd + K on a Mac. Not with Shift or Alt.
export function isSearchShortcut(event) {
  return (
    Boolean(event) &&
    Boolean(event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    String(event.key ?? "").toLowerCase() === "k"
  );
}