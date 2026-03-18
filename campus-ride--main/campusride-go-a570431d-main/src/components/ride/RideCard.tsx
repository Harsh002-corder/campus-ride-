import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Map, MessageCircle, Phone, Play, Users, XCircle } from "lucide-react";
import type { RideDto } from "@/lib/apiClient";

type CancellationReason = {
  key: string;
  label: string;
};

type RideCardProps = {
  ride: RideDto;
  busy: boolean;
  isActive: boolean;
  queuePosition: number;
  isLatest?: boolean;
  actionLabel?: string;
  cancelReasonKey: string;
  cancelCustomReason: string;
  cancellationReasons: CancellationReason[];
  onCancelReasonKeyChange: (rideId: string, reasonKey: string) => void;
  onCancelCustomReasonChange: (rideId: string, customReason: string) => void;
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
  cancelReasonKey,
  cancelCustomReason,
  cancellationReasons,
  onCancelReasonKeyChange,
  onCancelCustomReasonChange,
  onStart,
  onCancel,
  onComplete,
  onTrack,
}: RideCardProps) {
  const [completeBurst, setCompleteBurst] = useState(false);

  const tapSoft = {
    whileTap: { scale: 0.97 },
    transition: { duration: 0.12 },
  };

  const activeContactName = ride?.student?.name || "Student";
  const activeContactPhoneRaw = ride?.student?.phone || "+91 90000 00000";
  const activeContactPhoneDigits = toPhoneDigits(activeContactPhoneRaw);
  const canContactActiveStudent = activeContactPhoneDigits.length >= 10;
  const activeCallHref = canContactActiveStudent ? `tel:${activeContactPhoneDigits}` : undefined;
  const activeChatHref = canContactActiveStudent
    ? `sms:${activeContactPhoneDigits}?body=${encodeURIComponent(`Hi ${activeContactName}, I am your driver for this ride.`)}`
    : undefined;

  const isInProgress = ["in_progress", "ongoing"].includes(ride.status);
  const isStarting = actionLabel === "Starting...";
  const isCompleting = actionLabel === "Completing...";
  const isCancelling = actionLabel === "Cancelling...";
  const createdAtText = new Date(ride.createdAt).toLocaleString();
  const shouldShowVerificationCode = ["accepted", "in_progress", "ongoing"].includes(ride.status) && Boolean(ride.verificationCode);

  useEffect(() => {
    if (!isCompleting) {
      setCompleteBurst(false);
    }
  }, [isCompleting]);

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.004 }}
      transition={{ duration: 0.18 }}
      className={`card-glass border relative overflow-hidden ${isActive ? "border-primary/30" : "border-border/50"}`}
    >
      {busy && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 left-0 w-20 rounded-full bg-white/10 blur-md"
          animate={{ x: ["-140%", "280%"] }}
          transition={{ duration: 1.05, repeat: Infinity, ease: "linear" }}
        />
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl btn-primary-gradient flex items-center justify-center">
            <Map className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {isActive ? `Active #${queuePosition}` : `Queued #${queuePosition}`} - {ride.pickup?.label || "-"} {"->"} {ride.drop?.label || "-"}
            </p>
            {isLatest && <p className="text-[11px] text-primary font-semibold">Latest ride</p>}
            <p className="text-xs text-muted-foreground">Status: {ride.status}</p>
            <p className="text-xs text-muted-foreground">Student: {activeContactName}</p>
            <p className="text-xs text-muted-foreground">Requested: {createdAtText}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {ride.passengers || 1}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <motion.button
            {...tapSoft}
            whileHover={{ y: -1 }}
            animate={{ boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 8px 20px rgba(59,130,246,0.18)", "0 0 0 rgba(0,0,0,0)"] }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            onClick={() => onTrack(ride.id)}
            className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <motion.span animate={{ x: [0, 2, 0] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}>
              <Map className="w-3.5 h-3.5 text-primary-foreground" />
            </motion.span>
            Track Ride
          </motion.button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        {activeCallHref ? (
          <motion.a
            {...tapSoft}
            whileHover={{ y: -1 }}
            href={activeCallHref}
            className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <motion.span whileHover={{ rotate: [-6, 6, 0] }} transition={{ duration: 0.25 }}>
              <Phone className="w-3.5 h-3.5" />
            </motion.span>
            Call Student
          </motion.a>
        ) : (
          <button type="button" disabled className="flex-1 bg-muted/50 text-muted-foreground py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
            <Phone className="w-3.5 h-3.5" /> Call Student
          </button>
        )}

        {activeChatHref ? (
          <motion.a
            {...tapSoft}
            whileHover={{ y: -1 }}
            href={activeChatHref}
            className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <motion.span whileHover={{ scale: 1.08 }} transition={{ duration: 0.2 }}>
              <MessageCircle className="w-3.5 h-3.5" />
            </motion.span>
            Chat Student
          </motion.a>
        ) : (
          <button type="button" disabled className="flex-1 bg-muted/50 text-muted-foreground py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
            <MessageCircle className="w-3.5 h-3.5" /> Chat Student
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <select
          title="Cancellation reason"
          value={cancelReasonKey}
          onChange={(event) => onCancelReasonKeyChange(ride.id, event.target.value)}
          className="bg-muted/50 border border-border rounded-xl py-2 px-2 text-xs"
        >
          {cancellationReasons.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>

        {cancelReasonKey === "other" && (
          <input
            value={cancelCustomReason}
            onChange={(event) => onCancelCustomReasonChange(ride.id, event.target.value)}
            placeholder="Custom reason"
            className="bg-muted/50 border border-border rounded-xl py-2 px-2 text-xs"
          />
        )}
      </div>

      {shouldShowVerificationCode && (
        <div className="mb-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
          <p className="text-[11px] text-primary/90">Verification Code</p>
          <p className="text-sm font-bold tracking-widest text-primary">{ride.verificationCode}</p>
        </div>
      )}

      <div className="flex gap-2">
        <motion.button
          {...tapSoft}
          whileHover={{ y: -1 }}
          onClick={() => onStart(ride.id)}
          disabled={busy || ride.status !== "accepted"}
          className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <motion.span animate={isStarting ? { x: [0, 2, 0] } : { x: 0 }} transition={isStarting ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}>
            <Play className="w-3.5 h-3.5" />
          </motion.span>
          {isStarting ? "Starting..." : "Start Ride"}
        </motion.button>

        {isInProgress && (
          <motion.button
            {...tapSoft}
            whileHover={{ y: -1 }}
            onClick={() => {
              setCompleteBurst(true);
              window.setTimeout(() => setCompleteBurst(false), 620);
              onComplete(ride.id);
            }}
            disabled={busy}
            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors relative overflow-hidden"
          >
            <motion.span animate={isCompleting ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={isCompleting ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}>
              <CheckCircle className="w-3.5 h-3.5" />
            </motion.span>
            {isCompleting ? "Completing..." : "Complete Ride"}
            {completeBurst && (
              <span className="pointer-events-none absolute inset-0">
                {[0, 1, 2, 3, 4, 5].map((p) => (
                  <motion.span
                    key={`complete-burst-${ride.id}-${p}`}
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-green-300"
                    initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
                    animate={{
                      x: [0, -16, 14, -10, 18, -14][p],
                      y: [0, -14, -16, 16, 12, 8][p],
                      opacity: 0,
                      scale: 0.4,
                    }}
                    transition={{ duration: 0.56, ease: "easeOut" }}
                  />
                ))}
              </span>
            )}
          </motion.button>
        )}

        <motion.button
          {...tapSoft}
          whileHover={{ y: -1 }}
          onClick={() => onCancel(ride.id)}
          disabled={busy || !["accepted", "in_progress", "ongoing"].includes(ride.status)}
          className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <motion.span animate={isCancelling ? { rotate: [-8, 8, 0] } : { rotate: 0 }} transition={isCancelling ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}>
            <XCircle className="w-3.5 h-3.5" />
          </motion.span>
          {isCancelling ? "Cancelling..." : "Cancel Ride"}
        </motion.button>
      </div>
    </motion.div>
  );
}

export function RideCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card-glass border border-border/40"
    >
      <div className="space-y-3">
        <motion.div className="h-4 w-2/3 rounded bg-muted/60" animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="h-3 w-1/2 rounded bg-muted/50" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.08 }} />
        <div className="grid grid-cols-2 gap-2">
          <motion.div className="h-8 rounded-xl bg-muted/50" animate={{ opacity: [0.3, 0.55, 0.3] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.12 }} />
          <motion.div className="h-8 rounded-xl bg-muted/50" animate={{ opacity: [0.3, 0.55, 0.3] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.18 }} />
        </div>
      </div>
    </motion.div>
  );
}
