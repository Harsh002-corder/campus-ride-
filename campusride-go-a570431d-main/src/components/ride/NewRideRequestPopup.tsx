import { AnimatePresence, motion } from "framer-motion";
import { type RideDto } from "@/lib/apiClient";
import { Users } from "lucide-react";

type NewRideRequestPopupProps = {
  ride: RideDto | null;
  busy: boolean;
  busyLabel?: string;
  onAccept: (rideId: string) => void;
  onIgnore: () => void;
};

export default function NewRideRequestPopup({
  ride,
  busy,
  busyLabel,
  onAccept,
  onIgnore,
}: NewRideRequestPopupProps) {
  const studentName = ride?.student?.name || `Student #${ride?.studentId?.slice(-6) || "N/A"}`;

  return (
    <AnimatePresence>
      {ride && (
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 bottom-0 z-50 w-full rounded-t-2xl border border-primary/40 border-b-0 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-auto sm:top-20 sm:right-4 sm:w-[min(92vw,380px)] sm:rounded-2xl sm:border-b"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-primary font-semibold">New Ride Request</p>
              <p className="text-sm font-medium truncate">{studentName}</p>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onIgnore}
            >
              Deny
            </button>
          </div>

          <p className="text-xs text-muted-foreground mb-1 break-words">
            Pickup: {ride.pickup?.label || "-"}
          </p>
          <p className="text-xs text-muted-foreground mb-1 break-words">
            Destination: {ride.drop?.label || "-"}
          </p>
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {ride.passengers || 1} passenger(s)
          </p>

          {["pending", "requested"].includes(ride.status) && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(ride.id)}
                className="flex-1 btn-primary-gradient py-2 rounded-xl text-xs font-semibold"
              >
                {busyLabel === "Accepting..." ? "Accepting..." : "Accept"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onIgnore}
                className="flex-1 bg-muted/50 hover:bg-muted py-2 rounded-xl text-xs font-medium text-muted-foreground transition-colors"
              >
                {busyLabel === "Denying..." ? "Denying..." : "Deny"}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
