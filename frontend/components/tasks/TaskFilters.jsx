import { Search, X } from "lucide-react";
import { PRIORITIES } from "@/lib/tasks";

export default function TaskFilters({
  query,
  onQuery,
  priority,
  onPriority,
  assignee,
  onAssignee,
  members,
  currentUserId,
  active,
  onClear,
}) {
  // "Assigned to me" already covers you, so you're left out of the people list.
  const others = members.filter((member) => member.id !== currentUserId);

  return (
    <div role="search" className="flex flex-1 flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <label htmlFor="task-search" className="sr-only">
          Search tasks
        </label>
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          id="task-search"
          type="text"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search tasks"
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
        <label htmlFor="task-priority" className="sr-only">
          Filter by priority
        </label>
        <select
          id="task-priority"
          value={priority}
          onChange={(event) => onPriority(event.target.value)}
          className="input input-sm"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="task-assignee" className="sr-only">
          Filter by assignee
        </label>
        <select
          id="task-assignee"
          value={assignee}
          onChange={(event) => onAssignee(event.target.value)}
          className="input input-sm"
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {others.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
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