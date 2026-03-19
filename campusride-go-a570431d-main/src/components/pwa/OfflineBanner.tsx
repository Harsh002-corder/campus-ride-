import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-xs font-medium text-amber-100 backdrop-blur">
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-4 w-4" /> You are offline. Showing cached CampusRide data.
      </span>
    </div>
  );
}
