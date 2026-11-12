import { highlightParts } from "@/lib/searchResults";

// Text with the parts that match the search marked. The text is cut into pieces and drawn
// by React, so nothing is ever put into the page as HTML. The mark is bold and has a
// background, so it doesn't depend on colour alone.
export default function Highlighted({ text, query }) {
  return highlightParts(text, query).map((part, index) =>
    part.match ? (
      <mark key={index} className="search-mark">
        {part.text}
      </mark>
    ) : (
      <span key={index}>{part.text}</span>
    )
  );
}