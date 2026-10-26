// "Rahul is editing", "Rahul and Priya are editing", "3 people are editing".
//   people: [{ id, name }]
//   also:   adds the word "also" (used inside the editor: "Rahul is also editing")
// Shows nothing when nobody is editing. The words carry the meaning, not the dot.
export default function EditingNow({ people, also = false }) {
  if (!people || people.length === 0) return null;

  const extra = also ? "also " : "";
  let text;
  if (people.length === 1) text = `${people[0].name} is ${extra}editing`;
  else if (people.length === 2) text = `${people[0].name} and ${people[1].name} are ${extra}editing`;
  else text = `${people.length} people are ${extra}editing`;

  return (
    <span className="editing-pill">
      <span className="editing-dot" aria-hidden="true" />
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}