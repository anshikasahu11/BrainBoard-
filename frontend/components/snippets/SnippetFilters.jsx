import { Search, X } from "lucide-react";
import { LANGUAGES } from "@/lib/snippets";

// tags: [{ name, count }] from the server.
export default function SnippetFilters({
  query,
  onQuery,
  language,
  onLanguage,
  tag,
  onTag,
  tags,
  active,
  onClear,
}) {
  // Keep the chosen tag in the menu even if no snippet uses it any more.
  const options = !tag || tags.some((item) => item.name === tag) ? tags : [{ name: tag, count: 0 }, ...tags];

  return (
    <div role="search" className="flex flex-1 flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <label htmlFor="snippet-search" className="sr-only">
          Search snippets
        </label>
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          id="snippet-search"
          type="text"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search titles, code and tags"
          autoComplete="off"
          className="input input-search"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-control text-fg-muted transition-colors hover:text-fg"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div>
        <label htmlFor="snippet-language" className="sr-only">
          Filter by language
        </label>
        <select
          id="snippet-language"
          value={language}
          onChange={(event) => onLanguage(event.target.value)}
          className="input input-sm"
        >
          <option value="">All languages</option>
          {LANGUAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="snippet-tag" className="sr-only">
          Filter by tag
        </label>
        <select
          id="snippet-tag"
          value={tag}
          onChange={(event) => onTag(event.target.value)}
          className="input input-sm"
        >
          <option value="">All tags</option>
          {options.map((item) => (
            <option key={item.name} value={item.name}>
              {item.count > 0 ? `${item.name} (${item.count})` : item.name}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] text-fg-2 underline underline-offset-4 transition-colors hover:text-ember-300"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}