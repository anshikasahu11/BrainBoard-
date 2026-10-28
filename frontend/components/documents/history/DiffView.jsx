// Shows the result of a comparison: added lines, removed lines, and a few lines of
// unchanged context. Every changed line has a + or − marker and a hidden label for
// screen readers, so colour is never the only signal.
//   entries: from collapseEntries(...) (or the full list), each { type, text, parts } or { type: "gap", count }

function renderText(entry) {
  if (!entry.parts) return entry.text || "\u00A0";

  // Words that changed inside the line: added words are underlined, removed words struck through.
  return entry.parts.map((part, index) => {
    if (part.type === "add") {
      return (
        <ins key={index} className="diff-ins">
          {part.text}
        </ins>
      );
    }
    if (part.type === "remove") {
      return (
        <del key={index} className="diff-del">
          {part.text}
        </del>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}

export default function DiffView({ entries, label }) {
  if (entries.length === 0) return null;

  return (
    <div role="region" tabIndex={0} aria-label={label} className="diff-box">
      {entries.map((entry, index) => {
        if (entry.type === "gap") {
          return (
            <div key={index} className="diff-gap">
              … {entry.count} unchanged {entry.count === 1 ? "line" : "lines"}
            </div>
          );
        }

        return (
          <div key={index} className={`diff-line diff-line-${entry.type}`}>
            <span className="diff-marker" aria-hidden="true">
              {entry.type === "add" ? "+" : entry.type === "remove" ? "−" : ""}
            </span>
            {entry.type !== "equal" && (
              <span className="sr-only">{entry.type === "add" ? "Added: " : "Removed: "}</span>
            )}
            <span className="diff-text">{renderText(entry)}</span>
          </div>
        );
      })}
    </div>
  );
}