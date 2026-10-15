// Shown while we check the stored token, or while a redirect is happening.
export default function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-live="polite">
      <span className="loader-orb" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}