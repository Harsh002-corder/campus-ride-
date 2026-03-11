import { useEffect, useRef } from "react";
import { useAppToast } from "./use-app-toast";

/**
 * Custom hook for handling PWA updates.
 * Shows a toast notification when an update is available and reloads when the user accepts.
 */
export const usePwaUpdate = () => {
  const { toast } = useAppToast();
  const updateCheckInProgressRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleUpdateAvailable = () => {
      if (updateCheckInProgressRef.current) return;
      updateCheckInProgressRef.current = true;

      toast({
        title: "Update Available",
        description: "Campus Ride has been updated. Click refresh to get the latest version.",
        action: {
          label: "Refresh",
          onClick: () => {
            window.location.reload();
          },
        },
        duration: 0, // Keep toast visible until user interacts
        className: "border-primary/30 bg-background/95 backdrop-blur-md shadow-xl",
      });
    };

    // Listen for custom update event from pwa.ts
    window.addEventListener("pwa-update-available", handleUpdateAvailable);

    return () => {
      window.removeEventListener("pwa-update-available", handleUpdateAvailable);
    };
  }, [toast]);
};
