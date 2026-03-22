import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";

interface DriverRow {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  isActive: boolean;
  driverApprovalStatus?: "pending" | "approved" | "rejected";
  driverVerificationStatus?: "pending" | "approved" | "rejected";
  driverPerformanceScore?: number;
}

const card = (i: number) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06 },
});

const AdminDrivers = () => {
  const toast = useAppToast();
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [rides, setRides] = useState<RideDto[]>([]);
  const [updatingDriverId, setUpdatingDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifications, setVerifications] = useState<Array<{ id: string; driverId: string | null; status: "pending" | "approved" | "rejected"; reviewNotes: string; documents: Array<{ type: string; url: string; fileName: string }> }>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, ridesResponse, verificationsResponse] = await Promise.all([
        apiClient.users.list("driver") as Promise<{ users: DriverRow[] }>,
        apiClient.admin.rides(),
        apiClient.admin.verifications(),
      ]);

      setDrivers(usersResponse.users || []);
      setRides(ridesResponse.rides || []);
      setVerifications(verificationsResponse.verifications || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await loadData();
        if (!mounted) return;
      } catch (error) {
        if (!mounted) return;
        toast.error("Unable to load drivers", error, "Please refresh and try again.");
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [loadData, toast]);

  const updateDriverApproval = async (driverId: string, status: "approved" | "rejected") => {
    setUpdatingDriverId(driverId);
    try {
      const verification = verifications.find((item) => item.driverId === driverId);
      if (verification) {
        await apiClient.admin.reviewVerification(verification.id, { status });
      } else {
        await apiClient.admin.updateUser(driverId, {
          driverApprovalStatus: status,
          driverVerificationStatus: status,
        });
      }
      await loadData();
      toast.success(
        status === "approved" ? "Driver approved" : "Driver rejected",
        status === "approved" ? "This driver can now sign in." : "Driver account access remains blocked.",
      );
    } catch (error) {
      toast.error("Could not update driver status", error);
    } finally {
      setUpdatingDriverId(null);
    }
  };

  const ridesByDriver = useMemo(() => {
    const map = new Map<string, number>();
    rides.forEach((ride) => {
      if (!ride.driverId) return;
      map.set(ride.driverId, (map.get(ride.driverId) || 0) + 1);
    });
    return map;
  }, [rides]);

  const online = drivers.filter((d) => d.isOnline && d.driverApprovalStatus === "approved").length;
  const onRide = rides.filter((r) => ["accepted", "in_progress", "ongoing"].includes(r.status) && !!r.driverId).length;
  const verificationByDriver = useMemo(() => {
    const map = new Map<string, { id: string; status: "pending" | "approved" | "rejected"; reviewNotes: string; documents: Array<{ type: string; url: string; fileName: string }> }>();
    verifications.forEach((verification) => {
      if (verification.driverId) {
        map.set(verification.driverId, {
          id: verification.id,
          status: verification.status,
          reviewNotes: verification.reviewNotes,
          documents: verification.documents || [],
        });
      }
    });
    return map;
  }, [verifications]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display mb-1">Driver Management</h1>
        <p className="text-sm text-muted-foreground">{loading ? "Loading drivers..." : `${drivers.length} registered drivers`}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Online", value: online, color: "text-green-400" },
          { label: "On Ride", value: onRide, color: "text-primary" },
          { label: "Offline", value: Math.max(drivers.length - online, 0), color: "text-muted-foreground" },
        ].map((s, i) => (
          <motion.div key={s.label} {...card(i)} className="card-glass text-center">
            <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((driver, i) => {
          const verification = verificationByDriver.get(driver.id);
          return (
            <motion.div key={driver.id} {...card(i + 3)} className="card-glass max-w-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {driver.name?.charAt(0) || "D"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{driver.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{driver.email}</p>
                </div>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${
                driver.isOnline ? "bg-green-400" : "bg-muted-foreground"
              }`} />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="font-bold text-sm">{ridesByDriver.get(driver.id) || 0}</p>
                <p className="text-[10px] text-muted-foreground">Rides</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="font-bold text-sm capitalize">{driver.driverApprovalStatus || "pending"}</p>
                <p className="text-[10px] text-muted-foreground">Approval</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <p className="font-bold text-sm capitalize">{driver.driverVerificationStatus || verification?.status || "pending"}</p>
                <p className="text-[10px] text-muted-foreground">Verification</p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mb-2">Performance: {driver.driverPerformanceScore || 60}</p>

            {verification && verification.documents.length > 0 && (
              <div className="mb-3 space-y-1">
                {verification.documents.slice(-3).map((document) => (
                  <a key={`${verification.id}-${document.type}-${document.fileName}`} href={document.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline block truncate">
                    {document.type}: {document.fileName}
                  </a>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-3 h-3" /> Driver
              </span>
              <span className={`font-semibold ${driver.isActive ? "text-green-400" : "text-destructive"}`}>{driver.isActive ? "active" : "inactive"}</span>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={() => updateDriverApproval(driver.id, "approved")}
                disabled={updatingDriverId === driver.id || driver.driverApprovalStatus === "approved"}
                className="w-full flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-60"
              >
                {updatingDriverId === driver.id ? "Updating..." : "Approve"}
              </button>
              <button
                onClick={() => updateDriverApproval(driver.id, "rejected")}
                disabled={updatingDriverId === driver.id || driver.driverApprovalStatus === "rejected"}
                className="w-full flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-destructive/20 text-destructive hover:bg-destructive/30 disabled:opacity-60"
              >
                {updatingDriverId === driver.id ? "Updating..." : "Reject"}
              </button>
            </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDrivers;
