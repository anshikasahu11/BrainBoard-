"use client";

import { Code, CornerDownLeft, FileText, Kanban, Users } from "lucide-react";
import Highlighted from "@/components/search/Highlighted";
import { formatRelative } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { languageInfo } from "@/lib/snippets";
import { statusInfo } from "@/lib/tasks";

const ICONS = { document: FileText, task: Kanban, snippet: Code, member: Users };

// Where a match was found, when it wasn't the title. (A title match needs no explanation.)
const MATCHED_IN = {
  text: "text",
  description: "description",
  tags: "tags",
  code: "code",
  email: "email",
};

const capitalize = (value) => (value ? value[0].toUpperCase() + value.slice(1) : "");

// The small grey line under a result.
function detailLine(option) {
  const { type, item } = option;

  if (type === "document") return `Edited ${formatRelative(item.updatedAt)}`;
  if (type === "task") return `${statusInfo(item.status).label} · ${capitalize(item.priority)} priority`;
  if (type === "snippet") return [languageInfo(item.language).label, ...(item.tags ?? []).slice(0, 3)].join(" · ");
  if (type === "member") return `${item.email} · ${ROLE_LABELS[item.role] ?? capitalize(item.role)}`;
  return "";
}

// One entry in the list: a search result, a page in the "Go to" list, or a recent search.
// It's an option in a listbox: focus stays in the search box, and the highlighted option
// is announced from there.
//   query: the search these results belong to, for highlighting
export default function SearchResultRow({ option, id, active, query, onChoose, onHover }) {
  const { type, item } = option;

  // Pages and recent searches bring their own icon.
  const Icon = item.icon ?? ICONS[type];

  const matchedLabel = MATCHED_IN[item.matchedIn];
  const detail = [detailLine(option), matchedLabel ? `matched in ${matchedLabel}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      role="option"
      id={id}
      aria-selected={active}
      onClick={() => onChoose(option)}
      onMouseMove={onHover}
      className={`search-option ${active ? "search-option-active" : ""}`}
    >
      <span className="search-option-icon">
        <Icon size={15} strokeWidth={1.5} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-fg">
          <Highlighted text={item.title} query={query} />
        </span>

        {item.excerpt && (
          <span
            className={`mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-fg-2 ${
              item.matchedIn === "code" ? "font-mono" : ""
            }`}
          >
            <Highlighted text={item.excerpt} query={query} />
          </span>
        )}

        {detail && (
          <span className="mt-1 block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
            {detail}
          </span>
        )}
      </span>

      {active && (
        <CornerDownLeft size={14} strokeWidth={1.5} className="mt-2 shrink-0 text-fg-muted" aria-hidden="true" />
      )}
    </li>
  );
}