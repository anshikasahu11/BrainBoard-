// The BrainBoard AI orb. Purely decorative, so it's hidden from screen readers.
// size: optional CSS width, e.g. "96px". Default is responsive (170px to 280px).
// dots: show the "thinking" dots underneath.
export default function Orb({ className = "", size, dots = true }) {
  return (
    <div className={`flex flex-col items-center ${className}`} aria-hidden="true">
      <div className="orb" style={size ? { width: size } : undefined}>
        <div className="orb-glow" />
        <div className="orb-core" />
        <div className="orb-ring" />
      </div>

      {dots && (
        <div className="orb-dots">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}