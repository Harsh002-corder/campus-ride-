import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import BrandIcon from "@/components/BrandIcon";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { ArrowLeft, Download } from "lucide-react";

const RideDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ride, setRide] = useState<RideDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRide = async () => {
      if (!id) {
        setError("Ride ID missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await apiClient.rides.get(id);
        setRide(response.ride || null);
        setError(response.ride ? "" : "Ride not found.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load ride details.");
      } finally {
        setLoading(false);
      }
    };

    void loadRide();
  }, [id]);

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

  const detailRows = useMemo(() => {
    if (!ride) return [] as Array<{ label: string; value: string }>;
    return [
      { label: "Ride ID", value: ride.id },
      { label: "Status", value: ride.status.replace(/_/g, " ") },
      { label: "Pickup", value: ride.pickup?.label || "-" },
      { label: "Drop", value: ride.drop?.label || "-" },
      { label: "Scheduled For", value: formatDate(ride.scheduledFor) },
      { label: "Requested At", value: formatDate(ride.requestedAt) },
      { label: "Accepted At", value: formatDate(ride.acceptedAt) },
      { label: "Ride Started", value: formatDate(ride.ongoingAt) },
      { label: "Completed At", value: formatDate(ride.completedAt) },
      { label: "Cancelled At", value: formatDate(ride.cancelledAt) },
      { label: "Passengers", value: String(ride.passengers || 1) },
      { label: "Passenger Names", value: ride.passengerNames?.length ? ride.passengerNames.join(", ") : "-" },
      { label: "Driver", value: ride.driver?.name || "Not assigned" },
      { label: "Driver Phone", value: ride.driver?.phone || "-" },
      { label: "Student", value: ride.student?.name || "-" },
      { label: "Student Phone", value: ride.student?.phone || "-" },
      { label: "ETA", value: typeof ride.etaMinutes === "number" ? `${ride.etaMinutes} min` : "-" },
      { label: "Distance", value: typeof ride.etaDistanceKm === "number" ? `${ride.etaDistanceKm.toFixed(2)} km` : "-" },
      { label: "Total Fare", value: ride.fareBreakdown?.totalFare != null ? `Rs ${ride.fareBreakdown.totalFare}` : "-" },
      { label: "Per Passenger Fare", value: ride.fareBreakdown?.perPassengerFare != null ? `Rs ${ride.fareBreakdown.perPassengerFare}` : "-" },
      { label: "Platform Fee", value: ride.fareBreakdown?.platformFee != null ? `Rs ${ride.fareBreakdown.platformFee}` : "-" },
      { label: "Cancellation Reason", value: ride.cancellationCustomReason || ride.cancelReason || "-" },
      { label: "Verification Code", value: ride.verificationCode || "-" },
      { label: "Tracking Link", value: ride.shareTrackingUrl || "-" },
      { label: "Rating", value: ride.studentRating != null ? `${ride.studentRating}/5` : "-" },
      { label: "Feedback", value: ride.studentFeedback || "-" },
    ];
  }, [ride]);

  const handleDownloadInvoice = async () => {
    if (!ride) return;
    setDownloading(true);
    try {
      const blob = await apiClient.rides.downloadInvoice(ride.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `campusride-invoice-${ride.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" />
        <div className="relative z-10">
          <nav className="glass py-4 px-3 sm:px-6 sticky top-0 z-20">
            <div className="container mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors" title="Back">
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <a href="/" className="flex items-center gap-2">
                  <BrandIcon className="w-9 h-9" />
                  <span className="text-base sm:text-xl font-bold font-display">
                    Campus<span className="gradient-text">Ride</span>
                  </span>
                </a>
              </div>
              {ride && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => void handleDownloadInvoice()}
                  disabled={downloading}
                  className="btn-primary-gradient px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 disabled:opacity-70"
                >
                  <Download className="w-4 h-4" /> {downloading ? "Downloading..." : "Download Invoice"}
                </motion.button>
              )}
            </div>
          </nav>

          <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8">
            {loading ? (
              <div className="card-glass text-sm text-muted-foreground">Loading ride details...</div>
            ) : error ? (
              <div className="card-glass text-sm text-destructive">{error}</div>
            ) : ride ? (
              <div className="space-y-4">
                <div className="card-glass">
                  <h1 className="text-2xl font-bold font-display">Ride Details</h1>
                  <p className="text-sm text-muted-foreground mt-1">Complete information for ride {ride.id}</p>
                </div>

                {ride.timeline && ride.timeline.length > 0 && (
                  <div className="card-glass">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Timeline</p>
                    <div className="space-y-2">
                      {ride.timeline.map((step) => (
                        <div key={`${step.key}-${step.timestamp || "-"}`} className="flex items-center justify-between text-sm">
                          <span className={step.reached ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                          <span className="text-muted-foreground">{formatDate(step.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {detailRows.map((row) => (
                    <div key={row.label} className="card-glass">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
                      <p className="text-sm text-foreground break-words">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default RideDetails;
