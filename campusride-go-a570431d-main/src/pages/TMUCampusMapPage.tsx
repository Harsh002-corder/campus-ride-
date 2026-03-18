import { useState } from "react";
import TMUCampusLeafletMap from "@/components/map/TMUCampusLeafletMap";

type SelectedPoint = { lat: number; lng: number; label: string } | null;

const formatPinnedLabel = (lat: number, lng: number) => `Pinned ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export default function TMUCampusMapPage() {
  const [pickupPoint, setPickupPoint] = useState<SelectedPoint>(null);
  const [dropPoint, setDropPoint] = useState<SelectedPoint>(null);
  const [selectionTarget, setSelectionTarget] = useState<"pickup" | "drop">("pickup");

  const handleSelectPoint = (point: { lat: number; lng: number }, target: "pickup" | "drop") => {
    const label = formatPinnedLabel(point.lat, point.lng);

    if (target === "pickup") {
      setPickupPoint({ lat: point.lat, lng: point.lng, label });
      setSelectionTarget("drop");
      return;
    }

    setDropPoint({ lat: point.lat, lng: point.lng, label });
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <section className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Campus Map</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectionTarget("pickup")}
              className={`px-3 py-1.5 rounded-lg text-sm ${selectionTarget === "pickup" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              Pickup
            </button>
            <button
              type="button"
              onClick={() => setSelectionTarget("drop")}
              className={`px-3 py-1.5 rounded-lg text-sm ${selectionTarget === "drop" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              Drop-off
            </button>
          </div>
        </div>

        <div className="h-[60vh] min-h-[360px] rounded-xl overflow-hidden border border-border">
          <TMUCampusLeafletMap
            pickupPoint={pickupPoint}
            dropPoint={dropPoint}
            selectionTarget={selectionTarget}
            onSelectPoint={handleSelectPoint}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Selected: P {pickupPoint?.label || "-"} | D {dropPoint?.label || "-"}
        </p>
      </section>
    </main>
  );
}
