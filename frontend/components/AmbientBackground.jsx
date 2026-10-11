// Fixed full-screen lighting layer. Sits behind all page content.
export default function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ribbon ribbon-key" />
      <div className="ribbon ribbon-teal" />
      <div className="ribbon ribbon-heat" />
      <div className="grain" />
    </div>
  );
}