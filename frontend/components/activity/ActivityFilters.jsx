const CATEGORIES = [
  { value: "", label: "All" },
  { value: "documents", label: "Documents" },
  { value: "tasks", label: "Tasks" },
  { value: "snippets", label: "Snippets" },
  { value: "team", label: "Team" },
];

// members: the workspace's people. currentUserId: you ("Only me" already covers you).
export default function ActivityFilters({
  category,
  onCategory,
  actor,
  onActor,
  members,
  currentUserId,
  active,
  onClear,
}) {
  const others = members.filter((member) => member.id !== currentUserId);

  // A person who has since left still has entries, so keep their choice in the menu.
  const known = actor === "" || actor === "me" || members.some((member) => member.id === actor);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="seg" role="group" aria-label="Kind of activity">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={category === item.value}
            onClick={() => onCategory(item.value)}
            className={`seg-btn ${category === item.value ? "seg-btn-active" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="activity-person" className="sr-only">
          Filter by person
        </label>
        <select
          id="activity-person"
          value={actor}
          onChange={(event) => onActor(event.target.value)}
          className="input input-sm"
        >
          <option value="">Everyone</option>
          <option value="me">Only me</option>
          {others.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
          {!known && <option value={actor}>Someone who left</option>}
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