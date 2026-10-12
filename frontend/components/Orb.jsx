// The BrainBoard AI orb. Purely decorative, so it's hidden from screen readers.
export default function Orb({ className = "" }) {
  return (
    <div className={`flex flex-col items-center ${className}`} aria-hidden="true">
      <div className="orb">
        <div className="orb-glow" />
        <div className="orb-core" />
        <div className="orb-ring" />
      </div>

      <div className="orb-dots">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}