export default function OfflineFallback() {
  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card/80 p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">You are offline</h2>
        <p className="text-sm text-muted-foreground">
          CampusRide is showing cached content. Reconnect to fetch live rides and sync updates.
        </p>
      </div>
    </div>
  );
}
