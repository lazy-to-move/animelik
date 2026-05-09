export default function Loading() {
  return (
    <main className="section">
      <div className="container state-shell">
        <div className="state-card">
          <div className="eyebrow">Loading</div>
          <h1>Preparing the public catalog...</h1>
          <p className="muted">
            The Next.js migration frontend is fetching live catalog data from the legacy content API.
          </p>
        </div>
      </div>
    </main>
  );
}
