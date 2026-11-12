"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, SearchX, X } from "lucide-react";
import FormAlert from "@/components/auth/FormAlert";
import { NAV_ITEMS } from "@/components/app/navItems";
import SearchResultRow from "@/components/search/SearchResultRow";
import useDebounce from "@/hooks/useDebounce";
import useWorkspace from "@/hooks/useWorkspace";
import useWorkspaceSearch from "@/hooks/useWorkspaceSearch";
import {
  MIN_QUERY_LENGTH,
  flattenResults,
  groupedOptions,
  moveIndex,
  optionKey,
} from "@/lib/searchResults";

// The search window. Mount it only while it should be open: it takes focus, keeps Tab inside,
// locks page scroll, and gives focus back when it closes.
//
// It's a combobox: the cursor stays in the box while the up and down keys move a highlight
// through the list, and Enter opens the highlighted entry.
export default function SearchDialog({ onClose }) {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const uid = useId();
  const listboxId = `${uid}-results`;
  const optionId = (index) => `${uid}-option-${index}`;

  const inputRef = useRef(null);
  const closeRef = useRef(null);
  const navigatedRef = useRef(false); // we left for another page, so focus shouldn't go back

  const [input, setInput] = useState("");
  const [highlight, setHighlight] = useState({ key: "", index: 0 });

  // What was typed, with extra spaces squashed. Searching starts a moment after you stop typing.
  const typed = input.replace(/\s+/g, " ").trim();
  const debounced = useDebounce(typed, 200);
  const searching = typed.length >= MIN_QUERY_LENGTH;
  const search = useWorkspaceSearch(workspace.id, debounced, debounced.length >= MIN_QUERY_LENGTH);

  // The answer on screen. While a newer search loads it can belong to the previous one,
  // which is fine: it stays (faded) so the list doesn't blank out.
  const data = searching && search.status !== "error" ? search.data : null;
  const refreshing = searching && search.status === "loading" && Boolean(data);
  const failed = searching && search.status === "error";

  // Before you type, the window is a quick-jump menu.
  const pageOptions = useMemo(
    () =>
      NAV_ITEMS.filter((item) => !item.soon).map((item) => ({
        type: "page",
        group: "pages",
        item: { id: item.key, title: item.label, icon: item.icon },
        href: `/workspaces/${workspace.id}${item.path ?? ""}`,
      })),
    [workspace.id]
  );

  const options = useMemo(() => {
    if (!searching) return pageOptions;
    return data ? flattenResults(data.results, workspace.id) : [];
  }, [searching, pageOptions, data, workspace.id]);

  // The highlight goes back to the first entry whenever the list changes.
  const listKey = options.map(optionKey).join(",");
  const activeIndex = highlight.key === listKey ? highlight.index : options.length > 0 ? 0 : -1;
  const setActive = (index) => setHighlight({ key: listKey, index });

  useEffect(() => {
    if (activeIndex >= 0) {
      document.getElementById(`${uid}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, listKey, uid]);

  // Take focus on open, lock page scroll, and put everything back on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (!navigatedRef.current) previouslyFocused?.focus?.();
    };
  }, []);

  function choose(option) {
    navigatedRef.current = true;
    onClose();
    router.push(option.href);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    // Keep Tab inside the window: it only has the box and the close button.
    if (event.key === "Tab") {
      event.preventDefault();
      (document.activeElement === inputRef.current ? closeRef : inputRef).current?.focus();
      return;
    }

    if (event.target !== inputRef.current) return;
    // Someone typing with an input method (Japanese, Chinese, Korean) presses Enter to confirm characters.
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(moveIndex(activeIndex, event.key === "ArrowDown" ? 1 : -1, options.length));
    } else if (event.key === "Enter") {
      const option = options[activeIndex];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    }
  }

  // ----- What to draw -----

  const query = data?.query ?? "";
  const groups = searching
    ? groupedOptions(options, data?.results)
    : [{ key: "pages", label: "Go to", hasMore: false, entries: options.map((option, index) => ({ option, index })) }];

  const waiting = searching && !failed && !data; // first answer on its way
  const noResults = searching && !failed && Boolean(data) && !refreshing && options.length === 0;
  const hasList = options.length > 0 && !failed;

  // Read out politely when the answer changes.
  let announcement = "";
  if (searching && !failed && data && !refreshing) {
    announcement =
      options.length === 0
        ? `No results for ${data.query}`
        : `${options.length} ${options.length === 1 ? "result" : "results"}`;
  } else if (failed) {
    announcement = "Search failed";
  }

  return (
    <div
      className="search-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div role="dialog" aria-modal="true" aria-label="Search" className="search-panel glass rounded-panel">
        <div className="search-head">
          <Search size={18} strokeWidth={1.5} className="shrink-0 text-fg-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search this workspace"
            aria-expanded={hasList}
            aria-controls={hasList ? listboxId : undefined}
            aria-activedescendant={hasList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={100}
            placeholder="Search documents, tasks, snippets and people"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="search-input"
          />
          {refreshing && (
            <Loader2 size={16} strokeWidth={1.75} className="shrink-0 animate-spin text-fg-muted" aria-hidden="true" />
          )}
          <kbd className="kbd hidden shrink-0 sm:inline-flex" aria-hidden="true">
            Esc
          </kbd>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="grid size-9 shrink-0 place-items-center rounded-control text-fg-2 transition-colors hover:bg-white/10 hover:text-fg"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <div className="search-results" aria-busy={waiting || refreshing}>
          {!searching && typed.length > 0 && (
            <p className="px-3 pb-1 pt-2 text-[12px] text-fg-muted">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          )}

          {waiting && (
            <div className="space-y-2 p-2" role="status">
              <div className="skeleton h-11 rounded-control" />
              <div className="skeleton h-11 rounded-control" />
              <div className="skeleton h-11 rounded-control" />
              <span className="sr-only">Searching</span>
            </div>
          )}

          {/* A failed search is never shown as "no results". */}
          {failed && (
            <div className="space-y-3 p-3">
              <FormAlert message={search.error} />
              <button
                type="button"
                onClick={search.retry}
                className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
              >
                Try again
              </button>
            </div>
          )}

          {noResults && (
            <div className="px-3 py-6 text-center">
              <SearchX size={22} strokeWidth={1.5} className="mx-auto text-fg-muted" aria-hidden="true" />
              <p className="mt-3 text-[14px]">No results for “{data.query}”</p>
              <p className="mt-1 text-[12.5px] text-fg-muted">
                Try fewer or different words. Search looks at titles, text, code, tags and people.
              </p>
            </div>
          )}

          {hasList && (
            <ul
              role="listbox"
              id={listboxId}
              aria-label={searching ? "Search results" : "Go to"}
              className={`transition-opacity duration-150 ${refreshing ? "opacity-60" : ""}`}
            >
              {groups.map((group) => {
                const headingId = `${uid}-group-${group.key}`;

                return (
                  <li key={group.key} role="presentation">
                    <p id={headingId} className="search-group-title">
                      {group.label}
                    </p>
                    <ul role="group" aria-labelledby={headingId}>
                      {group.entries.map(({ option, index }) => (
                        <SearchResultRow
                          key={optionKey(option)}
                          option={option}
                          id={optionId(index)}
                          active={index === activeIndex}
                          query={query}
                          onChoose={choose}
                          onHover={() => index !== activeIndex && setActive(index)}
                        />
                      ))}
                    </ul>
                    {group.hasMore && (
                      <p className="px-3 pb-1 pt-1 text-[12px] text-fg-muted">
                        There are more matches. Be more specific to narrow them down.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="search-foot" aria-hidden="true">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="kbd">Enter</kbd> to open
          </span>
          <span>
            <kbd className="kbd">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}