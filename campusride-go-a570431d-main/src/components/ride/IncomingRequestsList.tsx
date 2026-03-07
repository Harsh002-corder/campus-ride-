import { motion } from "framer-motion";
import { MapPin, Users } from "lucide-react";
import { type RideDto } from "@/lib/apiClient";

type IncomingRequestsListProps = {
  rides: RideDto[];
  busy: boolean;
  card: (index: number) => {
    initial: { opacity: number; y: number };
    animate: { opacity: number; y: number };
    transition: { delay: number };
  };
  onAccept: (rideId: string) => void;
  onDecline: (rideId: string) => void;
};

export default function IncomingRequestsList({
  rides,
  busy,
  card,
  onAccept,
  onDecline,
}: IncomingRequestsListProps) {
  return (
    <div className="space-y-3">
      {rides.length === 0 && <div className="card-glass text-sm text-muted-foreground">No incoming requests</div>}
      {rides.map((req, i) => (
        <motion.div key={req.id} {...card(i + 5)} className="card-glass">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium text-sm">{req.student?.name || `Student #${req.studentId?.slice(-6) || "N/A"}`}</p>
              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {req.passengers || 1}
              </p>
            </div>
            <p className="font-bold text-sm">-</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <MapPin className="w-3 h-3 text-green-400" />
            <span>{req.pickup?.label || "-"}</span>
            <span>{"->"}</span>
            <MapPin className="w-3 h-3 text-primary" />
            <span>{req.drop?.label || "-"}</span>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => onAccept(req.id)} className="flex-1 btn-primary-gradient py-2 rounded-xl text-xs font-semibold">Accept Ride</motion.button>
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => onDecline(req.id)} className="flex-1 bg-muted/50 hover:bg-muted py-2 rounded-xl text-xs font-medium text-muted-foreground transition-colors">Ignore</motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
