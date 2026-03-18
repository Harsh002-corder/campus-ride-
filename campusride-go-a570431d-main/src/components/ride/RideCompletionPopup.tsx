import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, Clock, Navigation, X, Send, CheckCircle, Users } from "lucide-react";

interface RideCompletionPopupProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, message: string) => Promise<void>;
  submitting?: boolean;
  allowClose?: boolean;
  ride: {
    from: string;
    to: string;
    fare: string;
    duration: string;
    distance: string;
    driverName: string;
    driverPhone?: string;
    passengers?: number;
  };
}

const RideCompletionPopup = ({ open, onClose, onSubmit, submitting = false, allowClose = true, ride }: RideCompletionPopupProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    await onSubmit(rating, message);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setRating(0);
      setMessage("");
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="card-glass border border-border w-full max-w-md relative overflow-hidden"
          >
            {/* Close button */}
            {allowClose && (
              <button
                onClick={onClose}
                title="Close"
                aria-label="Close"
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {submitted ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 rounded-2xl btn-primary-gradient flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold font-display mb-1">Thank you!</h3>
                <p className="text-sm text-muted-foreground">Your feedback has been submitted</p>
              </motion.div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-2xl btn-primary-gradient flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Ride Completed! 🎉</h3>
                  <p className="text-sm text-muted-foreground mt-1">How was your experience?</p>
                  {!allowClose && <p className="text-xs text-primary mt-1">Rating is required to close this popup.</p>}
                </div>

                {/* Ride Info */}
                <div className="bg-muted/30 rounded-xl p-4 mb-5 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium text-foreground">{ride.from}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-medium text-foreground">{ride.to}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" /> {ride.duration}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" /> {ride.distance}
                    </div>
                    <span className="ml-auto font-bold text-foreground">{ride.fare}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Driver: <span className="text-foreground font-medium">{ride.driverName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Driver phone: <span className="text-foreground font-medium">{ride.driverPhone || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-foreground font-medium">{ride.passengers || 1}</span>
                  </div>
                </div>

                {/* Star Rating */}
                <div className="mb-5">
                  <p className="text-sm font-medium mb-2 text-center">Rate your ride</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        whileTap={{ scale: 0.8 }}
                        whileHover={{ scale: 1.2 }}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onClick={() => setRating(star)}
                        className="p-1"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= (hoveredStar || rating)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </motion.button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-xs text-muted-foreground mt-1"
                    >
                      {rating <= 2 ? "We'll improve!" : rating <= 4 ? "Great ride!" : "Excellent! 🌟"}
                    </motion.p>
                  )}
                </div>

                {/* Message */}
                <div className="mb-5">
                  <p className="text-sm font-medium mb-2">Leave a message (optional)</p>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your experience..."
                    rows={3}
                    className="w-full bg-muted/50 border border-border rounded-xl py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  />
                </div>

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={rating === 0 || submitting}
                  className="w-full btn-primary-gradient py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Feedback"}
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RideCompletionPopup;
