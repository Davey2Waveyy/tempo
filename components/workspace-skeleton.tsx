export function WorkspaceSkeleton({ view }: { view: string }) {
  return (
    <output
      className="workspace-loading"
      aria-label={`Loading ${view.toLowerCase()}`}
    >
      <span className="sr-only">Loading {view.toLowerCase()}…</span>
      <div className="workspace-skeleton" aria-hidden="true">
        {(view === 'Overview' || view === 'Time tracker') && (
          <div className="skeleton-block skeleton-timer" />
        )}
        <div className="skeleton-summary">
          {Array.from({ length: view === 'Projects' ? 3 : 4 }, (_, i) => (
            <div
              className={`panel ${view === 'Projects' ? 'skeleton-project' : ''}`}
              key={i}
            >
              <div className="skeleton-block skeleton-label" />
              <div className="skeleton-block skeleton-value" />
            </div>
          ))}
        </div>
        {view !== 'Projects' && (
          <div className="panel">
            <div className="skeleton-block skeleton-label" />
            {Array.from({ length: 5 }, (_, i) => (
              <div className="skeleton-block skeleton-row" key={i} />
            ))}
          </div>
        )}
      </div>
    </output>
  );
}
