import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { CAMPUS_BOUNDARY_POLYGON, CAMPUS_MAP_CENTER, isWithinCampusBoundary, TMU_MAIN_GATE } from "@/lib/campusBoundary";

type SelectedPoint = { lat: number; lng: number; label: string } | null;

type Props = {
  pickupPoint: SelectedPoint;
  dropPoint: SelectedPoint;
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void | Promise<void>;
  onBoundaryViolation?: () => void;
};

function ClickHandler({
  selectionTarget,
  onSelectPoint,
  onBoundaryViolation,
}: {
  selectionTarget: "pickup" | "drop";
  onSelectPoint: (point: { lat: number; lng: number }, target: "pickup" | "drop") => void | Promise<void>;
  onBoundaryViolation?: () => void;
}) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      const { lat, lng } = event.latlng;
      if (!isWithinCampusBoundary({ lat, lng })) {
        onBoundaryViolation?.();
        return;
      }
      void onSelectPoint({ lat, lng }, selectionTarget);
    },
  });

  return null;
}

function FitToSelectionBoundary({ boundary }: { boundary: [number, number][] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!boundary || boundary.length < 3) return;
    map.fitBounds(boundary, { padding: [18, 18] });
  }, [map, boundary]);

  return null;
}

export default function TMUCampusLeafletMap({
  pickupPoint,
  dropPoint,
  selectionTarget,
  onSelectPoint,
  onBoundaryViolation,
}: Props) {
  const campusBoundary = CAMPUS_BOUNDARY_POLYGON.map((point) => [point.lat, point.lng] as [number, number]);

  return (
    <MapContainer
      center={[CAMPUS_MAP_CENTER.lat, CAMPUS_MAP_CENTER.lng]}
      zoom={16}
      className="w-full h-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler
        selectionTarget={selectionTarget}
        onSelectPoint={onSelectPoint}
        onBoundaryViolation={onBoundaryViolation}
      />
      <FitToSelectionBoundary boundary={campusBoundary} />

      <Polygon
        positions={campusBoundary}
        pathOptions={{
          color: "#f97316",
          weight: 2,
          fillColor: "#fb923c",
          fillOpacity: 0.08,
          dashArray: "6 6",
        }}
      />

      <Marker position={[TMU_MAIN_GATE.lat, TMU_MAIN_GATE.lng]}>
        <Popup>TMU Main Gate</Popup>
      </Marker>

      {pickupPoint && (
        <CircleMarker
          center={[pickupPoint.lat, pickupPoint.lng]}
          radius={8}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.8 }}
        >
          <Popup>Pickup: {pickupPoint.label}</Popup>
        </CircleMarker>
      )}

      {dropPoint && (
        <CircleMarker
          center={[dropPoint.lat, dropPoint.lng]}
          radius={8}
          pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.8 }}
        >
          <Popup>Drop: {dropPoint.label}</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
