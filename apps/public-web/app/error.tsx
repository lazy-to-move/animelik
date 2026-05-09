"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("public-web route error", error);
  }, [error]);

  return (
    <main className="section">
      <div className="container state-shell">
        <div className="state-card">
          <div className="eyebrow">Temporary Error</div>
          <h1>The public frontend hit a runtime error.</h1>
          <p className="muted">
            This usually means the migration frontend could not complete a request against the legacy content API or an
            unexpected response shape reached the route.
          </p>
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
