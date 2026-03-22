import { motion } from "framer-motion";
import { CheckCircle, LocateFixed, Map, MessageCircle, Phone, Play, Users, XCircle } from "lucide-react";
import type { RideDto } from "@/lib/apiClient";

type RideCardProps = {
  ride: RideDto;
  busy: boolean;
  isActive: boolean;
  queuePosition: number;
  isLatest?: boolean;
  actionLabel?: string;
  onArrive: (rideId: string) => void;
  onStart: (rideId: string) => void;
  onCancel: (rideId: string) => void;
  onComplete: (rideId: string) => void;
  onTrack: (rideId: string) => void;
};

const toPhoneDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

export default function RideCard({
  ride,
  busy,
  isActive,
  queuePosition,
  isLatest,
  actionLabel,
  onArrive,
  onStart,
  onCancel,
  onComplete,
  onTrack,
}: RideCardProps) {
  const activeContactName = ride?.student?.name || "Student";
  const activeContactPhoneRaw = ride?.student?.phone || "+91 90000 00000";
  const activeContactPhoneDigits = toPhoneDigits(activeContactPhoneRaw);
  const canContactActiveStudent = activeContactPhoneDigits.length >= 10;
  const activeCallHref = canContactActiveStudent ? `tel:${activeContactPhoneDigits}` : undefined;
  const activeChatHref = canContactActiveStudent
    ? `sms:${activeContactPhoneDigits}?body=${encodeURIComponent(`Hi ${activeContactName}, I am your driver for this ride.`)}`
    : undefined;

  const isInProgress = ["in_progress", "ongoing"].includes(ride.status);
  const canArrive = ride.status === "accepted";
  const isStarting = actionLabel === "Starting...";
  const isArriving = actionLabel === "Arriving...";
  const isCompleting = actionLabel === "Completing...";
  const isCancelling = actionLabel === "Cancelling...";
  const createdAtText = new Date(ride.createdAt).toLocaleString();
  const shouldShowVerificationCode = ["accepted", "in_progress", "ongoing"].includes(ride.status) && Boolean(ride.verificationCode);

  return (
    <motion.div className={`card-glass border w-full max-w-full md:max-w-3xl md:mx-auto ${isActive ? "border-primary/30" : "border-border/50"}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl btn-primary-gradient flex items-center justify-center">
            <Map className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm break-words">
              {isActive ? `Active #${queuePosition}` : `Queued #${queuePosition}`} - {ride.pickup?.label || "-"} {"->"} {ride.drop?.label || "-"}
            </p>
            {isLatest && <p className="text-[11px] text-primary font-semibold">Latest ride</p>}
            <p className="text-xs text-muted-foreground">Status: {ride.status}</p>
            <p className="text-xs text-muted-foreground truncate">Student: {activeContactName}</p>
            <p className="text-xs text-muted-foreground">Requested: {createdAtText}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {ride.passengers || 1}</p>
          </div>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onTrack(ride.id)} className="btn-primary-gradient px-3 py-2 rounded-lg text-xs font-semibold w-full sm:w-auto">Track Ride</motion.button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        {activeCallHref ? (
          <a href={activeCallHref} className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-10">
            <Phone className="w-3.5 h-3.5" /> Call Student
          </a>
        ) : (
          <button type="button" disabled className="flex-1 bg-muted/50 text-muted-foreground py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed min-h-10">
            <Phone className="w-3.5 h-3.5" /> Call Student
          </button>
        )}

        {activeChatHref ? (
          <a href={activeChatHref} className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-10">
            <MessageCircle className="w-3.5 h-3.5" /> Chat Student
          </a>
        ) : (
          <button type="button" disabled className="flex-1 bg-muted/50 text-muted-foreground py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed min-h-10">
            <MessageCircle className="w-3.5 h-3.5" /> Chat Student
          </button>
        )}
      </div>

      {shouldShowVerificationCode && (
        <div className="mb-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
          <p className="text-[11px] text-primary/90">Verification Code</p>
          <p className="text-sm font-bold tracking-widest text-primary">{ride.verificationCode}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onArrive(ride.id)}
          disabled={busy || !canArrive}
          className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 min-h-10"
        >
          <LocateFixed className="w-3.5 h-3.5" /> {isArriving ? "Arriving..." : "Mark Arrived"}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onStart(ride.id)}
          disabled={busy || ride.status !== "accepted"}
          className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 min-h-10"
        >
          <Play className="w-3.5 h-3.5" /> {isStarting ? "Starting..." : "Start Ride"}
        </motion.button>

        {isInProgress && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onComplete(ride.id)} disabled={busy} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-10">
            <CheckCircle className="w-3.5 h-3.5" /> {isCompleting ? "Completing..." : "Complete Ride"}
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onCancel(ride.id)}
          disabled={busy || !["accepted", "in_progress", "ongoing"].includes(ride.status)}
          className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 min-h-10"
        >
          <XCircle className="w-3.5 h-3.5" /> {isCancelling ? "Cancelling..." : "Cancel Ride"}
        </motion.button>
      </div>
    </motion.div>
  );
}
