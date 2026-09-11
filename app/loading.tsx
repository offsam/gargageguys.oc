export default function Loading() {
  return (
    <div className="bos-route-loading" role="status" aria-live="polite" aria-label="Loading">
      <div className="bos-route-loading-bar" />
      <div className="bos-route-loading-body">
        <div className="bos-route-loading-spinner" />
        <p>Loading…</p>
      </div>
    </div>
  );
}
