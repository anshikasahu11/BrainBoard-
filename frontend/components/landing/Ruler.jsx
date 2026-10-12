// Decorative measurement line under the hero.
export default function Ruler() {
  const marks = ["00 Docs", "01 Tasks", "02 Code", "03 AI"];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16" aria-hidden="true">
      <div className="ruler" />
      <div className="text-glow mt-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
        {marks.map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>
    </div>
  );
}